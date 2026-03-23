import { Minus, Square } from 'lucide-react';

export default function TitleBar() {
  const handleMinimize = () => window.electronAPI?.minimizeWindow();
  const handleMaximize = () => window.electronAPI?.maximizeWindow();
  const handleClose = () => window.electronAPI?.closeWindow();

  return (
    <div
      className="flex items-center justify-between h-10 bg-ink border-b border-teal/20 text-cream select-none shrink-0"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex items-center gap-3 pl-4">
        <span className="font-pixel text-[14px] text-cream tracking-wider">KLIENT</span>
      </div>

      <div
        className="flex h-full"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={handleMinimize}
          className="h-full px-4 hover:bg-teal/20 transition-colors flex items-center"
        >
          <Minus width={12} height={12} className="text-steel" />
        </button>
        <button
          onClick={handleMaximize}
          className="h-full px-4 hover:bg-teal/20 transition-colors flex items-center"
        >
          <Square width={10} height={10} className="text-steel" />
        </button>
        <button
          onClick={handleClose}
          className="h-full px-4 hover:bg-red-500/80 transition-colors flex items-center group"
        >
          <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor" className="text-steel group-hover:text-white">
            <path d="M5 5h2v2H5V5zm4 4H7V7h2v2zm2 2H9V9h2v2zm2 0h-2v2H9v2H7v2H5v2h2v-2h2v-2h2v-2h2v2h2v2h2v2h2v-2h-2v-2h-2v-2h-2v-2zm2-2h-2v2h2V9zm2-2h-2v2h2V7zm0 0V5h2v2h-2z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
