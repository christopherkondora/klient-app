import { useState, useEffect } from 'react';
import { X, FileText, Loader2, ChevronRight, AlertCircle, ScrollText, Calendar, Banknote, MapPin, Clock, Shield, Package, Milestone } from 'lucide-react';
import DatePicker from './DatePicker';

// Shared classes
const inputBox = "w-full px-2.5 py-2 bg-surface-900/40 border border-teal/8 rounded-lg text-sm text-cream focus:outline-none focus:border-teal/25 placeholder:text-steel/40 transition-colors";
const inputLine = "flex-1 bg-transparent text-sm text-cream focus:outline-none placeholder:text-steel/40";
const labelCls = "text-[10px] text-steel tracking-wider uppercase mb-1 block";

/** Format number with Hungarian thousand separator (space) and strip non-digits on input */
function formatAmount(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('hu-HU');
}

/** Strip formatting back to raw digits for storage */
function parseAmount(formatted: string): string {
  return formatted.replace(/\D/g, '');
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return <span className={labelCls}>{children}{required && ' *'}</span>;
}

/** Card wrapper with optional teal left accent */
function Card({ children, accent, className = '' }: { children: React.ReactNode; accent?: boolean; className?: string }) {
  return (
    <div className={`rounded-xl bg-surface-900/25 border border-teal/6 p-3 ${accent ? 'border-l-2 border-l-teal/40' : ''} ${className}`}>
      {children}
    </div>
  );
}

/** Inline badge label */
function Badge({ children, icon: Icon }: { children: React.ReactNode; icon: typeof Banknote }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-teal/8 border border-teal/10 mb-2">
      <Icon width={9} height={9} className="text-teal/70" />
      <span className="text-[9px] text-teal/80 tracking-wider uppercase font-medium">{children}</span>
    </div>
  );
}

interface Props {
  clientId: string;
  clientName: string;
  projects: Project[];
  onClose: () => void;
  onGenerated: (contract: Contract) => void;
}

export default function ContractGenerateModal({ clientId, clientName, projects, onClose, onGenerated }: Props) {
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [projectId, setProjectId] = useState('');
  const [contractDate, setContractDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'select' | 'fill'>('select');

  useEffect(() => {
    window.electronAPI.getContractTemplates().then(setTemplates);
  }, []);

  const selectTemplate = (t: ContractTemplate) => {
    setSelectedTemplate(t);
    const defaults: Record<string, string> = {};
    for (const f of t.fields) {
      defaults[f.key] = f.defaultValue || '';
    }
    setFields(defaults);
    setStep('fill');
  };

  const setField = (key: string, value: string) => setFields(prev => ({ ...prev, [key]: value }));

  const handleGenerate = async () => {
    if (!selectedTemplate) return;

    for (const f of selectedTemplate.fields) {
      if (f.required && !fields[f.key]?.trim()) {
        setError(`A "${f.label}" mező kitöltése kötelező`);
        return;
      }
    }

    setLoading(true);
    setError('');
    try {
      const contract = await window.electronAPI.generateContract({
        templateId: selectedTemplate.id,
        clientId,
        projectId: projectId || undefined,
        fields,
        contractDate,
      });
      onGenerated(contract);
    } catch (err: any) {
      setError(err.message || 'Hiba történt a generálás során');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onDoubleClick={onClose}>
      <div
        className="bg-surface-800 rounded-2xl ring-1 ring-inset ring-teal/15 w-full max-w-lg shadow-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onDoubleClick={e => e.stopPropagation()}
      >
        {/* Header accent */}
        <div className="h-1 bg-teal" />

        <div className="p-5 flex flex-col flex-1 min-h-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <span className="font-pixel text-[14px] text-cream">
              {step === 'select' ? 'Új szerződés' : selectedTemplate?.name}
            </span>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-teal/10 text-steel hover:text-cream cursor-pointer transition-colors duration-150 ease-out">
              <X width={14} height={14} />
            </button>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center gap-3 mb-5">
            <div className={`flex items-center gap-2 text-xs font-medium ${step === 'select' ? 'text-cream' : 'text-steel/50'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 'select' ? 'bg-teal text-cream' : 'bg-teal/20 text-steel/50'}`}>1</span>
              Sablon
            </div>
            <div className="h-px flex-1 bg-teal/10" />
            <div className={`flex items-center gap-2 text-xs font-medium ${step === 'fill' ? 'text-cream' : 'text-steel/50'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 'fill' ? 'bg-teal text-cream' : 'bg-teal/20 text-steel/50'}`}>2</span>
              Kitöltés
            </div>
          </div>

          {/* Step 1: Template selection */}
          {step === 'select' && (
            <div className="space-y-4 overflow-y-auto px-1 -mx-1">
              <div>
                <span className="text-[10px] text-steel tracking-wider uppercase mb-1 block">Ügyfél</span>
                <div className="flex items-center gap-2 border-b border-teal/8 py-1.5">
                  <ScrollText width={12} height={12} className="text-steel/60 shrink-0" />
                  <span className="text-sm text-cream">{clientName}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-steel tracking-wider uppercase mb-2 block">Típus</span>
                <div className="space-y-1.5">
                  {templates.map(t => (
                    <button
                      key={t.id}
                      onClick={() => selectTemplate(t)}
                      className="w-full text-left px-3 py-2.5 rounded-lg bg-surface-900/30 hover:bg-surface-900/60 transition-all duration-150 ease-out cursor-pointer group"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-cream">{t.name}</p>
                          <p className="text-[10px] text-steel mt-0.5">{t.description}</p>
                        </div>
                        <ChevronRight width={14} height={14} className="text-steel/40 group-hover:text-cream transition-colors duration-150" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-2 text-[10px] text-steel/40 pt-2">
                <AlertCircle width={11} height={11} className="mt-0.5 shrink-0" />
                <p>Kiindulási sablonok, nem jogi tanácsadás. Javasoljuk ügyvéddel történő átnézésüket.</p>
              </div>
            </div>
          )}

          {/* Step 2: Fill fields — template-specific layout */}
          {step === 'fill' && selectedTemplate && (
            <div className="space-y-3 overflow-y-auto px-1 -mx-1 flex-1">
              {/* Top bar: date + project - compact inline */}
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Label>Szerződés dátuma</Label>
                  <DatePicker value={contractDate} onChange={setContractDate} />
                </div>
                {projects.length > 0 && (
                  <div className="flex-1">
                    <Label>Projekt</Label>
                    <select value={projectId} onChange={e => setProjectId(e.target.value)} className={inputBox}>
                      <option value="">Nincs hozzárendelve</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* ─── MEGBÍZÁSI ─── */}
              {selectedTemplate.id === 'megbizasi' && (
                <>
                  {/* Subject — hero card with teal accent */}
                  <Card accent>
                    <Label required>Megbízás tárgya</Label>
                    <textarea value={fields.subject || ''} onChange={e => setField('subject', e.target.value)} className={`${inputBox} resize-none h-16 !bg-transparent !border-0 !px-0 !rounded-none border-b !border-b-teal/10`} placeholder="pl. Weboldal tervezése és fejlesztése" autoFocus />
                  </Card>

                  {/* Fee card — prominent amount */}
                  <Card>
                    <Badge icon={Banknote}>Díjazás</Badge>
                    <div className="flex items-end gap-3">
                      <div className="flex-[3]">
                        <Label required>Megbízási díj</Label>
                        <div className="flex items-baseline gap-1.5">
                          <input type="text" value={formatAmount(fields.fee || '')} onChange={e => setField('fee', parseAmount(e.target.value))} className="w-full bg-transparent text-lg font-medium text-cream focus:outline-none placeholder:text-steel/30" placeholder="500 000" />
                          <span className="text-[10px] text-steel/50 whitespace-nowrap">Ft</span>
                        </div>
                        <div className="h-px bg-teal/15 mt-1" />
                      </div>
                      <div className="flex-[2]">
                        <Label required>Fizetési határidő</Label>
                        <div className="flex items-baseline gap-1.5">
                          <input type="text" value={fields.paymentDeadline || ''} onChange={e => setField('paymentDeadline', e.target.value)} className="w-full bg-transparent text-sm text-cream focus:outline-none placeholder:text-steel/30" placeholder="15" />
                          <span className="text-[10px] text-steel/50 whitespace-nowrap">nap</span>
                        </div>
                        <div className="h-px bg-teal/15 mt-1" />
                      </div>
                    </div>
                  </Card>

                  {/* Dates — asymmetric layout */}
                  <div>
                    <Badge icon={Calendar}>Időszak</Badge>
                    <div className="grid grid-cols-[1.2fr_1fr] gap-3">
                      <div>
                        <Label required>Kezdő dátum</Label>
                        <DatePicker value={fields.startDate || ''} onChange={v => setField('startDate', v)} />
                      </div>
                      <div>
                        <Label required>Befejezés</Label>
                        <DatePicker value={fields.endDate || ''} onChange={v => setField('endDate', v)} />
                      </div>
                    </div>
                  </div>

                  {/* Compact extras row */}
                  <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
                    <div>
                      <Label>Tájékoztatás</Label>
                      <input type="text" value={fields.reportFrequency || ''} onChange={e => setField('reportFrequency', e.target.value)} className={inputBox} placeholder="pl. kéthetente" />
                    </div>
                    <div className="h-8 w-px bg-teal/8" />
                    <div>
                      <Label>Felmondási idő</Label>
                      <div className="flex items-center gap-1.5">
                        <input type="text" value={fields.noticePeriod || ''} onChange={e => setField('noticePeriod', e.target.value)} className={inputBox} placeholder="15" />
                        <span className="text-[10px] text-steel/40 whitespace-nowrap">nap</span>
                      </div>
                    </div>
                  </div>

                  {/* Place — subtle inline */}
                  <div className="flex items-center gap-2 pt-1">
                    <MapPin width={11} height={11} className="text-steel/40 shrink-0" />
                    <Label required>Kelt</Label>
                    <input type="text" value={fields.place || ''} onChange={e => setField('place', e.target.value)} className="flex-1 bg-transparent text-sm text-cream border-b border-teal/10 pb-0.5 focus:outline-none focus:border-teal/25 placeholder:text-steel/40 transition-colors" placeholder="Budapest" />
                  </div>
                </>
              )}

              {/* ─── VÁLLALKOZÁSI ─── */}
              {selectedTemplate.id === 'vallalkozasi' && (
                <>
                  {/* Subject + Deliverables — hero card */}
                  <Card accent>
                    <div className="space-y-3">
                      <div>
                        <Label required>Vállalkozás tárgya</Label>
                        <textarea value={fields.subject || ''} onChange={e => setField('subject', e.target.value)} className={`${inputBox} resize-none h-14 !bg-transparent !border-0 !px-0 !rounded-none border-b !border-b-teal/10`} placeholder="pl. Mobilalkalmazás fejlesztése" autoFocus />
                      </div>
                      <div>
                        <Label required>Átadandó eredmények</Label>
                        <textarea value={fields.deliverables || ''} onChange={e => setField('deliverables', e.target.value)} className={`${inputBox} resize-none h-14 !bg-transparent !border-0 !px-0 !rounded-none border-b !border-b-teal/10`} placeholder="pl. Forráskód, dokumentáció, tesztek" />
                      </div>
                    </div>
                  </Card>

                  {/* Milestones — optional, full-width */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Milestone width={10} height={10} className="text-steel/40" />
                      <Label>Mérföldkövek <span className="text-steel/30 normal-case tracking-normal">(opcionális)</span></Label>
                    </div>
                    <textarea value={fields.milestones || ''} onChange={e => setField('milestones', e.target.value)} className={`${inputBox} resize-none h-12`} placeholder="pl. 1. Design — 04.30., 2. Frontend — 05.31." />
                  </div>

                  {/* Fee card — prominent with advance */}
                  <Card>
                    <Badge icon={Banknote}>Díjazás</Badge>
                    <div className="space-y-2.5">
                      <div className="flex items-end gap-3">
                        <div className="flex-1">
                          <Label required>Vállalkozási díj</Label>
                          <div className="flex items-baseline gap-1.5">
                            <input type="text" value={formatAmount(fields.fee || '')} onChange={e => setField('fee', parseAmount(e.target.value))} className="w-full bg-transparent text-lg font-medium text-cream focus:outline-none placeholder:text-steel/30" placeholder="1 500 000" />
                            <span className="text-[10px] text-steel/50 whitespace-nowrap">Ft</span>
                          </div>
                          <div className="h-px bg-teal/15 mt-1" />
                        </div>
                        <div className="w-px h-8 bg-teal/8" />
                        <div className="flex-1">
                          <Label>Előleg</Label>
                          <div className="flex items-baseline gap-1.5">
                            <input type="text" value={formatAmount(fields.advancePayment || '')} onChange={e => setField('advancePayment', parseAmount(e.target.value))} className="w-full bg-transparent text-sm text-cream focus:outline-none placeholder:text-steel/30" placeholder="500 000" />
                            <span className="text-[10px] text-steel/50 whitespace-nowrap">Ft</span>
                          </div>
                          <div className="h-px bg-teal/15 mt-1" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label required>Fizetési határidő</Label>
                          <div className="flex items-center gap-1.5">
                            <input type="text" value={fields.paymentDeadline || ''} onChange={e => setField('paymentDeadline', e.target.value)} className={inputBox} placeholder="15" />
                            <span className="text-[10px] text-steel/40 whitespace-nowrap">nap</span>
                          </div>
                        </div>
                        <div>
                          <Label>Jótállás</Label>
                          <input type="text" value={fields.warrantyMonths || ''} onChange={e => setField('warrantyMonths', e.target.value)} className={inputBox} placeholder="pl. 6 hónap" />
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Dates + Acceptance in one block */}
                  <div className="space-y-2.5">
                    <Badge icon={Clock}>Határidők</Badge>
                    <div className="grid grid-cols-[1.2fr_1fr] gap-3">
                      <div>
                        <Label required>Kezdő dátum</Label>
                        <DatePicker value={fields.startDate || ''} onChange={v => setField('startDate', v)} />
                      </div>
                      <div>
                        <Label required>Teljesítés</Label>
                        <DatePicker value={fields.deadline || ''} onChange={v => setField('deadline', v)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
                      <div>
                        <Label>Átvételi határidő</Label>
                        <div className="flex items-center gap-1.5">
                          <input type="text" value={fields.acceptanceDays || ''} onChange={e => setField('acceptanceDays', e.target.value)} className={inputBox} placeholder="8" />
                          <span className="text-[10px] text-steel/40 whitespace-nowrap">munkanap</span>
                        </div>
                      </div>
                      <div className="h-8 w-px bg-teal/8" />
                      <div>
                        <Label>Hibajavítás</Label>
                        <div className="flex items-center gap-1.5">
                          <input type="text" value={fields.bugfixDays || ''} onChange={e => setField('bugfixDays', e.target.value)} className={inputBox} placeholder="10" />
                          <span className="text-[10px] text-steel/40 whitespace-nowrap">munkanap</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Place */}
                  <div className="flex items-center gap-2 pt-1">
                    <MapPin width={11} height={11} className="text-steel/40 shrink-0" />
                    <Label required>Kelt</Label>
                    <input type="text" value={fields.place || ''} onChange={e => setField('place', e.target.value)} className="flex-1 bg-transparent text-sm text-cream border-b border-teal/10 pb-0.5 focus:outline-none focus:border-teal/25 placeholder:text-steel/40 transition-colors" placeholder="Budapest" />
                  </div>
                </>
              )}

              {/* ─── NDA ─── */}
              {selectedTemplate.id === 'nda' && (
                <>
                  {/* Purpose — hero card */}
                  <Card accent>
                    <Label required>Felhasználás célja</Label>
                    <textarea value={fields.purpose || ''} onChange={e => setField('purpose', e.target.value)} className={`${inputBox} resize-none h-16 !bg-transparent !border-0 !px-0 !rounded-none border-b !border-b-teal/10`} placeholder="pl. Webfejlesztési projekt megvalósítása" autoFocus />
                  </Card>

                  {/* Confidential info */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Shield width={10} height={10} className="text-steel/40" />
                      <Label required>Bizalmas információ meghatározása</Label>
                    </div>
                    <textarea value={fields.confidentialInfo || ''} onChange={e => setField('confidentialInfo', e.target.value)} className={`${inputBox} resize-none h-16`} placeholder="pl. Üzleti tervek, forráskódok, ügyféllisták" />
                  </div>

                  {/* Terms card — duration + penalty side by side */}
                  <Card>
                    <Badge icon={FileText}>Feltételek</Badge>
                    <div className="flex items-end gap-3">
                      <div className="flex-1">
                        <Label required>Titoktartás időtartama</Label>
                        <input type="text" value={fields.durationYears || ''} onChange={e => setField('durationYears', e.target.value)} className={inputBox} placeholder="pl. 3 év" />
                      </div>
                      <div className="w-px h-8 bg-teal/8" />
                      <div className="flex-1">
                        <Label>Kötbér összege</Label>
                        <div className="flex items-baseline gap-1.5">
                          <input type="text" value={formatAmount(fields.penaltyAmount || '')} onChange={e => setField('penaltyAmount', parseAmount(e.target.value))} className="w-full bg-transparent text-sm text-cream focus:outline-none placeholder:text-steel/30 border-b border-teal/10 pb-0.5" placeholder="2 000 000" />
                          <span className="text-[10px] text-steel/50 whitespace-nowrap">Ft</span>
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Place */}
                  <div className="flex items-center gap-2 pt-1">
                    <MapPin width={11} height={11} className="text-steel/40 shrink-0" />
                    <Label required>Kelt</Label>
                    <input type="text" value={fields.place || ''} onChange={e => setField('place', e.target.value)} className="flex-1 bg-transparent text-sm text-cream border-b border-teal/10 pb-0.5 focus:outline-none focus:border-teal/25 placeholder:text-steel/40 transition-colors" placeholder="Budapest" />
                  </div>
                </>
              )}

              {error && <p className="text-xs text-red-400">{error}</p>}

              {/* Actions */}
              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => { setStep('select'); setSelectedTemplate(null); setError(''); }}
                  className="px-4 py-2 text-xs text-steel hover:text-cream transition-colors duration-150 ease-out cursor-pointer"
                >
                  ← Vissza
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={loading}
                  className="flex items-center gap-2 px-5 py-2 bg-teal text-cream rounded-lg text-xs font-medium hover:bg-teal/80 transition-colors duration-150 ease-out cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 width={13} height={13} className="animate-spin" /> : <FileText width={13} height={13} />}
                  {loading ? 'Generálás...' : 'Szerződés generálása'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
