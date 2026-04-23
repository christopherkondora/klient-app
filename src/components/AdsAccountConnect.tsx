import { useState } from 'react';
import { X, Loader2, Key, ExternalLink, Check, ChevronRight, AlertCircle } from 'lucide-react';

interface Props {
  onClose: () => void;
  onConnected: () => void;
}

type Step = 'credentials' | 'oauth' | 'select' | 'syncing';

export default function AdsAccountConnect({ onClose, onConnected }: Props) {
  const [step, setStep] = useState<Step>('credentials');
  const [developerToken, setDeveloperToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [mccId, setMccId] = useState('');
  const [saving, setSaving] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState('');
  const [oauthAccounts, setOauthAccounts] = useState<AdsOAuthAccount[]>([]);
  const [refreshToken, setRefreshToken] = useState('');
  const [connecting, setConnecting] = useState<string | null>(null);

  // Check if credentials already saved
  useState(() => {
    window.electronAPI.adsGetCredentials().then(res => {
      if (res.hasCredentials) {
        setStep('oauth');
      }
    });
  });

  const inputClass = 'w-full px-3 py-2 bg-surface-900 border border-teal/10 rounded-lg text-sm text-cream placeholder:text-steel/40 focus:outline-none focus:ring-2 focus:ring-teal/30';

  async function handleSaveCredentials() {
    if (!developerToken.trim() || !clientId.trim() || !clientSecret.trim()) {
      setError('Minden kötelező mezőt ki kell tölteni');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await window.electronAPI.adsSaveCredentials({
        developerToken: developerToken.trim(),
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
        mccId: mccId.trim() || undefined,
      });
      if (res.success) {
        setStep('oauth');
      } else {
        setError(res.error || 'Hiba történt a mentés során');
      }
    } catch (err: any) {
      setError(err.message || 'Hiba történt');
    } finally {
      setSaving(false);
    }
  }

  async function handleStartOAuth() {
    setOauthLoading(true);
    setError('');
    try {
      const res = await window.electronAPI.adsStartOAuth();
      if (res.success && res.data) {
        setOauthAccounts(res.data.accounts);
        setRefreshToken(res.data.refreshToken);
        setStep('select');
      } else {
        setError(res.error || 'OAuth hiba');
      }
    } catch (err: any) {
      setError(err.message || 'OAuth hiba');
    } finally {
      setOauthLoading(false);
    }
  }

  async function handleConnectAccount(account: AdsOAuthAccount) {
    setConnecting(account.customerId);
    setError('');
    try {
      const res = await window.electronAPI.adsConnectAccount({
        customerId: account.customerId,
        name: account.name,
        currency: account.currency,
        timezone: account.timezone,
        isMcc: account.isMcc,
        refreshToken,
      });
      if (res.success) {
        // Run initial full sync and wait for it
        if (res.data?.id) {
          setStep('syncing');
          try {
            await window.electronAPI.adsSyncAccount(res.data.id, 'full');
          } catch {
            // Sync failure is non-fatal — data can be synced later
          }
        }
        onConnected();
      } else {
        setError(res.error || 'Hiba a fiók csatlakoztatásakor');
      }
    } catch (err: any) {
      setError(err.message || 'Hiba történt');
    } finally {
      setConnecting(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg bg-surface-950 border border-teal/15 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-teal/10">
          <h2 className="text-sm font-bold text-cream">Google Ads Fiók Összekapcsolása</h2>
          <button onClick={onClose} className="text-steel hover:text-cream transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress */}
        <div className="flex items-center px-5 py-3 gap-2 bg-surface-900/30">
          {(['credentials', 'oauth', 'select'] as const).map((s, i) => {
            const isSyncing = step === ('syncing' as Step);
            const isCompleted = isSyncing
              || (s === 'credentials' && step !== 'credentials')
              || (s === 'oauth' && (step === 'select' || isSyncing));
            const isCurrent = step === s;
            return (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && <ChevronRight className="w-3 h-3 text-steel/30" />}
                <div className={`flex items-center gap-1.5 text-[11px] ${
                  isCurrent ? 'text-teal font-medium' : isCompleted ? 'text-emerald-400' : 'text-steel/50'
                }`}>
                  {isCompleted
                    ? <Check className="w-3 h-3" />
                    : <div className={`w-4 h-4 rounded-full ${isCurrent ? 'bg-teal/20' : 'bg-surface-800'} flex items-center justify-center text-[9px] font-bold`}>{i + 1}</div>
                  }
                  {s === 'credentials' ? 'API Kulcsok' : s === 'oauth' ? 'Bejelentkezés' : 'Fiók választás'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div className="px-5 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {step === 'credentials' && (
            <>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-steel mb-1">Developer Token *</label>
                  <input
                    className={inputClass}
                    value={developerToken}
                    onChange={e => setDeveloperToken(e.target.value)}
                    placeholder="XXXXXXXXXXXXXXXXXXXXXX"
                  />
                </div>
                <div>
                  <label className="block text-xs text-steel mb-1">OAuth Client ID *</label>
                  <input
                    className={inputClass}
                    value={clientId}
                    onChange={e => setClientId(e.target.value)}
                    placeholder="xxxxx.apps.googleusercontent.com"
                  />
                </div>
                <div>
                  <label className="block text-xs text-steel mb-1">OAuth Client Secret *</label>
                  <input
                    type="password"
                    className={inputClass}
                    value={clientSecret}
                    onChange={e => setClientSecret(e.target.value)}
                    placeholder="GOCSPX-xxxxxxxxx"
                  />
                </div>
                <div>
                  <label className="block text-xs text-steel mb-1">MCC Customer ID (opcionális)</label>
                  <input
                    className={inputClass}
                    value={mccId}
                    onChange={e => setMccId(e.target.value)}
                    placeholder="XXX-XXX-XXXX"
                  />
                </div>
              </div>
              <button
                onClick={handleSaveCredentials}
                disabled={saving}
                className="w-full py-2.5 bg-teal/15 text-cream text-sm font-medium rounded-lg hover:bg-teal/25 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                Mentés és tovább
              </button>
            </>
          )}

          {step === 'oauth' && (
            <div className="text-center space-y-4 py-4">
              <p className="text-sm text-steel">
                A böngésződ megnyílik a Google bejelentkezési oldalával.
                Jelentkezz be és engedélyezd az appot.
              </p>
              <button
                onClick={handleStartOAuth}
                disabled={oauthLoading}
                className="px-5 py-2.5 bg-teal/15 text-cream text-sm font-medium rounded-lg hover:bg-teal/25 disabled:opacity-50 transition-colors inline-flex items-center gap-2"
              >
                {oauthLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                Google Bejelentkezés
              </button>
            </div>
          )}

          {step === 'select' && (
            <div className="space-y-2">
              <p className="text-xs text-steel mb-3">Válaszd ki a kezelni kívánt fiókot:</p>
              {oauthAccounts.length === 0 ? (
                <p className="text-sm text-steel text-center py-4">Nem található elérhető fiók.</p>
              ) : (
                oauthAccounts.map(acc => (
                  <button
                    key={acc.customerId}
                    onClick={() => handleConnectAccount(acc)}
                    disabled={connecting !== null}
                    className="w-full flex items-center justify-between p-3 bg-surface-900 border border-teal/10 rounded-lg hover:border-teal/25 transition-colors text-left disabled:opacity-50"
                  >
                    <div>
                      <p className="text-sm text-cream font-medium">{acc.name}</p>
                      <p className="text-[11px] text-steel mt-0.5">
                        {acc.customerId} · {acc.currency} · {acc.isMcc ? 'MCC' : 'Standard'}
                      </p>
                    </div>
                    {connecting === acc.customerId
                      ? <Loader2 className="w-4 h-4 animate-spin text-teal" />
                      : <ChevronRight className="w-4 h-4 text-steel" />
                    }
                  </button>
                ))
              )}
            </div>
          )}

          {step === 'syncing' && (
            <div className="text-center space-y-4 py-8">
              <Loader2 className="w-8 h-8 animate-spin text-teal mx-auto" />
              <div>
                <p className="text-sm font-medium text-cream">Adatok szinkronizálása...</p>
                <p className="text-xs text-steel mt-1.5">
                  Kampányok, hirdetéscsoportok és metrikák letöltése a Google Ads-ből.
                  Ez az első alkalommal néhány másodpercig tarthat.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
