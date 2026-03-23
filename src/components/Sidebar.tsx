import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home, Users, Briefcase, Calendar, Plus, Trash2, SquarePen,
  X, Settings, ChevronLeft, ChevronRight, Coins, FolderOpen,
} from 'lucide-react';
import { SHORTCUT_ICONS, getShortcutIcon, guessIconFromUrl } from '../utils/shortcutIcons';

const navItems = [
  { to: '/', icon: Home, label: 'Dashboard' },
  { to: '/finances', icon: Coins, label: 'Pénzügyek' },
  { to: '/clients', icon: Users, label: 'Ügyfelek' },
  { to: '/projects', icon: Briefcase, label: 'Projektek' },
  { to: '/calendar', icon: Calendar, label: 'Naptár' },
  { to: '/files', icon: FolderOpen, label: 'Fájlok' },
];

export default function Sidebar({ onOpenShortcut, activeShortcutUrl }: { onOpenShortcut: (url: string | null) => void; activeShortcutUrl: string | null }) {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingShortcut, setEditingShortcut] = useState<Shortcut | null>(null);
  const [contextMenu, setContextMenu] = useState<{ shortcut: Shortcut; x: number; y: number } | null>(null);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === 'true');

  useEffect(() => {
    loadShortcuts();
  }, []);

  function toggleCollapsed() {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
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

  return (
    <aside
      className={`${collapsed ? 'w-14' : 'w-52'} bg-surface-950 border-r border-teal/10 flex flex-col shrink-0 transition-[width] duration-200 ease-in-out`}
    >
      {/* Essentials Grid */}
      <div className={`${collapsed ? 'px-2' : 'px-3'} pt-4 pb-2`}>
        <div className={`grid ${collapsed ? 'grid-cols-1' : 'grid-cols-3'} gap-1.5`}>
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
              className={`w-full aspect-square rounded-lg flex items-center justify-center transition-colors group relative ${
                activeShortcutUrl === shortcut.url
                  ? 'bg-teal/20 ring-1 ring-teal/40'
                  : 'bg-surface-800/60 hover:bg-surface-800'
              }`}
              title={shortcut.name}
            >
              <Icon width={16} height={16} className={`transition-colors ${activeShortcutUrl === shortcut.url ? 'text-cream' : 'text-steel group-hover:text-cream'}`} />
            </button>
            );
          })}
          <button
            onClick={() => { setEditingShortcut(null); setShowAddForm(true); }}
            className="w-full aspect-square rounded-lg border border-dashed border-teal/15 hover:border-teal/30 flex items-center justify-center transition-colors"
            title="Új gyorslink"
          >
            <Plus width={14} height={14} className="text-steel/40" />
          </button>
        </div>
      </div>

      <div className={`h-px bg-teal/10 ${collapsed ? 'mx-2' : 'mx-3'}`} />

      {/* Navigation */}
      <nav className={`flex-1 py-4 ${collapsed ? 'px-2' : 'px-3'} space-y-0.5`}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={() => onOpenShortcut(null)}
            className={({ isActive }) => {
              const showActive = isActive && !activeShortcutUrl;
              return `flex items-center ${collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'} rounded-md text-[13px] transition-all relative ${
                showActive
                  ? 'bg-teal/15 text-cream font-semibold before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[3px] before:rounded-full before:bg-steel'
                  : 'text-steel font-medium hover:bg-teal/8 hover:text-ash'
              }`;
            }}
          >
            <item.icon width={16} height={16} />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className={`${collapsed ? 'px-2' : 'px-3'} py-3 border-t border-teal/10 space-y-2`}>
        <NavLink
          to="/settings"
          onClick={() => onOpenShortcut(null)}
          className={({ isActive }) => {
            const showActive = isActive && !activeShortcutUrl;
            return `flex items-center ${collapsed ? 'justify-center px-0 py-2' : 'gap-3 px-3 py-2'} rounded-md text-[13px] transition-all relative ${
              showActive
                ? 'bg-teal/15 text-cream font-semibold before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[3px] before:rounded-full before:bg-steel'
                : 'text-steel font-medium hover:bg-teal/8 hover:text-ash'
            }`;
          }}
        >
          <Settings width={16} height={16} />
          {!collapsed && <span>Beállítások</span>}
        </NavLink>

        {/* Collapse toggle */}
        <button
          onClick={toggleCollapsed}
          className="w-full flex items-center justify-center py-1.5 rounded-md text-steel/50 hover:text-steel hover:bg-teal/8 transition-colors"
          title={collapsed ? 'Sidebar kinyitása' : 'Sidebar összezárása'}
        >
          {collapsed
            ? <ChevronRight width={14} height={14} />
            : <ChevronLeft width={14} height={14} />
          }
        </button>

        {!collapsed && <p className="font-pixel text-[11px] text-teal tracking-wider px-3">KLIENT V1.0.0</p>}
      </div>

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

  const inputClass = "w-full px-3 py-2 bg-surface-900 border border-teal/10 rounded-lg text-sm text-cream focus:outline-none focus:ring-2 focus:ring-teal/30";

  const effectiveIcon = icon || (url ? guessIconFromUrl(url) : 'Globe');

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onDoubleClick={onClose}>
      <div className="bg-surface-800 rounded-xl border border-teal/15 p-6 w-full max-w-sm shadow-2xl" onDoubleClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-pixel text-[14px] text-cream">
            {shortcut ? 'Gyorslink szerkesztése' : 'Új gyorslink'}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-teal/10 text-steel hover:text-cream">
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
            <label className="block text-xs font-medium text-steel mb-1">Név *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputClass} placeholder="pl. Gmail" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-steel mb-1">URL *</label>
            <input type="text" value={url} onChange={e => setUrl(e.target.value)} className={inputClass} placeholder="https://mail.google.com" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-steel mb-1.5">Ikon</label>
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
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-steel hover:bg-teal/10 rounded-lg">Mégse</button>
            <button type="submit" className="px-4 py-2 text-sm bg-teal text-cream rounded-lg hover:bg-teal/80">
              {shortcut ? 'Mentés' : 'Hozzáadás'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
