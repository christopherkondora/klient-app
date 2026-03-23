import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Folder, FileText, Image, FileSpreadsheet, FileCode, Film, Music,
  Search, FolderPlus, ChevronRight, LayoutGrid, List, ArrowLeft,
  Trash2, Pencil, ExternalLink, FolderOpen, X, File, Plus,
  Upload, FolderUp,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import ConfirmDialog from '../components/ConfirmDialog';

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
const PDF_EXT = '.pdf';

function getFileIcon(name: string, isDirectory: boolean) {
  if (isDirectory) return Folder;
  const ext = name.toLowerCase().slice(name.lastIndexOf('.'));
  if (IMAGE_EXTS.includes(ext)) return Image;
  if (ext === PDF_EXT) return FileText;
  if (['.xls', '.xlsx', '.csv'].includes(ext)) return FileSpreadsheet;
  if (['.js', '.ts', '.tsx', '.jsx', '.html', '.css', '.json', '.py'].includes(ext)) return FileCode;
  if (['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext)) return Film;
  if (['.mp3', '.wav', '.ogg', '.flac', '.aac'].includes(ext)) return Music;
  return File;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function isPreviewable(name: string): boolean {
  const ext = name.toLowerCase().slice(name.lastIndexOf('.'));
  return IMAGE_EXTS.includes(ext) || ext === PDF_EXT;
}

export default function Files() {
  const [searchParams] = useSearchParams();
  const initialPath = searchParams.get('path') || '';

  const [currentPath, setCurrentPath] = useState(initialPath);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() =>
    (localStorage.getItem('files-view') as 'grid' | 'list') || 'grid'
  );
  const [loading, setLoading] = useState(true);
  const [contextMenu, setContextMenu] = useState<{ entry: FileEntry; x: number; y: number } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FileEntry | null>(null);
  const [renameTarget, setRenameTarget] = useState<FileEntry | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [previewFile, setPreviewFile] = useState<FileEntry | null>(null);
  const [previewData, setPreviewData] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bgContextMenu, setBgContextMenu] = useState<{ x: number; y: number } | null>(null);
  // Rubber-band selection
  const [rubberBand, setRubberBand] = useState<{ startX: number; startY: number; curX: number; curY: number } | null>(null);
  const rubberBandBaseSelection = useRef<Set<string>>(new Set());
  const contentRef = useRef<HTMLDivElement>(null);
  const dragCounter = useRef(0);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadEntries();
  }, [currentPath]);

  useEffect(() => {
    if (renameTarget && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renameTarget]);

  useEffect(() => {
    if (showNewFolder && newFolderInputRef.current) {
      newFolderInputRef.current.focus();
    }
  }, [showNewFolder]);

  // Close context menu on click elsewhere
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      setContextMenu(null);
      setBgContextMenu(null);
      // Close add menu if clicking outside
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    }
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // Filter entries (computed early for Ctrl+A)
  const filtered = search
    ? entries.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
    : entries;

  // Ctrl+A to select all
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === 'a' && filtered.length > 0) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        setSelected(new Set(filtered.map(f => f.path)));
      }
      if (e.key === 'Escape') {
        setSelected(new Set());
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filtered]);

  // Clear selection on path change
  useEffect(() => {
    setSelected(new Set());
  }, [currentPath]);

  async function loadEntries() {
    setLoading(true);
    try {
      const data = await window.electronAPI.filesList(currentPath);
      // Sort: directories first, then alphabetically
      data.sort((a: FileEntry, b: FileEntry) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name, 'hu');
      });
      setEntries(data);
    } catch (err) {
      console.error('Failed to list files:', err);
    } finally {
      setLoading(false);
    }
  }

  function navigateTo(relativePath: string) {
    setSearch('');
    setCurrentPath(relativePath);
  }

  function handleEntryClick(entry: FileEntry, e?: React.MouseEvent) {
    // If rubber band drag just happened, don't do anything
    if (rubberBandDragged.current) return;
    // If clicked on a checkbox, let toggleSelection handle it
    if (e && (e.target as HTMLElement).closest('[data-checkbox]')) return;
    // Ctrl+click toggles selection
    if (e && e.ctrlKey) {
      e.preventDefault();
      setSelected(prev => {
        const next = new Set(prev);
        if (next.has(entry.path)) next.delete(entry.path);
        else next.add(entry.path);
        return next;
      });
      return;
    }
    // Regular click clears selection
    if (selected.size > 0) {
      setSelected(new Set());
    }
  }

  function handleEntryDoubleClick(entry: FileEntry) {
    setSelected(new Set());
    if (entry.isDirectory) {
      navigateTo(entry.path);
    } else if (isPreviewable(entry.name)) {
      openPreview(entry);
    } else {
      window.electronAPI.filesOpenFile(entry.path);
    }
  }

  function toggleSelection(path: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  // Background right-click (empty area)
  function handleBgContextMenu(e: React.MouseEvent) {
    // Don't show if right-clicking on a file entry
    if ((e.target as HTMLElement).closest('[data-file-entry]')) return;
    e.preventDefault();
    setContextMenu(null);
    setBgContextMenu({ x: e.clientX, y: e.clientY });
  }

  // Bulk delete
  async function handleBulkDelete() {
    for (const p of selected) {
      try { await window.electronAPI.filesDelete(p); } catch {}
    }
    setSelected(new Set());
    loadEntries();
  }

  // Rubber-band selection
  function handleRubberBandStart(e: React.MouseEvent) {
    // Only start on left-click
    if (e.button !== 0) return;
    // Don't start on buttons, inputs, checkboxes
    if ((e.target as HTMLElement).closest('button')) return;
    if ((e.target as HTMLElement).closest('input')) return;
    if ((e.target as HTMLElement).closest('[data-checkbox]')) return;
    if (!e.ctrlKey) setSelected(new Set());
    rubberBandBaseSelection.current = e.ctrlKey ? new Set(selected) : new Set();
    setRubberBand({ startX: e.clientX, startY: e.clientY, curX: e.clientX, curY: e.clientY });
    rubberBandDragged.current = false;
    e.preventDefault();
  }

  const rubberBandDragged = useRef(false);

  useEffect(() => {
    if (!rubberBand) return;
    function computeSelection(rx: number, ry: number, rw: number, rh: number) {
      if (!contentRef.current) return;
      const items = contentRef.current.querySelectorAll('[data-file-entry]');
      const newSelected = new Set(rubberBandBaseSelection.current);
      items.forEach(el => {
        const rect = el.getBoundingClientRect();
        const overlaps = !(rect.right < rx || rect.left > rx + rw || rect.bottom < ry || rect.top > ry + rh);
        const path = el.getAttribute('data-file-entry') || '';
        if (overlaps && path) newSelected.add(path);
      });
      setSelected(newSelected);
    }
    function onMove(e: MouseEvent) {
      setRubberBand(prev => {
        if (!prev) return null;
        const dx = Math.abs(e.clientX - prev.startX);
        const dy = Math.abs(e.clientY - prev.startY);
        if (dx > 5 || dy > 5) rubberBandDragged.current = true;
        const next = { ...prev, curX: e.clientX, curY: e.clientY };
        if (rubberBandDragged.current) {
          const rx = Math.min(next.startX, next.curX);
          const ry = Math.min(next.startY, next.curY);
          const rw = Math.abs(next.curX - next.startX);
          const rh = Math.abs(next.curY - next.startY);
          computeSelection(rx, ry, rw, rh);
        }
        return next;
      });
    }
    function onUp() {
      setRubberBand(null);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [rubberBand, selected]);

  function handleContextMenu(e: React.MouseEvent, entry: FileEntry) {
    e.preventDefault();
    e.stopPropagation();
    setBgContextMenu(null);
    setContextMenu({ entry, x: e.clientX, y: e.clientY });
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await window.electronAPI.filesDelete(deleteTarget.path);
      setDeleteTarget(null);
      loadEntries();
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  }

  async function handleRename() {
    if (!renameTarget || !renameValue.trim()) return;
    const parentPath = renameTarget.path.substring(0, renameTarget.path.lastIndexOf('/'));
    const newPath = parentPath ? `${parentPath}/${renameValue.trim()}` : renameValue.trim();
    try {
      await window.electronAPI.filesRename(renameTarget.path, newPath);
      setRenameTarget(null);
      setRenameValue('');
      loadEntries();
    } catch (err) {
      console.error('Failed to rename:', err);
    }
  }

  async function handleNewFolder() {
    if (!newFolderName.trim()) return;
    const folderPath = currentPath ? `${currentPath}/${newFolderName.trim()}` : newFolderName.trim();
    try {
      await window.electronAPI.filesCreateFolder(folderPath);
      setShowNewFolder(false);
      setNewFolderName('');
      loadEntries();
    } catch (err) {
      console.error('Failed to create folder:', err);
    }
  }

  async function openPreview(entry: FileEntry) {
    setPreviewFile(entry);
    try {
      const base64 = await window.electronAPI.filesReadFile(entry.path);
      setPreviewData(base64);
    } catch (err) {
      console.error('Failed to read file:', err);
    }
  }

  function setViewModeAndSave(mode: 'grid' | 'list') {
    setViewMode(mode);
    localStorage.setItem('files-view', mode);
  }

  async function handleUploadFiles() {
    setShowAddMenu(false);
    const paths = await window.electronAPI.filesSelectFiles();
    if (paths.length === 0) return;
    await window.electronAPI.filesCopyFiles(paths, currentPath || '.');
    loadEntries();
  }

  async function handleUploadFolder() {
    setShowAddMenu(false);
    const paths = await window.electronAPI.filesSelectFolder();
    if (paths.length === 0) return;
    await window.electronAPI.filesCopyFiles(paths, currentPath || '.');
    loadEntries();
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setDragging(true);
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragging(false);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    dragCounter.current = 0;

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const paths: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const filePath = window.electronAPI.getFilePathForDrop(files[i]);
      if (filePath) paths.push(filePath);
    }
    if (paths.length === 0) return;
    await window.electronAPI.filesCopyFiles(paths, currentPath || '.');
    loadEntries();
  }

  // Breadcrumb segments
  const pathParts = currentPath ? currentPath.split('/').filter(Boolean) : [];
  const breadcrumbs = pathParts.map((part, i) => ({
    label: part,
    path: pathParts.slice(0, i + 1).join('/'),
  }));

  return (
    <div
      className="max-w-7xl mx-auto space-y-6 relative"
      onContextMenu={e => e.preventDefault()}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {dragging && (
        <div className="fixed inset-0 z-40 bg-teal/10 border-2 border-dashed border-teal rounded-lg flex items-center justify-center pointer-events-none">
          <div className="bg-surface-800 border border-teal/30 rounded-xl px-8 py-6 text-center">
            <Upload width={40} height={40} className="mx-auto text-teal mb-3" />
            <p className="text-cream font-medium">Húzd ide a fájlokat</p>
            <p className="text-steel text-sm mt-1">Hozzáadás az aktuális mappához</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-pixel text-xl text-cream">Fájlok</h1>
          <p className="text-steel text-sm mt-2">{entries.length} elem</p>
        </div>
        <div className="relative" ref={addMenuRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowAddMenu(prev => !prev); }}
            className="flex items-center gap-2 px-4 py-2 bg-teal text-cream rounded-lg text-sm font-medium hover:bg-teal/80 transition-colors"
          >
            <Plus width={16} height={16} />
            Új
          </button>
          {showAddMenu && (
            <div className="absolute right-0 top-full mt-2 bg-surface-800 border border-teal/15 rounded-lg shadow-2xl py-1 min-w-[220px] z-50">
              <button
                onClick={() => { setShowAddMenu(false); setShowNewFolder(true); setNewFolderName(''); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-cream hover:bg-teal/10 transition-colors"
              >
                <FolderPlus width={16} height={16} className="text-steel" /> Új mappa
              </button>
              <div className="border-t border-teal/10 my-1" />
              <button
                onClick={handleUploadFiles}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-cream hover:bg-teal/10 transition-colors"
              >
                <Upload width={16} height={16} className="text-steel" /> Fájl hozzáadása
              </button>
              <button
                onClick={handleUploadFolder}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-cream hover:bg-teal/10 transition-colors"
              >
                <FolderUp width={16} height={16} className="text-steel" /> Mappa hozzáadása
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Breadcrumbs + controls */}
      <div className="flex items-center gap-3">
        {/* Back button */}
        {currentPath && (
          <button
            onClick={() => {
              const parent = currentPath.substring(0, currentPath.lastIndexOf('/'));
              navigateTo(parent);
            }}
            className="p-2 rounded-lg text-steel hover:text-cream hover:bg-teal/10 transition-colors"
          >
            <ArrowLeft width={16} height={16} />
          </button>
        )}

        {/* Breadcrumbs */}
        <div className="flex items-center gap-1 text-sm flex-1 min-w-0 overflow-x-auto">
          <button
            onClick={() => navigateTo('')}
            className={`shrink-0 px-2 py-1 rounded transition-colors ${
              !currentPath ? 'text-cream font-medium' : 'text-steel hover:text-cream hover:bg-teal/10'
            }`}
          >
            Files
          </button>
          {breadcrumbs.map((bc, i) => (
            <div key={bc.path} className="flex items-center gap-1 shrink-0">
              <ChevronRight width={14} height={14} className="text-steel/40" />
              <button
                onClick={() => navigateTo(bc.path)}
                className={`px-2 py-1 rounded transition-colors truncate max-w-[180px] ${
                  i === breadcrumbs.length - 1 ? 'text-cream font-medium' : 'text-steel hover:text-cream hover:bg-teal/10'
                }`}
              >
                {bc.label}
              </button>
            </div>
          ))}
        </div>

        {/* Search + View toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <Search width={14} height={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-steel" />
            <input
              type="text"
              placeholder="Keresés..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 bg-surface-800/50 border border-teal/10 rounded-lg text-sm text-cream placeholder:text-steel/50 focus:outline-none focus:ring-2 focus:ring-teal/30 w-48"
            />
          </div>
          <div className="flex bg-surface-800/50 border border-teal/10 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewModeAndSave('grid')}
              className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-teal/20 text-cream' : 'text-steel hover:text-cream'}`}
            >
              <LayoutGrid width={16} height={16} />
            </button>
            <button
              onClick={() => setViewModeAndSave('list')}
              className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-teal/20 text-cream' : 'text-steel hover:text-cream'}`}
            >
              <List width={16} height={16} />
            </button>
          </div>
        </div>
      </div>

      {/* New folder inline form */}
      {showNewFolder && (
        <div className="flex items-center gap-2 bg-surface-800/50 border border-teal/15 rounded-lg p-3">
          <Folder width={18} height={18} className="text-teal shrink-0" />
          <input
            ref={newFolderInputRef}
            type="text"
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleNewFolder();
              if (e.key === 'Escape') setShowNewFolder(false);
            }}
            placeholder="Mappa neve..."
            className="flex-1 bg-transparent border-none text-sm text-cream placeholder:text-steel/50 focus:outline-none"
          />
          <button onClick={handleNewFolder} className="px-3 py-1 bg-teal text-cream rounded text-xs hover:bg-teal/80">Létrehozás</button>
          <button onClick={() => setShowNewFolder(false)} className="p-1 text-steel hover:text-cream">
            <X width={14} height={14} />
          </button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-steel"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div
          ref={contentRef}
          className="min-h-[40vh] select-none"
          onContextMenu={handleBgContextMenu}
          onMouseDown={handleRubberBandStart}
        >
          <div className="text-center py-16">
            <FolderOpen width={40} height={40} className="mx-auto text-steel/30 mb-3" />
            <p className="text-steel/60 text-sm">
              {search ? 'Nincs találat' : 'Ez a mappa üres'}
            </p>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div
          ref={contentRef}
          className="relative select-none min-h-[40vh]"
          onMouseDown={handleRubberBandStart}
          onContextMenu={handleBgContextMenu}
        >
          {/* Rubber band rectangle */}
          {rubberBand && rubberBandDragged.current && (
            <div
              className="fixed border border-teal/50 bg-teal/10 z-30 pointer-events-none"
              style={{
                left: Math.min(rubberBand.startX, rubberBand.curX),
                top: Math.min(rubberBand.startY, rubberBand.curY),
                width: Math.abs(rubberBand.curX - rubberBand.startX),
                height: Math.abs(rubberBand.curY - rubberBand.startY),
              }}
            />
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 pb-16">
          {filtered.map(entry => {
            const Icon = getFileIcon(entry.name, entry.isDirectory);
            const isRenaming = renameTarget?.path === entry.path;
            const isSelected = selected.has(entry.path);
            return (
              <div
                key={entry.path}
                data-file-entry={entry.path}
                onClick={(e) => !isRenaming && handleEntryClick(entry, e)}
                onDoubleClick={() => !isRenaming && handleEntryDoubleClick(entry)}
                onContextMenu={e => handleContextMenu(e, entry)}
                className={`group relative bg-surface-800/50 rounded-lg border p-4 cursor-pointer transition-colors flex flex-col items-center text-center gap-2 ${
                  isSelected ? 'border-teal/50 bg-teal/10' : 'border-teal/10 hover:border-teal/25'
                }`}
              >
                {/* Checkbox */}
                <div
                  data-checkbox
                  onClick={(e) => toggleSelection(entry.path, e)}
                  className={`absolute top-2 left-2 w-5 h-5 rounded border flex items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-teal border-teal text-ink'
                      : 'border-steel/30 opacity-0 group-hover:opacity-100 hover:border-steel/60'
                  }`}
                >
                  {isSelected && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  )}
                </div>
                <Icon
                  width={36}
                  height={36}
                  className={entry.isDirectory ? 'text-teal' : 'text-steel'}
                />
                {isRenaming ? (
                  <input
                    ref={renameInputRef}
                    type="text"
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleRename();
                      if (e.key === 'Escape') { setRenameTarget(null); setRenameValue(''); }
                    }}
                    onBlur={handleRename}
                    onClick={e => e.stopPropagation()}
                    className="w-full bg-surface-900 border border-teal/20 rounded px-2 py-1 text-xs text-cream text-center focus:outline-none focus:ring-1 focus:ring-teal/40"
                  />
                ) : (
                  <p className="text-xs text-cream truncate w-full" title={entry.name}>{entry.name}</p>
                )}
              </div>
            );
          })}
          </div>
        </div>
      ) : (
        /* List View */
        <div
          ref={contentRef}
          className="relative select-none min-h-[40vh]"
          onMouseDown={handleRubberBandStart}
          onContextMenu={handleBgContextMenu}
        >
          {/* Rubber band rectangle */}
          {rubberBand && rubberBandDragged.current && (
            <div
              className="fixed border border-teal/50 bg-teal/10 z-30 pointer-events-none"
              style={{
                left: Math.min(rubberBand.startX, rubberBand.curX),
                top: Math.min(rubberBand.startY, rubberBand.curY),
                width: Math.abs(rubberBand.curX - rubberBand.startX),
                height: Math.abs(rubberBand.curY - rubberBand.startY),
              }}
            />
          )}
          <div className="bg-surface-800/50 rounded-lg border border-teal/10 divide-y divide-teal/5">
          {filtered.map(entry => {
            const Icon = getFileIcon(entry.name, entry.isDirectory);
            const isRenaming = renameTarget?.path === entry.path;
            const isSelected = selected.has(entry.path);
            return (
              <div
                key={entry.path}
                data-file-entry={entry.path}
                onClick={(e) => !isRenaming && handleEntryClick(entry, e)}
                onDoubleClick={() => !isRenaming && handleEntryDoubleClick(entry)}
                onContextMenu={e => handleContextMenu(e, entry)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors group ${
                  isSelected ? 'bg-teal/10' : 'hover:bg-teal/5'
                }`}
              >
                {/* Checkbox */}
                <div
                  data-checkbox
                  onClick={(e) => toggleSelection(entry.path, e)}
                  className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-all ${
                    isSelected
                      ? 'bg-teal border-teal text-ink'
                      : 'border-steel/30 opacity-0 group-hover:opacity-100 hover:border-steel/60'
                  }`}
                >
                  {isSelected && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  )}
                </div>
                <Icon
                  width={20}
                  height={20}
                  className={entry.isDirectory ? 'text-teal shrink-0' : 'text-steel shrink-0'}
                />
                {isRenaming ? (
                  <input
                    ref={renameInputRef}
                    type="text"
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleRename();
                      if (e.key === 'Escape') { setRenameTarget(null); setRenameValue(''); }
                    }}
                    onBlur={handleRename}
                    onClick={e => e.stopPropagation()}
                    className="flex-1 bg-surface-900 border border-teal/20 rounded px-2 py-1 text-sm text-cream focus:outline-none focus:ring-1 focus:ring-teal/40"
                  />
                ) : (
                  <span className="flex-1 text-sm text-cream truncate">{entry.name}</span>
                )}
                <span className="text-xs text-steel shrink-0 w-20 text-right">
                  {entry.isDirectory ? '' : formatSize(entry.size)}
                </span>
                <span className="text-xs text-steel shrink-0 w-32 text-right">
                  {format(parseISO(entry.modifiedAt), 'yyyy. MM. dd. HH:mm')}
                </span>
              </div>
            );
          })}
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-surface-800 border border-teal/15 rounded-lg shadow-2xl py-1 min-w-[180px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={e => e.stopPropagation()}
        >
          {!contextMenu.entry.isDirectory && (
            <button
              onClick={() => {
                window.electronAPI.filesOpenFile(contextMenu.entry.path);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-cream hover:bg-teal/10 transition-colors"
            >
              <ExternalLink width={14} height={14} className="text-steel" /> Megnyitás
            </button>
          )}
          <button
            onClick={() => {
              setRenameTarget(contextMenu.entry);
              setRenameValue(contextMenu.entry.name);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-cream hover:bg-teal/10 transition-colors"
          >
            <Pencil width={14} height={14} className="text-steel" /> Átnevezés
          </button>
          <button
            onClick={() => {
              window.electronAPI.filesOpenInExplorer(contextMenu.entry.path);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-cream hover:bg-teal/10 transition-colors"
          >
            <FolderOpen width={14} height={14} className="text-steel" /> Megnyitás Explorerben
          </button>
          <div className="border-t border-teal/10 my-1" />
          <button
            onClick={() => {
              setDeleteTarget(contextMenu.entry);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-400/10 transition-colors"
          >
            <Trash2 width={14} height={14} /> Törlés
          </button>
        </div>
      )}

      {/* Background Context Menu (right-click on empty area) */}
      {bgContextMenu && (
        <div
          className="fixed z-50 bg-surface-800 border border-teal/15 rounded-lg shadow-2xl py-1 min-w-[220px]"
          style={{ left: bgContextMenu.x, top: bgContextMenu.y }}
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => { setBgContextMenu(null); setShowNewFolder(true); setNewFolderName(''); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-cream hover:bg-teal/10 transition-colors"
          >
            <FolderPlus width={14} height={14} className="text-steel" /> Új mappa
          </button>
          <div className="border-t border-teal/10 my-1" />
          <button
            onClick={() => { setBgContextMenu(null); handleUploadFiles(); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-cream hover:bg-teal/10 transition-colors"
          >
            <Upload width={14} height={14} className="text-steel" /> Fájl hozzáadása
          </button>
          <button
            onClick={() => { setBgContextMenu(null); handleUploadFolder(); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-cream hover:bg-teal/10 transition-colors"
          >
            <FolderUp width={14} height={14} className="text-steel" /> Mappa hozzáadása
          </button>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <ConfirmDialog
          title={`${deleteTarget.isDirectory ? 'Mappa' : 'Fájl'} törlése`}
          message={`Biztosan törölni szeretnéd: "${deleteTarget.name}"? Ez a művelet nem vonható vissza.`}
          confirmLabel="Törlés"
          cancelLabel="Mégse"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Preview Modal */}
      {previewFile && previewData && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => { setPreviewFile(null); setPreviewData(null); }}>
          <div className="relative max-w-4xl max-h-[90vh] w-full mx-4" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => { setPreviewFile(null); setPreviewData(null); }}
              className="absolute -top-10 right-0 p-1 text-steel hover:text-cream"
            >
              <X width={20} height={20} />
            </button>
            <p className="text-cream text-sm mb-2 truncate">{previewFile.name}</p>
            {previewFile.name.toLowerCase().endsWith('.pdf') ? (
              <iframe
                src={`data:application/pdf;base64,${previewData}`}
                className="w-full h-[80vh] rounded-lg border border-teal/15"
              />
            ) : (
              <img
                src={`data:image/${previewFile.name.split('.').pop()};base64,${previewData}`}
                alt={previewFile.name}
                className="max-w-full max-h-[80vh] rounded-lg border border-teal/15 mx-auto object-contain"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
