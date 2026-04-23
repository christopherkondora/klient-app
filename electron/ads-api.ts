import { GoogleAdsApi, enums, fromMicros } from 'google-ads-api';
import { getGoogleCredentials, getAccountRefreshToken } from './ads-store';
import { refreshAccessToken } from './ads-auth';
import { queryOne } from './db-helpers';

// ============ Helpers ============

/** Convert micros (Google Ads unit) to normal currency amount */
export function microsToAmount(micros: number): number {
  return fromMicros(micros);
}

/** Calculate ROAS (Return On Ad Spend) */
export function calculateROAS(conversionsValue: number, costMicros: number): number {
  const cost = microsToAmount(costMicros);
  if (cost === 0) return 0;
  return conversionsValue / cost;
}

/** Calculate CTR as percentage */
export function calculateCTR(clicks: number, impressions: number): number {
  if (impressions === 0) return 0;
  return (clicks / impressions) * 100;
}

// ============ Client Factory ============

let clientInstance: GoogleAdsApi | null = null;

/** Create or return cached GoogleAdsApi instance */
function getClient(): GoogleAdsApi {
  const creds = getGoogleCredentials();
  if (!creds.hasCredentials) {
    throw new Error('Google Ads credentials not configured.');
  }

  if (!clientInstance) {
    clientInstance = new GoogleAdsApi({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      developer_token: creds.developerToken,
    });
  }

  return clientInstance;
}

/** Invalidate cached client (call after credential changes) */
export function invalidateClient(): void {
  clientInstance = null;
}

/** Get a Customer instance for a specific ads account */
async function getCustomer(accountId: string) {
  const client = getClient();
  const creds = getGoogleCredentials();

  // Get the account's customer_id and parent_mcc_id from DB
  const account = queryOne(`SELECT customer_id, parent_mcc_id FROM ads_accounts WHERE id = ?`, [accountId]);
  if (!account) {
    throw new Error(`Ads account not found: ${accountId}`);
  }

  const refreshToken = getAccountRefreshToken(accountId);
  if (!refreshToken) {
    throw new Error(`No refresh token for account: ${accountId}`);
  }

  const customerId = (account.customer_id as string).replace(/-/g, '');

  // Only use login_customer_id (MCC) if this account is actually managed under the MCC.
  // Accounts shared directly via email should NOT use MCC as login_customer_id.
  const parentMcc = account.parent_mcc_id as string | null;
  const loginCustomerId = parentMcc
    ? parentMcc.replace(/-/g, '')
    : undefined;

  return client.Customer({
    customer_id: customerId,
    refresh_token: refreshToken,
    login_customer_id: loginCustomerId,
  });
}

/** Execute a GAQL query with automatic retry on auth failure and rate limits */
async function queryWithRetry<T>(
  accountId: string,
  queryFn: (customer: Awaited<ReturnType<typeof getCustomer>>) => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const customer = await getCustomer(accountId);
      return await queryFn(customer);
    } catch (err: any) {
      // If auth error (401/UNAUTHENTICATED), try refreshing the token
      const isAuthError = err?.errors?.[0]?.error_code?.authentication_error ||
        err?.message?.includes('UNAUTHENTICATED') ||
        err?.message?.includes('401');

      if (isAuthError && attempt === 0) {
        const refreshToken = getAccountRefreshToken(accountId);
        if (refreshToken) {
          await refreshAccessToken(refreshToken);
          continue;
        }
      }

      // Rate limit (429) — retry with exponential backoff
      const isRateLimit = err?.message?.includes('429') ||
        err?.message?.includes('RESOURCE_EXHAUSTED') ||
        err?.errors?.[0]?.error_code?.quota_error;

      if (isRateLimit && attempt < maxRetries) {
        const delay = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
        console.warn(`[AdsAPI] Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw err;
    }
  }
  throw new Error('Max retries exceeded');
}

// ============ Data Fetching Functions ============

export interface RawCampaign {
  campaign_id: string;
  name: string;
  status: string;
  type: string;
  budget_amount_micros: number;
  budget_type: string;
  bidding_strategy: string;
  start_date: string | null;
  end_date: string | null;
}

export async function fetchCampaigns(accountId: string): Promise<RawCampaign[]> {
  return queryWithRetry(accountId, async (customer) => {
    const results = await customer.query(`
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        campaign_budget.amount_micros,
        campaign_budget.type,
        campaign.bidding_strategy_type,
        campaign.start_date_time,
        campaign.end_date_time
      FROM campaign
      WHERE campaign.status != 'REMOVED'
    `);

    return results.map((row: any) => ({
      campaign_id: String(row.campaign?.id || ''),
      name: row.campaign?.name || '',
      status: enums.CampaignStatus[row.campaign?.status] || 'UNKNOWN',
      type: enums.AdvertisingChannelType[row.campaign?.advertising_channel_type] || 'UNKNOWN',
      budget_amount_micros: Number(row.campaign_budget?.amount_micros || 0),
      budget_type: enums.BudgetType?.[row.campaign_budget?.type] || 'DAILY',
      bidding_strategy: enums.BiddingStrategyType?.[row.campaign?.bidding_strategy_type] || 'UNKNOWN',
      start_date: row.campaign?.start_date_time || null,
      end_date: row.campaign?.end_date_time || null,
    }));
  });
}

export interface RawAdGroup {
  ad_group_id: string;
  campaign_id: string;
  name: string;
  status: string;
  cpc_bid_micros: number;
}

export async function fetchAdGroups(accountId: string, campaignId?: string): Promise<RawAdGroup[]> {
  return queryWithRetry(accountId, async (customer) => {
    let query = `
      SELECT
        ad_group.id,
        ad_group.name,
        ad_group.status,
        ad_group.campaign,
        ad_group.cpc_bid_micros
      FROM ad_group
      WHERE ad_group.status != 'REMOVED'
    `;
    if (campaignId) {
      query += ` AND ad_group.campaign = 'customers/${(await customer).credentials.customer_id}/campaigns/${campaignId}'`;
    }

    const results = await customer.query(query);

    return results.map((row: any) => {
      // Extract campaign ID from resource name: customers/XXX/campaigns/YYY
      const campResource = row.ad_group?.campaign || '';
      const campId = campResource.split('/').pop() || '';

      return {
        ad_group_id: String(row.ad_group?.id || ''),
        campaign_id: campId,
        name: row.ad_group?.name || '',
        status: enums.AdGroupStatus?.[row.ad_group?.status] || 'UNKNOWN',
        cpc_bid_micros: Number(row.ad_group?.cpc_bid_micros || 0),
      };
    });
  });
}

export interface RawKeyword {
  criterion_id: string;
  ad_group_id: string;
  keyword_text: string;
  match_type: string;
  status: string;
  quality_score: number | null;
  expected_ctr: string | null;
  ad_relevance: string | null;
  landing_page_experience: string | null;
}

export async function fetchKeywords(accountId: string): Promise<RawKeyword[]> {
  return queryWithRetry(accountId, async (customer) => {
    const results = await customer.query(`
      SELECT
        ad_group_criterion.criterion_id,
        ad_group_criterion.ad_group,
        ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type,
        ad_group_criterion.status,
        ad_group_criterion.quality_info.quality_score,
        ad_group_criterion.quality_info.creative_quality_score,
        ad_group_criterion.quality_info.post_click_quality_score,
        ad_group_criterion.quality_info.search_predicted_ctr
      FROM keyword_view
    `);

    return results.map((row: any) => {
      const agResource = row.ad_group_criterion?.ad_group || '';
      const agId = agResource.split('/').pop() || '';

      return {
        criterion_id: String(row.ad_group_criterion?.criterion_id || ''),
        ad_group_id: agId,
        keyword_text: row.ad_group_criterion?.keyword?.text || '',
        match_type: enums.KeywordMatchType?.[row.ad_group_criterion?.keyword?.match_type] || 'UNKNOWN',
        status: enums.AdGroupCriterionStatus?.[row.ad_group_criterion?.status] || 'UNKNOWN',
        quality_score: row.ad_group_criterion?.quality_info?.quality_score ?? null,
        expected_ctr: enums.QualityScoreBucket?.[row.ad_group_criterion?.quality_info?.search_predicted_ctr] || null,
        ad_relevance: enums.QualityScoreBucket?.[row.ad_group_criterion?.quality_info?.creative_quality_score] || null,
        landing_page_experience: enums.QualityScoreBucket?.[row.ad_group_criterion?.quality_info?.post_click_quality_score] || null,
      };
    });
  });
}

export interface RawDailyMetric {
  entity_id: string;
  date: string;
  impressions: number;
  clicks: number;
  cost_micros: number;
  conversions: number;
  conversions_value: number;
  ctr: number;
  avg_cpc_micros: number;
  search_impression_share: number | null;
  search_budget_lost_is: number | null;
  search_rank_lost_is: number | null;
}

export async function fetchDailyMetrics(
  accountId: string,
  entityType: 'campaign' | 'ad_group' | 'keyword',
  startDate: string,
  endDate: string,
): Promise<RawDailyMetric[]> {
  return queryWithRetry(accountId, async (customer) => {
    let query: string;

    if (entityType === 'campaign') {
      query = `
        SELECT
          campaign.id,
          segments.date,
          metrics.impressions,
          metrics.clicks,
          metrics.ctr,
          metrics.cost_micros,
          metrics.conversions,
          metrics.conversions_value,
          metrics.average_cpc,
          metrics.search_impression_share,
          metrics.search_budget_lost_impression_share,
          metrics.search_rank_lost_impression_share
        FROM campaign
        WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
          AND campaign.status = 'ENABLED'
      `;
    } else if (entityType === 'ad_group') {
      query = `
        SELECT
          ad_group.id,
          segments.date,
          metrics.impressions,
          metrics.clicks,
          metrics.ctr,
          metrics.cost_micros,
          metrics.conversions,
          metrics.conversions_value,
          metrics.average_cpc
        FROM ad_group
        WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
          AND ad_group.status = 'ENABLED'
      `;
    } else {
      query = `
        SELECT
          ad_group_criterion.criterion_id,
          segments.date,
          metrics.impressions,
          metrics.clicks,
          metrics.ctr,
          metrics.cost_micros,
          metrics.conversions,
          metrics.conversions_value,
          metrics.average_cpc
        FROM keyword_view
        WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      `;
    }

    const results = await customer.query(query);

    return results.map((row: any) => {
      let entityId: string;
      if (entityType === 'campaign') {
        entityId = String(row.campaign?.id || '');
      } else if (entityType === 'ad_group') {
        entityId = String(row.ad_group?.id || '');
      } else {
        entityId = String(row.ad_group_criterion?.criterion_id || '');
      }

      return {
        entity_id: entityId,
        date: row.segments?.date || '',
        impressions: Number(row.metrics?.impressions || 0),
        clicks: Number(row.metrics?.clicks || 0),
        cost_micros: Number(row.metrics?.cost_micros || 0),
        conversions: Number(row.metrics?.conversions || 0),
        conversions_value: Number(row.metrics?.conversions_value || 0),
        ctr: Number(row.metrics?.ctr || 0),
        avg_cpc_micros: Number(row.metrics?.average_cpc || 0),
        search_impression_share: row.metrics?.search_impression_share ?? null,
        search_budget_lost_is: row.metrics?.search_budget_lost_impression_share ?? null,
        search_rank_lost_is: row.metrics?.search_rank_lost_impression_share ?? null,
      };
    });
  });
}

export interface RawSearchTerm {
  search_term: string;
  impressions: number;
  clicks: number;
  cost_micros: number;
  conversions: number;
}

export async function fetchSearchTerms(
  accountId: string,
  campaignId?: string,
  startDate?: string,
  endDate?: string,
): Promise<RawSearchTerm[]> {
  return queryWithRetry(accountId, async (customer) => {
    let dateFilter: string;
    if (startDate && endDate) {
      dateFilter = `segments.date BETWEEN '${startDate}' AND '${endDate}'`;
    } else {
      dateFilter = `segments.date DURING LAST_30_DAYS`;
    }

    let campaignFilter = '';
    if (campaignId) {
      campaignFilter = `AND campaign.id = ${campaignId}`;
    }

    const results = await customer.query(`
      SELECT
        search_term_view.search_term,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions
      FROM search_term_view
      WHERE ${dateFilter}
        ${campaignFilter}
      ORDER BY metrics.cost_micros DESC
      LIMIT 100
    `);

    return results.map((row: any) => ({
      search_term: row.search_term_view?.search_term || '',
      impressions: Number(row.metrics?.impressions || 0),
      clicks: Number(row.metrics?.clicks || 0),
      cost_micros: Number(row.metrics?.cost_micros || 0),
      conversions: Number(row.metrics?.conversions || 0),
    }));
  });
}

// ============ Ad Group Ads (Responsive Search Ads) ============

export interface RawAdGroupAd {
  ad_group_id: string;
  campaign_id: string;
  ad_id: string;
  ad_type: string;
  headlines: string[];
  descriptions: string[];
  status: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cost_micros: number;
  conversions: number;
}

export async function fetchAdGroupAds(accountId: string, campaignId: string): Promise<RawAdGroupAd[]> {
  return queryWithRetry(accountId, async (customer) => {
    const results = await customer.query(`
      SELECT
        ad_group_ad.ad.id,
        ad_group_ad.ad.type,
        ad_group_ad.ad.responsive_search_ad.headlines,
        ad_group_ad.ad.responsive_search_ad.descriptions,
        ad_group_ad.status,
        ad_group.id,
        campaign.id,
        metrics.impressions,
        metrics.clicks,
        metrics.ctr,
        metrics.cost_micros,
        metrics.conversions
      FROM ad_group_ad
      WHERE campaign.id = ${campaignId}
        AND ad_group_ad.status != 'REMOVED'
        AND segments.date DURING LAST_30_DAYS
    `);

    return results.map((row: any) => {
      const headlines = (row.ad_group_ad?.ad?.responsive_search_ad?.headlines || []).map((h: any) => h.text || '');
      const descriptions = (row.ad_group_ad?.ad?.responsive_search_ad?.descriptions || []).map((d: any) => d.text || '');

      return {
        ad_group_id: String(row.ad_group?.id || ''),
        campaign_id: String(row.campaign?.id || ''),
        ad_id: String(row.ad_group_ad?.ad?.id || ''),
        ad_type: enums.AdType?.[row.ad_group_ad?.ad?.type] || 'UNKNOWN',
        headlines,
        descriptions,
        status: enums.AdGroupAdStatus?.[row.ad_group_ad?.status] || 'UNKNOWN',
        impressions: Number(row.metrics?.impressions || 0),
        clicks: Number(row.metrics?.clicks || 0),
        ctr: Number(row.metrics?.ctr || 0),
        cost_micros: Number(row.metrics?.cost_micros || 0),
        conversions: Number(row.metrics?.conversions || 0),
      };
    });
  });
}

// ============ Negative Keywords ============

export interface RawNegativeKeyword {
  keyword_text: string;
  match_type: string;
}

export async function fetchNegativeKeywords(accountId: string, campaignId: string): Promise<RawNegativeKeyword[]> {
  return queryWithRetry(accountId, async (customer) => {
    const results = await customer.query(`
      SELECT
        campaign_criterion.keyword.text,
        campaign_criterion.keyword.match_type
      FROM campaign_criterion
      WHERE campaign.id = ${campaignId}
        AND campaign_criterion.negative = TRUE
        AND campaign_criterion.type = 'KEYWORD'
    `);

    return results.map((row: any) => ({
      keyword_text: row.campaign_criterion?.keyword?.text || '',
      match_type: enums.KeywordMatchType?.[row.campaign_criterion?.keyword?.match_type] || 'UNKNOWN',
    }));
  });
}

// ============ PMax Asset Groups ============

export interface RawAssetGroup {
  asset_group_id: string;
  campaign_id: string;
  name: string;
  status: string;
  ad_strength: string;
  impressions: number;
  clicks: number;
  cost_micros: number;
  conversions: number;
  conversions_value: number;
}

export async function fetchAssetGroups(accountId: string, campaignId: string): Promise<RawAssetGroup[]> {
  return queryWithRetry(accountId, async (customer) => {
    const results = await customer.query(`
      SELECT
        asset_group.id,
        asset_group.name,
        asset_group.status,
        asset_group.ad_strength,
        campaign.id,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value
      FROM asset_group
      WHERE campaign.id = ${campaignId}
        AND segments.date DURING LAST_30_DAYS
    `);

    return results.map((row: any) => ({
      asset_group_id: String(row.asset_group?.id || ''),
      campaign_id: String(row.campaign?.id || ''),
      name: row.asset_group?.name || '',
      status: enums.AssetGroupStatus?.[row.asset_group?.status] || 'UNKNOWN',
      ad_strength: enums.AdStrength?.[row.asset_group?.ad_strength] || 'UNSPECIFIED',
      impressions: Number(row.metrics?.impressions || 0),
      clicks: Number(row.metrics?.clicks || 0),
      cost_micros: Number(row.metrics?.cost_micros || 0),
      conversions: Number(row.metrics?.conversions || 0),
      conversions_value: Number(row.metrics?.conversions_value || 0),
    }));
  });
}

// ============ PMax Asset Group Assets ============

export interface RawAssetGroupAsset {
  asset_group_id: string;
  field_type: string;
  performance_label: string;
  asset_text: string | null;
  asset_name: string | null;
  status: string;
}

export async function fetchAssetGroupAssets(accountId: string, assetGroupIds: string[]): Promise<RawAssetGroupAsset[]> {
  if (assetGroupIds.length === 0) return [];

  return queryWithRetry(accountId, async (customer) => {
    const allResults: RawAssetGroupAsset[] = [];

    for (const agId of assetGroupIds) {
      const results = await customer.query(`
        SELECT
          asset_group_asset.field_type,
          asset_group_asset.performance_label,
          asset_group_asset.status,
          asset.name,
          asset.type,
          asset.text_asset.text,
          asset_group.id
        FROM asset_group_asset
        WHERE asset_group.id = ${agId}
      `);

      for (const row of results) {
        const fieldTypeVal = row.asset_group_asset?.field_type;
        const perfLabelVal = (row.asset_group_asset as any)?.performance_label;
        const statusVal = row.asset_group_asset?.status;
        allResults.push({
          asset_group_id: String(agId),
          field_type: fieldTypeVal != null ? (enums.AssetFieldType as any)?.[fieldTypeVal] || 'UNSPECIFIED' : 'UNSPECIFIED',
          performance_label: perfLabelVal != null ? (enums.AssetPerformanceLabel as any)?.[perfLabelVal] || 'UNSPECIFIED' : 'UNSPECIFIED',
          asset_text: row.asset?.text_asset?.text || null,
          asset_name: row.asset?.name || null,
          status: statusVal != null ? (enums.AssetLinkStatus as any)?.[statusVal] || 'UNKNOWN' : 'UNKNOWN',
        });
      }
    }

    return allResults;
  });
}

// ============ Shopping Performance ============

export interface RawShoppingPerformance {
  product_title: string;
  product_item_id: string;
  impressions: number;
  clicks: number;
  cost_micros: number;
  conversions: number;
  conversions_value: number;
}

export async function fetchShoppingPerformance(accountId: string, campaignId: string): Promise<RawShoppingPerformance[]> {
  return queryWithRetry(accountId, async (customer) => {
    const results = await customer.query(`
      SELECT
        segments.product_title,
        segments.product_item_id,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value
      FROM shopping_performance_view
      WHERE campaign.id = ${campaignId}
        AND segments.date DURING LAST_30_DAYS
      ORDER BY metrics.cost_micros DESC
      LIMIT 100
    `);

    return results.map((row: any) => ({
      product_title: row.segments?.product_title || '',
      product_item_id: row.segments?.product_item_id || '',
      impressions: Number(row.metrics?.impressions || 0),
      clicks: Number(row.metrics?.clicks || 0),
      cost_micros: Number(row.metrics?.cost_micros || 0),
      conversions: Number(row.metrics?.conversions || 0),
      conversions_value: Number(row.metrics?.conversions_value || 0),
    }));
  });
}

// ============ Placements ============

export interface RawPlacement {
  display_name: string;
  target_url: string;
  placement_type: string;
  impressions: number;
  clicks: number;
  cost_micros: number;
}

export async function fetchPlacements(accountId: string, campaignId: string): Promise<RawPlacement[]> {
  return queryWithRetry(accountId, async (customer) => {
    const results = await customer.query(`
      SELECT
        detail_placement_view.display_name,
        detail_placement_view.target_url,
        detail_placement_view.placement_type,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros
      FROM detail_placement_view
      WHERE campaign.id = ${campaignId}
        AND segments.date DURING LAST_30_DAYS
      ORDER BY metrics.impressions DESC
      LIMIT 50
    `);

    return results.map((row: any) => ({
      display_name: row.detail_placement_view?.display_name || '',
      target_url: row.detail_placement_view?.target_url || '',
      placement_type: enums.PlacementType?.[row.detail_placement_view?.placement_type] || 'UNKNOWN',
      impressions: Number(row.metrics?.impressions || 0),
      clicks: Number(row.metrics?.clicks || 0),
      cost_micros: Number(row.metrics?.cost_micros || 0),
    }));
  });
}
