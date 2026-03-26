import { ipcMain, net, BrowserWindow, shell } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, execute } from './db-helpers';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { getSupabase } from './supabase';

function sanitizeFolderName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').trim();
}

function getFilesRoot(): string {
  return path.join(app.getPath('userData'), 'Files');
}

const USER_FIELDS = 'id, name, email, invoice_platform, onboarding_complete, pomodoro_project_tracking, revenue_goal_yearly, created_at';

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
      const local = ensureLocalUser(session.user.id, session.user.email ?? '');
      return local;
    } catch {
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

    // If identities is empty, the email already exists but is unconfirmed — resend confirmation
    if (authData.user.identities?.length === 0) {
      await sb.auth.resend({ type: 'signup', email, options: { emailRedirectTo: 'https://klient.work/confirmed' } });
    }

    const local = ensureLocalUser(authData.user.id, authData.user.email ?? '', data.name as string);
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

    const local = ensureLocalUser(authData.user.id, authData.user.email ?? '', authData.user.user_metadata?.name as string);
    return local;
  });

  // Logout
  ipcMain.handle('db:user:logout', async () => {
    try {
      const sb = getSupabase();
      await sb.auth.signOut();
    } catch { /* ignore */ }
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
    const local = ensureLocalUser(authData.user.id, authData.user.email ?? '', authData.user.user_metadata?.name as string);
    return { confirmed: true, user: local };
  });

  // Google OAuth
  ipcMain.handle('db:user:googleAuth', async () => {
    const sb = getSupabase();
    const redirectUrl = 'http://localhost/auth/callback';

    const { data, error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        skipBrowserRedirect: true,
        redirectTo: redirectUrl,
      },
    });

    if (error || !data.url) throw new Error(error?.message || 'Google auth indítása sikertelen');

    return new Promise<Record<string, unknown>>((resolve, reject) => {
      let settled = false;

      const authWindow = new BrowserWindow({
        width: 500,
        height: 700,
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          partition: 'oauth',
        },
      });

      const handleCallback = async (url: string) => {
        if (settled || !url.startsWith(redirectUrl)) return;
        settled = true;

        try {
          const urlObj = new URL(url);
          const code = urlObj.searchParams.get('code');

          // Also check hash params (implicit flow fallback)
          const hashStr = url.includes('#') ? url.split('#')[1] : '';
          const hashParams = new URLSearchParams(hashStr);
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');

          let userId: string | undefined;
          let userEmail: string | undefined;
          let userName: string | undefined;

          if (code) {
            // PKCE flow
            const { data: session, error: sessErr } = await sb.auth.exchangeCodeForSession(code);
            if (sessErr || !session.user) throw new Error(sessErr?.message || 'Session hiba');
            userId = session.user.id;
            userEmail = session.user.email;
            userName = session.user.user_metadata?.full_name || session.user.user_metadata?.name;
          } else if (accessToken && refreshToken) {
            // Implicit flow
            const { data: session, error: sessErr } = await sb.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
            if (sessErr || !session.user) throw new Error(sessErr?.message || 'Session hiba');
            userId = session.user.id;
            userEmail = session.user.email;
            userName = session.user.user_metadata?.full_name || session.user.user_metadata?.name;
          } else {
            throw new Error('Nem érkezett token a Google-tól');
          }

          const local = ensureLocalUser(userId!, userEmail ?? '', userName);
          authWindow.close();
          resolve(local);
        } catch (err) {
          authWindow.close();
          reject(err);
        }
      };

      // Intercept redirects to localhost callback
      authWindow.webContents.on('will-redirect', (_event, url) => { handleCallback(url); });
      authWindow.webContents.on('will-navigate', (_event, url) => { handleCallback(url); });

      // Also intercept via request filter (catches PKCE code in query params)
      authWindow.webContents.session.webRequest.onBeforeRequest(
        { urls: [`${redirectUrl}*`] },
        (details, callback) => {
          if (details.url.startsWith(redirectUrl)) {
            callback({ cancel: true });
            handleCallback(details.url);
          } else {
            callback({ cancel: false });
          }
        }
      );

      authWindow.on('closed', () => {
        if (!settled) {
          settled = true;
          reject(new Error('Google bejelentkezés megszakítva'));
        }
      });

      authWindow.loadURL(data.url);
    });
  });

  // Update local user settings (non-auth fields)
  ipcMain.handle('db:user:update', (_event, id: string, data: Record<string, unknown>) => {
    const allowedFields = ['name', 'email', 'invoice_platform', 'onboarding_complete', 'pomodoro_project_tracking', 'revenue_goal_yearly'];
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
          // Trial expired — update status in Supabase
          await sb.from('subscriptions')
            .update({ status: 'expired' })
            .eq('user_id', session.user.id);
          data.status = 'expired';
        }
      }

      // Check if paid subscription period has ended
      if ((data.status === 'active' || data.status === 'cancelled') && data.current_period_end && data.plan !== 'lifetime') {
        const periodEnd = new Date(data.current_period_end);
        if (periodEnd < new Date()) {
          await sb.from('subscriptions')
            .update({ status: 'expired' })
            .eq('user_id', session.user.id);
          data.status = 'expired';
        }
      }

      return data;
    } catch (err) {
      console.error('[Subscription] Error fetching:', err);
      return null;
    }
  });

  // ── Stripe Checkout — creates session via Supabase Edge Function ──
  ipcMain.handle('db:subscription:checkout', async (_event, data: { plan: 'monthly' | 'yearly' | 'lifetime' }) => {
    const sb = getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user) throw new Error('Nincs bejelentkezve');

    const res = await sb.functions.invoke('create-checkout', {
      body: { plan: data.plan },
    });

    if (res.error) throw new Error(res.error.message || 'Checkout hiba');
    const result = res.data as { url?: string; error?: string };
    if (result.error || !result.url) throw new Error(result.error || 'Nincs checkout URL');

    return { success: true, url: result.url };
  });

  // Cancel subscription (cancel_at_period_end)
  ipcMain.handle('db:subscription:cancel', async () => {
    const sb = getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user) throw new Error('Nincs bejelentkezve');

    const res = await sb.functions.invoke('manage-subscription', {
      body: { action: 'cancel' },
    });

    if (res.error) throw new Error(res.error.message || 'Lemondási hiba');
    const result = res.data as { success?: boolean; error?: string };
    if (result.error) throw new Error(result.error);
    return { success: true };
  });

  // Reactivate cancelled subscription
  ipcMain.handle('db:subscription:reactivate', async () => {
    const sb = getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user) throw new Error('Nincs bejelentkezve');

    const res = await sb.functions.invoke('manage-subscription', {
      body: { action: 'reactivate' },
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
      `INSERT INTO clients (id, name, email, phone, company, address, notes, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.name, data.email, data.phone, data.company, data.address, data.notes, data.color || '#6366f1']
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
    const allowedFields = ['name', 'email', 'phone', 'company', 'address', 'notes', 'color'];
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
    execute(
      `INSERT INTO invoices (id, project_id, client_id, file_path, invoice_number, amount, currency, issue_date, due_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [invoiceId, id, project.client_id, invoiceData.file_path, invoiceData.invoice_number, invoiceData.amount, invoiceData.currency || 'HUF', invoiceData.issue_date, invoiceData.due_date, invoiceData.notes]
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
    execute(
      `INSERT INTO invoices (id, project_id, client_id, file_path, invoice_number, amount, currency, issue_date, due_date, status, notes, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.project_id, data.client_id, data.file_path, data.invoice_number, data.amount, data.currency || 'HUF', data.issue_date, data.due_date, data.status || 'pending', data.notes, data.type || 'invoice']
    );
    return queryOne('SELECT * FROM invoices WHERE id = ?', [id]);
  });

  ipcMain.handle('db:invoices:update', (_event, id: string, data: Record<string, unknown>) => {
    const allowedFields = ['invoice_number', 'amount', 'currency', 'issue_date', 'due_date', 'status', 'notes', 'file_path', 'client_id', 'project_id', 'type'];
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

  ipcMain.handle('db:invoices:delete', (_event, id: string) => {
    execute('DELETE FROM invoices WHERE id = ?', [id]);
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
        COALESCE((SELECT SUM(i.amount) FROM invoices i WHERE i.project_id = p.id), 0) as invoiced_total,
        COALESCE((SELECT SUM(i.amount) FROM invoices i WHERE i.project_id = p.id AND i.status = 'paid'), 0) as paid_total
       FROM projects p LEFT JOIN clients c ON p.client_id = c.id
       WHERE p.status IN ('active', 'completed') AND p.estimated_hours > 0
         AND p.client_id IS NOT NULL AND p.client_id != ''
         AND NOT (
           (SELECT COUNT(*) FROM invoices i WHERE i.project_id = p.id) > 0
           AND (SELECT COUNT(*) FROM invoices i WHERE i.project_id = p.id AND i.status != 'paid') = 0
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
    const monthlySubscriptions = (queryOne(
      `SELECT COALESCE(SUM(COALESCE(amount_huf, amount)), 0) as total FROM expenses
       WHERE type = 'subscription' AND frequency = 'monthly'
         AND (end_date IS NULL OR end_date >= date('now'))`
    ) as Record<string, number>)?.total ?? 0;
    const yearlySubscriptions = (queryOne(
      `SELECT COALESCE(SUM(COALESCE(amount_huf, amount) / 12.0), 0) as total FROM expenses
       WHERE type = 'subscription' AND frequency = 'yearly'
         AND (end_date IS NULL OR end_date >= date('now'))`
    ) as Record<string, number>)?.total ?? 0;
    const monthlyExpenses = Math.round(monthlySubscriptions + yearlySubscriptions);
    const yearlyExpenses = (queryOne(
      `SELECT COALESCE(SUM(
        CASE
          WHEN frequency = 'monthly' THEN COALESCE(amount_huf, amount) * 12
          WHEN frequency = 'yearly' THEN COALESCE(amount_huf, amount)
          WHEN frequency = 'one-time' THEN COALESCE(amount_huf, amount)
        END
      ), 0) as total FROM expenses
       WHERE (end_date IS NULL OR end_date >= date('now', 'start of year'))
         AND start_date <= date('now')`
    ) as Record<string, number>)?.total ?? 0;
    const revenueGoal = (queryOne('SELECT revenue_goal_yearly FROM user_settings LIMIT 1') as Record<string, number>)?.revenue_goal_yearly ?? 0;
    const expensesByCategory = queryAll(
      `SELECT category, COALESCE(SUM(
        CASE
          WHEN frequency = 'monthly' THEN COALESCE(amount_huf, amount) * 12
          WHEN frequency = 'yearly' THEN COALESCE(amount_huf, amount)
          WHEN frequency = 'one-time' THEN COALESCE(amount_huf, amount)
        END
      ), 0) as total FROM expenses
       WHERE (end_date IS NULL OR end_date >= date('now', 'start of year'))
         AND start_date <= date('now')
       GROUP BY category ORDER BY total DESC`
    ) as { category: string; total: number }[];
    const monthlyExpensesTrend = queryAll(
      `SELECT strftime('%Y-%m', start_date) as month, COALESCE(SUM(
        CASE
          WHEN frequency = 'monthly' THEN COALESCE(amount_huf, amount)
          WHEN frequency = 'yearly' THEN COALESCE(amount_huf, amount) / 12.0
          WHEN frequency = 'one-time' THEN COALESCE(amount_huf, amount)
        END
      ), 0) as total FROM expenses
       WHERE start_date >= date('now', '-11 months', 'start of month')
         AND (end_date IS NULL OR end_date >= date('now', '-11 months', 'start of month'))
       GROUP BY month ORDER BY month ASC`
    ) as { month: string; total: number }[];
    return {
      paidLastMonth,
      yearlyRevenue,
      yearlyMonthly,
      topClients,
      avgPaymentDays: Math.round(avgPaymentDays),
      monthlyExpenses,
      yearlyExpenses: Math.round(yearlyExpenses),
      revenueGoal,
      expensesByCategory,
      monthlyExpensesTrend,
    };
  });

  // ============ EXPENSES ============
  ipcMain.handle('db:expenses:getAll', () => {
    return queryAll('SELECT * FROM expenses ORDER BY created_at DESC');
  });

  ipcMain.handle('db:expenses:create', (_event, data: Record<string, unknown>) => {
    const id = uuidv4();
    const amountHuf = data.amount_huf ?? data.amount;
    execute(
      `INSERT INTO expenses (id, name, amount, currency, amount_huf, category, type, frequency, start_date, end_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.name, data.amount, data.currency || 'HUF', amountHuf, data.category || 'other', data.type || 'subscription', data.frequency || 'monthly', data.start_date || new Date().toISOString().split('T')[0], data.end_date || null, data.notes || null]
    );
    return queryOne('SELECT * FROM expenses WHERE id = ?', [id]);
  });

  ipcMain.handle('db:expenses:update', (_event, id: string, data: Record<string, unknown>) => {
    const allowedFields = ['name', 'amount', 'currency', 'amount_huf', 'category', 'type', 'frequency', 'start_date', 'end_date', 'notes'];
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
}
