import { useEffect, useState } from 'react';
import { version } from '../../package.json';
import { NavLink } from 'react-router-dom';
import {
  Home, Users, UsersRound, Briefcase, Calendar, Plus, Trash2, SquarePen,
  X, Settings, ChevronLeft, Coins, FolderOpen,
} from 'lucide-react';
import { SHORTCUT_ICONS, getShortcutIcon, guessIconFromUrl } from '../utils/shortcutIcons';
import { useAuth } from '../contexts/AuthContext';

const baseNavItems = [
  { to: '/', icon: Home, label: 'Dashboard' },
  { to: '/clients', icon: Users, label: 'Ügyfelek' },
  { to: '/projects', icon: Briefcase, label: 'Projektek' },
  { to: '/finances', icon: Coins, label: 'Pénzügyek' },
  { to: '/calendar', icon: Calendar, label: 'Naptár' },
  { to: '/files', icon: FolderOpen, label: 'Fájlok' },
];

export default function Sidebar({ onOpenShortcut, activeShortcutUrl }: { onOpenShortcut: (url: string | null) => void; activeShortcutUrl: string | null }) {
  const { user } = useAuth();
  const teamMode = user?.team_mode === 1;
  // Pénzügyek oldal mindig elérhető — bárki rögzíthet bevételeket/kiadásokat.
  // Csak a számlázás és adózás van a vállalkozói módhoz kötve (lásd Finances.tsx).
  const filteredBase = baseNavItems;
  const navItems = teamMode
    ? [...filteredBase.slice(0, Math.min(5, filteredBase.length)), { to: '/team', icon: UsersRound, label: 'Csapat' }, ...filteredBase.slice(Math.min(5, filteredBase.length))]
    : filteredBase;
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingShortcut, setEditingShortcut] = useState<Shortcut | null>(null);
  const [contextMenu, setContextMenu] = useState<{ shortcut: Shortcut; x: number; y: number } | null>(null);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === 'true');
  // layoutCollapsed drives JSX structure (shortcut grid vs list, section labels).
  // When collapsing it lags 300ms behind `collapsed` so the width animation finishes
  // before the layout reflows — eliminating the vertical jump.
  const [layoutCollapsed, setLayoutCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === 'true');

  useEffect(() => {
    loadShortcuts();
  }, []);

  function toggleCollapsed() {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      if (next) {
        // Collapsing: let the 300ms width animation finish before reflowing layout
        setTimeout(() => setLayoutCollapsed(true), 300);
      } else {
        // Expanding: switch layout immediately so content is ready as sidebar widens
        setLayoutCollapsed(false);
      }
      return next;
    });
  }

  async function loadShortcuts() {
    try {
      const data = await window.electronAPI.getShortcuts();
      setShortcuts(data);
    } catch (err) {
      console.error('Failed to load shortcuts:', err);
    }
  }

  async function handleSaveShortcut(data: { name: string; url: string; icon: string }) {
    try {
      let finalUrl = data.url.trim();
      if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        finalUrl = 'https://' + finalUrl;
      }
      if (editingShortcut) {
        await window.electronAPI.updateShortcut(editingShortcut.id, { name: data.name.trim(), url: finalUrl, icon: data.icon });
      } else {
        await window.electronAPI.createShortcut({ name: data.name.trim(), url: finalUrl, icon: data.icon });
      }
      setShowAddForm(false);
      setEditingShortcut(null);
      loadShortcuts();
    } catch (err) {
      console.error('Failed to save shortcut:', err);
    }
  }

  async function handleDeleteShortcut(id: string) {
    try {
      await window.electronAPI.deleteShortcut(id);
      setContextMenu(null);
      loadShortcuts();
    } catch (err) {
      console.error('Failed to delete shortcut:', err);
    }
  }

  // Shared motion tokens — Tailwind JIT only scans static class strings, so the curve is inlined.
  const easeCurve = 'ease-[cubic-bezier(0.32,0.72,0,1)]';
  const widthTransition = `transition-[width] duration-300 ${easeCurve}`;
  // Label slides out by collapsing its max-width + fading. Icon never moves position.
  // Collapsing: labels vanish in 75ms (before the sidebar visually narrows).
  // Expanding: labels fade in with a 120ms delay (after the sidebar has started to widen).
  const labelClass = `inline-block overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ${easeCurve} ${
    collapsed ? 'max-w-0 opacity-0' : 'max-w-[160px] opacity-100'
  }`;

  return (
    <aside
      className={`${collapsed ? 'w-16' : 'w-52'} bg-surface-950 border-r border-teal/10 flex flex-col shrink-0 relative group/sidebar ${widthTransition}`}
    >
      {/* Shortcuts */}
      <div className="px-3 pt-3 pb-3">
        {!collapsed && (
          <p className="text-muted-soft px-1 pb-2 text-[10px] font-medium tracking-[0.16em]">
            GYORSLINKEK
          </p>
        )}
        {layoutCollapsed ? (
          // Collapsed: fixed-size icon buttons so height never changes during animation
          <div className="flex flex-col items-center gap-1.5">
            {shortcuts.map(shortcut => {
              const Icon = getShortcutIcon(shortcut.icon || guessIconFromUrl(shortcut.url));
              return (
                <button
                  key={shortcut.id}
                  onClick={() => onOpenShortcut(shortcut.url)}
                  onContextMenu={e => {
                    e.preventDefault();
                    setContextMenu({ shortcut, x: e.clientX, y: e.clientY });
                  }}
                  className={`w-9 h-9 rounded-lg border border-transparent flex items-center justify-center transition-colors group relative ${
                    activeShortcutUrl === shortcut.url
                      ? 'bg-teal/18 border-teal/30 ring-1 ring-teal/25'
                      : 'bg-surface-800/35 hover:bg-surface-800/60 hover:border-teal/10'
                  }`}
                  title={shortcut.name}
                >
                  <Icon width={15} height={15} className={`transition-colors ${activeShortcutUrl === shortcut.url ? 'text-cream' : 'text-muted-soft group-hover:text-cream'}`} />
                </button>
              );
            })}
            <button
              onClick={() => { setEditingShortcut(null); setShowAddForm(true); }}
              className="w-9 h-9 rounded-lg border border-dashed border-teal/12 hover:border-teal/25 flex items-center justify-center transition-colors"
              title="Új gyorslink"
            >
              <Plus width={13} height={13} className="text-muted-soft" />
            </button>
          </div>
        ) : (
          // Expanded: grid inside the decorative box
          <div className="rounded-xl border border-teal/8 bg-surface-900/45 shadow-inner shadow-black/10 p-1.5">
            <div className="grid grid-cols-3 gap-1.5">
              {shortcuts.map(shortcut => {
                const Icon = getShortcutIcon(shortcut.icon || guessIconFromUrl(shortcut.url));
                return (
                  <button
                    key={shortcut.id}
                    onClick={() => onOpenShortcut(shortcut.url)}
                    onContextMenu={e => {
                      e.preventDefault();
                      setContextMenu({ shortcut, x: e.clientX, y: e.clientY });
                    }}
                    className={`w-full aspect-square rounded-lg border border-transparent flex items-center justify-center transition-colors group relative ${
                      activeShortcutUrl === shortcut.url
                        ? 'bg-teal/18 border-teal/30 ring-1 ring-teal/25'
                        : 'bg-surface-800/35 hover:bg-surface-800/60 hover:border-teal/10'
                    }`}
                    title={shortcut.name}
                  >
                    <Icon width={15} height={15} className={`transition-colors ${activeShortcutUrl === shortcut.url ? 'text-cream' : 'text-muted-soft group-hover:text-cream'}`} />
                  </button>
                );
              })}
              <button
                onClick={() => { setEditingShortcut(null); setShowAddForm(true); }}
                className="w-full aspect-square rounded-lg border border-dashed border-teal/12 hover:border-teal/25 flex items-center justify-center transition-colors"
                title="Új gyorslink"
              >
                <Plus width={13} height={13} className="text-muted-soft" />
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="h-px bg-teal/10 mx-3" />

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-hidden">
        {!collapsed && (
          <p className="text-muted-soft px-3 pb-2 text-[10px] font-medium tracking-[0.16em]">
            FŐ MENÜ
          </p>
        )}
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={() => onOpenShortcut(null)}
            title={item.label}
            className={({ isActive }) => {
              const showActive = isActive && !activeShortcutUrl;
              return `flex items-center gap-3 px-3 py-2.5 rounded-md text-[13px] transition-colors relative ${
                showActive
                  ? 'bg-teal/15 text-cream font-semibold before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[3px] before:rounded-full before:bg-steel'
                  : 'text-muted font-medium hover:bg-teal/8 hover:text-ash'
              }`;
            }}
          >
            <item.icon width={16} height={16} className="shrink-0" />
            <span className={labelClass}>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-teal/10 space-y-2 overflow-hidden">
        <NavLink
          to="/settings"
          onClick={() => onOpenShortcut(null)}
          title="Beállítások"
          className={({ isActive }) => {
            const showActive = isActive && !activeShortcutUrl;
            return `flex items-center gap-3 px-3 py-2 rounded-md text-[13px] transition-colors relative ${
              showActive
                ? 'bg-teal/15 text-cream font-semibold before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[3px] before:rounded-full before:bg-steel'
                : 'text-steel font-medium hover:bg-teal/8 hover:text-ash'
            }`;
          }}
        >
          <Settings width={16} height={16} className="shrink-0" />
          <span className={labelClass}>Beállítások</span>
        </NavLink>

        {!layoutCollapsed && (
          <p className="font-pixel text-[11px] text-teal tracking-wider px-3 whitespace-nowrap">
            KLIENT V{version} <span className="text-muted-soft">BETA</span>
          </p>
        )}
      </div>

      {/* Theme-matched edge handle — integrates with the sidebar border, no drop shadow.
          Stays subtly visible so users can find it, brightens on hover. */}
      <button
        onClick={toggleCollapsed}
        aria-label={collapsed ? 'Sidebar kinyitása' : 'Sidebar összezárása'}
        title={collapsed ? 'Sidebar kinyitása' : 'Sidebar összezárása'}
        className="absolute top-1/2 -translate-y-1/2 -right-[11px] w-[22px] h-[22px] rounded-full bg-surface-950 border border-teal/15 text-muted-soft hover:text-cream hover:border-teal/35 flex items-center justify-center opacity-0 group-hover/sidebar:opacity-100 focus-visible:opacity-100 transition-opacity duration-150 ease-out z-20"
      >
        <ChevronLeft
          size={11}
          className={`transition-transform duration-300 ${easeCurve} ${collapsed ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 bg-surface-800 border border-teal/15 rounded-lg shadow-xl py-1 min-w-[140px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => {
                setEditingShortcut(contextMenu.shortcut);
                setShowAddForm(true);
                setContextMenu(null);
              }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-steel hover:bg-teal/10 hover:text-cream"
            >
              <SquarePen width={12} height={12} /> Szerkesztés
            </button>
            <button
              onClick={() => handleDeleteShortcut(contextMenu.shortcut.id)}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-steel hover:bg-red-500/10 hover:text-red-400"
            >
              <Trash2 width={12} height={12} /> Törlés
            </button>
          </div>
        </>
      )}

      {/* Add/Edit Shortcut Modal */}
      {showAddForm && (
        <ShortcutFormModal
          shortcut={editingShortcut}
          onSave={handleSaveShortcut}
          onClose={() => { setShowAddForm(false); setEditingShortcut(null); }}
        />
      )}
    </aside>
  );
}

function ShortcutFormModal({ shortcut, onSave, onClose }: {
  shortcut: Shortcut | null;
  onSave: (data: { name: string; url: string; icon: string }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(shortcut?.name || '');
  const [url, setUrl] = useState(shortcut?.url || '');
  const [icon, setIcon] = useState(shortcut?.icon || '');

  const inputClass = "w-full px-2.5 py-2 bg-surface-900/40 border border-teal/8 rounded-lg text-sm text-cream focus:outline-none focus:border-teal/25 placeholder:text-steel/40 transition-colors";
  const labelClass = "text-[10px] text-steel tracking-wider uppercase mb-1 block";

  const effectiveIcon = icon || (url ? guessIconFromUrl(url) : 'Globe');

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onDoubleClick={onClose}>
      <div className="bg-surface-800 rounded-2xl ring-1 ring-inset ring-teal/15 w-full max-w-sm shadow-2xl overflow-hidden" onDoubleClick={e => e.stopPropagation()}>

        {/* Header accent */}
        <div className="h-1 bg-teal" />

        <div className="p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-pixel text-[14px] text-cream">
              {shortcut ? 'Gyorslink szerkesztése' : 'Új gyorslink'}
            </h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-teal/10 text-steel hover:text-cream cursor-pointer transition-colors duration-150 ease-out">
              <X width={14} height={14} />
            </button>
          </div>
        <form
          onSubmit={e => {
            e.preventDefault();
            if (!name.trim() || !url.trim()) return;
            onSave({ name: name.trim(), url: url.trim(), icon: effectiveIcon });
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelClass}>Név *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputClass} placeholder="pl. Gmail" required />
          </div>
          <div>
            <label className={labelClass}>URL *</label>
            <input type="text" value={url} onChange={e => setUrl(e.target.value)} className={inputClass} placeholder="https://mail.google.com" required />
          </div>
          <div>
            <label className={labelClass}>Ikon</label>
            <div className="grid grid-cols-7 gap-1.5">
              {Object.entries(SHORTCUT_ICONS).map(([key, { icon: IconComp, label }]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setIcon(key)}
                  className={`w-full aspect-square rounded-lg flex items-center justify-center transition-colors ${
                    effectiveIcon === key
                      ? 'bg-teal/30 ring-1 ring-teal/50 text-cream'
                      : 'bg-surface-900 text-steel hover:bg-teal/10 hover:text-ash'
                  }`}
                  title={label}
                >
                  <IconComp width={14} height={14} />
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-steel hover:text-cream transition-colors duration-150 ease-out cursor-pointer">Mégse</button>
            <button type="submit" className="px-5 py-2 text-xs font-medium bg-teal text-cream rounded-lg hover:bg-teal/80 transition-colors duration-150 ease-out cursor-pointer">
              {shortcut ? 'Mentés' : 'Hozzáadás'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}
