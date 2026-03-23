import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { ResizableImageExtension } from './ResizableImageExtension';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import {
  X, Plus, Trash2, Pin, PinOff, Bell, BellOff,
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, List, ListOrdered, Highlighter,
  Mic, MicOff, Search, StickyNote, ChevronLeft,
  GripHorizontal, CheckSquare, Save, ImagePlus, Link2,
  AlignLeft, AlignCenter, AlignRight, MoreHorizontal,
} from 'lucide-react';

const NOTE_COLORS: Record<string, { bg: string; border: string; label: string }> = {
  default: { bg: 'bg-surface-800/60', border: 'border-teal/10', label: 'Alap' },
  teal: { bg: 'bg-teal/10', border: 'border-teal/25', label: 'Teal' },
  amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/25', label: 'Sárga' },
  rose: { bg: 'bg-rose-500/10', border: 'border-rose-500/25', label: 'Piros' },
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', label: 'Zöld' },
  violet: { bg: 'bg-violet-500/10', border: 'border-violet-500/25', label: 'Lila' },
};

const COLOR_DOTS: Record<string, string> = {
  default: 'bg-steel/50',
  teal: 'bg-teal',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  emerald: 'bg-emerald-500',
  violet: 'bg-violet-500',
};

interface NotesPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function NotesPanel({ open, onClose }: NotesPanelProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [search, setSearch] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [toolbarExpanded, setToolbarExpanded] = useState(false);
  const [linkInput, setLinkInput] = useState<{ show: boolean; url: string; rect: { top: number; left: number; width: number } | null }>({ show: false, url: '', rect: null });
  const linkInputRef = useRef<HTMLInputElement>(null);

  // Refs to avoid stale closures in editor onUpdate
  const activeNoteRef = useRef<Note | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRecordingRef = useRef(false);

  // Drag state
  const [pos, setPos] = useState({ x: -9999, y: -9999 });
  const [initialized, setInitialized] = useState(false);
  const [size, setSize] = useState({ w: 420, h: 560 });
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Center the floating window on first open
  useEffect(() => {
    if (open && !initialized) {
      const x = Math.round((window.innerWidth - size.w) / 2);
      const y = Math.round((window.innerHeight - size.h) / 2);
      setPos({ x, y });
      setInitialized(true);
    }
  }, [open, initialized, size.w, size.h]);

  // Re-clamp position when window resizes (fullscreen → restore, monitor switch)
  useEffect(() => {
    if (!open) return;
    const handleResize = () => {
      setPos(prev => {
        const maxX = window.innerWidth - 60;
        const maxY = window.innerHeight - 60;
        const clampedX = Math.max(0, Math.min(prev.x, maxX - 60));
        const clampedY = Math.max(0, Math.min(prev.y, maxY - 60));
        if (clampedX !== prev.x || clampedY !== prev.y) {
          return { x: clampedX, y: clampedY };
        }
        return prev;
      });
    };
    window.addEventListener('resize', handleResize);
    // Also clamp immediately on open in case window shrank while panel was closed
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [open]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2] },
      }),
      Highlight.configure({ multicolor: false }),
      Placeholder.configure({ placeholder: 'Kezdj el írni...' }),
      TaskList,
      TaskItem.configure({ nested: true }),
      ResizableImageExtension.configure({ allowBase64: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'note-link' } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-sm prose-invert max-w-none focus:outline-none min-h-[120px] px-1 py-2 text-cream/90',
      },
      handleClick: (view, _pos, event) => {
        const target = event.target as HTMLElement;
        const link = target.closest('a');
        if (link?.href) {
          event.preventDefault();
          window.electronAPI.openExternal(link.href);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const note = activeNoteRef.current;
      if (note) {
        setIsDirty(true);
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          handleAutoSave(note.id, editor.getHTML());
        }, 800);
      }
    },
  });

  // Keep ref in sync with state
  useEffect(() => {
    activeNoteRef.current = activeNote;
  }, [activeNote]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    if (open) loadNotes();
  }, [open]);

  // Flush pending auto-save when panel closes
  useEffect(() => {
    if (!open && activeNoteRef.current && editor && isDirty) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      const content = editor.getHTML();
      window.electronAPI.updateNote(activeNoteRef.current.id, { content }).catch(console.error);
      setIsDirty(false);
    }
  }, [open]);

  useEffect(() => {
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, []);

  // Drag handlers
  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const panel = panelRef.current;
    if (!panel) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPosX: pos.x, startPosY: pos.y };
    panel.style.willChange = 'transform';
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      let newX = dragRef.current.startPosX + dx;
      let newY = dragRef.current.startPosY + dy;
      const minVisible = 60;
      newX = Math.max(-size.w + minVisible, Math.min(window.innerWidth - minVisible, newX));
      newY = Math.max(0, Math.min(window.innerHeight - minVisible, newY));
      panel.style.transform = `translate(${newX}px, ${newY}px)`;
      (panel as any).__dragPos = { x: newX, y: newY };
    };
    const onUp = () => {
      dragRef.current = null;
      panel.style.willChange = '';
      const final = (panel as any).__dragPos;
      if (final) {
        setPos(final);
        delete (panel as any).__dragPos;
      }
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [pos, size.w]);

  // Resize handler
  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { startX: e.clientX, startY: e.clientY, startW: size.w, startH: size.h };
    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const dw = ev.clientX - resizeRef.current.startX;
      const dh = ev.clientY - resizeRef.current.startY;
      setSize({
        w: Math.max(340, resizeRef.current.startW + dw),
        h: Math.max(400, resizeRef.current.startH + dh),
      });
    };
    const onUp = () => {
      resizeRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [size]);

  async function loadNotes() {
    try {
      const data = await window.electronAPI.getNotes();
      setNotes(data);
    } catch (err) {
      console.error('Failed to load notes:', err);
    }
  }

  async function handleAutoSave(id: string, content: string) {
    try {
      await window.electronAPI.updateNote(id, { content });
      setNotes(prev => prev.map(n => n.id === id ? { ...n, content } : n));
      setIsDirty(false);
    } catch (err) {
      console.error('Failed to auto-save:', err);
    }
  }

  async function handleManualSave() {
    if (!activeNote || !editor) return;
    try {
      const content = editor.getHTML();
      await window.electronAPI.updateNote(activeNote.id, { content, title: activeNote.title });
      setNotes(prev => prev.map(n => n.id === activeNote.id ? { ...n, content, title: activeNote.title } : n));
      setIsDirty(false);
    } catch (err) {
      console.error('Failed to save:', err);
    }
  }

  async function handleCreate() {
    try {
      const note = await window.electronAPI.createNote({
        title: 'Új jegyzet',
        content: '',
        color: 'default',
      });
      await loadNotes();
      openNote(note);
    } catch (err) {
      console.error('Failed to create note:', err);
    }
  }

  async function handleDelete(id: string) {
    try {
      await window.electronAPI.deleteNote(id);
      if (activeNote?.id === id) {
        setActiveNote(null);
        editor?.commands.clearContent(false);
        setIsDirty(false);
      }
      loadNotes();
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  }

  async function handleTogglePin(note: Note) {
    try {
      const updated = await window.electronAPI.updateNote(note.id, { pinned: note.pinned ? 0 : 1 });
      setNotes(prev => prev.map(n => n.id === note.id ? updated : n));
      if (activeNote?.id === note.id) setActiveNote(updated);
    } catch (err) {
      console.error('Failed to toggle pin:', err);
    }
  }

  async function handleColorChange(note: Note, color: string) {
    try {
      const updated = await window.electronAPI.updateNote(note.id, { color });
      setNotes(prev => prev.map(n => n.id === note.id ? updated : n));
      if (activeNote?.id === note.id) setActiveNote(updated);
    } catch (err) {
      console.error('Failed to change color:', err);
    }
  }

  async function handleTitleChange(title: string) {
    if (!activeNote) return;
    setIsDirty(true);
    setActiveNote(prev => prev ? { ...prev, title } : null);
    try {
      await window.electronAPI.updateNote(activeNote.id, { title });
      setNotes(prev => prev.map(n => n.id === activeNote.id ? { ...n, title } : n));
    } catch (err) {
      console.error('Failed to update title:', err);
    }
  }

  async function handleReminderToggle(note: Note) {
    try {
      const hasReminder = !!note.reminder_date;
      const updates: Partial<Note> = hasReminder
        ? { reminder_date: null, reminder_time: null }
        : { reminder_date: new Date().toISOString().split('T')[0], reminder_time: '09:00' };

      const updated = await window.electronAPI.updateNote(note.id, updates);
      setNotes(prev => prev.map(n => n.id === note.id ? updated : n));
      if (activeNote?.id === note.id) setActiveNote(updated);
    } catch (err) {
      console.error('Failed to toggle reminder:', err);
    }
  }

  async function handleReminderDateChange(date: string) {
    if (!activeNote) return;
    try {
      const updated = await window.electronAPI.updateNote(activeNote.id, { reminder_date: date });
      setNotes(prev => prev.map(n => n.id === activeNote.id ? updated : n));
      setActiveNote(updated);
    } catch (err) {
      console.error('Failed to update reminder:', err);
    }
  }

  function openNote(note: Note) {
    // Cancel any pending debounced save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    // Save current note before switching
    if (activeNote && editor && isDirty) {
      const content = editor.getHTML();
      window.electronAPI.updateNote(activeNote.id, { content, title: activeNote.title }).catch(console.error);
    }
    setActiveNote(note);
    setIsDirty(false);
    editor?.commands.setContent(note.content || '', { emitUpdate: false });
  }

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const transcriptCleanupRef = useRef<(() => void) | null>(null);
  const [dictationError, setDictationError] = useState('');

  const toggleSpeechRecognition = useCallback(async () => {
    setDictationError('');

    if (isRecording) {
      // Stop streaming
      processorRef.current?.disconnect();
      processorRef.current = null;
      audioContextRef.current?.close();
      audioContextRef.current = null;
      mediaStreamRef.current?.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
      transcriptCleanupRef.current?.();
      transcriptCleanupRef.current = null;
      await window.electronAPI.stopDeepgramStream();
      isRecordingRef.current = false;
      setIsRecording(false);
      return;
    }

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      mediaStreamRef.current = stream;

      // Start Deepgram WebSocket
      const { ok, error } = await window.electronAPI.startDeepgramStream();
      if (!ok) {
        console.error('[Speech] Could not start Deepgram stream:', error);
        setDictationError('Deepgram kapcsolódási hiba');
        stream.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
        return;
      }

      // Listen for transcript events
      const cleanup = window.electronAPI.onTranscript(({ text, isFinal }) => {
        if (!editor || !text) return;
        if (isFinal) {
          editor.commands.insertContent(text + ' ');
        }
      });
      transcriptCleanupRef.current = cleanup;

      // Capture PCM audio at 16kHz and stream to main process
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      if (audioCtx.state === 'suspended') await audioCtx.resume();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const float32 = e.inputBuffer.getChannelData(0);
        // Convert float32 [-1,1] to int16
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          const s = Math.max(-1, Math.min(1, float32[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        const bytes = new Uint8Array(int16.buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        window.electronAPI.sendAudioChunk(btoa(binary));
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);

      isRecordingRef.current = true;
      setIsRecording(true);
    } catch (err: any) {
      console.error('[Speech] Dictation error:', err);
      setDictationError(err?.message || 'Hiba a diktálás indításakor');
      stream?.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
  }, [isRecording, editor]);

  const filtered = notes.filter(n =>
    (n.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (n.content || '').toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0;
  });

  function stripHtml(html: string): string {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="fixed z-50 flex flex-col bg-surface-900 border border-teal/15 rounded-xl shadow-2xl shadow-black/40 overflow-hidden select-none"
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, width: size.w, height: size.h, left: 0, top: 0 }}
    >
      {/* Draggable header */}
      <div
        onMouseDown={onDragStart}
        className="flex items-center justify-between px-4 py-2.5 border-b border-teal/10 shrink-0 cursor-grab active:cursor-grabbing bg-surface-900/80"
      >
        {activeNote ? (
          <button
            onClick={() => {
              // Cancel any pending debounced save
              if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
                saveTimeoutRef.current = null;
              }
              // Save before going back
              if (editor && isDirty && activeNote) {
                const content = editor.getHTML();
                window.electronAPI.updateNote(activeNote.id, { content, title: activeNote.title }).then(() => loadNotes()).catch(console.error);
              } else {
                loadNotes();
              }
              setActiveNote(null);
              editor?.commands.clearContent(false);
              setIsDirty(false);
            }}
            className="flex items-center gap-1.5 text-sm text-steel hover:text-cream transition-colors"
            onMouseDown={e => e.stopPropagation()}
          >
            <ChevronLeft size={16} />
            Vissza
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <GripHorizontal size={14} className="text-steel/30" />
            <StickyNote size={16} className="text-steel" />
            <h2 className="font-pixel text-base text-cream">Jegyzetek</h2>
          </div>
        )}
        <button
          onClick={onClose}
          onMouseDown={e => e.stopPropagation()}
          className="p-1.5 rounded-lg hover:bg-teal/10 text-steel hover:text-cream transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      {activeNote ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Title */}
          <div className="px-4 pt-3 pb-1">
            <input
              type="text"
              value={activeNote.title || ''}
              onChange={e => handleTitleChange(e.target.value)}
              className="w-full text-base font-semibold text-cream bg-transparent border-none outline-none placeholder:text-steel/40"
              placeholder="Cím nélkül"
            />
          </div>

          {/* Actions bar */}
          <div className="flex items-center gap-1 px-4 pb-2 border-b border-teal/10">
            <button
              onClick={() => handleTogglePin(activeNote)}
              className={`p-1.5 rounded transition-colors ${activeNote.pinned ? 'text-amber-400 bg-amber-500/10' : 'text-steel hover:text-cream hover:bg-teal/10'}`}
              title={activeNote.pinned ? 'Kitűzés eltávolítása' : 'Kitűzés'}
            >
              {activeNote.pinned ? <PinOff size={13} /> : <Pin size={13} />}
            </button>
            <button
              onClick={() => handleReminderToggle(activeNote)}
              className={`p-1.5 rounded transition-colors ${activeNote.reminder_date ? 'text-teal bg-teal/10' : 'text-steel hover:text-cream hover:bg-teal/10'}`}
              title={activeNote.reminder_date ? 'Emlékeztető törlése' : 'Emlékeztető'}
            >
              {activeNote.reminder_date ? <BellOff size={13} /> : <Bell size={13} />}
            </button>

            {activeNote.reminder_date && (
              <input
                type="date"
                value={activeNote.reminder_date}
                onChange={e => handleReminderDateChange(e.target.value)}
                className="notes-date-input text-xs text-steel bg-surface-800 border border-teal/10 rounded px-2 py-1 ml-1"
              />
            )}

            <div className="flex-1" />

            {/* Color dots */}
            <div className="flex items-center gap-1">
              {Object.keys(NOTE_COLORS).map(c => (
                <button
                  key={c}
                  onClick={() => handleColorChange(activeNote, c)}
                  className={`w-3.5 h-3.5 rounded-full ${COLOR_DOTS[c]} transition-all ${
                    activeNote.color === c ? 'ring-2 ring-cream ring-offset-1 ring-offset-surface-900 scale-110' : 'opacity-50 hover:opacity-100'
                  }`}
                  title={NOTE_COLORS[c].label}
                />
              ))}
            </div>
          </div>

          {/* Toolbar */}
          {editor && (() => {
            const isCompact = size.w < 520;
            const linkBtn = (
              <>
                <ToolbarBtn active={editor.isActive('link')} onClick={() => {
                  if (editor.isActive('link')) { editor.chain().focus().unsetLink().run(); return; }
                  const { from, to } = editor.state.selection;
                  if (from === to) return;
                  const coords = editor.view.coordsAtPos(from);
                  const endCoords = editor.view.coordsAtPos(to);
                  const rect = {
                    top: coords.top,
                    left: coords.left + (endCoords.left - coords.left) / 2,
                    width: endCoords.left - coords.left,
                  };
                  setLinkInput({ show: true, url: '', rect });
                  setTimeout(() => linkInputRef.current?.focus(), 0);
                }} icon={<Link2 size={13} />} />
              </>
            );
            const imageBtn = (
              <ToolbarBtn active={false} onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = () => {
                  const file = input.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    if (typeof reader.result === 'string') {
                      editor.chain().focus().setImage({ src: reader.result }).run();
                    }
                  };
                  reader.readAsDataURL(file);
                };
                input.click();
              }} icon={<ImagePlus size={13} />} />
            );
            const sep = <div className="w-px h-4 bg-teal/15 mx-0.5" />;
            const secondaryBtns = (
              <>
                <ToolbarBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} icon={<List size={13} />} />
                <ToolbarBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} icon={<ListOrdered size={13} />} />
                <ToolbarBtn active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()} icon={<CheckSquare size={13} />} />
                {sep}
                <ToolbarBtn active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight().run()} icon={<Highlighter size={13} />} />
                {sep}
                <ToolbarBtn active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} icon={<AlignLeft size={13} />} />
                <ToolbarBtn active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} icon={<AlignCenter size={13} />} />
                <ToolbarBtn active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} icon={<AlignRight size={13} />} />
              </>
            );

            return (
              <div className="mx-4 mt-2 bg-surface-800 border border-teal/15 rounded-lg overflow-hidden">
                {/* Row 1 */}
                <div className="flex items-center gap-0.5 p-1">
                  <ToolbarBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} icon={<Bold size={13} />} />
                  <ToolbarBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} icon={<Italic size={13} />} />
                  <ToolbarBtn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} icon={<UnderlineIcon size={13} />} />
                  <ToolbarBtn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} icon={<Strikethrough size={13} />} />
                  {sep}
                  <ToolbarBtn active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} icon={<Heading1 size={13} />} />
                  <ToolbarBtn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} icon={<Heading2 size={13} />} />
                  {!isCompact && (
                    <>
                      {sep}
                      {secondaryBtns}
                    </>
                  )}
                  {sep}
                  {linkBtn}
                  {imageBtn}
                  {isCompact && (
                    <>
                      {sep}
                      <ToolbarBtn
                        active={toolbarExpanded}
                        onClick={() => setToolbarExpanded(v => !v)}
                        icon={<MoreHorizontal size={13} />}
                      />
                    </>
                  )}
                </div>
                {/* Row 2 – expanded overflow */}
                {isCompact && toolbarExpanded && (
                  <div className="flex items-center gap-0.5 p-1 border-t border-teal/15">
                    {secondaryBtns}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Editor */}
          <div className="flex-1 overflow-auto px-4 py-2">
            <div className="notes-editor-area min-h-full rounded-xl">
              <EditorContent editor={editor} />
            </div>

            {/* Link URL input popup — positioned above selected text */}
            {linkInput.show && linkInput.rect && createPortal(
              <>
                <div className="fixed inset-0 z-[9998]" onClick={() => { setLinkInput({ show: false, url: '', rect: null }); editor!.commands.focus(); }} />
                <div
                  className="fixed z-[9999] bg-surface-900 border border-teal/15 rounded-lg shadow-2xl p-2 flex items-center gap-1.5 w-56"
                  style={{ top: linkInput.rect.top - 42, left: linkInput.rect.left - 112 }}
                >
                <input
                  ref={linkInputRef}
                  type="url"
                  value={linkInput.url}
                  onChange={e => setLinkInput(prev => ({ ...prev, url: e.target.value }))}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && linkInput.url.trim()) {
                      const url = linkInput.url.trim().startsWith('http') ? linkInput.url.trim() : `https://${linkInput.url.trim()}`;
                      editor!.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
                      setLinkInput({ show: false, url: '', rect: null });
                    }
                    if (e.key === 'Escape') { setLinkInput({ show: false, url: '', rect: null }); editor!.commands.focus(); }
                  }}
                  placeholder="https://..."
                  className="flex-1 text-xs px-2 py-1 bg-surface-800 border border-teal/10 rounded text-cream focus:outline-none focus:ring-1 focus:ring-teal/30"
                />
                <button
                  onClick={() => {
                    if (!linkInput.url.trim()) return;
                    const url = linkInput.url.trim().startsWith('http') ? linkInput.url.trim() : `https://${linkInput.url.trim()}`;
                    editor!.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
                    setLinkInput({ show: false, url: '', rect: null });
                  }}
                  className="px-2 py-1 text-xs bg-teal text-cream rounded hover:bg-teal/80 cursor-pointer transition-colors duration-150 ease-out shrink-0"
                >
                  OK
                </button>
                </div>
              </>,
              document.body
            )}
          </div>

          {/* Bottom bar */}
          <div className="px-3 py-2 border-t border-teal/10 flex items-center gap-2 shrink-0">
            <button
              onClick={toggleSpeechRecognition}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isRecording
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-surface-800 text-steel hover:text-cream border border-teal/10 hover:border-teal/20'
              }`}
            >
              {isRecording ? <><MicOff size={12} /><span className="animate-pulse">Diktálás...</span></> : <><Mic size={12} />Diktálás</>}
            </button>

            {dictationError && (
              <span className="text-xs text-red-400">{dictationError}</span>
            )}

            <button
              onClick={handleManualSave}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isDirty
                  ? 'bg-teal/20 text-cream border border-teal/30 hover:bg-teal/30'
                  : 'bg-surface-800 text-steel/50 border border-teal/10 cursor-default'
              }`}
              disabled={!isDirty}
            >
              <Save size={12} />
              Mentés
            </button>

            <div className="flex-1" />
            <button
              onClick={() => handleDelete(activeNote.id)}
              className="p-1.5 rounded-lg text-steel/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Jegyzet törlése"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ) : (
        /* Notes list view */
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Search */}
          <div className="px-4 py-3">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-steel/50" />
              <input
                type="text"
                placeholder="Keresés..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-surface-800/50 border border-teal/10 rounded-lg text-sm text-cream placeholder:text-steel/40 focus:outline-none focus:ring-1 focus:ring-teal/30"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-auto px-4 pb-16 space-y-2">
            {sorted.length === 0 ? (
              <div className="text-center py-12">
                <StickyNote size={28} className="mx-auto text-steel/20 mb-3" />
                <p className="text-sm text-steel/50 italic">Nincsenek jegyzetek</p>
                <button onClick={handleCreate} className="mt-3 text-xs text-teal hover:text-cream transition-colors">
                  + Hozz létre egyet
                </button>
              </div>
            ) : (
              sorted.map(note => {
                const colorConfig = NOTE_COLORS[note.color] || NOTE_COLORS.default;
                return (
                  <div
                    key={note.id}
                    onClick={() => openNote(note)}
                    className={`${colorConfig.bg} border ${colorConfig.border} rounded-lg p-3 cursor-pointer group hover:border-steel/30 transition-all`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {note.pinned ? <Pin size={10} className="text-amber-400 shrink-0" /> : null}
                          {note.reminder_date ? <Bell size={10} className="text-teal shrink-0" /> : null}
                          <span className="font-medium text-sm text-cream truncate">
                            {note.title || 'Cím nélkül'}
                          </span>
                        </div>
                        <p className="text-xs text-steel mt-1 line-clamp-2">
                          {stripHtml(note.content) || 'Üres jegyzet'}
                        </p>
                        <span className="text-[10px] text-steel/40 mt-1.5 block">
                          {new Date(note.updated_at || note.created_at).toLocaleDateString('hu-HU')}
                        </span>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(note.id); }}
                        className="p-1 rounded text-steel/30 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* FAB: new note */}
          <button
            onClick={handleCreate}
            className="absolute bottom-4 right-4 w-11 h-11 rounded-full bg-teal text-cream shadow-lg shadow-teal/25 hover:bg-teal/80 hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
            title="Új jegyzet"
          >
            <Plus size={20} />
          </button>
        </div>
      )}

      {/* Resize handle */}
      <div
        onMouseDown={onResizeStart}
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
        style={{ touchAction: 'none' }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" className="text-steel/20">
          <path d="M14 14L8 14L14 8Z" fill="currentColor" />
          <path d="M14 14L11 14L14 11Z" fill="currentColor" opacity="0.5" />
        </svg>
      </div>
    </div>
  );
}

function ToolbarBtn({ active, onClick, icon }: { active: boolean; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`p-1.5 rounded transition-colors ${
        active ? 'bg-teal/20 text-cream' : 'text-steel hover:text-cream hover:bg-teal/10'
      }`}
    >
      {icon}
    </button>
  );
}
