import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, execute } from './db-helpers';
import { getDb, saveDb } from './database';
import {
  fetchCampaigns,
  fetchAdGroups,
  fetchKeywords,
  fetchDailyMetrics,
  fetchAdGroupAds,
  fetchNegativeKeywords,
  fetchAssetGroups,
  fetchAssetGroupAssets,
  fetchShoppingPerformance,
  fetchPlacements,
  type RawCampaign,
} from './ads-api';
import { BrowserWindow } from 'electron';
import { detectAnomalies, detectAccountLevelAlerts, saveAlerts, linkAiAnalysis, hasAutoAnalysisToday } from './ads-alerts';
import { runAnalysis } from './ads-ai';

type AdsSyncType = 'full' | 'incremental' | 'catchup';

/** Format a Date to YYYY-MM-DD */
function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Get date N days ago */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatDate(d);
}

/**
 * Sync a single Google Ads account.
 * - 'full': fetches last 30 days of metrics
 * - 'incremental': fetches last 3 days (Google Ads data can be delayed ~72h)
 * - 'catchup': same as incremental, triggered after resume
 */
export async function syncAccount(accountId: string, syncType: AdsSyncType = 'incremental'): Promise<number> {
  const logId = uuidv4();
  let recordsSynced = 0;

  // Insert sync log entry
  execute(
    `INSERT INTO ads_sync_log (id, account_id, sync_type, status, started_at) VALUES (?, ?, ?, 'running', datetime('now'))`,
    [logId, accountId, syncType],
  );

  try {
    const db = getDb();

    // 1. Sync campaigns
    const campaigns = await fetchCampaigns(accountId);
    for (const c of campaigns) {
      const id = uuidv4();
      db.run(
        `INSERT INTO ads_campaigns (id, account_id, campaign_id, name, type, status, budget_amount_micros, budget_type, bidding_strategy, start_date, end_date, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(account_id, campaign_id) DO UPDATE SET
           name = excluded.name,
           type = excluded.type,
           status = excluded.status,
           budget_amount_micros = excluded.budget_amount_micros,
           budget_type = excluded.budget_type,
           bidding_strategy = excluded.bidding_strategy,
           start_date = excluded.start_date,
           end_date = excluded.end_date,
           updated_at = datetime('now')`,
        [id, accountId, c.campaign_id, c.name, c.type, c.status, c.budget_amount_micros, c.budget_type, c.bidding_strategy, c.start_date, c.end_date],
      );
      recordsSynced++;
    }

    // 2. Sync ad groups
    const adGroups = await fetchAdGroups(accountId);
    for (const ag of adGroups) {
      const id = uuidv4();
      db.run(
        `INSERT INTO ads_ad_groups (id, account_id, campaign_id, ad_group_id, name, status, cpc_bid_micros, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(account_id, ad_group_id) DO UPDATE SET
           campaign_id = excluded.campaign_id,
           name = excluded.name,
           status = excluded.status,
           cpc_bid_micros = excluded.cpc_bid_micros,
           updated_at = datetime('now')`,
        [id, accountId, ag.campaign_id, ag.ad_group_id, ag.name, ag.status, ag.cpc_bid_micros],
      );
      recordsSynced++;
    }

    // 3. Sync keywords
    const keywords = await fetchKeywords(accountId);
    for (const kw of keywords) {
      const id = uuidv4();
      db.run(
        `INSERT INTO ads_keywords (id, account_id, ad_group_id, criterion_id, keyword_text, match_type, status, quality_score, expected_ctr, ad_relevance, landing_page_experience, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(account_id, criterion_id) DO UPDATE SET
           ad_group_id = excluded.ad_group_id,
           keyword_text = excluded.keyword_text,
           match_type = excluded.match_type,
           status = excluded.status,
           quality_score = excluded.quality_score,
           expected_ctr = excluded.expected_ctr,
           ad_relevance = excluded.ad_relevance,
           landing_page_experience = excluded.landing_page_experience,
           updated_at = datetime('now')`,
        [id, accountId, kw.ad_group_id, kw.criterion_id, kw.keyword_text, kw.match_type, kw.status, kw.quality_score, kw.expected_ctr, kw.ad_relevance, kw.landing_page_experience],
      );
      recordsSynced++;
    }

    // 4. Sync daily metrics
    const startDate = syncType === 'full' ? daysAgo(30) : daysAgo(3);
    const endDate = formatDate(new Date());

    for (const entityType of ['campaign', 'ad_group', 'keyword'] as const) {
      try {
        const metrics = await fetchDailyMetrics(accountId, entityType, startDate, endDate);
        for (const m of metrics) {
          const id = uuidv4();
          db.run(
            `INSERT INTO ads_daily_metrics (id, account_id, entity_type, entity_id, date, impressions, clicks, cost_micros, conversions, conversions_value, ctr, avg_cpc_micros, search_impression_share, search_budget_lost_is, search_rank_lost_is)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(account_id, entity_type, entity_id, date) DO UPDATE SET
               impressions = excluded.impressions,
               clicks = excluded.clicks,
               cost_micros = excluded.cost_micros,
               conversions = excluded.conversions,
               conversions_value = excluded.conversions_value,
               ctr = excluded.ctr,
               avg_cpc_micros = excluded.avg_cpc_micros,
               search_impression_share = excluded.search_impression_share,
               search_budget_lost_is = excluded.search_budget_lost_is,
               search_rank_lost_is = excluded.search_rank_lost_is`,
            [id, accountId, entityType, m.entity_id, m.date, m.impressions, m.clicks, m.cost_micros, m.conversions, m.conversions_value, m.ctr, m.avg_cpc_micros, m.search_impression_share, m.search_budget_lost_is, m.search_rank_lost_is],
          );
          recordsSynced++;
        }
      } catch (err) {
        // Ad group / keyword metrics might fail for some account types — log and continue
        console.warn(`[AdsSync] Failed to fetch ${entityType} metrics for ${accountId}:`, err);
      }
    }

    // 5. Sync campaign-type-specific data
    for (const c of campaigns) {
      try {
        if (c.type === 'SEARCH') {
          // Ad group ads (responsive search ads)
          const ads = await fetchAdGroupAds(accountId, c.campaign_id);
          for (const ad of ads) {
            const id = uuidv4();
            db.run(
              `INSERT INTO ads_ad_group_ads (id, account_id, ad_group_id, campaign_id, ad_id, ad_type, headlines, descriptions, status, impressions, clicks, ctr, cost_micros, conversions, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
               ON CONFLICT(account_id, ad_id) DO UPDATE SET
                 ad_group_id = excluded.ad_group_id,
                 campaign_id = excluded.campaign_id,
                 ad_type = excluded.ad_type,
                 headlines = excluded.headlines,
                 descriptions = excluded.descriptions,
                 status = excluded.status,
                 impressions = excluded.impressions,
                 clicks = excluded.clicks,
                 ctr = excluded.ctr,
                 cost_micros = excluded.cost_micros,
                 conversions = excluded.conversions,
                 updated_at = datetime('now')`,
              [id, accountId, ad.ad_group_id, ad.campaign_id, ad.ad_id, ad.ad_type, JSON.stringify(ad.headlines), JSON.stringify(ad.descriptions), ad.status, ad.impressions, ad.clicks, ad.ctr, ad.cost_micros, ad.conversions],
            );
            recordsSynced++;
          }

          // Negative keywords
          const negKws = await fetchNegativeKeywords(accountId, c.campaign_id);
          for (const nk of negKws) {
            const id = uuidv4();
            db.run(
              `INSERT INTO ads_negative_keywords (id, account_id, campaign_id, keyword_text, match_type)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(account_id, campaign_id, keyword_text) DO UPDATE SET
                 match_type = excluded.match_type`,
              [id, accountId, c.campaign_id, nk.keyword_text, nk.match_type],
            );
            recordsSynced++;
          }
        } else if (c.type === 'PERFORMANCE_MAX') {
          // Asset groups
          const assetGroups = await fetchAssetGroups(accountId, c.campaign_id);
          for (const ag of assetGroups) {
            const id = uuidv4();
            db.run(
              `INSERT INTO ads_asset_groups (id, account_id, campaign_id, asset_group_id, name, status, ad_strength, impressions, clicks, cost_micros, conversions, conversions_value, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
               ON CONFLICT(account_id, asset_group_id) DO UPDATE SET
                 campaign_id = excluded.campaign_id,
                 name = excluded.name,
                 status = excluded.status,
                 ad_strength = excluded.ad_strength,
                 impressions = excluded.impressions,
                 clicks = excluded.clicks,
                 cost_micros = excluded.cost_micros,
                 conversions = excluded.conversions,
                 conversions_value = excluded.conversions_value,
                 updated_at = datetime('now')`,
              [id, accountId, c.campaign_id, ag.asset_group_id, ag.name, ag.status, ag.ad_strength, ag.impressions, ag.clicks, ag.cost_micros, ag.conversions, ag.conversions_value],
            );
            recordsSynced++;
          }

          // Asset group assets — clear old data first (no UNIQUE constraint)
          const agIds = assetGroups.map(ag => ag.asset_group_id);
          if (agIds.length > 0) {
            for (const agId of agIds) {
              db.run(`DELETE FROM ads_asset_group_assets WHERE account_id = ? AND asset_group_id = ?`, [accountId, agId]);
            }
            const assets = await fetchAssetGroupAssets(accountId, agIds);
            for (const a of assets) {
              const id = uuidv4();
              db.run(
                `INSERT INTO ads_asset_group_assets (id, account_id, asset_group_id, field_type, performance_label, asset_text, asset_name, status, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                [id, accountId, a.asset_group_id, a.field_type, a.performance_label, a.asset_text, a.asset_name, a.status],
              );
              recordsSynced++;
            }
          }

          // Shopping performance
          const shopping = await fetchShoppingPerformance(accountId, c.campaign_id);
          for (const s of shopping) {
            const id = uuidv4();
            db.run(
              `INSERT INTO ads_shopping_performance (id, account_id, campaign_id, product_title, product_item_id, impressions, clicks, cost_micros, conversions, conversions_value, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
               ON CONFLICT(account_id, campaign_id, product_item_id) DO UPDATE SET
                 product_title = excluded.product_title,
                 impressions = excluded.impressions,
                 clicks = excluded.clicks,
                 cost_micros = excluded.cost_micros,
                 conversions = excluded.conversions,
                 conversions_value = excluded.conversions_value,
                 updated_at = datetime('now')`,
              [id, accountId, c.campaign_id, s.product_title, s.product_item_id, s.impressions, s.clicks, s.cost_micros, s.conversions, s.conversions_value],
            );
            recordsSynced++;
          }

          // Placements
          const placements = await fetchPlacements(accountId, c.campaign_id);
          for (const p of placements) {
            const id = uuidv4();
            db.run(
              `INSERT INTO ads_placements (id, account_id, campaign_id, display_name, target_url, placement_type, impressions, clicks, cost_micros, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
               ON CONFLICT(account_id, campaign_id, target_url) DO UPDATE SET
                 display_name = excluded.display_name,
                 placement_type = excluded.placement_type,
                 impressions = excluded.impressions,
                 clicks = excluded.clicks,
                 cost_micros = excluded.cost_micros,
                 updated_at = datetime('now')`,
              [id, accountId, c.campaign_id, p.display_name, p.target_url, p.placement_type, p.impressions, p.clicks, p.cost_micros],
            );
            recordsSynced++;
          }
        }
      } catch (err) {
        console.warn(`[AdsSync] Failed to sync detail data for campaign ${c.campaign_id} (${c.type}):`, err);
      }
    }

    // Update sync log: completed
    execute(
      `UPDATE ads_sync_log SET status = 'completed', completed_at = datetime('now'), records_synced = ? WHERE id = ?`,
      [recordsSynced, logId],
    );

    // Update account last_sync_at
    execute(
      `UPDATE ads_accounts SET last_sync_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
      [accountId],
    );

    saveDb();
    console.log(`[AdsSync] Account ${accountId} synced: ${recordsSynced} records (${syncType})`);

    // Run alert detection asynchronously (non-blocking — sync is already "completed")
    runPostSyncAlerts(accountId).catch(err => {
      console.error('[AdsSync] Post-sync alert detection failed:', err);
    });

    return recordsSynced;
  } catch (err: any) {
    // Update sync log: failed
    execute(
      `UPDATE ads_sync_log SET status = 'failed', completed_at = datetime('now'), error_message = ? WHERE id = ?`,
      [err.message || String(err), logId],
    );
    saveDb();
    console.error(`[AdsSync] Failed to sync account ${accountId}:`, err);
    throw err;
  }
}

/** Sync all active accounts */
export async function syncAllAccounts(syncType: AdsSyncType = 'incremental'): Promise<{
  synced: number;
  failed: number;
  total: number;
}> {
  const accounts = queryAll(`SELECT id FROM ads_accounts WHERE status = 'active'`);
  let synced = 0;
  let failed = 0;

  for (const acc of accounts) {
    try {
      await syncAccount(acc.id as string, syncType);
      synced++;
    } catch {
      failed++;
    }
  }

  return { synced, failed, total: accounts.length };
}

/** Get sync logs for an account */
export function getSyncLog(accountId: string, limit = 20): any[] {
  return queryAll(
    `SELECT * FROM ads_sync_log WHERE account_id = ? ORDER BY started_at DESC LIMIT ?`,
    [accountId, limit],
  );
}

/** Get last successful sync time for an account */
export function getLastSync(accountId: string): string | null {
  const row = queryOne(
    `SELECT completed_at FROM ads_sync_log WHERE account_id = ? AND status = 'completed' ORDER BY completed_at DESC LIMIT 1`,
    [accountId],
  );
  return (row?.completed_at as string) || null;
}

/**
 * Run rule-based alert detection after a successful sync.
 * Also triggers auto AI analysis for CRITICAL alerts (max 1×/day/account).
 */
async function runPostSyncAlerts(accountId: string): Promise<void> {
  // 1. Detect anomalies
  const campaignAlerts = detectAnomalies(accountId);
  const accountAlerts = detectAccountLevelAlerts(accountId);
  const allAlerts = [...campaignAlerts, ...accountAlerts];

  // 2. Save alerts (handles dedup + cleanup)
  saveAlerts(accountId, allAlerts);

  const alertCount = allAlerts.filter(a => a.severity === 'critical' || a.severity === 'warning').length;
  console.log(`[AdsSync] Alerts for ${accountId}: ${allAlerts.length} total (${alertCount} critical/warning)`);

  // 3. Notify renderer
  const win = BrowserWindow.getAllWindows()[0];
  if (win && !win.isDestroyed()) {
    win.webContents.send('ads:alerts-updated', { accountId, alertCount });
  }

  // 4. Auto AI analysis for CRITICAL alerts (max 1×/day/account)
  const criticalAlerts = allAlerts.filter(a => a.severity === 'critical');
  if (criticalAlerts.length > 0 && !hasAutoAnalysisToday(accountId)) {
    try {
      const result = await runAnalysis(accountId, 'anomaly');
      if (result?.id) {
        linkAiAnalysis(accountId, criticalAlerts.map(a => a.id), result.id);
      }
      console.log(`[AdsSync] Auto AI analysis triggered for ${accountId}`);
    } catch (err) {
      console.error('[AdsSync] Auto AI analysis failed:', err);
    }
  }
}
