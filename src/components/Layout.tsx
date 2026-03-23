import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TitleBar from './TitleBar';
import NotesPanel from './NotesPanel';
import PomodoroTimer from './PomodoroTimer';
import TrialBanner from './TrialBanner';
import { ArrowLeft, StickyNote } from 'lucide-react';

export default function Layout() {
  const [activeShortcutUrl, setActiveShortcutUrl] = useState<string | null>(null);
  const [notesPanelOpen, setNotesPanelOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen bg-ink text-cream">
      <TitleBar />
      <TrialBanner />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar onOpenShortcut={setActiveShortcutUrl} activeShortcutUrl={activeShortcutUrl} />
        <main className="flex-1 overflow-auto bg-surface-900 relative">
          {/* Normal page content — always rendered so state is preserved */}
          <div className={`p-8 h-full overflow-auto ${activeShortcutUrl ? 'hidden' : ''}`}>
            <Outlet context={{ openNotesPanel: () => setNotesPanelOpen(true) }} />
          </div>
          {/* Webview overlay */}
          {activeShortcutUrl && (
            <div className="absolute inset-0 flex flex-col z-10">
              <div className="flex items-center gap-2 px-4 py-2 bg-surface-900 border-b border-teal/10 shrink-0">
                <button
                  onClick={() => setActiveShortcutUrl(null)}
                  className="flex items-center gap-1.5 text-xs text-steel hover:text-cream px-2 py-1.5 rounded hover:bg-teal/10 transition-colors"
                >
                  <ArrowLeft width={14} height={14} />
                  Vissza
                </button>
                <div className="flex-1 text-xs text-steel/60 truncate px-2 py-1 bg-surface-800 rounded border border-teal/10">
                  {activeShortcutUrl}
                </div>
              </div>
              <webview
                src={activeShortcutUrl}
                partition="persist:shortcuts"
                className="flex-1"
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          )}
        </main>
      </div>
      <NotesPanel open={notesPanelOpen} onClose={() => setNotesPanelOpen(false)} />
      <PomodoroTimer />
      <button
        onClick={() => setNotesPanelOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-teal text-cream shadow-lg shadow-teal/25 hover:bg-teal/80 hover:scale-105 transition-all flex items-center justify-center z-30"
        title="Jegyzetek"
      >
        <StickyNote size={22} />
      </button>
    </div>
  );
}
