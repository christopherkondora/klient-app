import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, execute } from './db-helpers';
import { saveDb } from './database';
import { getSupabase } from './supabase';

export type AnalysisType = 'performance' | 'budget' | 'keywords' | 'anomaly' | 'report';

/** Build markdown-table context from local DB for the AI prompt */
export function prepareAnalysisContext(accountId: string, analysisType: AnalysisType): string {
  const sections: string[] = [];

  // Account info
  const account = queryOne(`SELECT name, currency, client_id FROM ads_accounts WHERE id = ?`, [accountId]);
  if (account) {
    sections.push(`## Fiók: ${account.name} (${account.currency})`);
  }

  // Client context enrichment — when account is linked to a client
  if (account?.client_id) {
    const client = queryOne(`SELECT name, company, email FROM clients WHERE id = ?`, [account.client_id]);
    if (client) {
      sections.push(`\n## Ügyfél kontextus`);
      sections.push(`- **Név:** ${client.name}${client.company ? ` (${client.company})` : ''}`);

      // Recent invoices (last 6 months)
      const d180 = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10);
      const invoices = queryAll(
        `SELECT invoice_number, amount, currency, status, issue_date FROM invoices
         WHERE client_id = ? AND issue_date >= ? ORDER BY issue_date DESC LIMIT 10`,
        [account.client_id, d180],
      );
      if (invoices.length > 0) {
        const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount || 0), 0);
        sections.push(`- **Bevétel (6 hó):** ${Math.round(totalPaid).toLocaleString()} Ft (${invoices.filter(i => i.status === 'paid').length} fizetett / ${invoices.length} számla)`);
      }

      // Active projects
      const projects = queryAll(
        `SELECT name, status FROM projects WHERE client_id = ? AND status = 'active' LIMIT 5`,
        [account.client_id],
      );
      if (projects.length > 0) {
        sections.push(`- **Aktív projektek:** ${projects.map(p => p.name).join(', ')}`);
      }
    }
  }

  // Date range helpers
  const today = new Date().toISOString().slice(0, 10);
  const d7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const d14 = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const d30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  if (analysisType === 'performance' || analysisType === 'report') {
    // Campaign summary (last 30 days)
    const campaigns = queryAll(
      `SELECT c.name, c.type, c.status,
        SUM(m.impressions) as imp, SUM(m.clicks) as cl, SUM(m.cost_micros) as cost,
        SUM(m.conversions) as conv, SUM(m.conversions_value) as conv_val
      FROM ads_campaigns c
      LEFT JOIN ads_daily_metrics m ON m.entity_id = c.campaign_id AND m.entity_type = 'campaign'
        AND m.account_id = c.account_id AND m.date BETWEEN ? AND ?
      WHERE c.account_id = ?
      GROUP BY c.id ORDER BY cost DESC LIMIT 15`,
      [d30, today, accountId],
    );

    if (campaigns.length > 0) {
      sections.push('## Kampányok (utolsó 30 nap)');
      sections.push('| Kampány | Típus | Megjelenítés | Kattintás | CTR | Költés (Ft) | Konv. | ROAS |');
      sections.push('|---------|-------|-------------|-----------|-----|-------------|-------|------|');
      for (const c of campaigns) {
        const cost = Math.round(Number(c.cost || 0) / 1e6);
        const ctr = Number(c.imp) ? ((Number(c.cl) / Number(c.imp)) * 100).toFixed(2) : '0';
        const roas = cost ? (Number(c.conv_val || 0) / cost).toFixed(2) : '0';
        sections.push(`| ${c.name} | ${c.type} | ${Number(c.imp || 0).toLocaleString()} | ${Number(c.cl || 0).toLocaleString()} | ${ctr}% | ${cost.toLocaleString()} | ${Number(c.conv || 0).toFixed(1)} | ${roas}x |`);
      }
    }

    // Weekly trend
    const weeklyTrend = queryAll(
      `SELECT
        CASE WHEN date BETWEEN ? AND ? THEN 'this_week' ELSE 'prev_week' END as period,
        SUM(impressions) as imp, SUM(clicks) as cl, SUM(cost_micros) as cost,
        SUM(conversions) as conv, SUM(conversions_value) as conv_val
      FROM ads_daily_metrics
      WHERE account_id = ? AND entity_type = 'campaign' AND date BETWEEN ? AND ?
      GROUP BY period`,
      [d7, today, accountId, d14, today],
    );
    if (weeklyTrend.length > 0) {
      sections.push('\n## Heti trend');
      sections.push('| Időszak | Megjelenítés | Kattintás | Költés (Ft) | Konverziók |');
      sections.push('|---------|-------------|-----------|-------------|------------|');
      for (const w of weeklyTrend) {
        const label = w.period === 'this_week' ? 'Elmúlt 7 nap' : 'Előző 7 nap';
        sections.push(`| ${label} | ${Number(w.imp || 0).toLocaleString()} | ${Number(w.cl || 0).toLocaleString()} | ${Math.round(Number(w.cost || 0) / 1e6).toLocaleString()} | ${Number(w.conv || 0).toFixed(1)} |`);
      }
    }
  }

  if (analysisType === 'budget') {
    // Campaign with impression share data
    const budgetData = queryAll(
      `SELECT c.name, c.budget_amount_micros, c.budget_type,
        SUM(m.cost_micros) as cost, SUM(m.conversions_value) as conv_val,
        AVG(m.search_impression_share) as avg_is,
        AVG(m.search_budget_lost_is) as avg_budget_lost,
        AVG(m.search_rank_lost_is) as avg_rank_lost
      FROM ads_campaigns c
      LEFT JOIN ads_daily_metrics m ON m.entity_id = c.campaign_id AND m.entity_type = 'campaign'
        AND m.account_id = c.account_id AND m.date BETWEEN ? AND ?
      WHERE c.account_id = ? AND c.status = 'ENABLED'
      GROUP BY c.id ORDER BY cost DESC LIMIT 10`,
      [d30, today, accountId],
    );

    if (budgetData.length > 0) {
      sections.push('## Budget & Impression Share (utolsó 30 nap)');
      sections.push('| Kampány | Budget (Ft/nap) | Költés (Ft) | IS% | Budget Lost IS% | Rank Lost IS% | ROAS |');
      sections.push('|---------|----------------|-------------|-----|-----------------|---------------|------|');
      for (const b of budgetData) {
        const budget = b.budget_amount_micros ? Math.round(Number(b.budget_amount_micros) / 1e6) : 0;
        const cost = Math.round(Number(b.cost || 0) / 1e6);
        const roas = cost ? (Number(b.conv_val || 0) / cost).toFixed(2) : '0';
        sections.push(`| ${b.name} | ${budget.toLocaleString()} | ${cost.toLocaleString()} | ${(Number(b.avg_is || 0) * 100).toFixed(1)} | ${(Number(b.avg_budget_lost || 0) * 100).toFixed(1)} | ${(Number(b.avg_rank_lost || 0) * 100).toFixed(1)} | ${roas}x |`);
      }
    }
  }

  if (analysisType === 'keywords') {
    // Keywords with quality score + metrics
    const kwData = queryAll(
      `SELECT k.keyword_text, k.match_type, k.quality_score, k.expected_ctr, k.ad_relevance, k.landing_page_experience,
        SUM(m.impressions) as imp, SUM(m.clicks) as cl, SUM(m.cost_micros) as cost,
        SUM(m.conversions) as conv, SUM(m.conversions_value) as conv_val
      FROM ads_keywords k
      LEFT JOIN ads_daily_metrics m ON m.entity_id = k.criterion_id AND m.entity_type = 'keyword'
        AND m.account_id = k.account_id AND m.date BETWEEN ? AND ?
      WHERE k.account_id = ? AND k.status = 'ENABLED'
      GROUP BY k.id ORDER BY cost DESC LIMIT 30`,
      [d30, today, accountId],
    );

    if (kwData.length > 0) {
      sections.push('## Kulcsszavak (top 30 költés szerint)');
      sections.push('| Kulcsszó | Egyezés | QS | Kattintás | Költés (Ft) | Konv. | ROAS | CTR | Landing |');
      sections.push('|----------|---------|-----|-----------|-------------|-------|------|-----|---------|');
      for (const k of kwData) {
        const cost = Math.round(Number(k.cost || 0) / 1e6);
        const roas = cost ? (Number(k.conv_val || 0) / cost).toFixed(2) : '0';
        const ctr = Number(k.imp) ? ((Number(k.cl) / Number(k.imp)) * 100).toFixed(2) : '0';
        sections.push(`| ${k.keyword_text} | ${k.match_type} | ${k.quality_score ?? '–'} | ${Number(k.cl || 0)} | ${cost.toLocaleString()} | ${Number(k.conv || 0).toFixed(1)} | ${roas}x | ${ctr}% | ${k.landing_page_experience || '–'} |`);
      }
    }
  }

  if (analysisType === 'anomaly') {
    // Last 7 days vs previous 7 days — campaign level
    const anomalyData = queryAll(
      `SELECT c.name,
        SUM(CASE WHEN m.date BETWEEN ? AND ? THEN m.impressions ELSE 0 END) as imp_now,
        SUM(CASE WHEN m.date BETWEEN ? AND ? THEN m.impressions ELSE 0 END) as imp_prev,
        SUM(CASE WHEN m.date BETWEEN ? AND ? THEN m.clicks ELSE 0 END) as cl_now,
        SUM(CASE WHEN m.date BETWEEN ? AND ? THEN m.clicks ELSE 0 END) as cl_prev,
        SUM(CASE WHEN m.date BETWEEN ? AND ? THEN m.cost_micros ELSE 0 END) as cost_now,
        SUM(CASE WHEN m.date BETWEEN ? AND ? THEN m.cost_micros ELSE 0 END) as cost_prev,
        SUM(CASE WHEN m.date BETWEEN ? AND ? THEN m.conversions ELSE 0 END) as conv_now,
        SUM(CASE WHEN m.date BETWEEN ? AND ? THEN m.conversions ELSE 0 END) as conv_prev
      FROM ads_campaigns c
      LEFT JOIN ads_daily_metrics m ON m.entity_id = c.campaign_id AND m.entity_type = 'campaign'
        AND m.account_id = c.account_id
      WHERE c.account_id = ? AND c.status = 'ENABLED'
      GROUP BY c.id`,
      [
        d7, today, d14, d7,
        d7, today, d14, d7,
        d7, today, d14, d7,
        d7, today, d14, d7,
        accountId,
      ],
    );

    if (anomalyData.length > 0) {
      sections.push('## Anomália detekció (utolsó 7 nap vs. előző 7 nap)');
      sections.push('| Kampány | Imp. változás | Katt. változás | Költés változás | Konv. változás |');
      sections.push('|---------|--------------|----------------|-----------------|----------------|');
      for (const a of anomalyData) {
        const pct = (now: number, prev: number) => {
          if (!prev) return now > 0 ? '+∞' : '0%';
          const change = ((now - prev) / prev * 100).toFixed(1);
          return (now >= prev ? '+' : '') + change + '%';
        };
        sections.push(`| ${a.name} | ${pct(Number(a.imp_now), Number(a.imp_prev))} | ${pct(Number(a.cl_now), Number(a.cl_prev))} | ${pct(Number(a.cost_now), Number(a.cost_prev))} | ${pct(Number(a.conv_now), Number(a.conv_prev))} |`);
      }
    }
  }

  // Append knowledge base entries
  const kbEntries = queryAll(`SELECT title, content FROM ads_knowledge_base ORDER BY created_at DESC LIMIT 10`);
  if (kbEntries.length > 0) {
    sections.push('\n## Felhasználó saját tudásbázisa');
    for (const kb of kbEntries) {
      sections.push(`### ${kb.title}\n${kb.content}`);
    }
  }

  return sections.join('\n');
}

/** Run an AI analysis via Supabase edge function */
export async function runAnalysis(
  accountId: string,
  analysisType: AnalysisType,
  customPrompt?: string,
): Promise<{ id: string; content: string }> {
  const context = prepareAnalysisContext(accountId, analysisType);

  const sb = getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new Error('Nincs bejelentkezve');

  const res = await sb.functions.invoke('ads-analyze', {
    body: {
      analysisType,
      accountData: context,
      customPrompt: customPrompt || undefined,
    },
  });

  if (res.error) throw new Error(res.error.message || 'AI elemzés hiba');

  const result = res.data as { analysis: string; usage?: { input_tokens?: number; output_tokens?: number } };
  if (!result?.analysis) throw new Error('Üres válasz az AI-tól');

  const tokensUsed = (result.usage?.input_tokens || 0) + (result.usage?.output_tokens || 0);

  // Save to DB
  const id = uuidv4();
  execute(
    `INSERT INTO ads_ai_analyses (id, account_id, analysis_type, prompt_summary, response_text, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    [id, accountId, analysisType, customPrompt || '', result.analysis],
  );
  saveDb();

  return { id, content: result.analysis };
}

/** Get previous analyses for an account */
export function getAnalyses(accountId: string, limit = 20): Record<string, unknown>[] {
  return queryAll(
    `SELECT id, analysis_type, prompt_summary, response_text, created_at FROM ads_ai_analyses WHERE account_id = ? ORDER BY created_at DESC LIMIT ?`,
    [accountId, limit],
  );
}

/** Get a single analysis by ID */
export function getAnalysis(id: string): Record<string, unknown> | undefined {
  return queryOne(`SELECT * FROM ads_ai_analyses WHERE id = ?`, [id]);
}

/** Knowledge base CRUD */
export function getKnowledgeBase(): Record<string, unknown>[] {
  return queryAll(`SELECT * FROM ads_knowledge_base ORDER BY created_at DESC`);
}

export function createKnowledgeEntry(title: string, content: string, category?: string): string {
  const id = uuidv4();
  execute(
    `INSERT INTO ads_knowledge_base (id, title, content, category, created_at) VALUES (?, ?, ?, ?, datetime('now'))`,
    [id, title, content, category || 'strategy'],
  );
  return id;
}

export function updateKnowledgeEntry(id: string, title: string, content: string, category?: string): void {
  execute(
    `UPDATE ads_knowledge_base SET title = ?, content = ?, category = ? WHERE id = ?`,
    [title, content, category || 'strategy', id],
  );
}

export function deleteKnowledgeEntry(id: string): void {
  execute(`DELETE FROM ads_knowledge_base WHERE id = ?`, [id]);
}
