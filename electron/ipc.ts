import { ipcMain, net, BrowserWindow, shell } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, execute } from './db-helpers';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { getSupabase } from './supabase';
import { switchDatabase, closeDatabase, getCurrentUserId, saveDb } from './database';
import * as taxService from './tax-service';
import { setBillingConfig, getBillingConfig, getBillingApiKey, clearBillingConfig } from './billing-store';
import * as billingoAdapter from './billing/billingo-adapter';
import * as szamlazzAdapter from './billing/szamlazz-adapter';
import * as billingService from './billing/billing-service';
import * as syncService from './billing/sync-service';
import { saveGoogleCredentials, getGoogleCredentials, clearGoogleCredentials, saveAccountRefreshToken, getAccountRefreshToken, removeAccountRefreshToken } from './ads-store';
import { startOAuthFlow, refreshAccessToken, listAccessibleAccounts, getAccountInfo, listMccClientAccounts } from './ads-auth';
import { syncAccount, syncAllAccounts, getSyncLog, getLastSync } from './ads-sync';
import { runAnalysis, getAnalyses, getAnalysis, getKnowledgeBase, createKnowledgeEntry, updateKnowledgeEntry, deleteKnowledgeEntry, type AnalysisType } from './ads-ai';
import { getAlerts, getAllAlerts, dismissAlert, getAlertCount } from './ads-alerts';

function sanitizeFolderName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').trim();
}

function getFilesRoot(): string {
  return path.join(app.getPath('userData'), 'Files');
}

const USER_FIELDS = 'id, name, email, invoice_platform, onboarding_complete, pomodoro_project_tracking, revenue_goal_yearly, profit_goal_yearly, company_name, tax_number, address, bank_account, team_mode, vat_status, vat_rate_default, vat_number, created_at';

/** Ensure a local user_settings row exists for a Supabase user, return it */
function ensureLocalUser(supabaseId: string, email: string, name?: string): Record<string, unknown> {
  let local = queryOne(`SELECT ${USER_FIELDS} FROM user_settings WHERE id = ?`, [supabaseId]);
  if (!local) {
    // Remove stale row if same email exists with a different (old/deleted) Supabase ID
    execute('DELETE FROM user_settings WHERE email = ? AND id != ?', [email, supabaseId]);
    execute(
      'INSERT INTO user_settings (id, name, email, password_hash, invoice_platform, onboarding_complete) VALUES (?, ?, ?, ?, ?, ?)',
      [supabaseId, name || email.split('@')[0], email, 'supabase-managed', 'none', 0]
    );
    local = queryOne(`SELECT ${USER_FIELDS} FROM user_settings WHERE id = ?`, [supabaseId]);
  }
  return local as Record<string, unknown>;
}

export function registerIpcHandlers() {
  // ============ USER / AUTH (Supabase) ============

  // Get current session user
  ipcMain.handle('db:user:get', async () => {
    try {
      const sb = getSupabase();
      const { data: { session } } = await sb.auth.getSession();
      if (!session?.user) return null;

      // Ensure database is initialized for this user
      const currentDbUser = getCurrentUserId();
      if (currentDbUser !== session.user.id) {
        await switchDatabase(session.user.id);
      }

      let local: Record<string, unknown>;
      try {
        local = ensureLocalUser(session.user.id, session.user.email ?? '');
      } catch (err: any) {
        if (err?.message?.includes('Database not initialized')) {
          await switchDatabase(session.user.id);
          local = ensureLocalUser(session.user.id, session.user.email ?? '');
        } else {
          throw err;
        }
      }

      // Keep session restore responsive; tax sync can run after the user is returned.
      setTimeout(() => {
        try { taxService.syncTaxDeadlinesToCalendar(session.user.id); } catch {}
      }, 0);

      return local;
    } catch (err) {
      console.error('[Auth] Error getting user:', err);
      return null;
    }
  });

  // Register via Supabase Auth
  ipcMain.handle('db:user:register', async (_event, data: Record<string, unknown>) => {
    const sb = getSupabase();
    const email = data.email as string;
    const { data: authData, error } = await sb.auth.signUp({
      email,
      password: data.password as string,
      options: {
        data: { name: data.name as string },
        emailRedirectTo: 'https://klient.work/confirmed',
      },
    });
    if (error) { console.error('[Auth] Register error:', error.message); throw new Error(error.message); }
    if (!authData.user) throw new Error('Regisztráció sikertelen');
    const authUser = authData.user;

    // If identities is empty, the email already exists but is unconfirmed — resend confirmation
    if (authUser.identities?.length === 0) {
      await sb.auth.resend({ type: 'signup', email, options: { emailRedirectTo: 'https://klient.work/confirmed' } });
    }

    // Initialize user-specific database
    await switchDatabase(authUser.id);

    const local = ensureLocalUser(authUser.id, authUser.email ?? '', data.name as string);
    syncService.startPolling();
    setTimeout(() => {
      try { taxService.syncTaxDeadlinesToCalendar(authUser.id); } catch {}
    }, 0);
    return local;
  });

  // Login via Supabase Auth
  ipcMain.handle('db:user:login', async (_event, data: Record<string, unknown>) => {
    const sb = getSupabase();
    const { data: authData, error } = await sb.auth.signInWithPassword({
      email: data.email as string,
      password: data.password as string,
    });
    if (error) { console.error('[Auth] Login error:', error.message); throw new Error(error.message); }
    if (!authData.user) throw new Error('Bejelentkezés sikertelen');
    const authUser = authData.user;

    // Switch to user-specific database
    await switchDatabase(authUser.id);

    const local = ensureLocalUser(authUser.id, authUser.email ?? '', authUser.user_metadata?.name as string);
    syncService.startPolling();
    setTimeout(() => {
      try { taxService.syncTaxDeadlinesToCalendar(authUser.id); } catch {}
    }, 0);
    return local;
  });

  // Logout
  ipcMain.handle('db:user:logout', async () => {
    try {
      syncService.stopPolling();
      // Close database first
      closeDatabase();

      const sb = getSupabase();
      await sb.auth.signOut();
    } catch (err) {
      console.error('[Auth] Logout error:', err);
    }
    return { success: true };
  });

  // Change password (authenticated user)
  ipcMain.handle('db:user:changePassword', async (_event, data: { currentPassword: string; newPassword: string }) => {
    const sb = getSupabase();
    // Verify current password by re-authenticating
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user?.email) throw new Error('Nincs bejelentkezve');
    const { error: verifyError } = await sb.auth.signInWithPassword({
      email: session.user.email,
      password: data.currentPassword,
    });
    if (verifyError) throw new Error('A jelenlegi jelszó helytelen');
    // Update password
    const { error } = await sb.auth.updateUser({ password: data.newPassword });
    if (error) throw new Error(error.message);
    return { success: true };
  });

  // Password reset request
  ipcMain.handle('db:user:resetPassword', async (_event, email: string) => {
    const sb = getSupabase();
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://klient.work/reset-password',
    });
    if (error) throw new Error(error.message);
    return { success: true };
  });

  // Check if user's email is confirmed by attempting login
  ipcMain.handle('db:user:checkEmailConfirmed', async (_event, data: Record<string, unknown>) => {
    const sb = getSupabase();
    const { data: authData, error } = await sb.auth.signInWithPassword({
      email: data.email as string,
      password: data.password as string,
    });
    if (error) {
      const msg = error.message.toLowerCase();
      // Supabase returns this when email isn't confirmed yet
      if (msg.includes('email not confirmed') || msg.includes('invalid login')) {
        return { confirmed: false };
      }
      throw new Error(error.message);
    }
    if (!authData.user) return { confirmed: false };

    // Login succeeded → email is confirmed, session is now active
    // Switch to user-specific database
    await switchDatabase(authData.user.id);

    const local = ensureLocalUser(authData.user.id, authData.user.email ?? '', authData.user.user_metadata?.name as string);
    return { confirmed: true, user: local };
  });

  // Google OAuth — natív PKCE loopback flow (nem Supabase-proxyn át)
  // A Google consent screen-en "Klient" és klient.work jelenik meg, nem a supabase.co URL.
  ipcMain.handle('db:user:googleAuth', async () => {
    const sb = getSupabase();
    const { startGoogleSignIn } = await import('./google-signin');

    // 1. Natív Google PKCE flow → id_token
    const { idToken } = await startGoogleSignIn();

    // 2. Supabase session id_token-ből (nem redirect, nem code exchange Supabase-en)
    const { data: authData, error } = await sb.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error || !authData.user) {
      throw new Error(error?.message || 'Supabase session létrehozása sikertelen');
    }

    const authUser = authData.user;
    await switchDatabase(authUser.id);

    const local = ensureLocalUser(
      authUser.id,
      authUser.email ?? '',
      authUser.user_metadata?.full_name || authUser.user_metadata?.name,
    );
    syncService.startPolling();
    setTimeout(() => {
      try { taxService.syncTaxDeadlinesToCalendar(authUser.id); } catch {}
    }, 0);
    return local;
  });

  // Update local user settings (non-auth fields)
  ipcMain.handle('db:user:update', (_event, id: string, data: Record<string, unknown>) => {
    const allowedFields = ['name', 'email', 'invoice_platform', 'onboarding_complete', 'pomodoro_project_tracking', 'revenue_goal_yearly', 'profit_goal_yearly', 'company_name', 'tax_number', 'address', 'bank_account', 'team_mode', 'vat_status', 'vat_rate_default', 'vat_number'];
    const filteredData: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in data) filteredData[key] = data[key];
    }
    const fields = Object.keys(filteredData).map(k => `${k} = ?`).join(', ');
    const values = Object.values(filteredData);
    if (fields) {
      execute(`UPDATE user_settings SET ${fields} WHERE id = ?`, [...values, id]);
    }
    return queryOne(`SELECT ${USER_FIELDS} FROM user_settings WHERE id = ?`, [id]);
  });

  // ============ SUBSCRIPTION ============

  // Get subscription status from Supabase (server-side source of truth)
  ipcMain.handle('db:subscription:get', async () => {
    try {
      const sb = getSupabase();
      const { data: { session } } = await sb.auth.getSession();
      if (!session?.user) return null;

      const { data, error } = await sb.from('subscriptions')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (error) {
        console.error('[Subscription] Query error:', error.message, error.code);
        return null;
      }
      if (!data) return null;

      // Check if trial has expired server-side
      if (data.status === 'trial' && data.trial_ends_at) {
        const trialEnd = new Date(data.trial_ends_at);
        if (trialEnd < new Date()) {
          // Trial expired — use RPC function (bypasses RLS which has no UPDATE policy)
          await sb.rpc('expire_subscription', { p_user_id: session.user.id });
          data.status = 'expired';
        }
      }

      // Check if paid subscription period has ended
      if ((data.status === 'active' || data.status === 'cancelled') && data.current_period_end && data.plan !== 'lifetime') {
        const periodEnd = new Date(data.current_period_end);
        if (periodEnd < new Date()) {
          await sb.rpc('expire_subscription', { p_user_id: session.user.id });
          data.status = 'expired';
        }
      }

      // Check if Ads subscription period has ended
      if ((data.ads_status === 'active' || data.ads_status === 'cancelled') && data.ads_current_period_end) {
        const adsPeriodEnd = new Date(data.ads_current_period_end);
        if (adsPeriodEnd < new Date()) {
          await sb.rpc('expire_ads_subscription', { p_user_id: session.user.id });
          data.ads_status = 'expired';
        }
      }

      return data;
    } catch (err) {
      console.error('[Subscription] Error fetching:', err);
      return null;
    }
  });

  // ── Stripe Checkout — creates session via Supabase Edge Function ──
  ipcMain.handle('db:subscription:checkout', async (_event, data: { plan: 'monthly' | 'yearly' | 'lifetime'; module?: 'klient' | 'ads' }) => {
    const sb = getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user) throw new Error('Nincs bejelentkezve');

    console.log('[Checkout] User session:', {
      userId: session.user.id,
      email: session.user.email,
      hasAccessToken: !!session.access_token,
    });

    const res = await sb.functions.invoke('create-checkout', {
      body: { plan: data.plan, module: data.module },
    });

    console.log('[Checkout] Edge function response:', {
      error: res.error,
      data: res.data,
      status: (res as any).status,
    });

    if (res.error) throw new Error(res.error.message || 'Checkout hiba');
    const result = res.data as { url?: string; error?: string };
    if (result.error || !result.url) throw new Error(result.error || 'Nincs checkout URL');

    return { success: true, url: result.url };
  });

  // Cancel subscription (cancel_at_period_end)
  ipcMain.handle('db:subscription:cancel', async (_event, module?: 'klient' | 'ads') => {
    const sb = getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user) throw new Error('Nincs bejelentkezve');

    const res = await sb.functions.invoke('manage-subscription', {
      body: { action: 'cancel', module },
    });

    if (res.error) throw new Error(res.error.message || 'Lemondási hiba');
    const result = res.data as { success?: boolean; error?: string };
    if (result.error) throw new Error(result.error);
    return { success: true };
  });

  // Reactivate cancelled subscription
  ipcMain.handle('db:subscription:reactivate', async (_event, module?: 'klient' | 'ads') => {
    const sb = getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user) throw new Error('Nincs bejelentkezve');

    const res = await sb.functions.invoke('manage-subscription', {
      body: { action: 'reactivate', module },
    });

    if (res.error) throw new Error(res.error.message || 'Újraaktiválási hiba');
    const result = res.data as { success?: boolean; error?: string };
    if (result.error) throw new Error(result.error);
    return { success: true };
  });

  // ============ CLIENTS ============
  ipcMain.handle('db:clients:getAll', () => {
    return queryAll('SELECT * FROM clients ORDER BY name ASC');
  });

  ipcMain.handle('db:clients:get', (_event, id: string) => {
    return queryOne('SELECT * FROM clients WHERE id = ?', [id]);
  });

  ipcMain.handle('db:clients:create', (_event, data: Record<string, unknown>) => {
    const id = uuidv4();
    execute(
      `INSERT INTO clients (id, name, email, phone, company, address, postal_code, city, street, address_line2, tax_number, notes, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.name, data.email, data.phone, data.company, data.address, data.postal_code, data.city, data.street, data.address_line2, data.tax_number, data.notes, data.color || '#6366f1']
    );
    // Auto-create client folder
    if (data.name) {
      const folderPath = path.join(getFilesRoot(), sanitizeFolderName(data.name as string));
      if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
    }
    return queryOne('SELECT * FROM clients WHERE id = ?', [id]);
  });

  ipcMain.handle('db:clients:update', (_event, id: string, data: Record<string, unknown>) => {
    // Auto-rename client folder if name changed
    if (data.name) {
      const oldClient = queryOne('SELECT name FROM clients WHERE id = ?', [id]) as Record<string, string> | null;
      if (oldClient && oldClient.name !== data.name) {
        const root = getFilesRoot();
        const oldPath = path.join(root, sanitizeFolderName(oldClient.name));
        const newPath = path.join(root, sanitizeFolderName(data.name as string));
        if (fs.existsSync(oldPath) && !fs.existsSync(newPath)) {
          fs.renameSync(oldPath, newPath);
        }
      }
    }
    const allowedFields = ['name', 'email', 'phone', 'company', 'address', 'postal_code', 'city', 'street', 'address_line2', 'notes', 'color', 'tax_number', 'representative_name'];
    const filteredData: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in data) filteredData[key] = data[key];
    }
    const fields = Object.keys(filteredData).map(k => `${k} = ?`).join(', ');
    const values = Object.values(filteredData);
    if (fields) {
      execute(`UPDATE clients SET ${fields}, updated_at = datetime('now') WHERE id = ?`, [...values, id]);
    }
    return queryOne('SELECT * FROM clients WHERE id = ?', [id]);
  });

  ipcMain.handle('db:clients:delete', (_event, id: string) => {
    execute('DELETE FROM clients WHERE id = ?', [id]);
    return { success: true };
  });

  // ============ PROJECTS ============
  ipcMain.handle('db:projects:getAll', (_event, clientId?: string) => {
    if (clientId) {
      return queryAll(
        `SELECT p.*, c.name as client_name, c.color as client_color
         FROM projects p LEFT JOIN clients c ON p.client_id = c.id
         WHERE p.client_id = ? ORDER BY p.deadline ASC`,
        [clientId]
      );
    }
    return queryAll(
      `SELECT p.*, c.name as client_name, c.color as client_color
       FROM projects p LEFT JOIN clients c ON p.client_id = c.id
       ORDER BY p.deadline ASC`
    );
  });

  ipcMain.handle('db:projects:get', (_event, id: string) => {
    return queryOne(
      `SELECT p.*, c.name as client_name, c.color as client_color
       FROM projects p LEFT JOIN clients c ON p.client_id = c.id
       WHERE p.id = ?`,
      [id]
    );
  });

  ipcMain.handle('db:projects:create', (_event, data: Record<string, unknown>) => {
    const id = uuidv4();
    execute(
      `INSERT INTO projects (id, client_id, name, description, deadline, estimated_hours, priority, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.client_id || null, data.name, data.description, data.deadline || null, data.estimated_hours, data.priority || 'medium', data.color || null]
    );
    // Auto-create project folder
    if (data.name && data.client_id) {
      const client = queryOne('SELECT name FROM clients WHERE id = ?', [data.client_id]) as Record<string, string> | null;
      if (client) {
        const folderPath = path.join(getFilesRoot(), sanitizeFolderName(client.name), sanitizeFolderName(data.name as string));
        if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
      }
    }
    return queryOne(
      `SELECT p.*, c.name as client_name, c.color as client_color
       FROM projects p LEFT JOIN clients c ON p.client_id = c.id WHERE p.id = ?`,
      [id]
    );
  });

  ipcMain.handle('db:projects:update', (_event, id: string, data: Record<string, unknown>) => {
    // Auto-rename project folder if name changed
    if (data.name) {
      const oldProject = queryOne('SELECT p.name, c.name as client_name FROM projects p LEFT JOIN clients c ON p.client_id = c.id WHERE p.id = ?', [id]) as Record<string, string> | null;
      if (oldProject && oldProject.client_name && oldProject.name !== data.name) {
        const root = getFilesRoot();
        const clientFolder = sanitizeFolderName(oldProject.client_name);
        const oldPath = path.join(root, clientFolder, sanitizeFolderName(oldProject.name));
        const newPath = path.join(root, clientFolder, sanitizeFolderName(data.name as string));
        if (fs.existsSync(oldPath) && !fs.existsSync(newPath)) {
          fs.renameSync(oldPath, newPath);
        }
      }
    }
    const allowedFields = ['name', 'description', 'status', 'deadline', 'estimated_hours', 'allocated_hours', 'is_hours_distributed', 'priority', 'color', 'client_id'];
    const filteredData: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in data) {
        // Ensure empty strings become NULL for nullable fields
        const val = data[key];
        filteredData[key] = (val === '' && ['client_id', 'deadline', 'color'].includes(key)) ? null : val;
      }
    }
    const fields = Object.keys(filteredData).map(k => `${k} = ?`).join(', ');
    const values = Object.values(filteredData);
    if (fields) {
      execute(`UPDATE projects SET ${fields}, updated_at = datetime('now') WHERE id = ?`, [...values, id]);
    }
    return queryOne(
      `SELECT p.*, c.name as client_name, c.color as client_color
       FROM projects p LEFT JOIN clients c ON p.client_id = c.id WHERE p.id = ?`,
      [id]
    );
  });

  ipcMain.handle('db:projects:delete', (_event, id: string) => {
    execute('DELETE FROM projects WHERE id = ?', [id]);
    return { success: true };
  });

  ipcMain.handle('db:projects:close', (_event, id: string) => {
    const project = queryOne('SELECT * FROM projects WHERE id = ?', [id]);
    if (!project) throw new Error('Project not found');
    execute(`UPDATE projects SET status = 'completed', closed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`, [id]);
    return { success: true };
  });

  ipcMain.handle('db:projects:markPaid', (_event, id: string, invoiceData: Record<string, unknown>) => {
    const project = queryOne('SELECT * FROM projects WHERE id = ?', [id]);
    if (!project) throw new Error('Project not found');

    const invoiceId = uuidv4();
    // ÁFA szétbontás a user áfa-státusza alapján
    const user = queryOne('SELECT vat_status, vat_rate_default FROM user_settings LIMIT 1') as Record<string, unknown> | null;
    const vatStatus = (user?.vat_status as string) || 'exempt';
    const defaultRate = (user?.vat_rate_default as number) ?? 27;
    const amount = Number(invoiceData.amount);
    const currency = (invoiceData.currency as string) || 'HUF';
    const amountHuf = (invoiceData.amount_huf as number | undefined) ?? amount;
    const vatRate = vatStatus === 'exempt' ? 0 : defaultRate;
    const divisor = 1 + (vatRate / 100);
    const netAmount = Math.round((amount / divisor) * 100) / 100;
    const vatAmount = Math.round((amount - netAmount) * 100) / 100;
    const netAmountHuf = Math.round((amountHuf / divisor) * 100) / 100;
    const vatAmountHuf = Math.round((amountHuf - netAmountHuf) * 100) / 100;
    execute(
      `INSERT INTO invoices (id, project_id, client_id, file_path, invoice_number, amount, currency, amount_huf, vat_rate, net_amount, vat_amount, net_amount_huf, vat_amount_huf, issue_date, due_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [invoiceId, id, project.client_id, invoiceData.file_path, invoiceData.invoice_number, amount, currency, amountHuf, vatRate, netAmount, vatAmount, netAmountHuf, vatAmountHuf, invoiceData.issue_date, invoiceData.due_date, invoiceData.notes]
    );
    return { success: true };
  });

  ipcMain.handle('db:projects:completedHours', () => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().slice(0, 5);
    return queryAll(
      `SELECT project_id, COALESCE(SUM(duration_hours), 0) as completed_hours
       FROM calendar_events
       WHERE project_id IS NOT NULL
         AND (date < ? OR (date = ? AND end_time <= ?))
       GROUP BY project_id`,
      [today, today, currentTime]
    );
  });

  // ============ CALENDAR EVENTS ============
  ipcMain.handle('db:calendar:getAll', (_event, startDate: string, endDate: string) => {
    return queryAll(
      `SELECT ce.*, p.name as project_name, p.client_id, c.name as client_name
       FROM calendar_events ce
       LEFT JOIN projects p ON ce.project_id = p.id
       LEFT JOIN clients c ON p.client_id = c.id
       WHERE ce.date BETWEEN ? AND ?
       ORDER BY ce.date ASC, ce.start_time ASC`,
      [startDate, endDate]
    );
  });

  ipcMain.handle('db:calendar:create', (_event, data: Record<string, unknown>) => {
    const id = uuidv4();
    execute(
      `INSERT INTO calendar_events (id, project_id, title, description, date, start_time, end_time, duration_hours, type, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.project_id, data.title, data.description, data.date, data.start_time, data.end_time, data.duration_hours, data.type || 'work', data.color]
    );

    if (data.project_id && data.duration_hours) {
      const result = queryOne('SELECT COALESCE(SUM(duration_hours), 0) as total FROM calendar_events WHERE project_id = ?', [data.project_id]);
      execute('UPDATE projects SET allocated_hours = ? WHERE id = ?', [result?.total ?? 0, data.project_id]);
    }

    return queryOne('SELECT * FROM calendar_events WHERE id = ?', [id]);
  });

  ipcMain.handle('db:calendar:update', (_event, id: string, data: Record<string, unknown>) => {
    const event = queryOne('SELECT * FROM calendar_events WHERE id = ?', [id]);

    const allowedFields = ['title', 'description', 'date', 'start_time', 'end_time', 'duration_hours', 'type', 'color', 'project_id', 'actual_minutes'];
    const filteredData: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in data) filteredData[key] = data[key];
    }
    const fields = Object.keys(filteredData).map(k => `${k} = ?`).join(', ');
    const values = Object.values(filteredData);
    if (fields) {
      execute(`UPDATE calendar_events SET ${fields} WHERE id = ?`, [...values, id]);
    }

    const projectId = data.project_id || event?.project_id;
    if (projectId) {
      const result = queryOne('SELECT COALESCE(SUM(duration_hours), 0) as total FROM calendar_events WHERE project_id = ?', [projectId]);
      execute('UPDATE projects SET allocated_hours = ? WHERE id = ?', [result?.total ?? 0, projectId]);
    }

    return queryOne('SELECT * FROM calendar_events WHERE id = ?', [id]);
  });

  ipcMain.handle('db:calendar:delete', (_event, id: string) => {
    const event = queryOne('SELECT * FROM calendar_events WHERE id = ?', [id]);
    execute('DELETE FROM calendar_events WHERE id = ?', [id]);

    if (event?.project_id) {
      const result = queryOne('SELECT COALESCE(SUM(duration_hours), 0) as total FROM calendar_events WHERE project_id = ?', [event.project_id]);
      execute('UPDATE projects SET allocated_hours = ? WHERE id = ?', [result?.total ?? 0, event.project_id]);
    }

    return { success: true };
  });

  // ============ NOTES ============
  ipcMain.handle('db:notes:getAll', (_event, projectId?: string) => {
    if (projectId) {
      return queryAll(
        `SELECT n.*, p.name as project_name, c.name as client_name
         FROM notes n LEFT JOIN projects p ON n.project_id = p.id LEFT JOIN clients c ON n.client_id = c.id
         WHERE n.project_id = ? ORDER BY n.pinned DESC, n.date DESC, n.created_at DESC`,
        [projectId]
      );
    }
    return queryAll(
      `SELECT n.*, p.name as project_name, c.name as client_name
       FROM notes n LEFT JOIN projects p ON n.project_id = p.id LEFT JOIN clients c ON n.client_id = c.id
       ORDER BY n.pinned DESC, n.date DESC, n.created_at DESC`
    );
  });

  ipcMain.handle('db:notes:create', (_event, data: Record<string, unknown>) => {
    const id = uuidv4();
    execute(
      `INSERT INTO notes (id, project_id, client_id, title, content, date, is_notification, notification_email, color, pinned, reminder_date, reminder_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.project_id, data.client_id, data.title, data.content, data.date || new Date().toISOString().split('T')[0], data.is_notification ? 1 : 0, data.notification_email, data.color || 'default', data.pinned ? 1 : 0, data.reminder_date, data.reminder_time]
    );
    return queryOne('SELECT * FROM notes WHERE id = ?', [id]);
  });

  ipcMain.handle('db:notes:update', (_event, id: string, data: Record<string, unknown>) => {
    const allowedFields = ['title', 'content', 'date', 'is_notification', 'notification_email', 'color', 'pinned', 'reminder_date', 'reminder_time'];
    const filteredData: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in data) filteredData[key] = data[key];
    }
    const fields = Object.keys(filteredData).map(k => `${k} = ?`).join(', ');
    const values = Object.values(filteredData);
    if (fields) {
      execute(`UPDATE notes SET ${fields}, updated_at = datetime('now') WHERE id = ?`, [...values, id]);
    }
    return queryOne('SELECT * FROM notes WHERE id = ?', [id]);
  });

  ipcMain.handle('db:notes:getReminders', () => {
    return queryAll(
      `SELECT n.*, p.name as project_name, c.name as client_name
       FROM notes n LEFT JOIN projects p ON n.project_id = p.id LEFT JOIN clients c ON n.client_id = c.id
       WHERE n.reminder_date IS NOT NULL AND n.reminder_date <= date('now')
       ORDER BY n.reminder_date ASC, n.reminder_time ASC`
    );
  });

  ipcMain.handle('db:notes:delete', (_event, id: string) => {
    execute('DELETE FROM notes WHERE id = ?', [id]);
    return { success: true };
  });

  // ============ RECORDINGS ============
  ipcMain.handle('db:recordings:getAll', (_event, clientId?: string) => {
    if (clientId) {
      return queryAll('SELECT * FROM recordings WHERE client_id = ? ORDER BY created_at DESC', [clientId]);
    }
    return queryAll('SELECT * FROM recordings ORDER BY created_at DESC');
  });

  ipcMain.handle('db:recordings:create', (_event, data: Record<string, unknown>) => {
    const id = uuidv4();
    execute(
      `INSERT INTO recordings (id, client_id, project_id, title, file_path, duration_seconds, transcription, ai_summary) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.client_id, data.project_id, data.title, data.file_path, data.duration_seconds, data.transcription, data.ai_summary]
    );
    return queryOne('SELECT * FROM recordings WHERE id = ?', [id]);
  });

  ipcMain.handle('db:recordings:delete', (_event, id: string) => {
    const recording = queryOne('SELECT file_path FROM recordings WHERE id = ?', [id]);
    if (recording?.file_path) {
      try { fs.unlinkSync(recording.file_path as string); } catch { /* file may already be deleted */ }
    }
    execute('DELETE FROM recordings WHERE id = ?', [id]);
    return { success: true };
  });

  ipcMain.handle('db:recordings:update', (_event, id: string, data: Record<string, unknown>) => {
    const allowedFields = ['title', 'transcription', 'ai_summary'];
    const filteredData: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in data) filteredData[key] = data[key];
    }
    const fields = Object.keys(filteredData).map(k => `${k} = ?`).join(', ');
    const values = Object.values(filteredData);
    if (fields) {
      execute(`UPDATE recordings SET ${fields} WHERE id = ?`, [...values, id]);
    }
    return queryOne('SELECT * FROM recordings WHERE id = ?', [id]);
  });

  // ============ SHORTCUTS ============
  ipcMain.handle('db:shortcuts:getAll', () => {
    return queryAll('SELECT * FROM shortcuts ORDER BY sort_order ASC');
  });

  ipcMain.handle('db:shortcuts:create', (_event, data: Record<string, unknown>) => {
    const id = uuidv4();
    execute('INSERT INTO shortcuts (id, name, url, icon, sort_order) VALUES (?, ?, ?, ?, ?)', [id, data.name, data.url, data.icon, data.sort_order || 0]);
    return queryOne('SELECT * FROM shortcuts WHERE id = ?', [id]);
  });

  ipcMain.handle('db:shortcuts:update', (_event, id: string, data: Record<string, unknown>) => {
    const allowedFields = ['name', 'url', 'icon', 'sort_order'];
    const filteredData: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in data) filteredData[key] = data[key];
    }
    const fields = Object.keys(filteredData).map(k => `${k} = ?`).join(', ');
    const values = Object.values(filteredData);
    if (fields) {
      execute(`UPDATE shortcuts SET ${fields} WHERE id = ?`, [...values, id]);
    }
    return queryOne('SELECT * FROM shortcuts WHERE id = ?', [id]);
  });

  ipcMain.handle('db:shortcuts:delete', (_event, id: string) => {
    execute('DELETE FROM shortcuts WHERE id = ?', [id]);
    return { success: true };
  });

  // ============ CONTRACTS ============

  ipcMain.handle('db:contracts:getTemplates', () => {
    const { CONTRACT_TEMPLATES } = require('./contract-templates');
    return CONTRACT_TEMPLATES.map((t: { id: string; name: string; description: string; fields: unknown[] }) => ({
      id: t.id, name: t.name, description: t.description, fields: t.fields,
    }));
  });

  ipcMain.handle('db:contracts:getAll', (_event, clientId?: string) => {
    if (clientId) {
      return queryAll(
        `SELECT ct.*, c.name as client_name, p.name as project_name
         FROM contracts ct
         LEFT JOIN clients c ON ct.client_id = c.id
         LEFT JOIN projects p ON ct.project_id = p.id
         WHERE ct.client_id = ?
         ORDER BY ct.created_at DESC`,
        [clientId]
      );
    }
    return queryAll(
      `SELECT ct.*, c.name as client_name, p.name as project_name
       FROM contracts ct
       LEFT JOIN clients c ON ct.client_id = c.id
       LEFT JOIN projects p ON ct.project_id = p.id
       ORDER BY ct.created_at DESC`
    );
  });

  ipcMain.handle('db:contracts:generate', async (_event, data: {
    templateId: string;
    clientId: string;
    projectId?: string;
    fields: Record<string, string>;
    contractDate: string;
  }) => {
    const { generateContractPdf } = await import('./pdf-generator');
    const { CONTRACT_TEMPLATES } = await import('./contract-templates');

    const client = queryOne('SELECT * FROM clients WHERE id = ?', [data.clientId]) as Record<string, string> | null;
    if (!client) throw new Error('Ügyfél nem található');

    // Get the current user
    const sb = getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user) throw new Error('Nincs bejelentkezve');
    const user = queryOne(`SELECT ${USER_FIELDS} FROM user_settings WHERE id = ?`, [session.user.id]) as Record<string, string> | null;
    if (!user) throw new Error('Felhasználó nem található');

    // Validate user has required company information for contracts
    if (!user.company_name || !user.address) {
      throw new Error('A szerződés generálásához kérjük, töltse ki céges adatait (cégnév, cím) a Beállítások menüben.');
    }

    // Build client address from structured fields or use legacy address
    let clientAddress = client.address || '';
    if (client.postal_code || client.city || client.street) {
      const parts = [];
      if (client.postal_code) parts.push(client.postal_code);
      if (client.city) parts.push(client.city);
      if (client.street) parts.push(client.street);
      if (client.address_line2) parts.push(client.address_line2);
      clientAddress = parts.join(', ');
    }

    // Validate client has required information for contracts
    if (!clientAddress) {
      throw new Error('A szerződés generálásához az ügyfél címe kötelező. Kérjük, egészítse ki az ügyfél adatait.');
    }

    const template = CONTRACT_TEMPLATES.find((t: { id: string }) => t.id === data.templateId);
    if (!template) throw new Error('Sablon nem található');

    const contractData = {
      userName: user.name || '',
      userCompany: user.company_name || '',
      userAddress: user.address || '',
      userTaxNumber: user.tax_number || '',
      userBankAccount: user.bank_account || '',
      userEmail: user.email || '',
      userPhone: '',
      clientName: client.name || '',
      clientCompany: client.company || '',
      clientAddress: clientAddress,
      clientTaxNumber: client.tax_number || '',
      clientRepresentative: client.representative_name || '',
      clientEmail: client.email || '',
      clientPhone: client.phone || '',
      fields: data.fields,
      contractDate: data.contractDate,
      contractPlace: data.fields.place || '',
    };

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await generateContractPdf(data.templateId, contractData);
    } catch (err: any) {
      throw new Error(`PDF generálási hiba: ${err.message || 'Ismeretlen hiba történt'}`);
    }

    // Save PDF to client's Files folder
    const clientFolder = path.join(getFilesRoot(), sanitizeFolderName(client.name));
    const contractsFolder = path.join(clientFolder, 'Szerződések');
    try {
      if (!fs.existsSync(contractsFolder)) {
        fs.mkdirSync(contractsFolder, { recursive: true });
      }
    } catch (err: any) {
      throw new Error(`Mappa létrehozási hiba: ${err.message || 'Nem sikerült létrehozni a szerződések mappát'}`);
    }

    const dateStr = data.contractDate.replace(/-/g, '');
    const fileName = `${template.name}_${sanitizeFolderName(client.name)}_${dateStr}.pdf`;
    const filePath = path.join(contractsFolder, fileName);

    try {
      fs.writeFileSync(filePath, pdfBuffer);
    } catch (err: any) {
      throw new Error(`Fájl mentési hiba: ${err.message || 'Nem sikerült menteni a szerződést'}`);
    }

    // Save record in DB
    const id = uuidv4();
    execute(
      `INSERT INTO contracts (id, project_id, client_id, name, file_path, signed_date, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [id, data.projectId || null, data.clientId, template.name, filePath, null]
    );

    return queryOne(
      `SELECT ct.*, c.name as client_name, p.name as project_name
       FROM contracts ct LEFT JOIN clients c ON ct.client_id = c.id LEFT JOIN projects p ON ct.project_id = p.id
       WHERE ct.id = ?`, [id]
    );
  });

  ipcMain.handle('db:contracts:delete', (_event, id: string) => {
    const contract = queryOne('SELECT file_path FROM contracts WHERE id = ?', [id]) as { file_path: string } | null;
    if (contract?.file_path) {
      try { fs.unlinkSync(contract.file_path); } catch { /* file may not exist */ }
    }
    execute('DELETE FROM contracts WHERE id = ?', [id]);
    return { success: true };
  });

  // ============ INVOICES ============
  ipcMain.handle('db:invoices:getAll', (_event, projectId?: string) => {
    if (projectId) {
      return queryAll(
        `SELECT i.*, p.name as project_name, c.name as client_name, c.color as client_color
         FROM invoices i LEFT JOIN projects p ON i.project_id = p.id LEFT JOIN clients c ON i.client_id = c.id
         WHERE i.project_id = ? ORDER BY i.created_at DESC`,
        [projectId]
      );
    }
    return queryAll(
      `SELECT i.*, p.name as project_name, c.name as client_name, c.color as client_color
       FROM invoices i LEFT JOIN projects p ON i.project_id = p.id LEFT JOIN clients c ON i.client_id = c.id
       ORDER BY i.created_at DESC`
    );
  });

  ipcMain.handle('db:invoices:getByClient', (_event, clientId: string) => {
    return queryAll(
      `SELECT i.*, p.name as project_name, c.name as client_name
       FROM invoices i LEFT JOIN projects p ON i.project_id = p.id LEFT JOIN clients c ON i.client_id = c.id
       WHERE i.client_id = ? ORDER BY i.created_at DESC`,
      [clientId]
    );
  });

  ipcMain.handle('db:invoices:create', (_event, data: Record<string, unknown>) => {
    const id = uuidv4();
    // ÁFA szétbontás: ha a kliens küld net_amount-ot, azt használjuk; különben fallback:
    // áfakörös usernél alapértelmezett kulcs alapján, AAM-nél net = amount, vat = 0.
    const user = queryOne('SELECT vat_status, vat_rate_default FROM user_settings LIMIT 1') as Record<string, unknown> | null;
    const vatStatus = (user?.vat_status as string) || 'exempt';
    const defaultRate = (user?.vat_rate_default as number) ?? 27;
    const amount = Number(data.amount);
    const currency = (data.currency as string) || 'HUF';
    const amountHuf = (data.amount_huf as number | undefined) ?? (currency === 'HUF' ? amount : amount);
    let vatRate = data.vat_rate as number | undefined;
    let netAmount = data.net_amount as number | undefined;
    let vatAmount = data.vat_amount as number | undefined;
    let netAmountHuf = data.net_amount_huf as number | undefined;
    let vatAmountHuf = data.vat_amount_huf as number | undefined;
    if (vatRate === undefined) vatRate = vatStatus === 'exempt' ? 0 : defaultRate;
    if (netAmount === undefined || vatAmount === undefined) {
      const divisor = 1 + (vatRate / 100);
      netAmount = Math.round((amount / divisor) * 100) / 100;
      vatAmount = Math.round((amount - netAmount) * 100) / 100;
    }
    if (netAmountHuf === undefined || vatAmountHuf === undefined) {
      const divisor = 1 + (vatRate / 100);
      netAmountHuf = Math.round((amountHuf / divisor) * 100) / 100;
      vatAmountHuf = Math.round((amountHuf - netAmountHuf) * 100) / 100;
    }
    execute(
      `INSERT INTO invoices (id, project_id, client_id, file_path, invoice_number, amount, currency, amount_huf, vat_rate, net_amount, vat_amount, net_amount_huf, vat_amount_huf, issue_date, due_date, status, notes, type, provider, provider_invoice_id, provider_synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.project_id, data.client_id, data.file_path, data.invoice_number, amount, currency, amountHuf, vatRate, netAmount, vatAmount, netAmountHuf, vatAmountHuf, data.issue_date, data.due_date, data.status || 'pending', data.notes, data.type || 'invoice', data.provider || null, data.provider_invoice_id || null, data.provider_synced_at || null]
    );
    return queryOne('SELECT * FROM invoices WHERE id = ?', [id]);
  });

  ipcMain.handle('db:invoices:update', (_event, id: string, data: Record<string, unknown>) => {
    const allowedFields = ['invoice_number', 'amount', 'currency', 'amount_huf', 'vat_rate', 'net_amount', 'vat_amount', 'net_amount_huf', 'vat_amount_huf', 'issue_date', 'due_date', 'status', 'notes', 'file_path', 'client_id', 'project_id', 'type', 'provider', 'provider_invoice_id', 'provider_synced_at'];
    const filteredData: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in data) filteredData[key] = data[key];
    }
    const fields = Object.keys(filteredData).map(k => `${k} = ?`).join(', ');
    const values = Object.values(filteredData);
    if (fields) {
      execute(`UPDATE invoices SET ${fields} WHERE id = ?`, [...values, id]);
    }
    return queryOne(
      `SELECT i.*, p.name as project_name, c.name as client_name
       FROM invoices i LEFT JOIN projects p ON i.project_id = p.id LEFT JOIN clients c ON i.client_id = c.id
       WHERE i.id = ?`, [id]
    );
  });

  ipcMain.handle('db:invoices:delete', async (_event, id: string) => {
    // Look up the full invoice
    const invoice = queryOne('SELECT * FROM invoices WHERE id = ?', [id]) as Record<string, any> | undefined;
    if (!invoice) return { success: false, error: 'Számla nem található' };

    let stornoResult: { stornoInvoiceNumber?: string; stornoInvoiceId?: string; grossTotal?: number; pdfBase64?: string; provider?: string } | null = null;

    // Cancel on billing provider first
    if (invoice.provider && invoice.provider_invoice_id) {
      try {
        stornoResult = await billingService.cancelInvoice(invoice.provider_invoice_id, invoice.provider);
      } catch (err: any) {
        console.error('[IPC] Provider cancel failed:', err.message);
        return { success: false, error: `Sztornó hiba (${invoice.provider}): ${err.message}` };
      }
    }

    // Mark original as cancelled
    execute('UPDATE invoices SET status = ? WHERE id = ?', ['cancelled', id]);

    // Create storno invoice record if we got storno data from provider
    if (stornoResult?.stornoInvoiceNumber) {
      const stornoId = uuidv4();
      const today = new Date().toISOString().slice(0, 10);
      const negativeAmount = stornoResult.grossTotal
        ? -Math.abs(stornoResult.grossTotal)
        : -(invoice.amount || 0);

      // Save storno PDF to client folder if available
      let stornoFilePath: string | null = null;
      if (stornoResult.pdfBase64 && invoice.client_id) {
        try {
          const client = queryOne('SELECT name FROM clients WHERE id = ?', [invoice.client_id]) as { name: string } | undefined;
          if (client) {
            const sanitizedClient = client.name.replace(/[<>:"/\\|?*]/g, '_').trim();
            const invoicesDir = path.join(filesRoot, sanitizedClient, 'Számlák');
            if (!fs.existsSync(invoicesDir)) {
              fs.mkdirSync(invoicesDir, { recursive: true });
            }
            const safeName = `${stornoResult.stornoInvoiceNumber.replace(/\//g, '-')}.pdf`;
            const fpth = path.join(invoicesDir, safeName);
            fs.writeFileSync(fpth, Buffer.from(stornoResult.pdfBase64, 'base64'));
            stornoFilePath = fpth;
          }
        } catch (err: any) {
          console.warn('[IPC] Could not save storno PDF:', err.message);
        }
      }

      execute(
        `INSERT INTO invoices (id, project_id, client_id, file_path, invoice_number, amount, currency, issue_date, due_date, status, notes, type, provider, provider_invoice_id, provider_synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [stornoId, invoice.project_id, invoice.client_id, stornoFilePath, stornoResult.stornoInvoiceNumber, negativeAmount, invoice.currency || 'HUF', today, today, 'cancelled', `Sztornó: ${invoice.invoice_number || ''}`, 'invoice', invoice.provider, stornoResult.stornoInvoiceId || stornoResult.stornoInvoiceNumber, new Date().toISOString()]
      );
    }

    return { success: true };
  });

  ipcMain.handle('db:finance:stats', () => {
    // Befolyt bevétel - paid invoices this month
    const paidThisMonth = (queryOne(`SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE status = 'paid' AND issue_date >= date('now', 'start of month')`) as Record<string, number>)?.total ?? 0;
    // Függő bevétel - pending invoices total
    const pendingTotal = (queryOne(`SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE status = 'pending'`) as Record<string, number>)?.total ?? 0;
    // Várható bevétel - active + completed (but not fully paid) projects
    const avgHourlyRate = (queryOne(`SELECT COALESCE(AVG(i.amount / NULLIF(p.estimated_hours, 0)), 0) as rate FROM invoices i JOIN projects p ON i.project_id = p.id WHERE i.status = 'paid' AND p.estimated_hours > 0`) as Record<string, number>)?.rate ?? 0;
    const eligibleProjects = queryAll(
      `SELECT p.id, p.name, p.estimated_hours, p.status, c.name as client_name,
        COALESCE((SELECT SUM(i.amount) FROM invoices i WHERE i.project_id = p.id AND i.status != 'cancelled'), 0) as invoiced_total,
        COALESCE((SELECT SUM(i.amount) FROM invoices i WHERE i.project_id = p.id AND i.status = 'paid'), 0) as paid_total
       FROM projects p LEFT JOIN clients c ON p.client_id = c.id
       WHERE p.status IN ('active', 'completed') AND p.estimated_hours > 0
         AND p.client_id IS NOT NULL AND p.client_id != ''
         AND NOT (
           (SELECT COUNT(*) FROM invoices i WHERE i.project_id = p.id AND i.status != 'cancelled') > 0
           AND (SELECT COUNT(*) FROM invoices i WHERE i.project_id = p.id AND i.status NOT IN ('paid', 'cancelled')) = 0
         )
       ORDER BY p.estimated_hours DESC`
    ) as { id: string; name: string; estimated_hours: number; status: string; client_name: string; invoiced_total: number; paid_total: number }[];
    const expectedBreakdown = eligibleProjects.map(p => {
      const hasInvoices = p.invoiced_total > 0;
      return {
        projectName: p.name,
        clientName: p.client_name,
        hours: p.estimated_hours,
        value: hasInvoices ? Math.round(p.invoiced_total) : Math.round(p.estimated_hours * avgHourlyRate),
        isInvoiced: hasInvoices,
        isCompleted: p.status === 'completed',
      };
    });
    const expectedRevenue = expectedBreakdown.reduce((sum, p) => sum + p.value, 0);
    return { paidThisMonth, pendingTotal, expectedRevenue, avgHourlyRate: Math.round(avgHourlyRate), expectedBreakdown };
  });

  ipcMain.handle('db:invoices:nextNumber', () => {
    const year = new Date().getFullYear();
    const prefix = `KLIENT-${year}-`;
    const last = queryOne(`SELECT invoice_number FROM invoices WHERE invoice_number LIKE ? ORDER BY invoice_number DESC LIMIT 1`, [`${prefix}%`]) as Record<string, string> | null;
    let nextNum = 1;
    if (last?.invoice_number) {
      const parts = last.invoice_number.split('-');
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num)) nextNum = num + 1;
    }
    return `${prefix}${String(nextNum).padStart(3, '0')}`;
  });

  ipcMain.handle('db:finance:monthlyRevenue', () => {
    // Get monthly revenue for the last 12 months, broken down by client
    const rows = queryAll(
      `SELECT 
        strftime('%Y-%m', i.issue_date) as month,
        i.client_id,
        c.name as client_name,
        c.color as client_color,
        SUM(i.amount) as total
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      WHERE i.status = 'paid' AND i.issue_date >= date('now', '-12 months')
      GROUP BY month, i.client_id
      ORDER BY month ASC`
    );
    return rows;
  });

  // Enhanced finance stats
  ipcMain.handle('db:finance:enhanced', () => {
    const paidLastMonth = (queryOne(`SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE status = 'paid' AND issue_date >= date('now', 'start of month', '-1 month') AND issue_date < date('now', 'start of month')`) as Record<string, number>)?.total ?? 0;
    const yearlyRevenue = (queryOne(`SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE status = 'paid' AND issue_date >= date('now', 'start of year')`) as Record<string, number>)?.total ?? 0;
    // ÁFA bontás: nettó YTD (amit a vállalkozás tényleges bevételeként könyvelhet)
    // A migráció után minden számla net_amount/vat_amount mezője ki van töltve.
    // Ha valamiért NULL, fallback: amount (bruttónak tekintjük, de áfa 0).
    const vatRow = queryOne(
      `SELECT
         COALESCE(SUM(COALESCE(net_amount_huf, net_amount, amount_huf, amount)), 0) as net_ytd,
         COALESCE(SUM(COALESCE(vat_amount_huf, vat_amount, 0)), 0) as vat_payable_ytd
       FROM invoices
       WHERE status = 'paid' AND issue_date >= date('now', 'start of year')`
    ) as { net_ytd: number; vat_payable_ytd: number } | null;
    const yearlyNetRevenue = Math.round(vatRow?.net_ytd ?? 0);
    const vatPayable = Math.round(vatRow?.vat_payable_ytd ?? 0);
    // Levonható áfa a vat_deductible = 1 kiadásokból, YTD
    const vatDeductibleRow = queryOne(
      `SELECT COALESCE(SUM(COALESCE(vat_amount_huf, vat_amount, 0)), 0) as total
       FROM expenses
       WHERE vat_deductible = 1
         AND start_date >= date('now', 'start of year')
         AND start_date <= date('now')`
    ) as { total: number } | null;
    const vatDeductible = Math.round(vatDeductibleRow?.total ?? 0);
    const vatBalance = vatPayable - vatDeductible;
    const vatStatus = ((queryOne('SELECT vat_status FROM user_settings LIMIT 1') as Record<string, string>)?.vat_status as 'exempt' | 'standard') || 'exempt';
    const yearlyMonthly = queryAll(
      `SELECT strftime('%Y-%m', issue_date) as month, SUM(amount) as total
       FROM invoices WHERE status = 'paid' AND issue_date >= date('now', 'start of year')
       GROUP BY month ORDER BY month ASC`
    ) as { month: string; total: number }[];
    const topClients = queryAll(
      `SELECT c.id, c.name, c.color, SUM(i.amount) as total, COUNT(i.id) as invoice_count
       FROM invoices i JOIN clients c ON i.client_id = c.id
       WHERE i.status = 'paid'
       GROUP BY c.id ORDER BY total DESC LIMIT 3`
    ) as { id: string; name: string; color: string; total: number; invoice_count: number }[];
    const avgPaymentDays = (queryOne(
      `SELECT AVG(CAST(julianday(due_date) - julianday(issue_date) AS REAL)) as avg_days
       FROM invoices WHERE status = 'paid' AND issue_date IS NOT NULL AND due_date IS NOT NULL`
    ) as Record<string, number>)?.avg_days ?? 0;

    // ─── Expense actuals (no forecasting) ──────────────────────────────
    // Load all expenses and compute:
    //  - actualThisMonth: amount charged in the current calendar month
    //  - actualYTD: amount actually paid year-to-date
    //  - actualByCategoryYTD: YTD grouped by category
    //  - actualTrend: per-month actuals for the last 12 months
    const allExpenses = queryAll(
      `SELECT id, category, type, frequency, amount, amount_huf, extra_amount, start_date, end_date FROM expenses`
    ) as { id: string; category: string; type: string; frequency: 'monthly' | 'yearly' | 'one-time'; amount: number; amount_huf: number | null; extra_amount: number | null; start_date: string; end_date: string | null }[];

    const hufOf = (e: typeof allExpenses[number]) => {
      const base = e.amount_huf ?? e.amount;
      const ratio = e.amount ? (e.amount_huf ?? e.amount) / e.amount : 1;
      const extra = (e.extra_amount ?? 0) * ratio;
      return base + extra;
    };
    const parseDate = (s: string) => { const d = new Date(s + 'T00:00:00'); return d; };
    const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthsInclusive = (a: Date, b: Date) => {
      if (b < a) return 0;
      return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1;
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yearStart = new Date(today.getFullYear(), 0, 1);
    const currentMonthKey = monthKey(today);
    const firstOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Trend window: last 12 months including current
    const trendMonths: { key: string; firstOfMonth: Date }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      trendMonths.push({ key: monthKey(d), firstOfMonth: d });
    }
    const trendTotals = new Map(trendMonths.map(m => [m.key, 0]));

    let actualThisMonth = 0;
    let actualYTD = 0;
    const byCategoryYTD = new Map<string, number>();

    for (const e of allExpenses) {
      const amt = hufOf(e);
      const start = parseDate(e.start_date);
      const end = e.end_date ? parseDate(e.end_date) : null;

      // ─── CURRENT MONTH ACTUAL ───
      if (e.frequency === 'monthly') {
        // Active if start <= end-of-month AND (no end OR end >= first-of-month)
        if (start <= today && (!end || end >= firstOfCurrentMonth)) {
          actualThisMonth += amt;
        }
      } else if (e.frequency === 'yearly') {
        // Counts only in its anniversary month (start_date's month)
        if (
          start <= today &&
          start.getMonth() === today.getMonth() &&
          (!end || end >= firstOfCurrentMonth)
        ) {
          actualThisMonth += amt;
        }
      } else if (e.frequency === 'one-time') {
        if (monthKey(start) === currentMonthKey) {
          actualThisMonth += amt;
        }
      }

      // ─── YEAR-TO-DATE ACTUAL ───
      let ytdForExpense = 0;
      if (e.frequency === 'monthly') {
        const effStart = start > yearStart ? start : yearStart;
        const effEnd = end && end < today ? end : today;
        const months = monthsInclusive(effStart, effEnd);
        ytdForExpense = Math.max(0, months) * amt;
      } else if (e.frequency === 'yearly') {
        // Anniversary this year already passed?
        const anniv = new Date(today.getFullYear(), start.getMonth(), start.getDate());
        if (start <= today && anniv <= today && (!end || end >= anniv)) {
          ytdForExpense = amt;
        }
      } else if (e.frequency === 'one-time') {
        if (start >= yearStart && start <= today) {
          ytdForExpense = amt;
        }
      }
      if (ytdForExpense > 0) {
        actualYTD += ytdForExpense;
        byCategoryYTD.set(e.category, (byCategoryYTD.get(e.category) ?? 0) + ytdForExpense);
      }

      // ─── 12-MONTH TREND ───
      for (const tm of trendMonths) {
        const monthEnd = new Date(tm.firstOfMonth.getFullYear(), tm.firstOfMonth.getMonth() + 1, 0);
        if (e.frequency === 'monthly') {
          if (start <= monthEnd && (!end || end >= tm.firstOfMonth)) {
            trendTotals.set(tm.key, (trendTotals.get(tm.key) ?? 0) + amt);
          }
        } else if (e.frequency === 'yearly') {
          if (
            start <= monthEnd &&
            start.getMonth() === tm.firstOfMonth.getMonth() &&
            (!end || end >= tm.firstOfMonth)
          ) {
            trendTotals.set(tm.key, (trendTotals.get(tm.key) ?? 0) + amt);
          }
        } else if (e.frequency === 'one-time') {
          if (monthKey(start) === tm.key) {
            trendTotals.set(tm.key, (trendTotals.get(tm.key) ?? 0) + amt);
          }
        }
      }
    }

    const monthlyExpenses = Math.round(actualThisMonth);
    // Team monthly payroll costs (aktív alkalmazottak bérköltsége HUF-ban)
    const monthlyPayroll = (queryOne(
      `SELECT COALESCE(SUM(COALESCE(salary_huf, monthly_salary, 0)), 0) as total
       FROM team_members
       WHERE employment_type = 'employee'
         AND (status IS NULL OR status = 'active')
         AND monthly_salary IS NOT NULL`
    ) as Record<string, number>)?.total ?? 0;
    // Open contractor/freelancer fees on active projects (alvállalkozói díjak)
    const openContractorFees = (queryOne(
      `SELECT COALESCE(SUM(COALESCE(pa.fee_huf, pa.fee, 0)), 0) as total
       FROM project_assignments pa
       JOIN team_members tm ON pa.team_member_id = tm.id
       JOIN projects p ON pa.project_id = p.id
       WHERE tm.employment_type IN ('contractor', 'freelancer')
         AND p.status = 'active'
         AND pa.fee IS NOT NULL`
    ) as Record<string, number>)?.total ?? 0;
    // Contractor fees assigned in the current month
    const contractorFeesThisMonth = (queryOne(
      `SELECT COALESCE(SUM(COALESCE(pa.fee_huf, pa.fee, 0)), 0) as total
       FROM project_assignments pa
       JOIN team_members tm ON pa.team_member_id = tm.id
       WHERE tm.employment_type IN ('contractor', 'freelancer')
         AND pa.fee IS NOT NULL
         AND strftime('%Y-%m', pa.assigned_at) = strftime('%Y-%m', 'now')`
    ) as Record<string, number>)?.total ?? 0;
    // Contractor fees assigned in the current year
    const contractorFeesThisYear = (queryOne(
      `SELECT COALESCE(SUM(COALESCE(pa.fee_huf, pa.fee, 0)), 0) as total
       FROM project_assignments pa
       JOIN team_members tm ON pa.team_member_id = tm.id
       WHERE tm.employment_type IN ('contractor', 'freelancer')
         AND pa.fee IS NOT NULL
         AND strftime('%Y', pa.assigned_at) = strftime('%Y', 'now')`
    ) as Record<string, number>)?.total ?? 0;
    // Payroll already paid YTD (number of months elapsed this year × monthly payroll)
    const monthsElapsedYTD = today.getMonth() + 1;
    const payrollYTD = monthlyPayroll * monthsElapsedYTD;
    // Team cost items for list display (all time — kész projektek is)
    const teamCostItems = queryAll(
      `SELECT pa.id, pa.assigned_at, pa.fee, pa.fee_currency, pa.fee_huf,
              tm.name as member_name, tm.role as member_role, tm.employment_type,
              p.name as project_name
       FROM project_assignments pa
       JOIN team_members tm ON pa.team_member_id = tm.id
       JOIN projects p ON pa.project_id = p.id
       WHERE tm.employment_type IN ('contractor', 'freelancer')
         AND pa.fee IS NOT NULL
       ORDER BY pa.assigned_at DESC`
    ) as { id: string; assigned_at: string; fee: number; fee_currency: string; fee_huf: number | null; member_name: string; member_role: string | null; employment_type: string; project_name: string }[];
    // Employee salary items for list display
    const employeeSalaryItems = queryAll(
      `SELECT id, name, role, monthly_salary, salary_currency, salary_huf
       FROM team_members
       WHERE employment_type = 'employee'
         AND (status IS NULL OR status = 'active')
         AND monthly_salary IS NOT NULL AND monthly_salary > 0
       ORDER BY name ASC`
    ) as { id: string; name: string; role: string | null; monthly_salary: number; salary_currency: string | null; salary_huf: number | null }[];
    // Final totals
    const monthlyExpensesTotal = Math.round(monthlyExpenses + monthlyPayroll + contractorFeesThisMonth);
    const goalsRow = queryOne('SELECT revenue_goal_yearly, profit_goal_yearly FROM user_settings LIMIT 1') as Record<string, number> | null;
    const revenueGoal = goalsRow?.revenue_goal_yearly ?? 0;
    const profitGoal = goalsRow?.profit_goal_yearly ?? 0;
    const yearlyExpenses = Math.round(actualYTD + payrollYTD + contractorFeesThisYear);
    // Categories (YTD actuals) + virtual team categories
    const expensesByCategory = Array.from(byCategoryYTD.entries())
      .map(([category, total]) => ({ category, total: Math.round(total) }))
      .sort((a, b) => b.total - a.total);
    const virtualCats: { category: string; total: number }[] = [];
    if (payrollYTD > 0) virtualCats.push({ category: 'berkoltseg', total: Math.round(payrollYTD) });
    if (contractorFeesThisYear > 0) virtualCats.push({ category: 'alvallalkozo', total: Math.round(contractorFeesThisYear) });
    const expensesByCategoryFull = [...virtualCats, ...expensesByCategory];
    // Contractor fees per month for trend merging
    const contractorFeesByMonth = queryAll(
      `SELECT strftime('%Y-%m', pa.assigned_at) as month,
              COALESCE(SUM(COALESCE(pa.fee_huf, pa.fee, 0)), 0) as total
       FROM project_assignments pa
       JOIN team_members tm ON pa.team_member_id = tm.id
       WHERE tm.employment_type IN ('contractor', 'freelancer')
         AND pa.fee IS NOT NULL
         AND pa.assigned_at >= date('now', '-11 months', 'start of month')
       GROUP BY month`
    ) as { month: string; total: number }[];
    const feeByMonth = new Map(contractorFeesByMonth.map(r => [r.month, r.total]));
    const monthlyExpensesTrend = trendMonths.map(tm => ({
      month: tm.key,
      total: Math.round((trendTotals.get(tm.key) ?? 0) + monthlyPayroll + (feeByMonth.get(tm.key) ?? 0)),
    }));
    return {
      paidLastMonth,
      yearlyRevenue,
      yearlyNetRevenue,
      vatPayable,
      vatDeductible,
      vatBalance,
      vatStatus,
      yearlyMonthly,
      topClients,
      avgPaymentDays: Math.round(avgPaymentDays),
      monthlyExpenses: monthlyExpensesTotal,
      yearlyExpenses,
      monthlyPayroll: Math.round(monthlyPayroll),
      openContractorFees: Math.round(openContractorFees),
      revenueGoal,
      profitGoal,
      expensesByCategory: expensesByCategoryFull,
      monthlyExpensesTrend,
      teamCostItems,
      employeeSalaryItems,
    };
  });

  // ============ EXPENSES ============
  ipcMain.handle('db:expenses:getAll', () => {
    return queryAll('SELECT * FROM expenses ORDER BY created_at DESC');
  });

  ipcMain.handle('db:expenses:create', (_event, data: Record<string, unknown>) => {
    const id = uuidv4();
    const amountHuf = (data.amount_huf as number | undefined) ?? (data.amount as number);
    // ÁFA szétbontás
    const user = queryOne('SELECT vat_status, vat_rate_default FROM user_settings LIMIT 1') as Record<string, unknown> | null;
    const vatStatus = (user?.vat_status as string) || 'exempt';
    const defaultRate = (user?.vat_rate_default as number) ?? 27;
    const amount = Number(data.amount);
    let vatRate = data.vat_rate as number | undefined;
    let netAmount = data.net_amount as number | undefined;
    let vatAmount = data.vat_amount as number | undefined;
    let netAmountHuf = data.net_amount_huf as number | undefined;
    let vatAmountHuf = data.vat_amount_huf as number | undefined;
    if (vatRate === undefined) vatRate = vatStatus === 'exempt' ? 0 : defaultRate;
    if (netAmount === undefined || vatAmount === undefined) {
      const divisor = 1 + (vatRate / 100);
      netAmount = Math.round((amount / divisor) * 100) / 100;
      vatAmount = Math.round((amount - netAmount) * 100) / 100;
    }
    if (netAmountHuf === undefined || vatAmountHuf === undefined) {
      const divisor = 1 + (vatRate / 100);
      const ah = Number(amountHuf);
      netAmountHuf = Math.round((ah / divisor) * 100) / 100;
      vatAmountHuf = Math.round((ah - netAmountHuf) * 100) / 100;
    }
    const vatDeductible = (data.vat_deductible as number | undefined) ?? 1;
    execute(
      `INSERT INTO expenses (id, name, amount, currency, amount_huf, vat_rate, net_amount, vat_amount, net_amount_huf, vat_amount_huf, vat_deductible, category, type, frequency, start_date, end_date, notes, extra_amount, extra_description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.name, amount, data.currency || 'HUF', amountHuf, vatRate, netAmount, vatAmount, netAmountHuf, vatAmountHuf, vatDeductible, data.category || 'other', data.type || 'subscription', data.frequency || 'monthly', data.start_date || new Date().toISOString().split('T')[0], data.end_date || null, data.notes || null, data.extra_amount || null, data.extra_description || null]
    );
    return queryOne('SELECT * FROM expenses WHERE id = ?', [id]);
  });

  ipcMain.handle('db:expenses:update', (_event, id: string, data: Record<string, unknown>) => {
    const allowedFields = ['name', 'amount', 'currency', 'amount_huf', 'vat_rate', 'net_amount', 'vat_amount', 'net_amount_huf', 'vat_amount_huf', 'vat_deductible', 'category', 'type', 'frequency', 'start_date', 'end_date', 'notes', 'extra_amount', 'extra_description'];
    const filteredData: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in data) filteredData[key] = data[key];
    }
    const fields = Object.keys(filteredData).map(k => `${k} = ?`).join(', ');
    const values = Object.values(filteredData);
    if (fields) {
      execute(`UPDATE expenses SET ${fields} WHERE id = ?`, [...values, id]);
    }
    return queryOne('SELECT * FROM expenses WHERE id = ?', [id]);
  });

  ipcMain.handle('db:expenses:delete', (_event, id: string) => {
    execute('DELETE FROM expenses WHERE id = ?', [id]);
    return { success: true };
  });

  // ============ DASHBOARD ============
  ipcMain.handle('db:dashboard:stats', () => {
    const totalClients = (queryOne('SELECT COUNT(*) as count FROM clients') as Record<string, number>)?.count ?? 0;
    const activeClients = (queryOne("SELECT COUNT(*) as count FROM (SELECT DISTINCT client_id FROM projects WHERE status = 'active')") as Record<string, number>)?.count ?? 0;
    const activeProjects = (queryOne("SELECT COUNT(*) as count FROM projects WHERE status = 'active'") as Record<string, number>)?.count ?? 0;
    const completedProjects = (queryOne("SELECT COUNT(*) as count FROM projects WHERE status = 'completed'") as Record<string, number>)?.count ?? 0;
    const totalRevenue = (queryOne("SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE status = 'paid'") as Record<string, number>)?.total ?? 0;
    const pendingRevenue = (queryOne("SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE status = 'pending'") as Record<string, number>)?.total ?? 0;
    const thisMonthRevenue = (queryOne(`SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE status = 'paid' AND issue_date >= date('now', '-30 days')`) as Record<string, number>)?.total ?? 0;
    const thisWeekRevenue = (queryOne(`SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE status = 'paid' AND issue_date >= date('now', '-7 days')`) as Record<string, number>)?.total ?? 0;
    const thisYearRevenue = (queryOne(`SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE status = 'paid' AND issue_date >= date('now', '-365 days')`) as Record<string, number>)?.total ?? 0;

    return { totalClients, activeClients, activeProjects, completedProjects, totalRevenue, pendingRevenue, thisMonthRevenue, thisWeekRevenue, thisYearRevenue };
  });

  ipcMain.handle('db:dashboard:todayNotes', () => {
    return queryAll(
      `SELECT n.*, p.name as project_name, c.name as client_name
       FROM notes n LEFT JOIN projects p ON n.project_id = p.id LEFT JOIN clients c ON n.client_id = c.id
       WHERE n.date = date('now') ORDER BY n.created_at DESC`
    );
  });

  ipcMain.handle('db:dashboard:upcomingDeadlines', () => {
    return queryAll(
      `SELECT p.*, c.name as client_name, c.color as client_color
       FROM projects p LEFT JOIN clients c ON p.client_id = c.id
       WHERE p.status = 'active' AND p.deadline >= date('now')
       ORDER BY p.deadline ASC LIMIT 10`
    );
  });

  // ============ EXCHANGE RATES ============
  ipcMain.handle('exchange:getRate', async (_event, from: string, to: string) => {
    return new Promise<number>((resolve, reject) => {
      const url = `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(from)}&symbols=${encodeURIComponent(to)}`;
      const req = net.request(url);
      let body = '';
      req.on('response', (response) => {
        response.on('data', (chunk) => { body += chunk.toString(); });
        response.on('end', () => {
          try {
            const data = JSON.parse(body);
            const rate = data?.rates?.[to];
            if (typeof rate === 'number') resolve(rate);
            else reject(new Error('Rate not found'));
          } catch { reject(new Error('Parse error')); }
        });
      });
      req.on('error', reject);
      req.end();
    });
  });

  // ============ FILE OPERATIONS ============
  ipcMain.handle('file:save', async (_event, data: { buffer: number[]; fileName: string; type: string }) => {
    const uploadsDir = path.join(app.getPath('userData'), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const filePath = path.join(uploadsDir, `${uuidv4()}-${data.fileName}`);
    fs.writeFileSync(filePath, Buffer.from(data.buffer));
    return filePath;
  });

  ipcMain.handle('file:readAudio', async (_event, filePath: string) => {
    const uploadsDir = path.join(app.getPath('userData'), 'uploads');
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(uploadsDir)) throw new Error('Invalid path');
    const buffer = fs.readFileSync(resolved);
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  });

  ipcMain.handle('file:open', async (_event, filePath: string) => {
    const { shell } = await import('electron');
    shell.openPath(filePath);
  });

  ipcMain.handle('file:export', async (_event, data: { sourcePath: string; defaultName: string }) => {
    const { dialog } = await import('electron');
    const result = await dialog.showSaveDialog({
      defaultPath: data.defaultName,
      filters: [{ name: 'All Files', extensions: ['*'] }],
    });
    if (result.canceled || !result.filePath) return null;
    fs.copyFileSync(data.sourcePath, result.filePath);
    return result.filePath;
  });

  // ============ FILES MODULE ============
  const filesRoot = getFilesRoot();
  if (!fs.existsSync(filesRoot)) {
    fs.mkdirSync(filesRoot, { recursive: true });
  }

  function safeResolvePath(relativePath: string): string {
    const resolved = path.resolve(filesRoot, relativePath);
    if (!resolved.startsWith(filesRoot)) {
      throw new Error('Invalid path');
    }
    return resolved;
  }

  ipcMain.handle('files:getRoot', () => filesRoot);

  ipcMain.handle('files:list', (_event, relativePath: string) => {
    const dirPath = safeResolvePath(relativePath);
    if (!fs.existsSync(dirPath)) return [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries.map(entry => {
      const fullPath = path.join(dirPath, entry.name);
      const stat = fs.statSync(fullPath);
      return {
        name: entry.name,
        isDirectory: entry.isDirectory(),
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
        path: path.relative(filesRoot, fullPath).replace(/\\/g, '/'),
      };
    });
  });

  ipcMain.handle('files:createFolder', (_event, relativePath: string) => {
    const dirPath = safeResolvePath(relativePath);
    fs.mkdirSync(dirPath, { recursive: true });
    return { success: true };
  });

  ipcMain.handle('files:rename', (_event, oldRelPath: string, newRelPath: string) => {
    const oldPath = safeResolvePath(oldRelPath);
    const newPath = safeResolvePath(newRelPath);
    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
    }
    return { success: true };
  });

  ipcMain.handle('files:delete', (_event, relativePath: string) => {
    const targetPath = safeResolvePath(relativePath);
    if (fs.existsSync(targetPath)) {
      const stat = fs.statSync(targetPath);
      if (stat.isDirectory()) {
        fs.rmSync(targetPath, { recursive: true });
      } else {
        fs.unlinkSync(targetPath);
      }
    }
    return { success: true };
  });

  ipcMain.handle('files:openInExplorer', (_event, relativePath: string) => {
    const targetPath = safeResolvePath(relativePath);
    const { shell } = require('electron') as typeof import('electron');
    shell.showItemInFolder(targetPath);
  });

  ipcMain.handle('shell:openExternal', (_event, url: string) => {
    if (!/^https?:\/\//i.test(url)) return;
    const { shell } = require('electron') as typeof import('electron');
    shell.openExternal(url);
  });

  ipcMain.handle('files:openFile', (_event, relativePath: string) => {
    const targetPath = safeResolvePath(relativePath);
    const { shell } = require('electron') as typeof import('electron');
    shell.openPath(targetPath);
  });

  ipcMain.handle('files:readFile', (_event, relativePath: string) => {
    const targetPath = safeResolvePath(relativePath);
    if (!fs.existsSync(targetPath)) return null;
    const buffer = fs.readFileSync(targetPath);
    return buffer.toString('base64');
  });

  ipcMain.handle('files:ensureClientFolder', (_event, clientName: string) => {
    const sanitized = clientName.replace(/[<>:"/\\|?*]/g, '_').trim();
    const dirPath = path.join(filesRoot, sanitized);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    return sanitized;
  });

  ipcMain.handle('files:ensureProjectFolder', (_event, clientName: string, projectName: string) => {
    const sanitizedClient = clientName.replace(/[<>:"/\\|?*]/g, '_').trim();
    const sanitizedProject = projectName.replace(/[<>:"/\\|?*]/g, '_').trim();
    const dirPath = path.join(filesRoot, sanitizedClient, sanitizedProject);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    return `${sanitizedClient}/${sanitizedProject}`;
  });

  ipcMain.handle('files:saveToClientInvoices', (_event, clientName: string, fileName: string, base64Data: string) => {
    const sanitizedClient = clientName.replace(/[<>:"/\\|?*]/g, '_').trim();
    const invoicesDir = path.join(filesRoot, sanitizedClient, 'Számlák');
    if (!fs.existsSync(invoicesDir)) {
      fs.mkdirSync(invoicesDir, { recursive: true });
    }
    const safeName = fileName.replace(/[<>:"/\\|?*]/g, '_').trim();
    const filePath = path.join(invoicesDir, safeName);
    // Prevent directory traversal
    if (!filePath.startsWith(invoicesDir)) {
      throw new Error('Invalid file path');
    }
    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
    return { relativePath: `${sanitizedClient}/Számlák/${safeName}`, absolutePath: filePath };
  });

  ipcMain.handle('files:renameFolder', (_event, oldRelPath: string, newRelPath: string) => {
    const oldPath = safeResolvePath(oldRelPath);
    const newPath = safeResolvePath(newRelPath);
    if (fs.existsSync(oldPath) && !fs.existsSync(newPath)) {
      fs.renameSync(oldPath, newPath);
      return { success: true, renamed: true };
    }
    return { success: true, renamed: false };
  });

  // Copy files from absolute source paths into a relative target directory
  ipcMain.handle('files:copyFiles', (_event, sourcePaths: string[], targetRelPath: string) => {
    const targetDir = safeResolvePath(targetRelPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const copied: string[] = [];
    for (const src of sourcePaths) {
      const stat = fs.statSync(src);
      const name = path.basename(src);
      const dest = path.join(targetDir, name);
      if (stat.isDirectory()) {
        copyDirRecursive(src, dest);
      } else {
        fs.copyFileSync(src, dest);
      }
      copied.push(name);
    }
    return { success: true, copied };
  });

  function copyDirRecursive(src: string, dest: string) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        copyDirRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  // Open native dialog to pick files
  ipcMain.handle('files:selectFiles', async () => {
    const { dialog, BrowserWindow } = require('electron') as typeof import('electron');
    const win = BrowserWindow.getFocusedWindow();
    const result = win
      ? await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'] })
      : await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] });
    if (result.canceled) return [];
    return result.filePaths;
  });

  // Open native dialog to pick a folder
  ipcMain.handle('files:selectFolder', async () => {
    const { dialog, BrowserWindow } = require('electron') as typeof import('electron');
    const win = BrowserWindow.getFocusedWindow();
    const result = win
      ? await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (result.canceled) return [];
    return result.filePaths;
  });

  // Resolve relative path to absolute (for drag-out, clipboard)
  ipcMain.handle('files:getAbsolutePath', (_event, relativePath: string) => {
    return safeResolvePath(relativePath);
  });

  // Copy/cut files within the file manager
  ipcMain.handle('files:moveFiles', (_event, sourcePaths: string[], targetRelPath: string) => {
    const targetDir = safeResolvePath(targetRelPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const moved: string[] = [];
    for (const relSrc of sourcePaths) {
      const srcAbs = safeResolvePath(relSrc);
      const name = path.basename(srcAbs);
      const dest = path.join(targetDir, name);
      if (srcAbs !== dest && fs.existsSync(srcAbs)) {
        fs.renameSync(srcAbs, dest);
        moved.push(name);
      }
    }
    return { success: true, moved };
  });

  // Start native drag-out from the app (must use 'on' + 'send', not 'handle' + 'invoke')
  ipcMain.on('files:startDrag', (event, relativePaths: string[]) => {
    const absPaths = relativePaths.map(p => safeResolvePath(p));
    const existing = absPaths.filter(p => fs.existsSync(p));
    if (existing.length === 0) return;
    const { nativeImage } = require('electron') as typeof import('electron');
    // Create a minimal 1x1 transparent icon (required by startDrag)
    const icon = nativeImage.createFromBuffer(
      Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==', 'base64')
    );
    event.sender.startDrag({
      file: existing[0],
      files: existing,
      icon,
    });
  });

  // Copy files to OS clipboard for pasting into Explorer/Finder
  ipcMain.handle('files:copyToClipboard', async (_event, relativePaths: string[]) => {
    const absPaths = relativePaths.map(p => safeResolvePath(p));
    const existing = absPaths.filter(p => fs.existsSync(p));
    if (existing.length === 0) return { success: false };
    if (process.platform === 'win32') {
      // Use PowerShell Set-Clipboard -Path for proper CF_HDROP on Windows
      const { exec } = require('child_process') as typeof import('child_process');
      const escaped = existing.map(p => `'${p.replace(/'/g, "''")}'`).join(',');
      await new Promise<void>((resolve) => {
        exec(`powershell -NoProfile -Command "Set-Clipboard -Path ${escaped}"`, () => resolve());
      });
    } else {
      // macOS/Linux: Write file URIs as text
      const { clipboard } = require('electron') as typeof import('electron');
      const uris = existing.map(p => `file://${p}`).join('\n');
      clipboard.writeText(uris);
    }
    return { success: true };
  });

  // Duplicate files/folders in-place
  ipcMain.handle('files:duplicate', (_event, relativePath: string) => {
    const srcAbs = safeResolvePath(relativePath);
    if (!fs.existsSync(srcAbs)) return { success: false };
    const dir = path.dirname(srcAbs);
    const ext = path.extname(srcAbs);
    const base = path.basename(srcAbs, ext);
    let suffix = 1;
    let dest: string;
    do {
      const newName = `${base} (${suffix})${ext}`;
      dest = path.join(dir, newName);
      suffix++;
    } while (fs.existsSync(dest));
    const stat = fs.statSync(srcAbs);
    if (stat.isDirectory()) {
      copyDirRecursive(srcAbs, dest);
    } else {
      fs.copyFileSync(srcAbs, dest);
    }
    return { success: true, newName: path.basename(dest) };
  });

  // ============ TEAM MEMBERS ============

  ipcMain.handle('db:team:getAll', () => {
    return queryAll('SELECT * FROM team_members ORDER BY name ASC');
  });

  ipcMain.handle('db:team:get', (_event, id: string) => {
    return queryOne('SELECT * FROM team_members WHERE id = ?', [id]);
  });

  ipcMain.handle('db:team:create', (_event, data: Record<string, unknown>) => {
    const id = uuidv4();
    execute(
      `INSERT INTO team_members (id, name, email, phone, role, employment_type, status, monthly_salary, salary_currency, salary_huf, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.name,
        data.email || null,
        data.phone || null,
        data.role || null,
        data.employment_type || 'employee',
        data.status || 'active',
        data.monthly_salary ?? null,
        data.salary_currency || 'HUF',
        data.salary_huf ?? null,
        data.notes || null,
      ]
    );
    return queryOne('SELECT * FROM team_members WHERE id = ?', [id]);
  });

  ipcMain.handle('db:team:update', (_event, id: string, data: Record<string, unknown>) => {
    const allowedFields = ['name', 'email', 'phone', 'role', 'employment_type', 'status', 'monthly_salary', 'salary_currency', 'salary_huf', 'notes'];
    const filteredData: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in data) filteredData[key] = data[key];
    }
    const fields = Object.keys(filteredData).map(k => `${k} = ?`).join(', ');
    const values = Object.values(filteredData);
    if (fields) {
      execute(`UPDATE team_members SET ${fields}, updated_at = datetime('now') WHERE id = ?`, [...values, id]);
    }
    return queryOne('SELECT * FROM team_members WHERE id = ?', [id]);
  });

  ipcMain.handle('db:team:delete', (_event, id: string) => {
    execute('DELETE FROM team_members WHERE id = ?', [id]);
    return { success: true };
  });

  // ============ PROJECT ASSIGNMENTS ============

  ipcMain.handle('db:team:getProjectAssignments', (_event, projectId: string) => {
    return queryAll(
      `SELECT pa.*,
              tm.name as member_name,
              tm.email as member_email,
              tm.role as member_role,
              tm.employment_type as member_employment_type
       FROM project_assignments pa
       JOIN team_members tm ON pa.team_member_id = tm.id
       WHERE pa.project_id = ?
       ORDER BY tm.name ASC`,
      [projectId]
    );
  });

  ipcMain.handle('db:team:getMemberAssignments', (_event, teamMemberId: string) => {
    return queryAll(
      `SELECT pa.*, p.name as project_name, p.status as project_status
       FROM project_assignments pa
       JOIN projects p ON pa.project_id = p.id
       WHERE pa.team_member_id = ?
       ORDER BY p.name ASC`,
      [teamMemberId]
    );
  });

  ipcMain.handle('db:team:assignToProject', (_event, projectId: string, teamMemberId: string, data?: { fee?: number | null; fee_currency?: string; fee_huf?: number | null; notes?: string | null }) => {
    const existing = queryOne(
      'SELECT id FROM project_assignments WHERE project_id = ? AND team_member_id = ?',
      [projectId, teamMemberId]
    );
    if (existing) return existing;
    const id = uuidv4();
    const payload = data ?? {};
    execute(
      'INSERT INTO project_assignments (id, project_id, team_member_id, fee, fee_currency, fee_huf, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        projectId,
        teamMemberId,
        payload.fee ?? null,
        payload.fee_currency || 'HUF',
        payload.fee_huf ?? null,
        payload.notes || null,
      ]
    );
    return queryOne('SELECT * FROM project_assignments WHERE id = ?', [id]);
  });

  ipcMain.handle('db:team:updateAssignment', (_event, assignmentId: string, data: Record<string, unknown>) => {
    const allowedFields = ['fee', 'fee_currency', 'fee_huf', 'notes'];
    const filteredData: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in data) filteredData[key] = data[key];
    }
    const fields = Object.keys(filteredData).map(k => `${k} = ?`).join(', ');
    const values = Object.values(filteredData);
    if (fields) {
      execute(`UPDATE project_assignments SET ${fields} WHERE id = ?`, [...values, assignmentId]);
    }
    return queryOne('SELECT * FROM project_assignments WHERE id = ?', [assignmentId]);
  });

  ipcMain.handle('db:team:unassignFromProject', (_event, projectId: string, teamMemberId: string) => {
    execute(
      'DELETE FROM project_assignments WHERE project_id = ? AND team_member_id = ?',
      [projectId, teamMemberId]
    );
    return { success: true };
  });

  // ============ TAX ============

  ipcMain.handle('db:tax:getBusinessTypes', () => {
    return taxService.getAllBusinessTypes();
  });

  ipcMain.handle('db:tax:getRules', (_event, businessType: string, year: number) => {
    return taxService.resolveTaxRules(businessType, year);
  });

  ipcMain.handle('db:tax:checkEligibility', (_event, businessType: string, revenue: number, employeeCount?: number, year?: number) => {
    return taxService.checkEligibility(businessType, revenue, employeeCount, year);
  });

  ipcMain.handle('db:tax:calculate', (_event, input: taxService.TaxCalcInput) => {
    return taxService.calculateTax(input);
  });

  ipcMain.handle('db:tax:getAvailableTypes', (_event, revenue: number, employeeCount?: number, year?: number) => {
    return taxService.getAvailableTaxTypes(revenue, employeeCount, year);
  });

  ipcMain.handle('db:tax:getUserSettings', (_event, year?: number) => {
    return taxService.getUserTaxSettings(year);
  });

  ipcMain.handle('db:tax:setUserSettings', (_event, businessType: string, year?: number) => {
    taxService.setUserTaxSettings(businessType, year);
    return { success: true };
  });

  ipcMain.handle('db:tax:getCalculationHistory', (_event, limit?: number) => {
    return taxService.getTaxCalculationHistory(limit);
  });

  // ── New tax module handlers ──

  ipcMain.handle('db:tax:getParameters', (_event, year: number) => {
    return taxService.getTaxParameters(year);
  });

  ipcMain.handle('db:tax:getProfile', (_event, userId?: string) => {
    return taxService.getBusinessProfile(userId);
  });

  ipcMain.handle('db:tax:saveProfile', (_event, profile: import('./tax-types').BusinessProfile) => {
    taxService.saveBusinessProfile(profile);
    taxService.syncTaxDeadlinesToCalendar(profile.userId);
    return { success: true };
  });

  ipcMain.handle('db:tax:searchHipa', (_event, query: string) => {
    return taxService.searchHipaRates(query);
  });

  ipcMain.handle('db:tax:getHipaRate', (_event, megye: string, telepules: string) => {
    return taxService.getHipaRate(megye, telepules);
  });

  ipcMain.handle('db:tax:fullEstimate', (_event, userId: string | undefined, adoev: number, evesBevétel: number) => {
    return taxService.getFullTaxEstimate(userId, adoev, evesBevétel);
  });

  ipcMain.handle('db:tax:getDeadlines', (_event, userId: string | undefined, adoev: number) => {
    return taxService.getTaxDeadlines(userId, adoev);
  });

  ipcMain.handle('db:tax:getWarnings', (_event, userId: string | undefined, bevétel: number, adoev: number) => {
    return taxService.getTaxWarnings(userId, bevétel, adoev);
  });

  ipcMain.handle('db:tax:compareForms', (_event, bevétel: number, koltsegek: number, adoev: number, hipaKulcs: number, kivet?: number) => {
    return taxService.compareTaxFormsService(bevétel, koltsegek, adoev, hipaKulcs, kivet);
  });

  // ============ BILLING / INVOICING CONFIG ============

  ipcMain.handle('billing:set-config', (_event, data: { platform: string; apiKey?: string; url?: string }) => {
    setBillingConfig(data.platform, data.apiKey, data.url);
    return { success: true };
  });

  ipcMain.handle('billing:get-config', () => {
    return getBillingConfig();
  });

  ipcMain.handle('billing:test-connection', async (_event, data: { platform: string }) => {
    const apiKey = getBillingApiKey();

    if (data.platform === 'billingo') {
      if (!apiKey) return { success: false, error: 'Nincs mentett API kulcs' };
      try {
        const res = await fetch('https://api.billingo.hu/v3/utils/time', {
          headers: { 'X-API-KEY': apiKey },
        });
        if (res.ok) return { success: true };
        if (res.status === 401 || res.status === 403) return { success: false, error: 'Hibás API kulcs' };
        return { success: false, error: `Hiba: ${res.status}` };
      } catch (err: any) {
        return { success: false, error: err.message || 'Hálózati hiba' };
      }
    }

    if (data.platform === 'szamlazz') {
      if (!apiKey) return { success: false, error: 'Nincs mentett agent kulcs' };
      if (apiKey.length < 32) return { success: false, error: 'Az agent kulcs túl rövid (legalább 32 karakter)' };
      return { success: true };
    }

    return { success: false, error: 'Ismeretlen platform' };
  });

  ipcMain.handle('billing:clear-config', () => {
    clearBillingConfig();
    return { success: true };
  });

  // ============ BILLINGO ADAPTER ============

  ipcMain.handle('billing:billingo:get-blocks', async () => {
    try {
      return { success: true, data: await billingoAdapter.getDocumentBlocks() };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('billing:billingo:get-banks', async () => {
    try {
      return { success: true, data: await billingoAdapter.getBankAccounts() };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('billing:billingo:ensure-partner', async (_event, clientData: any) => {
    try {
      const partnerId = await billingoAdapter.ensurePartner(clientData);
      return { success: true, partnerId };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('billing:billingo:create-invoice', async (_event, request: any) => {
    try {
      const result = await billingoAdapter.createInvoice(request);
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('billing:billingo:get-pdf', async (_event, invoiceId: number) => {
    try {
      const buffer = await billingoAdapter.getInvoicePdf(invoiceId);
      return { success: true, data: buffer.toString('base64') };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('billing:billingo:cancel', async (_event, invoiceId: number) => {
    try {
      await billingoAdapter.cancelInvoice(invoiceId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('billing:billingo:get-status', async (_event, invoiceId: number) => {
    try {
      const status = await billingoAdapter.getInvoiceStatus(invoiceId);
      return { success: true, status };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ============ SZÁMLÁZZ.HU ADAPTER ============

  ipcMain.handle('billing:szamlazz:create-invoice', async (_event, request: any) => {
    try {
      const result = await szamlazzAdapter.createInvoice(request);
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('billing:szamlazz:get-by-external-id', async (_event, externalId: string) => {
    try {
      const result = await szamlazzAdapter.getInvoiceByExternalId(externalId);
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('billing:szamlazz:cancel', async (_event, invoiceNumber: string) => {
    try {
      await szamlazzAdapter.cancelInvoice(invoiceNumber);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ============ UNIFIED BILLING SERVICE ============

  ipcMain.handle('billing:get-active-provider', () => {
    return { provider: billingService.getActiveProvider() };
  });

  ipcMain.handle('billing:create-invoice', async (_event, request: any) => {
    try {
      const result = await billingService.createInvoice(request);
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ============ BILLING SYNC ============

  ipcMain.handle('billing:sync-invoices', async () => {
    try {
      const result = await syncService.syncAll();
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('billing:mark-invoice-paid', async (_event, providerInvoiceId: string, provider: string, amount?: number) => {
    try {
      await billingService.markInvoicePaid(providerInvoiceId, provider, amount);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('billing:get-last-sync-time', () => {
    return { time: syncService.getLastSyncTime() };
  });

  // ============ GOOGLE ADS - AUTH & CREDENTIALS ============

  ipcMain.handle('ads:save-credentials', async (_event, config: {
    developerToken: string;
    clientId: string;
    clientSecret: string;
    mccId?: string;
  }) => {
    try {
      saveGoogleCredentials(config);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ads:get-credentials', () => {
    const creds = getGoogleCredentials();
    // Never return secrets to renderer — only hasCredentials + mccId
    return {
      hasCredentials: creds.hasCredentials,
      mccId: creds.mccId,
      clientId: creds.clientId,
    };
  });

  ipcMain.handle('ads:clear-credentials', () => {
    clearGoogleCredentials();
    return { success: true };
  });

  ipcMain.handle('ads:start-oauth', async () => {
    try {
      const { accessToken, refreshToken } = await startOAuthFlow();
      // List accessible accounts
      const customerIds = await listAccessibleAccounts(accessToken);
      // Get info for each account
      const accounts = await Promise.all(
        customerIds.map(async (cid) => {
          try {
            return await getAccountInfo(accessToken, cid);
          } catch {
            return { customerId: cid, name: `Account ${cid}`, currency: 'HUF', timezone: 'Europe/Budapest', isMcc: false };
          }
        }),
      );

      // For MCC accounts, also fetch their client accounts
      const mccAccounts = accounts.filter(a => a.isMcc);
      const clientAccountSets = await Promise.all(
        mccAccounts.map(mcc => listMccClientAccounts(accessToken, mcc.customerId)),
      );

      // Build combined list: MCC accounts + all client accounts (deduplicated)
      const seen = new Set(accounts.map(a => a.customerId.replace(/-/g, '')));
      const allAccounts = [...accounts];
      for (const clientAccounts of clientAccountSets) {
        for (const client of clientAccounts) {
          const cleanId = client.customerId.replace(/-/g, '');
          if (!seen.has(cleanId)) {
            seen.add(cleanId);
            allAccounts.push(client);
          }
        }
      }

      return { success: true, data: { accounts: allAccounts, refreshToken } };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ads:connect-account', async (_event, account: {
    customerId: string;
    name: string;
    currency: string;
    timezone: string;
    isMcc: boolean;
    refreshToken: string;
  }) => {
    try {
      const cleanCustomerId = account.customerId.replace(/-/g, '');

      // Check if this customer_id already exists (e.g. previously disconnected)
      const existing = queryOne(
        `SELECT id, status FROM ads_accounts WHERE customer_id = ?`,
        [cleanCustomerId],
      );

      let id: string;
      if (existing) {
        // Reactivate existing record
        id = existing.id as string;
        saveAccountRefreshToken(id, account.refreshToken);
        execute(
          `UPDATE ads_accounts SET name = ?, currency = ?, timezone = ?, is_mcc = ?, status = 'active', updated_at = datetime('now') WHERE id = ?`,
          [account.name, account.currency, account.timezone, account.isMcc ? 1 : 0, id],
        );
      } else {
        // Insert new record
        id = uuidv4();
        saveAccountRefreshToken(id, account.refreshToken);
        execute(
          `INSERT INTO ads_accounts (id, customer_id, name, currency, timezone, is_mcc, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'))`,
          [id, cleanCustomerId, account.name, account.currency, account.timezone, account.isMcc ? 1 : 0],
        );
      }

      return { success: true, data: { id } };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ads:disconnect-account', async (_event, accountId: string) => {
    try {
      removeAccountRefreshToken(accountId);
      execute(`UPDATE ads_accounts SET status = 'disconnected', updated_at = datetime('now') WHERE id = ?`, [accountId]);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ads:get-accounts', () => {
    try {
      const accounts = queryAll(`SELECT id, customer_id, name, currency, timezone, is_mcc, parent_mcc_id, status, last_sync_at, client_id, created_at, updated_at FROM ads_accounts WHERE status != 'disconnected' ORDER BY created_at DESC`);
      return { success: true, data: accounts };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ads:link-account', (_event, accountId: string, clientId: string | null) => {
    try {
      execute(`UPDATE ads_accounts SET client_id = ? WHERE id = ?`, [clientId, accountId]);
      saveDb();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ads:get-client-ads-summary', (_event, clientId: string) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const d30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const d60 = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);

      const accounts = queryAll(
        `SELECT id, customer_id, name FROM ads_accounts WHERE client_id = ? AND status = 'active'`,
        [clientId],
      );
      if (accounts.length === 0) return { success: true, data: null };

      const accountIds = accounts.map(a => a.id as string);
      const placeholders = accountIds.map(() => '?').join(',');

      // Current 30d KPIs
      const kpi = queryOne(
        `SELECT SUM(impressions) as impressions, SUM(clicks) as clicks, SUM(cost_micros) as cost_micros,
                SUM(conversions) as conversions, SUM(conversions_value) as conversions_value
         FROM ads_daily_metrics
         WHERE account_id IN (${placeholders}) AND entity_type = 'campaign' AND date BETWEEN ? AND ?`,
        [...accountIds, d30, today],
      );

      // Previous 30d for delta
      const prevKpi = queryOne(
        `SELECT SUM(cost_micros) as cost_micros, SUM(conversions) as conversions
         FROM ads_daily_metrics
         WHERE account_id IN (${placeholders}) AND entity_type = 'campaign' AND date BETWEEN ? AND ?`,
        [...accountIds, d60, d30],
      );

      // Campaigns
      const campaigns = queryAll(
        `SELECT c.campaign_id, c.name, c.type, c.status,
                SUM(m.impressions) as impressions, SUM(m.clicks) as clicks,
                SUM(m.cost_micros) as cost_micros, SUM(m.conversions) as conversions,
                SUM(m.conversions_value) as conversions_value
         FROM ads_campaigns c
         LEFT JOIN ads_daily_metrics m ON m.entity_id = c.campaign_id AND m.entity_type = 'campaign'
           AND m.account_id = c.account_id AND m.date BETWEEN ? AND ?
         WHERE c.account_id IN (${placeholders})
         GROUP BY c.id ORDER BY cost_micros DESC LIMIT 10`,
        [d30, today, ...accountIds],
      );

      // Daily cost for sparkline (last 30 days)
      const dailyCost = queryAll(
        `SELECT date, SUM(cost_micros) as cost_micros
         FROM ads_daily_metrics
         WHERE account_id IN (${placeholders}) AND entity_type = 'campaign' AND date BETWEEN ? AND ?
         GROUP BY date ORDER BY date`,
        [...accountIds, d30, today],
      );

      return {
        success: true,
        data: {
          accounts,
          kpi: {
            impressions: Number(kpi?.impressions || 0),
            clicks: Number(kpi?.clicks || 0),
            cost_micros: Number(kpi?.cost_micros || 0),
            conversions: Number(kpi?.conversions || 0),
            conversions_value: Number(kpi?.conversions_value || 0),
          },
          prevCostMicros: Number(prevKpi?.cost_micros || 0),
          prevConversions: Number(prevKpi?.conversions || 0),
          campaigns,
          dailyCost,
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ads:get-total-spend-summary', () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const d30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const d60 = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);

      const current = queryOne(
        `SELECT SUM(cost_micros) as cost_micros FROM ads_daily_metrics
         WHERE entity_type = 'campaign' AND date BETWEEN ? AND ?`,
        [d30, today],
      );
      const previous = queryOne(
        `SELECT SUM(cost_micros) as cost_micros FROM ads_daily_metrics
         WHERE entity_type = 'campaign' AND date BETWEEN ? AND ?`,
        [d60, d30],
      );
      const accountCount = queryOne(
        `SELECT COUNT(*) as cnt FROM ads_accounts WHERE status = 'active'`,
      );
      return {
        success: true,
        data: {
          currentSpend: Number(current?.cost_micros || 0),
          previousSpend: Number(previous?.cost_micros || 0),
          accountCount: Number(accountCount?.cnt || 0),
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ads:get-spend-by-client', () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const d30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const d60 = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);

      const rows = queryAll(
        `SELECT a.id as account_id, a.name as account_name, a.client_id,
                c.name as client_name, c.color as client_color,
                COALESCE(curr.cost_micros, 0) as current_spend,
                COALESCE(prev.cost_micros, 0) as previous_spend
         FROM ads_accounts a
         LEFT JOIN clients c ON c.id = a.client_id
         LEFT JOIN (
           SELECT account_id, SUM(cost_micros) as cost_micros
           FROM ads_daily_metrics WHERE entity_type = 'campaign' AND date BETWEEN ? AND ?
           GROUP BY account_id
         ) curr ON curr.account_id = a.id
         LEFT JOIN (
           SELECT account_id, SUM(cost_micros) as cost_micros
           FROM ads_daily_metrics WHERE entity_type = 'campaign' AND date BETWEEN ? AND ?
           GROUP BY account_id
         ) prev ON prev.account_id = a.id
         WHERE a.status = 'active'
         ORDER BY curr.cost_micros DESC`,
        [d30, today, d60, d30],
      );
      return { success: true, data: rows };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ads:list-accounts', async () => {
    try {
      // Re-use stored refresh token from existing account to get accessible customers
      const accounts = queryAll(`SELECT id FROM ads_accounts WHERE status = 'active' LIMIT 1`);
      if (accounts.length === 0) {
        return { success: false, error: 'No connected accounts. Start OAuth flow first.' };
      }
      const refreshToken = getAccountRefreshToken(accounts[0].id as string);
      if (!refreshToken) {
        return { success: false, error: 'No refresh token found.' };
      }
      const accessToken = await refreshAccessToken(refreshToken);
      const customerIds = await listAccessibleAccounts(accessToken);
      const accountInfos = await Promise.all(
        customerIds.map(async (cid) => {
          try {
            return await getAccountInfo(accessToken, cid);
          } catch {
            return { customerId: cid, name: `Account ${cid}`, currency: 'HUF', timezone: 'Europe/Budapest', isMcc: false };
          }
        }),
      );

      // For MCC accounts, also fetch their client accounts
      const mccAccounts = accountInfos.filter(a => a.isMcc);
      const clientAccountSets = await Promise.all(
        mccAccounts.map(mcc => listMccClientAccounts(accessToken, mcc.customerId)),
      );

      const seen = new Set(accountInfos.map(a => a.customerId.replace(/-/g, '')));
      const allAccounts = [...accountInfos];
      for (const clientAccounts of clientAccountSets) {
        for (const client of clientAccounts) {
          const cleanId = client.customerId.replace(/-/g, '');
          if (!seen.has(cleanId)) {
            seen.add(cleanId);
            allAccounts.push(client);
          }
        }
      }

      return { success: true, data: allAccounts };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // Google Ads Sync
  ipcMain.handle('ads:sync-account', async (_event, accountId: string, syncType?: 'full' | 'incremental' | 'catchup') => {
    try {
      const records = await syncAccount(accountId, syncType || 'incremental');
      return { success: true, data: { records } };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ads:sync-all', async (_event, syncType?: 'full' | 'incremental' | 'catchup') => {
    try {
      const result = await syncAllAccounts(syncType || 'incremental');
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ads:get-sync-log', (_event, accountId: string, limit?: number) => {
    try {
      const logs = getSyncLog(accountId, limit);
      return { success: true, data: logs };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ads:get-last-sync', (_event, accountId: string) => {
    try {
      const time = getLastSync(accountId);
      return { success: true, data: { time } };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Google Ads Data Queries ──

  ipcMain.handle('ads:get-campaigns', (_event, accountId: string) => {
    try {
      const rows = queryAll(
        `SELECT * FROM ads_campaigns WHERE account_id = ? ORDER BY name`,
        [accountId],
      );
      return { success: true, data: rows };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ads:get-ad-groups', (_event, accountId: string, campaignId?: string) => {
    try {
      const sql = campaignId
        ? `SELECT * FROM ads_ad_groups WHERE account_id = ? AND campaign_id = ? ORDER BY name`
        : `SELECT * FROM ads_ad_groups WHERE account_id = ? ORDER BY name`;
      const params = campaignId ? [accountId, campaignId] : [accountId];
      return { success: true, data: queryAll(sql, params) };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ads:get-keywords', (_event, accountId: string, adGroupId?: string) => {
    try {
      const sql = adGroupId
        ? `SELECT * FROM ads_keywords WHERE account_id = ? AND ad_group_id = ? ORDER BY keyword_text`
        : `SELECT * FROM ads_keywords WHERE account_id = ? ORDER BY keyword_text`;
      const params = adGroupId ? [accountId, adGroupId] : [accountId];
      return { success: true, data: queryAll(sql, params) };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ads:get-daily-metrics', (_event, accountId: string, entityType: string, entityId: string | null, startDate: string, endDate: string) => {
    try {
      let sql: string;
      let params: unknown[];
      if (entityId) {
        sql = `SELECT * FROM ads_daily_metrics WHERE account_id = ? AND entity_type = ? AND entity_id = ? AND date BETWEEN ? AND ? ORDER BY date`;
        params = [accountId, entityType, entityId, startDate, endDate];
      } else {
        sql = `SELECT date,
          SUM(impressions) as impressions, SUM(clicks) as clicks, SUM(cost_micros) as cost_micros,
          SUM(conversions) as conversions, SUM(conversions_value) as conversions_value
        FROM ads_daily_metrics WHERE account_id = ? AND entity_type = ? AND date BETWEEN ? AND ?
        GROUP BY date ORDER BY date`;
        params = [accountId, entityType, startDate, endDate];
      }
      return { success: true, data: queryAll(sql, params) };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ads:get-kpi-summary', (_event, accountId: string, startDate: string, endDate: string) => {
    try {
      const row = queryOne(
        `SELECT
          SUM(impressions) as impressions,
          SUM(clicks) as clicks,
          SUM(cost_micros) as cost_micros,
          SUM(conversions) as conversions,
          SUM(conversions_value) as conversions_value
        FROM ads_daily_metrics
        WHERE account_id = ? AND entity_type = 'campaign' AND date BETWEEN ? AND ?`,
        [accountId, startDate, endDate],
      );
      return { success: true, data: row || { impressions: 0, clicks: 0, cost_micros: 0, conversions: 0, conversions_value: 0 } };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ads:get-campaign-metrics', (_event, accountId: string, startDate: string, endDate: string) => {
    try {
      const rows = queryAll(
        `SELECT c.id, c.campaign_id, c.name, c.type, c.status, c.budget_amount_micros, c.budget_type,
          SUM(m.impressions) as impressions, SUM(m.clicks) as clicks, SUM(m.cost_micros) as cost_micros,
          SUM(m.conversions) as conversions, SUM(m.conversions_value) as conversions_value
        FROM ads_campaigns c
        LEFT JOIN ads_daily_metrics m ON m.entity_id = c.campaign_id AND m.entity_type = 'campaign'
          AND m.account_id = c.account_id AND m.date BETWEEN ? AND ?
        WHERE c.account_id = ?
        GROUP BY c.id
        ORDER BY cost_micros DESC`,
        [startDate, endDate, accountId],
      );
      return { success: true, data: rows };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Google Ads AI Analysis ──

  ipcMain.handle('ads:run-analysis', async (_event, accountId: string, analysisType: string, customPrompt?: string) => {
    try {
      const result = await runAnalysis(accountId, analysisType as AnalysisType, customPrompt);
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ads:get-analyses', (_event, accountId: string, limit?: number) => {
    try {
      return { success: true, data: getAnalyses(accountId, limit) };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ads:get-analysis', (_event, id: string) => {
    try {
      const analysis = getAnalysis(id);
      return analysis ? { success: true, data: analysis } : { success: false, error: 'Not found' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Google Ads Knowledge Base ──

  ipcMain.handle('ads:kb-getAll', () => {
    try {
      return { success: true, data: getKnowledgeBase() };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ads:kb-create', (_event, title: string, content: string, category?: string) => {
    try {
      const id = createKnowledgeEntry(title, content, category);
      return { success: true, data: { id } };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ads:kb-update', (_event, id: string, title: string, content: string, category?: string) => {
    try {
      updateKnowledgeEntry(id, title, content, category);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ads:kb-delete', (_event, id: string) => {
    try {
      deleteKnowledgeEntry(id);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Google Ads Alerts ──

  ipcMain.handle('ads:get-alerts', (_event, accountId: string) => {
    try {
      const alerts = getAlerts(accountId);
      return { success: true, data: alerts };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ads:dismiss-alert', (_event, alertId: string) => {
    try {
      dismissAlert(alertId);
      // Notify renderer so sidebar badge updates
      const count = getAlertCount();
      const win = BrowserWindow.getAllWindows()[0];
      if (win && !win.isDestroyed()) {
        win.webContents.send('ads:alerts-updated', { accountId: '', alertCount: count });
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ads:get-all-alerts', () => {
    try {
      const alerts = getAllAlerts();
      return { success: true, data: alerts };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ads:get-alert-count', () => {
    try {
      const count = getAlertCount();
      return { success: true, data: { count } };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ── Google Ads Campaign Detail Data ──

  ipcMain.handle('ads:get-ad-group-ads', (_event, accountId: string, campaignId: string) => {
    try {
      const rows = queryAll(
        `SELECT * FROM ads_ad_group_ads WHERE account_id = ? AND campaign_id = ? ORDER BY clicks DESC`,
        [accountId, campaignId],
      );
      return { success: true, data: rows };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ads:get-negative-keywords', (_event, accountId: string, campaignId: string) => {
    try {
      const rows = queryAll(
        `SELECT * FROM ads_negative_keywords WHERE account_id = ? AND campaign_id = ? ORDER BY keyword_text`,
        [accountId, campaignId],
      );
      return { success: true, data: rows };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ads:get-search-terms', async (_event, accountId: string, campaignId: string) => {
    try {
      const { fetchSearchTerms } = await import('./ads-api');
      const data = await fetchSearchTerms(accountId, campaignId);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ads:get-asset-groups', (_event, accountId: string, campaignId: string) => {
    try {
      const rows = queryAll(
        `SELECT * FROM ads_asset_groups WHERE account_id = ? AND campaign_id = ? ORDER BY cost_micros DESC`,
        [accountId, campaignId],
      );
      return { success: true, data: rows };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ads:get-asset-group-assets', (_event, accountId: string, campaignId: string) => {
    try {
      const rows = queryAll(
        `SELECT aga.* FROM ads_asset_group_assets aga
         JOIN ads_asset_groups ag ON ag.asset_group_id = aga.asset_group_id AND ag.account_id = aga.account_id
         WHERE ag.account_id = ? AND ag.campaign_id = ?
         ORDER BY aga.field_type, aga.performance_label`,
        [accountId, campaignId],
      );
      return { success: true, data: rows };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ads:get-shopping-performance', (_event, accountId: string, campaignId: string) => {
    try {
      const rows = queryAll(
        `SELECT * FROM ads_shopping_performance WHERE account_id = ? AND campaign_id = ? ORDER BY cost_micros DESC`,
        [accountId, campaignId],
      );
      return { success: true, data: rows };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ads:get-placements', (_event, accountId: string, campaignId: string) => {
    try {
      const rows = queryAll(
        `SELECT * FROM ads_placements WHERE account_id = ? AND campaign_id = ? ORDER BY impressions DESC`,
        [accountId, campaignId],
      );
      return { success: true, data: rows };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ads:get-keywords-with-metrics', (_event, accountId: string, campaignId: string) => {
    try {
      const endDate = new Date().toISOString().slice(0, 10);
      const startDate = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const rows = queryAll(
        `SELECT k.id, k.keyword_text, k.match_type, k.status, k.quality_score,
                k.expected_ctr, k.ad_relevance, k.landing_page_experience,
                COALESCE(SUM(m.clicks), 0) as clicks,
                COALESCE(SUM(m.cost_micros), 0) as cost_micros,
                COALESCE(SUM(m.conversions), 0) as conversions
         FROM ads_keywords k
         JOIN ads_ad_groups ag ON ag.ad_group_id = k.ad_group_id AND ag.account_id = k.account_id
         LEFT JOIN ads_daily_metrics m ON m.entity_id = k.criterion_id AND m.entity_type = 'keyword'
           AND m.account_id = k.account_id AND m.date BETWEEN ? AND ?
         WHERE k.account_id = ? AND ag.campaign_id = ?
         GROUP BY k.id
         ORDER BY clicks DESC`,
        [startDate, endDate, accountId, campaignId],
      );
      return { success: true, data: rows };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}
