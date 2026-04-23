import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type DateRange = '7d' | '14d' | '30d';

interface AdsContextType {
  accounts: AdsAccountRow[];
  selectedAccount: AdsAccountRow | null;
  campaigns: AdsCampaignMetricRow[];
  kpi: AdsKpiSummary | null;
  dateRange: DateRange;
  syncing: boolean;
  loading: boolean;
  lastSync: string | null;
  loadAccounts: () => Promise<void>;
  selectAccount: (account: AdsAccountRow) => void;
  setDateRange: (range: DateRange) => void;
  refreshData: () => Promise<void>;
  syncNow: () => Promise<void>;
}

function getDateRange(range: DateRange): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (range === '7d' ? 7 : range === '14d' ? 14 : 30));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

const AdsContext = createContext<AdsContextType>({
  accounts: [],
  selectedAccount: null,
  campaigns: [],
  kpi: null,
  dateRange: '30d',
  syncing: false,
  loading: false,
  lastSync: null,
  loadAccounts: async () => {},
  selectAccount: () => {},
  setDateRange: () => {},
  refreshData: async () => {},
  syncNow: async () => {},
});

export function AdsProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<AdsAccountRow[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<AdsAccountRow | null>(null);
  const [campaigns, setCampaigns] = useState<AdsCampaignMetricRow[]>([]);
  const [kpi, setKpi] = useState<AdsKpiSummary | null>(null);
  const [dateRange, setDateRangeState] = useState<DateRange>('30d');
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    const res = await window.electronAPI.adsGetAccounts();
    if (res.success && res.data) {
      setAccounts(res.data);
      if (res.data.length > 0 && !selectedAccount) {
        setSelectedAccount(res.data[0]);
      }
    }
  }, [selectedAccount]);

  const loadData = useCallback(async (account: AdsAccountRow, range: DateRange) => {
    setLoading(true);
    try {
      const { start, end } = getDateRange(range);
      const [campRes, kpiRes, syncRes] = await Promise.all([
        window.electronAPI.adsGetCampaignMetrics(account.id, start, end),
        window.electronAPI.adsGetKpiSummary(account.id, start, end),
        window.electronAPI.adsGetLastSync(account.id),
      ]);
      if (campRes.success && campRes.data) setCampaigns(campRes.data);
      if (kpiRes.success && kpiRes.data) setKpi(kpiRes.data);
      if (syncRes.success && syncRes.data) setLastSync(syncRes.data.time);
    } finally {
      setLoading(false);
    }
  }, []);

  const selectAccount = useCallback((account: AdsAccountRow) => {
    setSelectedAccount(account);
    loadData(account, dateRange);
  }, [dateRange, loadData]);

  const setDateRange = useCallback((range: DateRange) => {
    setDateRangeState(range);
    if (selectedAccount) loadData(selectedAccount, range);
  }, [selectedAccount, loadData]);

  const refreshData = useCallback(async () => {
    if (selectedAccount) await loadData(selectedAccount, dateRange);
  }, [selectedAccount, dateRange, loadData]);

  const syncNow = useCallback(async () => {
    if (!selectedAccount) return;
    setSyncing(true);
    try {
      // Use full sync if no data exists yet, otherwise incremental
      const syncType = campaigns.length === 0 ? 'full' : 'incremental';
      await window.electronAPI.adsSyncAccount(selectedAccount.id, syncType);
      await loadData(selectedAccount, dateRange);
    } finally {
      setSyncing(false);
    }
  }, [selectedAccount, dateRange, loadData, campaigns.length]);

  return (
    <AdsContext.Provider value={{
      accounts, selectedAccount, campaigns, kpi, dateRange,
      syncing, loading, lastSync,
      loadAccounts, selectAccount, setDateRange, refreshData, syncNow,
    }}>
      {children}
    </AdsContext.Provider>
  );
}

export function useAds() {
  return useContext(AdsContext);
}
