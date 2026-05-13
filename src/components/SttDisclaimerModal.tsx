import { useState } from 'react';
import { X, Mic } from 'lucide-react';

const STORAGE_KEY = 'stt_disclaimer_dismissed';

export function isSttDisclaimerDismissed(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

export default function SttDisclaimerModal({
  onConfirm,
  onClose,
}: {
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [dontShow, setDontShow] = useState(false);

  function handleConfirm() {
    if (dontShow) {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
    onConfirm();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-surface-800 rounded-2xl ring-1 ring-inset ring-teal/15 w-full max-w-sm shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header accent */}
        <div className="h-1 bg-teal" />

        <div className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-teal/10">
              <Mic width={18} height={18} className="text-teal" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-pixel text-[14px] text-cream">Magyar beszédfelismerés – fontos tudnivaló</h2>
              <p className="text-sm text-steel mt-2 leading-relaxed">
                A magyar nyelv agglutináló szerkezete és gazdag morfológiája miatt a gépi
                beszédfelismerés magyarul nehezebb feladat, mint a legtöbb európai nyelven.
                Az átiratok pontossága ezért elmaradhat az elvárttól — különösen szakmai
                szókincs, nevek és gyors beszéd esetén.
              </p>
              <p className="text-sm text-steel mt-2 leading-relaxed">
                A Klient folyamatosan a legújabb modellekkel dolgozik (jelenleg: ElevenLabs
                Scribe v2), és minden frissítéssel igyekszünk javítani a magyar felismerés
                minőségén.
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-teal/10 text-steel hover:text-cream cursor-pointer transition-colors duration-150 ease-out shrink-0"
            >
              <X width={14} height={14} />
            </button>
          </div>

          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={dontShow}
                onChange={e => setDontShow(e.target.checked)}
                className="accent-teal"
              />
              <span className="text-xs text-steel">Többé ne jelenjen meg ez az üzenet</span>
            </label>
            <button
              onClick={handleConfirm}
              className="px-5 py-2 text-xs rounded-lg font-medium bg-teal text-cream hover:bg-teal/80 transition-colors duration-150 ease-out cursor-pointer shrink-0"
            >
              Rendben
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
