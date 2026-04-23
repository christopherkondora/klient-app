import { useState, useEffect } from 'react';
import { useAds } from '../contexts/AdsContext';
import AdsAccountConnect from '../components/AdsAccountConnect';
import { Settings2, Plus, Megaphone, Loader2, Link2, Unlink2, ChevronDown } from 'lucide-react';

function AdsSettingsContent() {
  const { accounts, selectedAccount, loadAccounts, refreshData } = useAds();
  const [showConnect, setShowConnect] = useState(false);
  const [hasCredentials, setHasCredentials] = useState<boolean | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [openPickerId, setOpenPickerId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const cred = await window.electronAPI.adsGetCredentials();
      setHasCredentials(cred.hasCredentials);
      const cl = await window.electronAPI.getClients();
      setClients(cl);
    })();
  }, []);

  const handleConnected = async () => {
    setShowConnect(false);
    setHasCredentials(true);
    await loadAccounts();
    await refreshData();
  };

  async function handleLink(accountId: string, clientId: string | null) {
    setLinkingId(accountId);
    try {
      await window.electronAPI.adsLinkAccount(accountId, clientId);
      await loadAccounts();
    } finally {
      setLinkingId(null);
      setOpenPickerId(null);
    }
  }

  // Clients that are already linked to other accounts (to show warning)
  const linkedClientIds = new Set(
    accounts.filter(a => a.client_id).map(a => a.client_id!),
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="font-pixel text-xl text-cream">Ads Beállítások</h1>
        <p className="text-steel text-sm mt-1">Google Ads fiókok kezelése és ügyfél-összekapcsolás</p>
      </div>

      {/* Connected accounts */}
      <div className="bg-surface-800/50 rounded-xl border border-teal/10 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-pixel text-sm text-cream">Összekapcsolt fiókok</h2>
          <button
            onClick={() => setShowConnect(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-teal/15 text-cream hover:bg-teal/25 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Fiók hozzáadása
          </button>
        </div>

        {accounts.length === 0 ? (
          <div className="text-center py-8">
            <Megaphone className="w-8 h-8 text-steel/20 mx-auto mb-3" />
            <p className="text-sm text-steel/60 italic">
              {hasCredentials === false ? 'Nincs API konfiguráció. Add hozzá a fiókod.' : 'Nincs összekapcsolt fiók.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map(acc => {
              const linkedClient = acc.client_id ? clients.find(c => c.id === acc.client_id) : null;
              const isPickerOpen = openPickerId === acc.id;

              return (
                <div key={acc.id} className="bg-surface-900/50 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div>
                        <p className="text-sm text-cream font-medium">{acc.name}</p>
                        <p className="text-xs text-steel/60">{acc.customer_id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {/* Client link indicator */}
                      {linkedClient ? (
                        <button
                          onClick={() => setOpenPickerId(isPickerOpen ? null : acc.id)}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-teal/8 border border-teal/15 hover:bg-teal/15 transition-colors"
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: linkedClient.color }}
                          />
                          <span className="text-xs text-cream/80 max-w-[120px] truncate">{linkedClient.name}</span>
                          <ChevronDown className="w-3 h-3 text-steel/40" />
                        </button>
                      ) : (
                        <button
                          onClick={() => setOpenPickerId(isPickerOpen ? null : acc.id)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-dashed border-steel/20 text-steel/50 hover:border-teal/30 hover:text-cream/60 transition-colors"
                        >
                          <Link2 className="w-3 h-3" />
                          <span className="text-xs">Ügyfél</span>
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      )}
                      {/* Status dot */}
                      <span className={`w-2 h-2 rounded-full shrink-0 ${selectedAccount?.id === acc.id ? 'bg-emerald-400' : 'bg-steel/40'}`} />
                    </div>
                  </div>

                  {/* Client picker dropdown */}
                  {isPickerOpen && (
                    <div className="border-t border-teal/8 bg-surface-900/80 p-3">
                      <p className="text-[10px] text-steel/40 tracking-wider font-medium mb-2">ÜGYFÉL HOZZÁRENDELÉS</p>
                      <div className="max-h-[200px] overflow-y-auto space-y-0.5">
                        {/* Unlink option */}
                        {linkedClient && (
                          <button
                            onClick={() => handleLink(acc.id, null)}
                            disabled={linkingId === acc.id}
                            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-red-500/8 transition-colors group"
                          >
                            <Unlink2 className="w-3.5 h-3.5 text-steel/30 group-hover:text-red-400 transition-colors" />
                            <span className="text-xs text-steel/60 group-hover:text-red-400 transition-colors">Leválasztás</span>
                          </button>
                        )}
                        {clients.map(cl => {
                          const alreadyLinked = linkedClientIds.has(cl.id) && cl.id !== acc.client_id;
                          return (
                            <button
                              key={cl.id}
                              onClick={() => !alreadyLinked && handleLink(acc.id, cl.id)}
                              disabled={linkingId === acc.id || alreadyLinked}
                              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                                cl.id === acc.client_id
                                  ? 'bg-teal/10 border border-teal/20'
                                  : alreadyLinked
                                    ? 'opacity-30 cursor-not-allowed'
                                    : 'hover:bg-surface-800/60'
                              }`}
                            >
                              <span
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: cl.color }}
                              />
                              <span className="text-xs text-cream/80 flex-1 truncate">{cl.name}</span>
                              {cl.company && (
                                <span className="text-[10px] text-steel/30 truncate max-w-[100px]">{cl.company}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {linkingId === acc.id && (
                        <div className="flex items-center gap-2 mt-2 text-xs text-steel/50">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Mentés...
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showConnect && (
        <AdsAccountConnect
          onClose={() => setShowConnect(false)}
          onConnected={handleConnected}
        />
      )}
    </div>
  );
}

export default function AdsSettings() {
  return <AdsSettingsContent />;
}
