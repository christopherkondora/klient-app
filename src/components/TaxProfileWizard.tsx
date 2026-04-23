import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronRight, ChevronLeft, Building2, User, Receipt, MapPin, Check, Settings } from 'lucide-react';

interface TaxProfileWizardProps {
  onClose: () => void;
  onSaved: () => void;
}

type Step = 1 | 2 | 3 | 4 | 5;

const stepLabels = ['Vállalkozás', 'Adózás', 'ÁFA', 'HIPA', 'Összegzés'];

interface HipaSearchResult {
  megye: string;
  telepules: string;
  kulcs: number;
}

export default function TaxProfileWizard({ onClose, onSaved }: TaxProfileWizardProps) {
  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Profile state
  const [vallalkozasTipus, setVallalkozasTipus] = useState<'EV' | 'Kft' | 'Bt' | 'Kkt'>('EV');
  const [adozasForma, setAdozasForma] = useState<'atalany' | 'vszja' | 'TAO' | 'KIVA'>('atalany');
  const [foglalkozas, setFoglalkozas] = useState<'fofoglalkozasu' | 'mellekfoglalkozasu'>('fofoglalkozasu');
  const [koltseghanyad, setKoltseghanyad] = useState(0.45);
  const [szakkepzettseg, setSzakkepzettseg] = useState(false);
  const [aamValasztott, setAamValasztott] = useState(false);
  const [afaBevallas, setAfaBevallas] = useState<'havi' | 'negyedeves' | 'eves'>('negyedeves');
  const [hipaKulcs, setHipaKulcs] = useState(0);
  const [hipaTelepules, setHipaTelepules] = useState('');
  const [hipaMegye, setHipaMegye] = useState('');
  const [hipaEgyszeru, setHipaEgyszeru] = useState(false);

  // HIPA search
  const [hipaQuery, setHipaQuery] = useState('');
  const [hipaResults, setHipaResults] = useState<HipaSearchResult[]>([]);
  const [hipaSearching, setHipaSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load existing profile
  useEffect(() => {
    (async () => {
      try {
        const profile = await window.electronAPI.getTaxProfile();
        if (profile && profile.beallitva) {
          setVallalkozasTipus(profile.vallalkozasTipus);
          setAdozasForma(profile.adozasForma);
          setFoglalkozas(profile.foglalkozas);
          setKoltseghanyad(profile.koltseghanyad);
          setSzakkepzettseg(profile.szakkepzettseg);
          setAamValasztott(profile.aamValasztott);
          setAfaBevallas(profile.afaBevallas);
          setHipaKulcs(profile.hipaKulcs);
          setHipaTelepules(profile.hipaTelepules);
          setHipaEgyszeru(profile.hipaEgyszeru);
          if (profile.hipaTelepules) {
            setHipaQuery(profile.hipaTelepules);
          }
        }
      } catch { /* first time, no profile */ }
    })();
  }, []);

  // HIPA search with debounce
  const handleHipaSearch = useCallback((query: string) => {
    setHipaQuery(query);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setHipaResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setHipaSearching(true);
      try {
        const results = await window.electronAPI.searchHipaRates(query);
        setHipaResults(results);
      } catch { setHipaResults([]); }
      setHipaSearching(false);
    }, 300);
  }, []);

  const selectHipa = (result: HipaSearchResult) => {
    setHipaTelepules(result.telepules);
    setHipaMegye(result.megye);
    setHipaKulcs(result.kulcs);
    setHipaQuery(`${result.telepules} (${result.megye})`);
    setHipaResults([]);
  };

  // Navigation
  const canProceed = () => {
    if (step === 1) return !!vallalkozasTipus;
    if (step === 2) return !!adozasForma;
    return true;
  };

  const next = () => { if (step < 5 && canProceed()) setStep((step + 1) as Step); };
  const prev = () => { if (step > 1) setStep((step - 1) as Step); };

  // When vallalkozasTipus changes, reset adozasForma to valid value
  useEffect(() => {
    if (vallalkozasTipus === 'EV') {
      if (adozasForma !== 'atalany' && adozasForma !== 'vszja') setAdozasForma('atalany');
    } else {
      if (adozasForma !== 'TAO' && adozasForma !== 'KIVA') setAdozasForma('TAO');
    }
  }, [vallalkozasTipus]);

  // Save
  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await window.electronAPI.saveTaxProfile({
        userId: '',
        vallalkozasTipus,
        adozasForma,
        foglalkozas,
        koltseghanyad,
        szakkepzettseg,
        aamValasztott,
        afaBevallas,
        hipaKulcs,
        hipaTelepules: hipaTelepules || '',
        hipaEgyszeru,
        adoev: new Date().getFullYear(),
        beallitva: true,
      });
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Hiba a mentés során');
    }
    setSaving(false);
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-surface-900/40 border border-teal/8 text-sm text-cream focus:outline-none focus:border-teal/25 placeholder:text-steel/40 transition-colors';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-surface-800 rounded-2xl ring-1 ring-inset ring-teal/15 w-full max-w-lg shadow-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Accent bar */}
        <div className="h-1 bg-teal" />

        <div className="p-5 flex flex-col flex-1 min-h-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Settings width={14} height={14} className="text-teal" />
              <h2 className="font-pixel text-[14px] text-cream">Adózási profil</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-teal/10 text-steel hover:text-cream cursor-pointer transition-colors duration-150">
              <X width={14} height={14} />
            </button>
          </div>

          {/* Step indicators */}
          <div className="flex items-center gap-1.5 mb-5">
            {stepLabels.map((label, i) => (
              <div key={i} className="flex items-center gap-1.5 flex-1">
                <div className={`flex items-center gap-1.5 text-[10px] font-medium ${step === i + 1 ? 'text-cream' : step > i + 1 ? 'text-teal/70' : 'text-steel/50'}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === i + 1 ? 'bg-teal text-cream' : step > i + 1 ? 'bg-teal/30 text-teal' : 'bg-teal/10 text-steel/50'}`}>
                    {step > i + 1 ? <Check width={10} height={10} /> : i + 1}
                  </span>
                  <span className="hidden sm:inline">{label}</span>
                </div>
                {i < 4 && <div className="h-px flex-1 bg-teal/10" />}
              </div>
            ))}
          </div>

          {/* Step content */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-4">
            {step === 1 && (
              <>
                <p className="text-xs text-steel mb-3">Milyen típusú a vállalkozásod?</p>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { val: 'EV' as const, icon: User, label: 'Egyéni vállalkozó', desc: 'EV' },
                    { val: 'Kft' as const, icon: Building2, label: 'Kft', desc: 'Korlátolt felelősségű' },
                    { val: 'Bt' as const, icon: Building2, label: 'Bt', desc: 'Betéti társaság' },
                    { val: 'Kkt' as const, icon: Building2, label: 'Kkt', desc: 'Közkereseti társaság' },
                  ]).map(opt => (
                    <button
                      key={opt.val}
                      onClick={() => setVallalkozasTipus(opt.val)}
                      className={`text-left px-3 py-3 rounded-lg border transition-all duration-150 cursor-pointer ${vallalkozasTipus === opt.val ? 'bg-teal/15 border-teal/40 text-cream' : 'bg-surface-900/30 border-teal/8 text-steel hover:bg-surface-900/60'}`}
                    >
                      <opt.icon width={16} height={16} className="mb-1.5" />
                      <div className="text-sm font-medium">{opt.label}</div>
                      <div className="text-[10px] text-steel/60">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <p className="text-xs text-steel mb-3">Válaszd ki az adózási formát</p>

                {vallalkozasTipus === 'EV' ? (
                  <div className="space-y-2">
                    {([
                      { val: 'atalany' as const, label: 'Átalányadó', desc: 'Egyszerűsített, vélelmezett költséghányad alapján' },
                      { val: 'vszja' as const, label: 'VSZJA', desc: 'Vállalkozói SZJA – valós költségek alapján' },
                    ]).map(opt => (
                      <button
                        key={opt.val}
                        onClick={() => setAdozasForma(opt.val)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all duration-150 cursor-pointer ${adozasForma === opt.val ? 'bg-teal/15 border-teal/40 text-cream' : 'bg-surface-900/30 border-teal/8 text-steel hover:bg-surface-900/60'}`}
                      >
                        <div className="text-sm font-medium">{opt.label}</div>
                        <div className="text-[10px] text-steel/60">{opt.desc}</div>
                      </button>
                    ))}

                    {adozasForma === 'atalany' && (
                      <div className="mt-4 space-y-3">
                        <div>
                          <label className="text-[10px] text-steel tracking-wider uppercase mb-1 block">Költséghányad</label>
                          <div className="flex gap-2">
                            {([
                              { val: 0.45, label: '45% – Általános' },
                              { val: 0.80, label: '80% – Kiskereskedelem' },
                              { val: 0.90, label: '90% – Üzletszerű kisker' },
                            ]).map(opt => (
                              <button
                                key={opt.val}
                                onClick={() => setKoltseghanyad(opt.val)}
                                className={`flex-1 px-2 py-1.5 rounded-lg border text-[11px] transition-all cursor-pointer ${koltseghanyad === opt.val ? 'bg-teal/15 border-teal/40 text-cream' : 'bg-surface-900/30 border-teal/8 text-steel hover:bg-surface-900/60'}`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] text-steel tracking-wider uppercase mb-1 block">Foglalkozás</label>
                          <div className="flex gap-2">
                            {([
                              { val: 'fofoglalkozasu' as const, label: 'Főfoglalkozású' },
                              { val: 'mellekfoglalkozasu' as const, label: 'Mellékfoglalkozású' },
                            ]).map(opt => (
                              <button
                                key={opt.val}
                                onClick={() => setFoglalkozas(opt.val)}
                                className={`flex-1 px-2 py-1.5 rounded-lg border text-[11px] transition-all cursor-pointer ${foglalkozas === opt.val ? 'bg-teal/15 border-teal/40 text-cream' : 'bg-surface-900/30 border-teal/8 text-steel hover:bg-surface-900/60'}`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <label className="flex items-center gap-2 text-xs text-steel cursor-pointer">
                          <input
                            type="checkbox"
                            checked={szakkepzettseg}
                            onChange={e => setSzakkepzettseg(e.target.checked)}
                            className="rounded border-teal/20 bg-surface-900/40 text-teal focus:ring-teal/30"
                          />
                          Szakképzettséget igénylő tevékenység (GBM járulékAlap)
                        </label>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {([
                      { val: 'TAO' as const, label: 'TAO', desc: 'Társasági adó (9%) + osztalékadó' },
                      { val: 'KIVA' as const, label: 'KIVA', desc: 'Kisvállalati adó (10%) – béralapú' },
                    ]).map(opt => (
                      <button
                        key={opt.val}
                        onClick={() => setAdozasForma(opt.val)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all duration-150 cursor-pointer ${adozasForma === opt.val ? 'bg-teal/15 border-teal/40 text-cream' : 'bg-surface-900/30 border-teal/8 text-steel hover:bg-surface-900/60'}`}
                      >
                        <div className="text-sm font-medium">{opt.label}</div>
                        <div className="text-[10px] text-steel/60">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {step === 3 && (
              <>
                <p className="text-xs text-steel mb-3">ÁFA beállítások</p>

                <label className="flex items-center gap-2 text-sm text-cream cursor-pointer mb-4">
                  <input
                    type="checkbox"
                    checked={aamValasztott}
                    onChange={e => setAamValasztott(e.target.checked)}
                    className="rounded border-teal/20 bg-surface-900/40 text-teal focus:ring-teal/30"
                  />
                  Alanyi adómentesség (AAM)
                </label>
                {aamValasztott && (
                  <div className="bg-teal/5 rounded-lg p-3 text-xs text-steel">
                    ÁFA-mentes működés – éves bevételi határ: 20M Ft (2026)
                  </div>
                )}

                {!aamValasztott && (
                  <div>
                    <label className="text-[10px] text-steel tracking-wider uppercase mb-1 block">ÁFA bevallás gyakorisága</label>
                    <div className="flex gap-2">
                      {([
                        { val: 'havi' as const, label: 'Havi' },
                        { val: 'negyedeves' as const, label: 'Negyedéves' },
                        { val: 'eves' as const, label: 'Éves' },
                      ]).map(opt => (
                        <button
                          key={opt.val}
                          onClick={() => setAfaBevallas(opt.val)}
                          className={`flex-1 px-2 py-1.5 rounded-lg border text-[11px] transition-all cursor-pointer ${afaBevallas === opt.val ? 'bg-teal/15 border-teal/40 text-cream' : 'bg-surface-900/30 border-teal/8 text-steel hover:bg-surface-900/60'}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {step === 4 && (
              <>
                <p className="text-xs text-steel mb-3">Helyi iparűzési adó (HIPA)</p>

                <div className="relative">
                  <label className="text-[10px] text-steel tracking-wider uppercase mb-1 block">Település keresés</label>
                  <div className="flex items-center gap-2">
                    <MapPin width={14} height={14} className="text-steel/50 absolute left-2.5 top-[calc(50%+4px)]" />
                    <input
                      type="text"
                      value={hipaQuery}
                      onChange={e => handleHipaSearch(e.target.value)}
                      placeholder="Pl. Budapest, Debrecen..."
                      className={`${inputCls} pl-8`}
                    />
                  </div>

                  {/* Search results dropdown */}
                  {hipaResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-surface-900 border border-teal/15 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                      {hipaResults.map((r, i) => (
                        <button
                          key={i}
                          onClick={() => selectHipa(r)}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-teal/10 text-cream transition-colors cursor-pointer"
                        >
                          <span className="font-medium">{r.telepules}</span>
                          <span className="text-steel/60"> ({r.megye})</span>
                          <span className="text-teal float-right">{r.kulcs.toFixed(2)}%</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {hipaSearching && <div className="text-[10px] text-steel/50 mt-1">Keresés...</div>}
                </div>

                {hipaTelepules && (
                  <div className="bg-teal/5 rounded-lg p-3 mt-3">
                    <div className="text-xs text-cream">
                      <span className="font-medium">{hipaTelepules}</span>
                      {hipaMegye && <span className="text-steel"> ({hipaMegye})</span>}
                    </div>
                    <div className="text-sm text-teal font-medium mt-1">{hipaKulcs.toFixed(2)}%</div>
                  </div>
                )}

                {vallalkozasTipus === 'EV' && adozasForma === 'atalany' && (
                  <label className="flex items-center gap-2 text-xs text-steel cursor-pointer mt-3">
                    <input
                      type="checkbox"
                      checked={hipaEgyszeru}
                      onChange={e => setHipaEgyszeru(e.target.checked)}
                      className="rounded border-teal/20 bg-surface-900/40 text-teal focus:ring-teal/30"
                    />
                    Egyszerűsített HIPA (sávos adóalap)
                  </label>
                )}
              </>
            )}

            {step === 5 && (
              <>
                <p className="text-xs text-steel mb-3">Profil összegzés</p>
                <div className="bg-teal/5 rounded-lg p-4 space-y-2.5">
                  <SummaryRow label="Vállalkozás" value={vallalkozasTipus} />
                  <SummaryRow label="Adózási forma" value={adozasForma === 'atalany' ? 'Átalányadó' : adozasForma === 'vszja' ? 'VSZJA' : adozasForma} />
                  {adozasForma === 'atalany' && (
                    <>
                      <SummaryRow label="Költséghányad" value={`${(koltseghanyad * 100).toFixed(0)}%`} />
                      <SummaryRow label="Foglalkozás" value={foglalkozas === 'fofoglalkozasu' ? 'Főfoglalkozású' : 'Mellékfoglalkozású'} />
                      <SummaryRow label="Szakképzettség" value={szakkepzettseg ? 'Igen' : 'Nem'} />
                    </>
                  )}
                  <SummaryRow label="ÁFA" value={aamValasztott ? 'AAM (mentes)' : `ÁFA – ${afaBevallas}`} />
                  <SummaryRow label="HIPA" value={hipaTelepules ? `${hipaTelepules} – ${hipaKulcs.toFixed(2)}%` : 'Nincs beállítva'} />
                  {hipaEgyszeru && <SummaryRow label="HIPA mód" value="Egyszerűsített (sávos)" />}
                </div>
                {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
              </>
            )}
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-teal/8">
            <button
              onClick={prev}
              disabled={step === 1}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${step === 1 ? 'text-steel/30' : 'text-steel hover:text-cream hover:bg-teal/10'}`}
            >
              <ChevronLeft width={12} height={12} /> Vissza
            </button>

            {step < 5 ? (
              <button
                onClick={next}
                disabled={!canProceed()}
                className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs bg-teal/20 text-cream hover:bg-teal/30 transition-colors cursor-pointer disabled:opacity-40"
              >
                Tovább <ChevronRight width={12} height={12} />
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs bg-teal text-cream hover:bg-teal/90 transition-colors cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Mentés...' : 'Mentés'}
                {!saving && <Check width={12} height={12} />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-steel">{label}</span>
      <span className="text-cream font-medium">{value}</span>
    </div>
  );
}
