// Google Ads AI Module types

export type AdsAccountStatus = 'active' | 'paused' | 'disconnected';
export type AdsCampaignType = 'SEARCH' | 'DISPLAY' | 'SHOPPING' | 'PERFORMANCE_MAX' | 'VIDEO';
export type AdsCampaignStatus = 'ENABLED' | 'PAUSED' | 'REMOVED';
export type AdsMatchType = 'EXACT' | 'PHRASE' | 'BROAD';
export type AdsQualityRating = 'ABOVE_AVERAGE' | 'AVERAGE' | 'BELOW_AVERAGE';
export type AdsEntityType = 'campaign' | 'ad_group' | 'keyword';
export type AdsSyncType = 'full' | 'incremental' | 'catchup';
export type AdsSyncStatus = 'running' | 'completed' | 'failed';
export type AdsAnalysisType = 'performance' | 'budget' | 'keywords' | 'anomaly' | 'report';
export type AdsKnowledgeCategory = 'strategy' | 'benchmark' | 'client_note';

export interface AdsAccount {
  id: string;
  customer_id: string;
  name: string;
  currency: string;
  timezone: string;
  refresh_token_encrypted?: Uint8Array;
  is_mcc: number;
  parent_mcc_id: string | null;
  status: AdsAccountStatus;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdsCampaign {
  id: string;
  account_id: string;
  campaign_id: string;
  name: string;
  type: AdsCampaignType | null;
  status: AdsCampaignStatus | null;
  budget_amount_micros: number | null;
  budget_type: string | null;
  bidding_strategy: string | null;
  start_date: string | null;
  end_date: string | null;
  updated_at: string;
}

export interface AdsAdGroup {
  id: string;
  account_id: string;
  campaign_id: string;
  ad_group_id: string;
  name: string;
  status: string | null;
  cpc_bid_micros: number | null;
  updated_at: string;
}

export interface AdsKeyword {
  id: string;
  account_id: string;
  ad_group_id: string;
  criterion_id: string;
  keyword_text: string;
  match_type: AdsMatchType | null;
  status: string | null;
  quality_score: number | null;
  expected_ctr: AdsQualityRating | null;
  ad_relevance: AdsQualityRating | null;
  landing_page_experience: AdsQualityRating | null;
  updated_at: string;
}

export interface AdsDailyMetrics {
  id: string;
  account_id: string;
  entity_type: AdsEntityType;
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

export interface AdsSyncLog {
  id: string;
  account_id: string;
  sync_type: AdsSyncType;
  status: AdsSyncStatus;
  started_at: string;
  completed_at: string | null;
  records_synced: number;
  error_message: string | null;
}

export interface AdsAiAnalysis {
  id: string;
  account_id: string;
  analysis_type: AdsAnalysisType;
  prompt_summary: string | null;
  response_text: string | null;
  data_snapshot: string | null;
  created_at: string;
}

export interface AdsKnowledgeBase {
  id: string;
  title: string;
  content: string;
  category: AdsKnowledgeCategory | null;
  created_at: string;
}

/** Aggregated metrics summary for KPI cards */
export interface AdsMetricsSummary {
  impressions: number;
  clicks: number;
  ctr: number;
  cost: number;
  conversions: number;
  conversions_value: number;
  roas: number;
  avg_cpc: number;
}
