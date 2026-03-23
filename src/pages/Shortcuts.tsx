import { useEffect, useState } from 'react';
import {
  Plus, Trash2, SquarePen, ExternalLink, X, Globe, ArrowLeft,
} from 'lucide-react';
import { SHORTCUT_ICONS, getShortcutIcon, guessIconFromUrl } from '../utils/shortcutIcons';

export default function Shortcuts() {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingShortcut, setEditingShortcut] = useState<Shortcut | null>(null);
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const data = await window.electronAPI.getShortcuts();
      setShortcuts(data);
    } catch (err) {
      console.error('Failed to load shortcuts:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(data: Partial<Shortcut>) {
    try {
      if (editingShortcut) {
        await window.electronAPI.updateShortcut(editingShortcut.id, data);
      } else {
        await window.electronAPI.createShortcut(data);
      }
      setShowForm(false);
      setEditingShortcut(null);
      loadData();
    } catch (err) {
      console.error('Failed to save shortcut:', err);
    }
  }

  async function handleDelete(id: string) {
    try {
      await window.electronAPI.deleteShortcut(id);
      loadData();
    } catch (err) {
      console.error('Failed to delete shortcut:', err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-steel"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="font-pixel text-xl text-cream">Gyorslinkek</h1>
          <p className="text-steel text-sm mt-1">Gyakran használt weboldalak az appon belül</p>
        </div>
        <button
          onClick={() => { setEditingShortcut(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-teal text-cream rounded-lg text-sm font-medium hover:bg-teal/80"
        >
          <Plus width={16} height={16} /> Új gyorslink
        </button>
      </div>

      {activeUrl ? (
        /* Embedded Browser View */
        <div className="flex-1 flex flex-col bg-surface-800/50 rounded-xl border border-teal/10 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 bg-surface-900 border-b border-teal/10 shrink-0">
            <button
              onClick={() => setActiveUrl(null)}
              className="flex items-center gap-1 text-xs text-steel hover:text-cream px-2 py-1 rounded hover:bg-teal/10"
            >
              <ArrowLeft width={12} height={12} /> Vissza
            </button>
            <div className="flex-1 text-xs text-steel/60 truncate px-2 py-1 bg-surface-800 rounded border border-teal/10">
              {activeUrl}
            </div>
          </div>
          <webview
            src={activeUrl}
            className="flex-1"
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      ) : (
        /* Shortcut Grid */
        <>
          {shortcuts.length === 0 ? (
            <div className="text-center py-12">
              <Globe width={40} height={40} className="mx-auto text-steel/30 mb-3" />
              <p className="text-steel/60 text-sm">Még nincsenek gyorslinkek</p>
              <p className="text-steel/60 text-xs mt-1">Adj hozzá gyakran használt weboldalakat</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {shortcuts.map(shortcut => {
                const Icon = getShortcutIcon(shortcut.icon || guessIconFromUrl(shortcut.url));
                return (
                <div
                  key={shortcut.id}
                  className="bg-surface-800/50 rounded-xl border border-teal/10 p-4 hover:border-teal/25 transition-colors cursor-pointer group relative"
                  onClick={() => setActiveUrl(shortcut.url)}
                >
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => { setEditingShortcut(shortcut); setShowForm(true); }}
                      className="p-1 rounded hover:bg-teal/10 text-steel/40 hover:text-cream"
                    >
                      <SquarePen width={12} height={12} />
                    </button>
                    <button
                      onClick={() => handleDelete(shortcut.id)}
                      className="p-1 rounded hover:bg-red-500/10 text-steel/40 hover:text-red-400"
                    >
                      <Trash2 width={12} height={12} />
                    </button>
                  </div>
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-teal/15 flex items-center justify-center">
                      <Icon width={20} height={20} className="text-steel" />
                    </div>
                    <div className="text-center">
                      <h3 className="font-medium text-cream text-sm">{shortcut.name}</h3>
                      <p className="text-[10px] text-steel/60 mt-0.5 truncate max-w-[150px]">{shortcut.url}</p>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {showForm && (
        <ShortcutForm
          shortcut={editingShortcut}
          onSubmit={handleSave}
          onClose={() => { setShowForm(false); setEditingShortcut(null); }}
        />
      )}
    </div>
  );
}

function ShortcutForm({ shortcut, onSubmit, onClose }: {
  shortcut: Shortcut | null;
  onSubmit: (data: Partial<Shortcut>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(shortcut?.name || '');
  const [url, setUrl] = useState(shortcut?.url || '');
  const [icon, setIcon] = useState(shortcut?.icon || '');

  const inputClass = "w-full px-3 py-2 bg-surface-900 border border-teal/10 rounded-lg text-sm text-cream focus:outline-none focus:ring-2 focus:ring-teal/30";

  const effectiveIcon = icon || (url ? guessIconFromUrl(url) : 'Globe');

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-surface-800 rounded-xl border border-teal/15 p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
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
            let finalUrl = url.trim();
            if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
              finalUrl = 'https://' + finalUrl;
            }
            onSubmit({ name: name.trim(), url: finalUrl, icon: effectiveIcon });
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-steel mb-1">Név *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputClass} placeholder="pl. Google Analytics" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-steel mb-1">URL *</label>
            <input type="text" value={url} onChange={e => setUrl(e.target.value)} className={inputClass} placeholder="https://analytics.google.com" required />
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
              {shortcut ? 'Mentés' : 'Létrehozás'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
