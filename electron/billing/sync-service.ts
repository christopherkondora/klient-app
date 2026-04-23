import { queryAll, execute } from '../db-helpers';
import { getActiveProvider } from './billing-service';
import * as billingoAdapter from './billingo-adapter';
import * as szamlazzAdapter from './szamlazz-adapter';
import { BrowserWindow } from 'electron';

// ── State ──

let pollTimer: ReturnType<typeof setInterval> | null = null;
let lastSyncTime: string | null = null;

const POLL_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

// ── Sync logic ──

export interface SyncResult {
  synced: number;
  errors: number;
  total: number;
}

/**
 * Synchronise all pending API-generated invoices with their provider.
 * Returns the count of invoices that changed status.
 */
export async function syncAll(): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, errors: 0, total: 0 };

  // Find pending invoices that have a provider
  const pendingInvoices = queryAll(
    `SELECT id, provider, provider_invoice_id, status
     FROM invoices
     WHERE provider IS NOT NULL AND provider_invoice_id IS NOT NULL AND status = 'pending'`
  );

  result.total = pendingInvoices.length;
  if (result.total === 0) {
    lastSyncTime = new Date().toISOString();
    return result;
  }

  const provider = getActiveProvider();

  for (const inv of pendingInvoices) {
    try {
      const invProvider = inv.provider as string;
      const providerInvoiceId = inv.provider_invoice_id as string;
      let newStatus: string | null = null;

      if (invProvider === 'billingo' && provider === 'billingo') {
        // Billingo: providerInvoiceId is the numeric document id
        const paymentStatus = await billingoAdapter.getInvoiceStatus(parseInt(providerInvoiceId, 10));
        // Billingo returns: "paid" | "outstanding" | "overdue"
        if (paymentStatus === 'paid') {
          newStatus = 'paid';
        } else if (paymentStatus === 'overdue') {
          newStatus = 'overdue';
        }
      } else if (invProvider === 'szamlazz' && provider === 'szamlazz') {
        // Számlázz.hu: query by external id (project id stored as providerInvoiceId = invoice number)
        const queryResult = await szamlazzAdapter.getInvoiceByExternalId(providerInvoiceId);
        if (queryResult) {
          // The status field from Számlázz.hu XML
          const st = queryResult.status?.toLowerCase();
          if (st === 'fizetve' || st === 'paid' || st === 'kifizetett') {
            newStatus = 'paid';
          }
        }
      }

      if (newStatus && newStatus !== (inv.status as string)) {
        execute(
          `UPDATE invoices SET status = ?, provider_synced_at = ? WHERE id = ?`,
          [newStatus, new Date().toISOString(), inv.id]
        );
        result.synced++;
      } else {
        // Update synced_at even if no status change
        execute(
          `UPDATE invoices SET provider_synced_at = ? WHERE id = ?`,
          [new Date().toISOString(), inv.id]
        );
      }
    } catch (err) {
      console.error(`[Billing Sync] Error syncing invoice ${inv.id}:`, err);
      result.errors++;
    }
  }

  lastSyncTime = new Date().toISOString();

  // Notify renderer if anything changed
  if (result.synced > 0) {
    const win = BrowserWindow.getAllWindows()[0];
    if (win && !win.isDestroyed()) {
      win.webContents.send('billing:sync-updated', result);
    }
  }

  return result;
}

// ── Polling ──

export function startPolling(): void {
  if (pollTimer) return;
  // Initial sync after short delay (let DB settle after login)
  setTimeout(() => {
    syncAll().catch(err => console.error('[Billing Sync] Initial sync error:', err));
  }, 5000);

  pollTimer = setInterval(() => {
    syncAll().catch(err => console.error('[Billing Sync] Poll error:', err));
  }, POLL_INTERVAL_MS);
  console.log('[Billing Sync] Polling started (30 min interval)');
}

export function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    console.log('[Billing Sync] Polling stopped');
  }
}

export function getLastSyncTime(): string | null {
  return lastSyncTime;
}
