import { useState } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './Sidebar';
import TitleBar from './TitleBar';
import NotesPanel from './NotesPanel';
import PomodoroTimer from './PomodoroTimer';
import TrialBanner from './TrialBanner';
import UpdateBanner from './UpdateBanner';
import { ArrowLeft, ChevronLeft, StickyNote, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export default function Layout({ paywalled }: { paywalled?: boolean } = {}) {
  const [activeShortcutUrl, setActiveShortcutUrl] = useState<string | null>(null);
  const [notesPanelOpen, setNotesPanelOpen] = useState(false);
  const [quickBarOpen, setQuickBarOpen] = useState(true);
  const { theme } = useTheme();
  const isLight = theme === 'light' || theme === 'ash-soft';
  const location = useLocation();
  const outlet = useOutlet({ openNotesPanel: () => setNotesPanelOpen(true) });

  return (
    <div className="flex flex-col h-screen bg-ink text-cream">
      <TitleBar />
      {!paywalled && <UpdateBanner />}
      {!paywalled && <TrialBanner />}
      <div className="flex flex-1 overflow-hidden">
        {!paywalled && <Sidebar onOpenShortcut={setActiveShortcutUrl} activeShortcutUrl={activeShortcutUrl} />}
        <main className={`flex-1 bg-surface-900 relative ${paywalled ? 'overflow-hidden' : 'overflow-hidden'}`} style={{ scrollbarGutter: 'stable' }}>
          {/* Normal page content — crossfade two pages stacked absolutely.
              `mode="sync"` lets old and new co-exist during the transition, absolute
              positioning prevents any layout jump. */}
          <AnimatePresence mode="sync" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
              className={`absolute inset-0 ${paywalled ? '' : 'p-8 pb-24 overflow-auto'} ${activeShortcutUrl ? 'hidden' : ''}`}
              style={{ scrollbarGutter: 'stable' }}
            >
              {outlet}
            </motion.div>
          </AnimatePresence>
          {/* Webview overlay */}
          {!paywalled && activeShortcutUrl && (
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
      {!paywalled && (
        <>
          <NotesPanel open={notesPanelOpen} onClose={() => setNotesPanelOpen(false)} />

          {/* Quick-bar: morphing container — slides & morphs between full bar and half-circle handle */}
          <div className="fixed bottom-6 right-0 z-30 flex items-end justify-end">
            <motion.div
              initial={false}
              animate={{
                width: quickBarOpen ? 'auto' : 30,
                marginRight: quickBarOpen ? 24 : 0,
              }}
              transition={{
                duration: 0.32,
                ease: [0.34, 1.35, 0.64, 1],
              }}
              onClick={!quickBarOpen ? () => setQuickBarOpen(true) : undefined}
              className={`
                group relative flex items-center h-[60px]
                bg-surface-900/60 backdrop-blur-md
                border border-teal/10
                rounded-full
                shadow-lg shadow-black/20
                transition-[border-top-right-radius,border-bottom-right-radius] duration-300
                ${quickBarOpen
                  ? 'hover:rounded-tr-lg'
                  : 'cursor-pointer border-r-0 !rounded-r-none'}
              `}
            >
              {/* Open content — buttons in flex flow; determines natural width */}
              <motion.div
                animate={{ opacity: quickBarOpen ? 1 : 0 }}
                transition={{ duration: 0.15, ease: 'easeOut', delay: quickBarOpen ? 0.12 : 0 }}
                style={{ pointerEvents: quickBarOpen ? 'auto' : 'none' }}
                className="flex items-center gap-1.5 p-1.5 whitespace-nowrap"
              >
                {/* Close — top-right corner of the flattened hover corner */}
                <button
                  onClick={(e) => { e.stopPropagation(); setQuickBarOpen(false); }}
                  aria-label="Gyorsmenü bezárása"
                  className="absolute top-0 right-0 p-1 text-steel hover:text-cream opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-out z-10"
                >
                  <X size={10} />
                </button>

                <PomodoroTimer />
                <button
                  onClick={() => setNotesPanelOpen(true)}
                  className="w-12 h-12 rounded-full bg-teal text-cream hover:bg-teal/80 transition-colors flex items-center justify-center"
                  title="Jegyzetek"
                >
                  <StickyNote size={20} />
                </button>
              </motion.div>

              {/* Closed content — chevron overlay, centered in the half-circle handle */}
              <motion.div
                animate={{ opacity: quickBarOpen ? 0 : 1 }}
                transition={{ duration: 0.12, ease: 'easeOut', delay: quickBarOpen ? 0 : 0.16 }}
                style={{ pointerEvents: 'none' }}
                className="absolute inset-0 flex items-center justify-center text-steel group-hover:text-cream transition-colors"
              >
                <ChevronLeft size={16} />
              </motion.div>
            </motion.div>
          </div>
        </>
      )}
    </div>
  );
}
