import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, execute } from './db-helpers';
import { getDb, saveDb } from './database';

export interface AdsAlert {
  id: string;
  accountId: string;
  campaignId?: string;
  campaignName?: string;
  severity: 'critical' | 'warning' | 'info';
  type: string;
  title: string;
  description: string;
  metric: string;
  currentValue: number;
  previousValue: number;
  changePercent: number;
  detectedAt: string;
  dismissed: boolean;
  aiAnalysisId?: string;
}

interface PeriodMetrics {
  campaign_id: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  cost_micros: number;
  conversions: number;
  conversions_value: number;
  avg_cpc_micros: number;
  ctr: number;
  search_budget_lost_is: number;
  search_impression_share: number;
}

function percentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgoDate(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatDate(d);
}

/**
 * Detect campaign-level anomalies by comparing last 7 days vs previous 7 days.
 */
export function detectAnomalies(accountId: string): AdsAlert[] {
  const alerts: AdsAlert[] = [];
  const now = new Date();
  const last7Start = daysAgoDate(7);
  const last7End = formatDate(now);
  const prev7Start = daysAgoDate(14);
  const prev7End = daysAgoDate(8);

  // Get enabled campaigns
  const campaigns = queryAll(
    `SELECT campaign_id, name FROM ads_campaigns WHERE account_id = ? AND status = 'ENABLED'`,
    [accountId],
  ) as { campaign_id: string; name: string }[];

  for (const camp of campaigns) {
    const current = queryOne(
      `SELECT
        COALESCE(SUM(impressions), 0) as impressions,
        COALESCE(SUM(clicks), 0) as clicks,
        COALESCE(SUM(cost_micros), 0) as cost_micros,
        COALESCE(SUM(conversions), 0) as conversions,
        COALESCE(SUM(conversions_value), 0) as conversions_value,
        COALESCE(AVG(avg_cpc_micros), 0) as avg_cpc_micros,
        COALESCE(AVG(ctr), 0) as ctr,
        COALESCE(AVG(search_budget_lost_is), 0) as search_budget_lost_is,
        COALESCE(AVG(search_impression_share), 0) as search_impression_share
      FROM ads_daily_metrics
      WHERE account_id = ? AND entity_type = 'campaign' AND entity_id = ? AND date BETWEEN ? AND ?`,
      [accountId, camp.campaign_id, last7Start, last7End],
    ) as unknown as PeriodMetrics | null;

    const previous = queryOne(
      `SELECT
        COALESCE(SUM(impressions), 0) as impressions,
        COALESCE(SUM(clicks), 0) as clicks,
        COALESCE(SUM(cost_micros), 0) as cost_micros,
        COALESCE(SUM(conversions), 0) as conversions,
        COALESCE(SUM(conversions_value), 0) as conversions_value,
        COALESCE(AVG(avg_cpc_micros), 0) as avg_cpc_micros,
        COALESCE(AVG(ctr), 0) as ctr,
        COALESCE(AVG(search_budget_lost_is), 0) as search_budget_lost_is,
        COALESCE(AVG(search_impression_share), 0) as search_impression_share
      FROM ads_daily_metrics
      WHERE account_id = ? AND entity_type = 'campaign' AND entity_id = ? AND date BETWEEN ? AND ?`,
      [accountId, camp.campaign_id, prev7Start, prev7End],
    ) as unknown as PeriodMetrics | null;

    if (!current || !previous) continue;
    // Minimum threshold: 100 impressions in previous period
    if (previous.impressions < 100) continue;

    const changes = {
      ctr: percentChange(current.ctr, previous.ctr),
      cpc: percentChange(current.avg_cpc_micros, previous.avg_cpc_micros),
      conversions: percentChange(current.conversions, previous.conversions),
      cost: percentChange(current.cost_micros, previous.cost_micros),
      impressionShare: (current.search_impression_share || 0) - (previous.search_impression_share || 0),
    };

    const currentCostHuf = current.cost_micros / 1_000_000;
    const currentRoas = currentCostHuf > 0 ? current.conversions_value / currentCostHuf : 0;

    // Conversions drop ≥30% → CRITICAL
    if (changes.conversions <= -30 && previous.conversions >= 1) {
      alerts.push(makeAlert(accountId, camp, 'critical', 'conversions_drop', 'Konverziók 30%+ csökkenése',
        `Az utóbbi 7 napban: ${current.conversions.toFixed(1)} konv. vs előző 7 nap: ${previous.conversions.toFixed(1)} konv. (${changes.conversions.toFixed(0)}%)`,
        'conversions', current.conversions, previous.conversions, changes.conversions));
    }

    // CTR drop ≥25% → WARNING
    if (changes.ctr <= -25 && previous.ctr > 0) {
      alerts.push(makeAlert(accountId, camp, 'warning', 'ctr_drop', 'CTR 25%+ csökkenése',
        `Az utóbbi 7 napban: ${(current.ctr * 100).toFixed(2)}% vs előző 7 nap: ${(previous.ctr * 100).toFixed(2)}% (${changes.ctr.toFixed(0)}%)`,
        'ctr', current.ctr, previous.ctr, changes.ctr));
    }

    // CPC spike ≥30% → WARNING
    if (changes.cpc >= 30 && previous.avg_cpc_micros > 0) {
      const currentCpc = Math.round(current.avg_cpc_micros / 1_000_000);
      const prevCpc = Math.round(previous.avg_cpc_micros / 1_000_000);
      alerts.push(makeAlert(accountId, camp, 'warning', 'cpc_spike', 'CPC 30%+ emelkedése',
        `Az utóbbi 7 napban: ${currentCpc} Ft/kattintás vs előző 7 nap: ${prevCpc} Ft (${changes.cpc.toFixed(0)}%)`,
        'cpc', current.avg_cpc_micros, previous.avg_cpc_micros, changes.cpc));
    }

    // Cost up + conversions down → CRITICAL
    if (changes.cost > 50 && changes.conversions < 0) {
      alerts.push(makeAlert(accountId, camp, 'critical', 'cost_up_conversions_down', 'Költés nő, konverziók csökkennek',
        `Az utóbbi 7 napban: költés +${changes.cost.toFixed(0)}%, konverziók ${changes.conversions.toFixed(0)}%`,
        'cost_vs_conversions', current.cost_micros, previous.cost_micros, changes.cost));
    }

    // Budget limited (>20% impression share lost to budget)
    if ((current.search_budget_lost_is || 0) > 20) {
      alerts.push(makeAlert(accountId, camp, 'info', 'budget_limited', 'Budget korlát: 20%+ megjelenítési részesedés veszteség',
        `Az utóbbi 7 napban budget miatti veszteség: ${(current.search_budget_lost_is || 0).toFixed(1)}%`,
        'search_budget_lost_is', current.search_budget_lost_is || 0, 0, 0));
    }

    // Low ROAS (<2x) with significant spend
    if (currentRoas < 2 && currentCostHuf > 10000) {
      alerts.push(makeAlert(accountId, camp, 'warning', 'low_roas', 'Alacsony ROAS (<2x), kampány veszteséges lehet',
        `Az utóbbi 7 napban: ROAS: ${currentRoas.toFixed(2)}x, költés: ${Math.round(currentCostHuf).toLocaleString('hu-HU')} Ft`,
        'roas', currentRoas, 2, ((currentRoas - 2) / 2) * 100));
    }

    // Impression share drop ≥15%
    if (changes.impressionShare <= -15 && (previous.search_impression_share || 0) > 0) {
      alerts.push(makeAlert(accountId, camp, 'warning', 'impression_share_drop', 'Megjelenítési részesedés 15%+ csökkenése',
        `Az utóbbi 7 napban: ${(current.search_impression_share || 0).toFixed(1)}% vs előző 7 nap: ${(previous.search_impression_share || 0).toFixed(1)}%`,
        'search_impression_share', current.search_impression_share || 0, previous.search_impression_share || 0, changes.impressionShare));
    }
  }

  return alerts;
}

/**
 * Detect account-level alerts (not campaign specific).
 */
export function detectAccountLevelAlerts(accountId: string): AdsAlert[] {
  const alerts: AdsAlert[] = [];
  const last7Start = daysAgoDate(7);
  const last7End = formatDate(new Date());
  const prev7Start = daysAgoDate(14);
  const prev7End = daysAgoDate(8);

  const thisWeek = queryOne(
    `SELECT COALESCE(SUM(cost_micros), 0) as total_cost, COALESCE(SUM(conversions), 0) as total_conversions
     FROM ads_daily_metrics WHERE account_id = ? AND entity_type = 'campaign' AND date BETWEEN ? AND ?`,
    [accountId, last7Start, last7End],
  ) as { total_cost: number; total_conversions: number } | null;

  const lastWeek = queryOne(
    `SELECT COALESCE(SUM(cost_micros), 0) as total_cost, COALESCE(SUM(conversions), 0) as total_conversions
     FROM ads_daily_metrics WHERE account_id = ? AND entity_type = 'campaign' AND date BETWEEN ? AND ?`,
    [accountId, prev7Start, prev7End],
  ) as { total_cost: number; total_conversions: number } | null;

  // Account stopped — no spend this week but had spend last week
  if (thisWeek && lastWeek && thisWeek.total_cost === 0 && lastWeek.total_cost > 0) {
    alerts.push({
      id: uuidv4(),
      accountId,
      severity: 'critical',
      type: 'account_stopped',
      title: 'Fiók leállt — nincs költés az elmúlt 7 napban',
      description: `Az utóbbi 7 napban: 0 Ft költés vs előző 7 nap: ${Math.round(lastWeek.total_cost / 1_000_000).toLocaleString('hu-HU')} Ft`,
      metric: 'cost',
      currentValue: 0,
      previousValue: lastWeek.total_cost,
      changePercent: -100,
      detectedAt: new Date().toISOString(),
      dismissed: false,
    });
  }

  // No conversions this week but had conversions last week
  if (thisWeek && lastWeek && thisWeek.total_conversions === 0 && lastWeek.total_conversions > 0) {
    alerts.push({
      id: uuidv4(),
      accountId,
      severity: 'critical',
      type: 'no_conversions',
      title: 'Nincs konverzió az elmúlt 7 napban',
      description: `Az utóbbi 7 napban: 0 konverzió vs előző 7 nap: ${lastWeek.total_conversions.toFixed(1)} konverzió`,
      metric: 'conversions',
      currentValue: 0,
      previousValue: lastWeek.total_conversions,
      changePercent: -100,
      detectedAt: new Date().toISOString(),
      dismissed: false,
    });
  }

  // No active campaigns
  const enabledCount = queryOne(
    `SELECT COUNT(*) as cnt FROM ads_campaigns WHERE account_id = ? AND status = 'ENABLED'`,
    [accountId],
  ) as { cnt: number } | null;

  if (enabledCount && enabledCount.cnt === 0) {
    alerts.push({
      id: uuidv4(),
      accountId,
      severity: 'info',
      type: 'no_active_campaigns',
      title: 'Nincs aktív kampány',
      description: 'Jelenleg nincs egyetlen ENABLED státuszú kampány sem a fiókban.',
      metric: 'campaigns',
      currentValue: 0,
      previousValue: 0,
      changePercent: 0,
      detectedAt: new Date().toISOString(),
      dismissed: false,
    });
  }

  return alerts;
}

/**
 * Save alerts to DB, avoiding duplicates (same type + campaign_id combo).
 */
export function saveAlerts(accountId: string, alerts: AdsAlert[]): void {
  const db = getDb();

  // Clean old alerts (>7 days, not dismissed)
  db.run(
    `DELETE FROM ads_alerts WHERE account_id = ? AND dismissed = 0 AND detected_at < datetime('now', '-7 days')`,
    [accountId],
  );

  for (const alert of alerts) {
    // Check for existing non-dismissed alert of same type + campaign combo
    const existing = queryOne(
      `SELECT id FROM ads_alerts WHERE account_id = ? AND type = ? AND COALESCE(campaign_id, '') = ? AND dismissed = 0`,
      [accountId, alert.type, alert.campaignId || ''],
    );
    if (existing) {
      // Update existing alert with fresh data
      db.run(
        `UPDATE ads_alerts SET title = ?, description = ?, severity = ?, metric = ?, current_value = ?, previous_value = ?, change_percent = ?, detected_at = datetime('now') WHERE id = ?`,
        [alert.title, alert.description, alert.severity, alert.metric, alert.currentValue, alert.previousValue, alert.changePercent, (existing as { id: string }).id],
      );
    } else {
      db.run(
        `INSERT INTO ads_alerts (id, account_id, campaign_id, campaign_name, severity, type, title, description, metric, current_value, previous_value, change_percent, detected_at, dismissed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 0)`,
        [alert.id, accountId, alert.campaignId || null, alert.campaignName || null, alert.severity, alert.type, alert.title, alert.description, alert.metric, alert.currentValue, alert.previousValue, alert.changePercent],
      );
    }
  }

  saveDb();
}

/**
 * Get active (non-dismissed) alerts for an account.
 */
export function getAlerts(accountId: string): AdsAlert[] {
  const rows = queryAll(
    `SELECT * FROM ads_alerts WHERE account_id = ? AND dismissed = 0 ORDER BY
      CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
      detected_at DESC`,
    [accountId],
  );
  return rows.map(mapRowToAlert);
}

/**
 * Get all undismissed alerts across all accounts (for dashboard widget).
 */
export function getAllAlerts(): AdsAlert[] {
  const rows = queryAll(
    `SELECT a.*, ac.name AS account_name, ac.client_id
     FROM ads_alerts a
     JOIN ads_accounts ac ON ac.id = a.account_id
     WHERE a.dismissed = 0
     ORDER BY
       CASE a.severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
       a.detected_at DESC
     LIMIT 20`,
    [],
  );
  return rows.map(r => ({ ...mapRowToAlert(r), accountName: r.account_name as string, clientId: r.client_id as string | null })) as any;
}

/**
 * Get total alert count across all accounts (for sidebar badge).
 */
export function getAlertCount(): number {
  const row = queryOne(
    `SELECT COUNT(*) as cnt FROM ads_alerts WHERE dismissed = 0 AND severity IN ('critical', 'warning')`,
    [],
  ) as { cnt: number } | null;
  return row?.cnt || 0;
}

/**
 * Dismiss an alert.
 */
export function dismissAlert(alertId: string): void {
  execute(`UPDATE ads_alerts SET dismissed = 1 WHERE id = ?`, [alertId]);
}

/**
 * Link AI analysis to critical alerts.
 */
export function linkAiAnalysis(accountId: string, alertIds: string[], analysisId: string): void {
  const db = getDb();
  for (const id of alertIds) {
    db.run(`UPDATE ads_alerts SET ai_analysis_id = ? WHERE id = ?`, [analysisId, id]);
  }
  saveDb();
}

/**
 * Check if auto AI analysis already ran today for this account.
 */
export function hasAutoAnalysisToday(accountId: string): boolean {
  const row = queryOne(
    `SELECT id FROM ads_ai_analyses WHERE account_id = ? AND analysis_type = 'anomaly' AND created_at >= date('now')`,
    [accountId],
  );
  return !!row;
}

// ── Helpers ──

function makeAlert(
  accountId: string,
  campaign: { campaign_id: string; name: string },
  severity: AdsAlert['severity'],
  type: string,
  title: string,
  description: string,
  metric: string,
  currentValue: number,
  previousValue: number,
  changePercent: number,
): AdsAlert {
  return {
    id: uuidv4(),
    accountId,
    campaignId: campaign.campaign_id,
    campaignName: campaign.name,
    severity,
    type,
    title,
    description,
    metric,
    currentValue,
    previousValue,
    changePercent,
    detectedAt: new Date().toISOString(),
    dismissed: false,
  };
}

function mapRowToAlert(row: Record<string, unknown>): AdsAlert {
  return {
    id: row.id as string,
    accountId: row.account_id as string,
    campaignId: row.campaign_id as string | undefined,
    campaignName: row.campaign_name as string | undefined,
    severity: row.severity as AdsAlert['severity'],
    type: row.type as string,
    title: row.title as string,
    description: row.description as string,
    metric: row.metric as string,
    currentValue: row.current_value as number,
    previousValue: row.previous_value as number,
    changePercent: row.change_percent as number,
    detectedAt: row.detected_at as string,
    dismissed: !!(row.dismissed as number),
    aiAnalysisId: row.ai_analysis_id as string | undefined,
  };
}
