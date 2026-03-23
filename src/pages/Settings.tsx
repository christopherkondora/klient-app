import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

const INVOICE_PLATFORMS = [
  { id: 'szamlazz', label: 'Számlázz.hu' },
  { id: 'billingo', label: 'Billingo' },
  { id: 'nav', label: 'NAV Online Számla' },
  { id: 'kulcs', label: 'Kulcs-Soft' },
  { id: 'none', label: 'Nincs / Egyéb' },
];

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { user, updateUser, logout } = useAuth();

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="font-pixel text-xl text-cream">Beállítások</h1>
        <p className="text-steel text-sm mt-2">Alkalmazás beállításai</p>
      </div>

      {/* Theme Settings */}
      <div className="bg-surface-800/50 rounded-lg border border-teal/10 p-6">
        <h2 className="font-pixel text-[14px] text-ash mb-4">Megjelenés</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-steel mb-3">Téma</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'dark' as const, name: 'Sötét', desc: 'Alapértelmezett', bg: '#01161E', sidebar: '#010E13', card: '#0C2230', text: '#EFF6E0', accent: '#124559', steel: '#598392' },
                { id: 'light' as const, name: 'Light — Beige', desc: 'Nappali', bg: '#E4EFD4', sidebar: '#DCEACC', card: '#FFFFFF', text: '#01161E', accent: '#124559', steel: '#598392' },
                { id: 'teal-ocean' as const, name: 'Teal — Ocean', desc: 'Egyedi', bg: '#0D3545', sidebar: '#0B2D3E', card: '#1A4D63', text: '#EFF6E0', accent: '#598392', steel: '#7FA0AD' },
                { id: 'ash-soft' as const, name: 'Ash — Soft', desc: 'Természetes', bg: '#9EB8A0', sidebar: '#B2C8B4', card: '#D4E0D5', text: '#01161E', accent: '#124559', steel: '#598392' },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`p-3 rounded-lg border-2 transition-all text-left ${
                    theme === t.id
                      ? 'border-teal bg-teal/10'
                      : 'border-teal/10 hover:border-teal/30'
                  }`}
                >
                  <div className="w-full h-14 rounded-md border border-black/10 mb-2 flex overflow-hidden" style={{ backgroundColor: t.bg }}>
                    <div className="w-5 h-full flex flex-col gap-0.5 p-1 justify-center" style={{ backgroundColor: t.sidebar }}>
                      <div className="w-full h-1 rounded-sm" style={{ backgroundColor: t.accent }} />
                      <div className="w-full h-1 rounded-sm" style={{ backgroundColor: t.accent }} />
                      <div className="w-full h-1 rounded-sm" style={{ backgroundColor: t.accent }} />
                    </div>
                    <div className="flex-1 p-1.5 flex flex-col gap-1">
                      <div className="w-full h-2 rounded-sm" style={{ backgroundColor: t.card }} />
                      <div className="flex gap-1">
                        <div className="flex-1 h-4 rounded-sm" style={{ backgroundColor: t.card }} />
                        <div className="flex-1 h-4 rounded-sm" style={{ backgroundColor: t.card }} />
                        <div className="flex-1 h-4 rounded-sm" style={{ backgroundColor: t.card }} />
                      </div>
                      <div className="w-full flex-1 rounded-sm" style={{ backgroundColor: t.card }} />
                    </div>
                  </div>
                  <p className="text-sm font-medium text-cream">{t.name}</p>
                  <p className="text-[10px] text-steel">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Platform */}
      <div className="bg-surface-800/50 rounded-lg border border-teal/10 p-6">
        <h2 className="font-pixel text-[14px] text-ash mb-4">Számlázás</h2>
        <div>
          <label className="block text-xs font-medium text-steel mb-3">Platform</label>
          <div className="flex flex-wrap gap-2">
            {INVOICE_PLATFORMS.map(p => (
              <button
                key={p.id}
                onClick={() => updateUser({ invoice_platform: p.id })}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                  user?.invoice_platform === p.id
                    ? 'border-teal bg-teal/15 text-cream'
                    : 'border-teal/10 text-steel hover:border-teal/25 hover:text-ash'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pomodoro */}
      <div className="bg-surface-800/50 rounded-lg border border-teal/10 p-6">
        <h2 className="font-pixel text-[14px] text-ash mb-2">Pomodoro</h2>
        <p className="text-[11px] text-steel mb-4">Ha bekapcsolod, a befejezett Pomodoro munkamenetek automatikusan rögzülnek a kiválasztott projekt naptári eseményéhez.</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-steel">Projekt követés</span>
          <button
            onClick={() => updateUser({ pomodoro_project_tracking: user?.pomodoro_project_tracking === 1 ? 0 : 1 })}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              user?.pomodoro_project_tracking === 1 ? 'bg-teal' : 'bg-surface-800 border border-teal/20'
            }`}
          >
            <span className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full transition-all ${
              user?.pomodoro_project_tracking === 1
                ? 'left-5.5 bg-cream'
                : 'left-0.5 bg-steel/60'
            }`} />
          </button>
        </div>
      </div>

      {/* App Info */}
      <div className="bg-surface-800/50 rounded-lg border border-teal/10 p-6">
        <h2 className="font-pixel text-[14px] text-ash mb-4">Alkalmazás</h2>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-steel">Verzió</span>
            <span className="text-xs text-cream font-medium">1.0.0</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-steel">Platform</span>
            <span className="text-xs text-cream font-medium">Electron + React</span>
          </div>
        </div>
      </div>

      {/* Account */}
      <div className="bg-surface-800/50 rounded-lg border border-teal/10 p-6">
        <h2 className="font-pixel text-[14px] text-ash mb-4">Fiók</h2>
        {user && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-steel">Bejelentkezve</span>
              <span className="text-xs text-cream font-medium">{user.email}</span>
            </div>
            <button
              onClick={logout}
              className="w-full py-2 text-sm text-red-400 border border-red-400/20 rounded-lg hover:bg-red-400/10 transition-colors"
            >
              Kijelentkezés
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
