import { useState, useEffect } from 'react';
import { X, FileText, Loader2, ChevronRight, AlertCircle, ScrollText, Calendar, Banknote } from 'lucide-react';
import DatePicker from './DatePicker';

// Shared classes matching ClientForm / ProjectForm design system
const inputBox = "w-full px-2.5 py-2 bg-surface-900/40 border border-teal/8 rounded-lg text-sm text-cream focus:outline-none focus:border-teal/25 placeholder:text-steel/40 transition-colors";
const inputLine = "flex-1 bg-transparent text-sm text-cream focus:outline-none placeholder:text-steel/40";
const labelCls = "text-[10px] text-steel tracking-wider uppercase mb-1 block";

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return <span className={labelCls}>{children}{required && ' *'}</span>;
}

function SectionDivider({ label, icon: Icon }: { label: string; icon: typeof Banknote }) {
  return (
    <div className="flex items-center gap-2 pt-3">
      <Icon width={11} height={11} className="text-steel/40" />
      <span className="text-[9px] text-steel/50 tracking-widest uppercase font-medium">{label}</span>
      <div className="flex-1 h-px bg-teal/6" />
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
        className="bg-surface-800 rounded-2xl border border-teal/15 w-full max-w-lg shadow-2xl max-h-[85vh] flex flex-col"
        onDoubleClick={e => e.stopPropagation()}
      >
        {/* Header accent */}
        <div className="h-1 bg-gradient-to-r from-teal via-steel to-teal/30" />

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
            <div className="space-y-4 overflow-y-auto px-1 -mx-1 flex-1">
              {/* Common: date + project */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Szerződés dátuma</Label>
                  <DatePicker value={contractDate} onChange={setContractDate} />
                </div>
                {projects.length > 0 ? (
                  <div>
                    <Label>Projekt</Label>
                    <select value={projectId} onChange={e => setProjectId(e.target.value)} className={inputBox}>
                      <option value="">Nincs hozzárendelve</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                ) : <div />}
              </div>

              {/* Template-specific fields */}
              {selectedTemplate.id === 'megbizasi' && (
                <>
                  <div>
                    <Label required>Megbízás tárgya</Label>
                    <textarea value={fields.subject || ''} onChange={e => setField('subject', e.target.value)} className={`${inputBox} resize-none h-16`} placeholder="pl. Weboldal tervezése és fejlesztése" autoFocus />
                  </div>

                  <SectionDivider label="Díjazás" icon={Banknote} />

                  <div>
                    <Label required>Megbízási díj <span className="text-steel/40 normal-case tracking-normal">(Ft)</span></Label>
                    <div className="flex items-center gap-2 border-b border-teal/8 py-1.5">
                      <Banknote width={12} height={12} className="text-steel/60 shrink-0" />
                      <input type="text" value={fields.fee || ''} onChange={e => setField('fee', e.target.value)} className={inputLine} placeholder="pl. 500 000" />
                    </div>
                  </div>

                  <div>
                    <Label required>Fizetési határidő</Label>
                    <div className="flex items-center gap-2 border-b border-teal/8 py-1.5">
                      <Calendar width={12} height={12} className="text-steel/60 shrink-0" />
                      <input type="text" value={fields.paymentDeadline || ''} onChange={e => setField('paymentDeadline', e.target.value)} className={inputLine} placeholder="pl. 15 nap" />
                    </div>
                  </div>

                  <SectionDivider label="Időszak" icon={Calendar} />

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label required>Kezdő dátum</Label>
                      <DatePicker value={fields.startDate || ''} onChange={v => setField('startDate', v)} />
                    </div>
                    <div>
                      <Label required>Befejezési határidő</Label>
                      <DatePicker value={fields.endDate || ''} onChange={v => setField('endDate', v)} />
                    </div>
                  </div>

                  <div>
                    <Label required>Kelt (helyszín)</Label>
                    <div className="flex items-center gap-2 border-b border-teal/8 py-1.5">
                      <ScrollText width={12} height={12} className="text-steel/60 shrink-0" />
                      <input type="text" value={fields.place || ''} onChange={e => setField('place', e.target.value)} className={inputLine} placeholder="pl. Budapest" />
                    </div>
                  </div>
                </>
              )}

              {selectedTemplate.id === 'vallalkozasi' && (
                <>
                  <div>
                    <Label required>Vállalkozás tárgya</Label>
                    <textarea value={fields.subject || ''} onChange={e => setField('subject', e.target.value)} className={`${inputBox} resize-none h-16`} placeholder="pl. Mobilalkalmazás fejlesztése iOS és Android platformra" autoFocus />
                  </div>

                  <div>
                    <Label required>Átadandó eredmények</Label>
                    <textarea value={fields.deliverables || ''} onChange={e => setField('deliverables', e.target.value)} className={`${inputBox} resize-none h-16`} placeholder="pl. Forráskód, dokumentáció, tesztek" />
                  </div>

                  <SectionDivider label="Díjazás" icon={Banknote} />

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label required>Vállalkozási díj <span className="text-steel/40 normal-case tracking-normal">(Ft)</span></Label>
                      <input type="text" value={fields.fee || ''} onChange={e => setField('fee', e.target.value)} className={inputBox} placeholder="pl. 1 500 000" />
                    </div>
                    <div>
                      <Label>Előleg <span className="text-steel/40 normal-case tracking-normal">(Ft)</span></Label>
                      <input type="text" value={fields.advancePayment || ''} onChange={e => setField('advancePayment', e.target.value)} className={inputBox} placeholder="pl. 500 000" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label required>Fizetési határidő</Label>
                      <input type="text" value={fields.paymentDeadline || ''} onChange={e => setField('paymentDeadline', e.target.value)} className={inputBox} placeholder="pl. 15 nap" />
                    </div>
                    <div>
                      <Label>Jótállás időtartama</Label>
                      <input type="text" value={fields.warrantyMonths || ''} onChange={e => setField('warrantyMonths', e.target.value)} className={inputBox} placeholder="pl. 6 hónap" />
                    </div>
                  </div>

                  <SectionDivider label="Időszak" icon={Calendar} />

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label required>Kezdő dátum</Label>
                      <DatePicker value={fields.startDate || ''} onChange={v => setField('startDate', v)} />
                    </div>
                    <div>
                      <Label required>Teljesítési határidő</Label>
                      <DatePicker value={fields.deadline || ''} onChange={v => setField('deadline', v)} />
                    </div>
                  </div>

                  <div>
                    <Label required>Kelt (helyszín)</Label>
                    <div className="flex items-center gap-2 border-b border-teal/8 py-1.5">
                      <ScrollText width={12} height={12} className="text-steel/60 shrink-0" />
                      <input type="text" value={fields.place || ''} onChange={e => setField('place', e.target.value)} className={inputLine} placeholder="pl. Budapest" />
                    </div>
                  </div>
                </>
              )}

              {selectedTemplate.id === 'nda' && (
                <>
                  <div>
                    <Label required>Felhasználás célja</Label>
                    <textarea value={fields.purpose || ''} onChange={e => setField('purpose', e.target.value)} className={`${inputBox} resize-none h-16`} placeholder="pl. Webfejlesztési projekt megvalósítása" autoFocus />
                  </div>

                  <div>
                    <Label required>Bizalmas információ meghatározása</Label>
                    <textarea value={fields.confidentialInfo || ''} onChange={e => setField('confidentialInfo', e.target.value)} className={`${inputBox} resize-none h-16`} placeholder="pl. Üzleti tervek, forráskódok, ügyféllisták, pénzügyi adatok" />
                  </div>

                  <SectionDivider label="Feltételek" icon={FileText} />

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label required>Titoktartás időtartama</Label>
                      <input type="text" value={fields.durationYears || ''} onChange={e => setField('durationYears', e.target.value)} className={inputBox} placeholder="pl. 3 év" />
                    </div>
                    <div>
                      <Label>Kötbér összege <span className="text-steel/40 normal-case tracking-normal">(Ft)</span></Label>
                      <input type="text" value={fields.penaltyAmount || ''} onChange={e => setField('penaltyAmount', e.target.value)} className={inputBox} placeholder="pl. 2 000 000" />
                    </div>
                  </div>

                  <div>
                    <Label required>Kelt (helyszín)</Label>
                    <div className="flex items-center gap-2 border-b border-teal/8 py-1.5">
                      <ScrollText width={12} height={12} className="text-steel/60 shrink-0" />
                      <input type="text" value={fields.place || ''} onChange={e => setField('place', e.target.value)} className={inputLine} placeholder="pl. Budapest" />
                    </div>
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
