import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronDown, Settings, AlertTriangle, TrendingUp, Receipt, Building2, MapPin, Check, Plus, Trash2 } from 'lucide-react';
import TaxProfileWizard from './TaxProfileWizard';
import { useAuth } from '../contexts/AuthContext';

interface TaxSectionProps {
  yearlyRevenue: number;
  yearlyNetRevenue?: number;
  vatPayable?: number;
  vatDeductible?: number;
  vatBalance?: number;
  vatStatus?: 'exempt' | 'standard';
  onVatChanged?: () => void;
}

interface TaxEstimate {
  adoev: number;
  szja: number;
  tb: number;
  szocho: number;
  hipa: number;
  egyebAdo: number;
  osszesen: number;
  negyedevek: Array<{
    quarter: 1 | 2 | 3 | 4;
    bevétel: number;
    szja: number;
    tb: number;
    szocho: number;
    hipa: number;
    osszesen: number;
  }>;
  reszletek: Record<string, unknown>;
  hipaReszletek: Record<string, unknown> | null;
  profil: {
    vallalkozasTipus: string;
    adozasForma: string;
    foglalkozas: string;
    hipaTelepules: string;
    koltseghanyad: number;
  };
}

interface TaxWarning {
  type: string;
  severity: 'info' | 'warning' | 'danger';
  message: string;
}

interface TaxComparison {
  forma: string;
  label: string;
  osszesen: number;
  reszletek: Record<string, unknown>;
  status?: 'ready' | 'needs_data';
  note?: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 }).format(amount);
}

type KivaAdjustmentOption = {
  value: string;
  label: string;
};

const KIVA_ADJUSTMENT_OPTIONS: Record<KivaAdjustmentType, KivaAdjustmentOption[]> = {
  AAN: [
    { value: 'jovahagyott_osztalek', label: 'Jóváhagyott fizetendő osztalék' },
    { value: 'tokekivonas', label: 'Tőkekivonás / jegyzett tőke leszállítás' },
    { value: 'penztar_novekedes', label: 'Pénztár növekedés korrekció' },
    { value: 'nem_vallalkozasi_koltseg', label: 'Nem vállalkozási érdekű költség' },
    { value: 'birsag_potlek', label: 'Bírság, pótlék, jogkövetkezmény' },
    { value: 'elengedett_koveteles', label: 'Elengedett követelés' },
    { value: 'behajthatatlan_koveteles', label: 'Behajthatatlan követelés korrekció' },
    { value: 'kapcsolt_vallalkozas', label: 'Kapcsolt vállalkozás / piaci ár korrekció' },
    { value: 'ellenorzott_kulfoldi_tarsasag', label: 'Ellenőrzött külföldi társaság korrekció' },
    { value: 'egyeb_adoalap_novelo', label: 'Egyéb adóalap-növelő tétel' },
  ],
  AACS: [
    { value: 'kapott_osztalek', label: 'Kapott osztalék' },
    { value: 'tokebevonas', label: 'Tőkebevonás / jegyzett tőke emelés' },
    { value: 'penztar_csokkenes', label: 'Pénztár csökkenés korrekció' },
    { value: 'elhatarolt_veszteseg', label: 'Elhatárolt veszteség felhasználása' },
    { value: 'beruhazas_veszteseg', label: 'Beruházáshoz kapcsolódó veszteségfelhasználás' },
    { value: 'kulfoldi_jovedelem', label: 'Külföldön adóztatható jövedelem korrekció' },
    { value: 'szemelyi_kifizetes_kedvezmeny', label: 'Személyi jellegű kifizetés kedvezmény' },
    { value: 'egyeb_adoalap_csokkento', label: 'Egyéb adóalap-csökkentő tétel' },
  ],
};

function getKivaAdjustmentCategoryLabel(type: KivaAdjustmentType, category: string): string {
  if (category === 'egyeb') {
    return type === 'AAN' ? 'Egyéb adóalap-növelő tétel' : 'Egyéb adóalap-csökkentő tétel';
  }
  return KIVA_ADJUSTMENT_OPTIONS[type].find(option => option.value === category)?.label ?? category.replace(/_/g, ' ');
}

export default function TaxSection({ yearlyRevenue, yearlyNetRevenue, vatPayable, vatDeductible, vatBalance, vatStatus = 'exempt', onVatChanged }: TaxSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [estimate, setEstimate] = useState<TaxEstimate | null>(null);
  const [warnings, setWarnings] = useState<TaxWarning[]>([]);
  const [comparison, setComparison] = useState<TaxComparison[]>([]);
  const [profileSummary, setProfileSummary] = useState<{ tipus: string; forma: string; telepules: string; foglalkozas: string; szakkepzettseg: boolean } | null>(null);
  const [kivaEstimate, setKivaEstimate] = useState<KivaEstimateRow | null>(null);
  const [kivaPeriods, setKivaPeriods] = useState<KivaPeriodRow[]>([]);
  const [kivaAdjustments, setKivaAdjustments] = useState<KivaAdjustmentRow[]>([]);
  const [showKivaEditor, setShowKivaEditor] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const expandTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentYear = new Date().getFullYear();

  const loadData = useCallback(async () => {
    try {
      const profile = await window.electronAPI.getTaxProfile();
      if (!profile || !profile.beallitva) {
        setHasProfile(false);
        return;
      }
      setHasProfile(true);
      setProfileSummary({
        tipus: profile.vallalkozasTipus,
        forma: profile.adozasForma === 'atalany' ? 'Átalányadó' :
               profile.adozasForma === 'vszja' ? 'VSZJA' : profile.adozasForma,
        telepules: profile.hipaTelepules || '',
        foglalkozas: profile.foglalkozas,
        szakkepzettseg: !!profile.szakkepzettseg,
      });

      const [est, warns, comp, kivaEst, periods, adjustments] = await Promise.all([
        window.electronAPI.getFullTaxEstimate(undefined, currentYear, yearlyRevenue),
        window.electronAPI.getTaxWarnings(undefined, yearlyRevenue, currentYear),
        window.electronAPI.compareTaxForms(yearlyRevenue, 0, currentYear, profile.hipaKulcs),
        profile.adozasForma === 'KIVA' ? window.electronAPI.getKivaEstimate(undefined, currentYear) : Promise.resolve(null),
        profile.adozasForma === 'KIVA' ? window.electronAPI.getKivaPeriods(undefined, currentYear) : Promise.resolve([]),
        profile.adozasForma === 'KIVA' ? window.electronAPI.getKivaAdjustments(undefined, currentYear) : Promise.resolve([]),
      ]);
      setEstimate(est);
      setWarnings(warns);
      setComparison(comp);
      setKivaEstimate(kivaEst);
      setKivaPeriods(periods);
      setKivaAdjustments(adjustments);
    } catch (e) {
      console.error('Tax data load error:', e);
    }
  }, [yearlyRevenue, currentYear]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleWizardSaved = () => {
    setShowWizard(false);
    loadData();
  };

  const isKivaProfile = profileSummary?.forma === 'KIVA';
  const kivaHeaderText = (() => {
    if (!isKivaProfile) return '';
    if (!kivaEstimate || kivaEstimate.completeness === 'missing') return 'Adat szükséges';
    if (kivaAdjustments.length > 0 || kivaPeriods.some(p => p.personal_payments_mode !== 'auto')) return formatCurrency(kivaEstimate.annualTaxHuf);
    return formatCurrency(kivaEstimate.annualTaxHuf);
  })();

  // No profile — CTA
  if (!hasProfile) {
    return (
      <>
        <div className="bg-surface-800/50 rounded-xl border border-dashed border-teal/20 p-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Receipt width={14} height={14} className="text-teal" />
              <span className="text-sm font-medium text-cream">Adózás</span>
            </div>
            <p className="text-xs text-steel">Állítsd be az adózási profilodat a becsült adóteher megjelenítéséhez</p>
          </div>
          <button
            onClick={() => setShowWizard(true)}
            className="px-4 py-2 rounded-lg text-xs bg-teal/20 text-cream hover:bg-teal/30 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Settings width={12} height={12} /> Profil beállítása
          </button>
        </div>
        {showWizard && <TaxProfileWizard onClose={() => setShowWizard(false)} onSaved={handleWizardSaved} />}
      </>
    );
  }

  return (
    <>
      <div className="bg-surface-800/50 rounded-xl border-l-[3px] border-teal overflow-hidden">
        {/* Collapsed header — always visible */}
        <button
          onClick={() => {
            const next = !expanded;
            setExpanded(next);
            if (next) {
              setAnimateIn(false);
              if (expandTimer.current) clearTimeout(expandTimer.current);
              expandTimer.current = setTimeout(() => setAnimateIn(true), 30);
            } else {
              setAnimateIn(false);
            }
          }}
          className="w-full p-5 flex items-center justify-between cursor-pointer hover:bg-teal/3 transition-colors"
        >
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[10px] text-steel tracking-[0.1em] uppercase text-left">SZJA</p>
              <p className="text-lg font-bold text-cream">{formatCurrency(estimate?.szja ?? 0)}</p>
            </div>
            <div>
              <p className="text-[10px] text-steel tracking-[0.1em] uppercase text-left">JÁRULÉKOK</p>
              <p className="text-lg font-bold text-cream">{formatCurrency((estimate?.tb ?? 0) + (estimate?.szocho ?? 0))}</p>
            </div>
            {(estimate?.hipa ?? 0) > 0 && (
              <div>
                <p className="text-[10px] text-steel tracking-[0.1em] uppercase text-left">HIPA</p>
                <p className="text-lg font-bold text-cream">{formatCurrency(estimate?.hipa ?? 0)}</p>
              </div>
            )}
            {isKivaProfile ? (
              <div>
                <p className="text-[10px] text-steel tracking-[0.1em] uppercase text-left">KIVA</p>
                <p className={`text-lg font-bold ${kivaEstimate?.completeness === 'missing' ? 'text-amber-400' : 'text-cream'}`}>{kivaHeaderText}</p>
              </div>
            ) : (estimate?.egyebAdo ?? 0) > 0 && (
              <div>
                <p className="text-[10px] text-steel tracking-[0.1em] uppercase text-left">{profileSummary?.forma === 'KIVA' ? 'KIVA' : 'TAO'}</p>
                <p className="text-lg font-bold text-cream">{formatCurrency(estimate?.egyebAdo ?? 0)}</p>
              </div>
            )}
            <div className="pl-4 border-l border-teal/10">
              <p className="text-[10px] text-steel tracking-[0.1em] uppercase text-left">ÖSSZESEN</p>
              <p className="text-lg font-bold text-teal">{formatCurrency(estimate?.osszesen ?? 0)}</p>
            </div>

            {/* ÁFA pill */}
            {vatStatus === 'standard' && typeof vatBalance === 'number' && (
              <div className="pl-4 border-l border-teal/10">
                <p className="text-[10px] text-steel tracking-[0.1em] uppercase text-left">ÁFA BEFIZETENDŐ</p>
                <p className={`text-lg font-bold ${vatBalance > 0 ? 'text-cream' : 'text-emerald-400'}`}>{formatCurrency(vatBalance)}</p>
              </div>
            )}
            {vatStatus === 'exempt' && (
              <div className="pl-4 border-l border-teal/10">
                <p className="text-[10px] text-steel tracking-[0.1em] uppercase text-left">ÁFA</p>
                <p className="text-sm font-medium text-steel">Alanyi mentes</p>
              </div>
            )}

            {/* Warnings inline */}
            {warnings.length > 0 && (
              <div className="flex items-center gap-1.5 ml-2">
                {warnings.map((w, i) => (
                  <span
                    key={i}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                      w.severity === 'danger' ? 'bg-red-500/15 text-red-400' :
                      w.severity === 'warning' ? 'bg-amber-500/15 text-amber-400' :
                      'bg-blue-500/15 text-blue-400'
                    }`}
                    title={w.message}
                  >
                    <AlertTriangle width={10} height={10} />
                    {w.severity === 'danger' ? 'Túllépés!' : 'Figyelem'}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={e => { e.stopPropagation(); setShowWizard(true); }}
              className="p-1.5 rounded-lg hover:bg-teal/10 text-steel hover:text-cream transition-colors cursor-pointer"
              title="Profil szerkesztése"
            >
              <Settings width={14} height={14} />
            </button>
            <ChevronDown width={16} height={16} className={`text-steel transition-transform duration-300 ease-out ${expanded ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {/* Expanded content — animated */}
        <div
          className="grid transition-[grid-template-rows] duration-300 ease-out"
          style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
          <div className={`px-5 pb-5 space-y-4 border-t border-teal/8 pt-4 transition-opacity duration-300 ${expanded ? 'opacity-100' : 'opacity-0'}`}>
            {/* Profile card */}
            {profileSummary && (
              <div className="bg-teal/5 rounded-lg p-3 flex items-center gap-4 text-xs" style={animateIn ? { animation: 'taxFadeSlide 300ms ease-out both', animationDelay: '50ms' } : undefined}>
                <div className="flex items-center gap-1.5 text-cream">
                  <Building2 width={12} height={12} className="text-teal" />
                  <span className="font-medium">{profileSummary.tipus}</span>
                  <span className="text-steel">•</span>
                  <span>{profileSummary.forma}</span>
                </div>
                {profileSummary.telepules && (
                  <div className="flex items-center gap-1 text-steel">
                    <MapPin width={10} height={10} />
                    <span>{profileSummary.telepules}</span>
                  </div>
                )}
              </div>
            )}

            {/* ÁFA szekció */}
            <VatPanel
              vatStatus={vatStatus}
              yearlyRevenue={yearlyRevenue}
              yearlyNetRevenue={yearlyNetRevenue}
              vatPayable={vatPayable}
              vatDeductible={vatDeductible}
              vatBalance={vatBalance}
              animateIn={animateIn}
              onChanged={onVatChanged}
            />

            {isKivaProfile && (
              <KivaPanel
                estimate={kivaEstimate}
                adjustments={kivaAdjustments}
                periods={kivaPeriods}
                animateIn={animateIn}
                onEdit={() => setShowKivaEditor(true)}
              />
            )}

            {/* Warnings detail */}
            {warnings.length > 0 && (
              <div className="space-y-1.5" style={animateIn ? { animation: 'taxFadeSlide 300ms ease-out both', animationDelay: '100ms' } : undefined}>
                {warnings.map((w, i) => (
                  <div
                    key={i}
                    className={`px-3 py-2 rounded-lg text-xs flex items-center gap-2 ${
                      w.severity === 'danger' ? 'bg-red-500/10 text-red-400' :
                      w.severity === 'warning' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-blue-500/10 text-blue-400'
                    }`}
                  >
                    <AlertTriangle width={12} height={12} />
                    {w.message}
                  </div>
                ))}
              </div>
            )}

            {/* Quarter breakdown */}
            {estimate && estimate.negyedevek.length > 0 && (
              <div>
                <p className="text-[10px] text-steel tracking-[0.1em] uppercase mb-2">NEGYEDÉVES BONTÁS</p>
                <div className="grid grid-cols-4 gap-2">
                  {estimate.negyedevek.map((q, qi) => (
                    <div key={q.quarter} className="bg-surface-900/40 rounded-lg p-3" style={animateIn ? { animation: 'taxFadeSlide 300ms ease-out both', animationDelay: `${150 + qi * 60}ms` } : undefined}>
                      <p className="text-[10px] text-steel mb-1">Q{q.quarter}</p>
                      <p className="text-sm font-bold text-cream">{formatCurrency(q.osszesen)}</p>
                      <div className="mt-1.5 space-y-0.5 text-[10px] text-steel/60">
                        <div className="flex justify-between"><span>SZJA</span><span>{formatCurrency(q.szja)}</span></div>
                        <div className="flex justify-between"><span>TB+SZ</span><span>{formatCurrency(q.tb + q.szocho)}</span></div>
                        {q.hipa > 0 && <div className="flex justify-between"><span>HIPA</span><span>{formatCurrency(q.hipa)}</span></div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tax form comparison */}
            {comparison.length > 1 && (
              <div>
                <p className="text-[10px] text-steel tracking-[0.1em] uppercase mb-2 flex items-center gap-1">
                  <TrendingUp width={10} height={10} /> ADÓFORMA ÖSSZEHASONLÍTÁS
                </p>
                <p className="text-[10px] text-steel/50 mb-3">
                  Becsült éves adóteher {formatCurrency(yearlyRevenue)} bevétel alapján{profileSummary ? `, ${profileSummary.foglalkozas === 'mellekfoglalkozasu' ? 'mellékfoglalkozásúként' : 'főfoglalkozásúként'}, ${profileSummary.szakkepzettseg ? 'szakképzettséggel' : 'szakképzettség nélkül'}` : ''}. A tényleges összegek eltérhetnek.
                </p>
                <div className="space-y-2">
                  {[...comparison]
                    .sort((a, b) => {
                      if (a.status === 'needs_data' && b.status !== 'needs_data') return 1;
                      if (a.status !== 'needs_data' && b.status === 'needs_data') return -1;
                      return a.osszesen - b.osszesen;
                    })
                    .map((c, i, arr) => {
                      const isActive = profileSummary?.forma === c.label.split(' ')[0] ||
                        (profileSummary?.forma === 'Átalányadó' && c.forma === 'atalany') ||
                        (profileSummary?.forma === 'VSZJA' && c.forma === 'vszja') ||
                        (profileSummary?.forma === c.forma);
                      const bestReadyIndex = arr.findIndex(item => item.status !== 'needs_data');
                      const isBest = c.status !== 'needs_data' && i === bestReadyIndex;
                      const d = c.reszletek;
                      return (
                        <div
                          key={c.forma}
                          className={`px-3 py-2.5 rounded-lg text-xs ${
                            isActive ? 'bg-teal/10 border border-teal/20' : 'bg-surface-900/30'
                          }`}
                          style={animateIn ? { animation: 'taxFadeSlide 300ms ease-out both', animationDelay: `${400 + i * 80}ms` } : undefined}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              {isBest && <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-medium">Legkedvezőbb</span>}
                              <span className={isActive ? 'text-cream font-medium' : 'text-steel'}>{c.label}</span>
                              {isActive && <span className="text-[9px] text-teal">(Jelenlegi)</span>}
                            </div>
                            <span className={c.status === 'needs_data' ? 'text-amber-400 font-medium' : isActive ? 'text-cream font-bold' : 'text-steel font-medium'}>
                              {c.status === 'needs_data' ? 'Adat szükséges' : formatCurrency(c.osszesen)}
                            </span>
                          </div>
                          {c.note && (
                            <p className={`text-[10px] mb-1.5 ${c.status === 'needs_data' ? 'text-amber-300/80' : 'text-steel/50'}`}>{c.note}</p>
                          )}
                          {/* Description + breakdown */}
                          {c.status !== 'needs_data' && c.forma === 'atalany' && (
                            <div className="text-[10px] text-steel/50 space-y-1">
                              <p>Egyéni vállalkozóknak. A bevétel {Math.round((d.koltseghanyad as number ?? 0.45) * 100)}%-a költséghányad, a maradék az adóköteles jövedelem. Adómentes sáv: {formatCurrency(d.adomentesSav as number ?? 0)}.</p>
                              <div className="flex gap-3 pt-0.5">
                                <span>SZJA: {formatCurrency(d.szja as number ?? 0)}</span>
                                <span>TB: {formatCurrency(d.tb as number ?? 0)}</span>
                                <span>SZOCHO: {formatCurrency(d.szocho as number ?? 0)}</span>
                              </div>
                            </div>
                          )}
                          {c.status !== 'needs_data' && c.forma === 'vszja' && (
                            <div className="text-[10px] text-steel/50 space-y-1">
                              <p>Egyéni vállalkozóknak, tételes költségelszámolással. A vállalkozói jövedelem után 9%, a kivét után SZJA + járulékok.</p>
                              <div className="flex gap-3 pt-0.5">
                                <span>Váll. SZJA (9%): {formatCurrency(d.vallSzja as number ?? 0)}</span>
                                <span>Kivét SZJA: {formatCurrency(d.kivetSzja as number ?? 0)}</span>
                                <span>TB+SZOCHO: {formatCurrency((d.kivetTb as number ?? 0) + (d.kivetSzocho as number ?? 0))}</span>
                              </div>
                            </div>
                          )}
                          {c.status !== 'needs_data' && c.forma === 'TAO' && (
                            <div className="text-[10px] text-steel/50 space-y-1">
                              <p>Társasági adó (Kft/Bt). TAO 9% az eredmény után, az osztalék után SZJA 15% + SZOCHO 13% (plafonig). 70%-os osztalék-kifizetéssel kalkulálva.</p>
                              <div className="flex gap-3 pt-0.5">
                                <span>TAO: {formatCurrency(d.tao as number ?? 0)}</span>
                                <span>Osztalék SZJA: {formatCurrency(d.osztalekSzja as number ?? 0)}</span>
                                <span>Osztalék SZOCHO: {formatCurrency(d.osztalekSzocho as number ?? 0)}</span>
                              </div>
                            </div>
                          )}
                          {c.status !== 'needs_data' && c.forma === 'KIVA' && (
                            <div className="text-[10px] text-steel/50 space-y-1">
                              <p>KIVA 10% a személyi jellegű kifizetések és az AAN/AACS korrekciók alapján, a minimum adóalap szabály figyelembevételével.</p>
                              <div className="flex gap-3 pt-0.5">
                                <span>Személyi: {formatCurrency(d.szemelyiKifizetesek as number ?? 0)}</span>
                                <span>KIVA alap: {formatCurrency(d.kivaAlap as number ?? 0)}</span>
                                <span>KIVA: {formatCurrency(d.kiva as number ?? 0)}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
                <p className="text-[10px] text-steel/40 mt-3 leading-relaxed">
                  Az összehasonlítás tájékoztató jellegű. A Kft opció nem tartalmazza a könyvelői díjat, alapítási költséget és adminisztrációs terheket. A VSZJA a rögzített kiadásokat használja költségként — ha nincs rögzített kiadás, 0 Ft költséggel számol. A TAO kalkuláció 70%-os osztalékkifizetéssel számol. A KIVA csak akkor jelenik meg összeggel, ha van értelmezhető személyi jellegű kifizetési alap vagy rögzített KIVA korrekció.
                </p>
              </div>
            )}
          </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes taxFadeSlide {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {showWizard && <TaxProfileWizard onClose={() => setShowWizard(false)} onSaved={handleWizardSaved} />}
      {showKivaEditor && (
        <KivaEditorModal
          year={currentYear}
          estimate={kivaEstimate}
          periods={kivaPeriods}
          adjustments={kivaAdjustments}
          onClose={() => setShowKivaEditor(false)}
          onSaved={() => {
            loadData();
          }}
        />
      )}
    </>
  );
}

function KivaPanel({
  estimate,
  adjustments,
  periods,
  animateIn,
  onEdit,
}: {
  estimate: KivaEstimateRow | null;
  adjustments: KivaAdjustmentRow[];
  periods: KivaPeriodRow[];
  animateIn: boolean;
  onEdit: () => void;
}) {
  const status = !estimate || estimate.completeness === 'missing'
    ? 'Adat szükséges'
    : adjustments.length > 0 || periods.some(p => p.personal_payments_mode !== 'auto')
      ? 'Pontosított becslés'
      : 'Automatikus becslés';

  return (
    <div className="bg-surface-900/35 rounded-lg border border-teal/8 p-3" style={animateIn ? { animation: 'taxFadeSlide 300ms ease-out both', animationDelay: '90ms' } : undefined}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] text-steel tracking-[0.1em] uppercase">KIVA</p>
          <p className="text-[11px] text-steel/60">{status}</p>
        </div>
        <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-teal/10 text-steel hover:text-cream transition-colors cursor-pointer" title="KIVA adatok szerkesztése">
          <Settings width={14} height={14} />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-3">
        <KivaMetric label="Személyi" value={formatCurrency(estimate?.annualPersonalPaymentsHuf ?? 0)} />
        <KivaMetric label="AAN" value={formatCurrency(estimate?.annualAanTotalHuf ?? 0)} />
        <KivaMetric label="AACS" value={formatCurrency(estimate?.annualAacsTotalHuf ?? 0)} />
        <KivaMetric label="KIVA" value={estimate?.completeness === 'missing' ? 'Adat kell' : formatCurrency(estimate?.annualTaxHuf ?? 0)} highlight />
      </div>

      {estimate && estimate.periods.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {estimate.periods.map(period => (
            <div key={period.quarter} className="rounded-lg bg-surface-800/45 px-2.5 py-2 border border-teal/5">
              <p className="text-[10px] text-steel/70">Q{period.quarter}</p>
              <p className="text-xs font-semibold text-cream">{formatCurrency(period.taxHuf)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function KivaMetric({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg bg-surface-800/45 px-2.5 py-2 border border-teal/5 min-w-0">
      <p className="text-[10px] text-steel/70 uppercase truncate">{label}</p>
      <p className={`text-xs font-semibold truncate ${highlight ? 'text-teal' : 'text-cream'}`}>{value}</p>
    </div>
  );
}

function KivaEditorModal({
  year,
  estimate,
  periods,
  adjustments,
  onClose,
  onSaved,
}: {
  year: number;
  estimate: KivaEstimateRow | null;
  periods: KivaPeriodRow[];
  adjustments: KivaAdjustmentRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<1 | 2 | 3 | 4 | 'annual'>(1);
  const selectedPeriod = typeof selected === 'number' ? periods.find(p => p.quarter === selected) : null;
  const selectedEstimate = typeof selected === 'number' ? estimate?.periods.find(p => p.quarter === selected) : null;
  const selectedAdjustments = adjustments.filter(a => selected === 'annual' ? a.quarter === null : a.quarter === selected);
  const [mode, setMode] = useState<KivaPersonalPaymentsMode>(selectedPeriod?.personal_payments_mode ?? 'auto');
  const [manual, setManual] = useState(selectedPeriod?.manual_personal_payments_huf?.toString() ?? '');
  const [adjustmentType, setAdjustmentType] = useState<KivaAdjustmentType>('AAN');
  const [category, setCategory] = useState(KIVA_ADJUSTMENT_OPTIONS.AAN[0].value);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const nextPeriod = typeof selected === 'number' ? periods.find(p => p.quarter === selected) : null;
    setMode(nextPeriod?.personal_payments_mode ?? 'auto');
    setManual(nextPeriod?.manual_personal_payments_huf?.toString() ?? '');
  }, [selected, periods]);

  const tabs: Array<1 | 2 | 3 | 4 | 'annual'> = [1, 2, 3, 4, 'annual'];
  const categories = KIVA_ADJUSTMENT_OPTIONS[adjustmentType];

  const savePeriod = async () => {
    if (typeof selected !== 'number') return;
    setSaving(true);
    await window.electronAPI.saveKivaPeriod(undefined, {
      year,
      quarter: selected,
      manualPersonalPaymentsHuf: manual ? parseCurrencyNumber(manual) : null,
      personalPaymentsMode: mode,
    });
    setSaving(false);
    onSaved();
  };

  const addAdjustment = async () => {
    const value = parseCurrencyNumber(amount);
    if (!value || value <= 0) return;
    setSaving(true);
    await window.electronAPI.createKivaAdjustment(undefined, {
      year,
      quarter: selected === 'annual' ? undefined : selected,
      type: adjustmentType,
      category,
      amountHuf: value,
      note: note.trim() || null,
    });
    setAmount('');
    setNote('');
    setSaving(false);
    onSaved();
  };

  const deleteAdjustment = async (id: string) => {
    setSaving(true);
    await window.electronAPI.deleteKivaAdjustment(undefined, id);
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-surface-800 rounded-2xl ring-1 ring-inset ring-teal/15 w-full max-w-lg shadow-2xl max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="h-1 bg-teal" />
        <div className="p-5 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-pixel text-[14px] text-cream">KIVA adatok</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-teal/10 text-steel hover:text-cream cursor-pointer transition-colors">×</button>
          </div>

          <div className="flex gap-1.5 mb-4">
            {tabs.map(tab => (
              <button key={tab} onClick={() => setSelected(tab)} className={`flex-1 px-2 py-1.5 rounded-lg border text-[11px] transition-colors cursor-pointer ${selected === tab ? 'bg-teal/15 border-teal/40 text-cream' : 'bg-surface-900/30 border-teal/8 text-steel hover:border-teal/25'}`}>
                {tab === 'annual' ? 'Éves' : `Q${tab}`}
              </button>
            ))}
          </div>

          <div className="overflow-y-auto pr-1 space-y-4">
            {typeof selected === 'number' && (
              <div className="rounded-lg bg-surface-900/40 border border-teal/8 p-3">
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <KivaMetric label="Auto" value={formatCurrency(selectedEstimate?.personalPaymentsHuf ?? selectedPeriod?.auto_personal_payments_huf ?? 0)} />
                  <KivaMetric label="Alap" value={formatCurrency(selectedEstimate?.baseHuf ?? 0)} />
                  <KivaMetric label="KIVA" value={formatCurrency(selectedEstimate?.taxHuf ?? 0)} highlight />
                </div>
                <div className="flex gap-2 mb-3">
                  {([
                    { value: 'auto' as const, label: 'Auto' },
                    { value: 'manual' as const, label: 'Kézi' },
                    { value: 'auto_plus_manual' as const, label: 'Auto + kézi' },
                  ]).map(option => (
                    <button key={option.value} onClick={() => setMode(option.value)} className={`flex-1 px-2 py-1.5 rounded-lg border text-[11px] transition-colors cursor-pointer ${mode === option.value ? 'bg-teal/15 border-teal/40 text-cream' : 'bg-surface-800/40 border-teal/8 text-steel hover:border-teal/25'}`}>
                      {option.label}
                    </button>
                  ))}
                </div>
                {mode !== 'auto' && (
                  <div className="flex items-center gap-2 border-b border-teal/10 py-1.5 mb-3">
                    <input value={manual} onChange={e => setManual(e.target.value)} inputMode="numeric" className="flex-1 bg-transparent text-sm text-cream focus:outline-none placeholder:text-steel/40" placeholder="Kézi összeg" />
                    <span className="text-xs text-steel">HUF</span>
                  </div>
                )}
                <button onClick={savePeriod} disabled={saving} className="w-full px-3 py-2 rounded-lg bg-teal/15 hover:bg-teal/25 text-cream text-xs transition-colors cursor-pointer disabled:opacity-60">
                  Mentés
                </button>
              </div>
            )}

            <div className="rounded-lg bg-surface-900/40 border border-teal/8 p-3">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] text-steel tracking-[0.1em] uppercase">AAN / AACS</p>
                <span className="text-[10px] text-steel/60">{selectedAdjustments.length} tétel</span>
              </div>
              <div className="space-y-1.5 mb-3">
                {selectedAdjustments.length === 0 ? (
                  <p className="text-xs text-steel/50 py-2">Nincs korrekció.</p>
                ) : selectedAdjustments.map(item => (
                  <div key={item.id} className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-surface-800/45 border border-teal/5">
                    <div className="min-w-0">
                      <p className="text-xs text-cream truncate">{item.type} · {getKivaAdjustmentCategoryLabel(item.type, item.category)}</p>
                      <p className="text-[10px] text-steel/60 truncate">{item.note || 'Megjegyzés nélkül'}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={item.type === 'AAN' ? 'text-xs text-amber-300' : 'text-xs text-emerald-300'}>{formatCurrency(item.amount_huf)}</span>
                      <button onClick={() => deleteAdjustment(item.id)} className="p-1 rounded hover:bg-red-500/10 text-steel/50 hover:text-red-400 cursor-pointer" title="Törlés"><Trash2 width={12} height={12} /></button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-[80px_1fr] gap-2 mb-2">
                <select
                  value={adjustmentType}
                  onChange={e => {
                    const nextType = e.target.value as KivaAdjustmentType;
                    setAdjustmentType(nextType);
                    setCategory(KIVA_ADJUSTMENT_OPTIONS[nextType][0].value);
                  }}
                  className="bg-surface-800/70 border border-teal/10 rounded-lg px-2 py-1.5 text-xs text-cream focus:outline-none"
                >
                  <option value="AAN">AAN</option>
                  <option value="AACS">AACS</option>
                </select>
                <select value={category} onChange={e => setCategory(e.target.value)} className="min-w-0 bg-surface-800/70 border border-teal/10 rounded-lg px-2 py-1.5 text-xs text-cream focus:outline-none">
                  {categories.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-2 mb-2">
                <input value={amount} onChange={e => setAmount(e.target.value)} inputMode="numeric" className="bg-surface-800/70 border border-teal/10 rounded-lg px-2 py-1.5 text-xs text-cream focus:outline-none placeholder:text-steel/40" placeholder="Összeg" />
                <button onClick={addAdjustment} disabled={saving} className="px-3 py-1.5 rounded-lg bg-teal/15 hover:bg-teal/25 text-cream text-xs transition-colors cursor-pointer disabled:opacity-60" title="Hozzáadás"><Plus width={13} height={13} /></button>
              </div>
              <input value={note} onChange={e => setNote(e.target.value)} className="w-full bg-transparent border-b border-teal/10 py-1.5 text-xs text-cream focus:outline-none placeholder:text-steel/40" placeholder="Megjegyzés" />
            </div>

            {estimate && (
              <div className="grid grid-cols-3 gap-2">
                <KivaMetric label="Éves alap" value={formatCurrency(estimate.annualBaseHuf)} />
                <KivaMetric label="Előlegek" value={formatCurrency(estimate.quarterlyAdvanceTaxHuf)} />
                <KivaMetric label="Eltérés" value={formatCurrency(estimate.settlementDifferenceHuf)} highlight />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function parseCurrencyNumber(value: string): number {
  const normalized = value.replace(/\s/g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

// ----------------------------- ÁFA panel -----------------------------
interface VatPanelProps {
  vatStatus: 'exempt' | 'standard';
  yearlyRevenue: number;
  yearlyNetRevenue?: number;
  vatPayable?: number;
  vatDeductible?: number;
  vatBalance?: number;
  animateIn: boolean;
  onChanged?: () => void;
}

function VatPanel({ vatStatus, yearlyRevenue, yearlyNetRevenue, vatPayable = 0, vatDeductible = 0, vatBalance = 0, animateIn }: VatPanelProps) {
  const { user } = useAuth();
  const rate = typeof user?.vat_rate_default === 'number' ? user.vat_rate_default : 27;
  const vatNumber = user?.vat_number ?? '';

  const aamLimit = 20_000_000;
  const nearLimit = vatStatus === 'exempt' && yearlyRevenue >= aamLimit * 0.8;
  const overLimit = vatStatus === 'exempt' && yearlyRevenue >= aamLimit;

  return (
    <div className="space-y-3" style={animateIn ? { animation: 'taxFadeSlide 300ms ease-out both', animationDelay: '75ms' } : undefined}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-steel tracking-[0.1em] uppercase">ÁFA</p>
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${vatStatus === 'exempt' ? 'bg-teal/15 text-teal' : 'bg-amber-500/15 text-amber-400'}`}>
          {vatStatus === 'exempt' ? 'Alanyi mentes (AAM)' : `Áfakörös · ${rate}%`}
        </span>
      </div>

      {/* AAM limit figyelmeztetés */}
      {(nearLimit || overLimit) && (
        <div className={`px-3 py-2 rounded-lg text-xs flex items-center gap-2 ${overLimit ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
          <AlertTriangle width={12} height={12} />
          {overLimit
            ? `Átlépted az AAM értékhatárt (${formatCurrency(yearlyRevenue)} / ${formatCurrency(aamLimit)}). Kötelező áfakörbe belépni.`
            : `Közeledsz az AAM értékhatárhoz (${formatCurrency(yearlyRevenue)} / ${formatCurrency(aamLimit)}).`}
        </div>
      )}

      {/* Áfakörös mérleg – csak adat */}
      {vatStatus === 'standard' && (
        <div className="space-y-3">
          <div className="bg-surface-900/40 rounded-lg p-3 grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] text-steel tracking-[0.1em] uppercase mb-1">Fizetendő</p>
              <p className="text-sm font-bold text-cream">{formatCurrency(vatPayable)}</p>
              <p className="text-[10px] text-steel/50 mt-0.5">Kiállított számlák áfája</p>
            </div>
            <div>
              <p className="text-[10px] text-steel tracking-[0.1em] uppercase mb-1">Levonható</p>
              <p className="text-sm font-bold text-cream">{formatCurrency(vatDeductible)}</p>
              <p className="text-[10px] text-steel/50 mt-0.5">Költségek visszaigénylés</p>
            </div>
            <div className="pl-3 border-l border-teal/10">
              <p className="text-[10px] text-steel tracking-[0.1em] uppercase mb-1">Egyenleg</p>
              <p className={`text-sm font-bold ${vatBalance > 0 ? 'text-cream' : 'text-emerald-400'}`}>{formatCurrency(vatBalance)}</p>
              <p className="text-[10px] text-steel/50 mt-0.5">{vatBalance > 0 ? 'Befizetendő' : 'Visszaigényelhető'}</p>
            </div>
          </div>

          {vatNumber && (
            <p className="text-[10px] text-steel/50">
              ÁFA adószám: <span className="text-steel">{vatNumber}</span>
            </p>
          )}

          {typeof yearlyNetRevenue === 'number' && (
            <p className="text-[10px] text-steel/50 leading-relaxed">
              Éves nettó árbevétel: <span className="text-steel">{formatCurrency(yearlyNetRevenue)}</span> · Bruttó: <span className="text-steel">{formatCurrency(yearlyRevenue)}</span>. Az áfa bevallás havi, negyedéves vagy éves gyakorisággal esedékes.
            </p>
          )}
        </div>
      )}

      <p className="text-[10px] text-steel/50">
        Az ÁFA státuszt, kulcsot és bevallási gyakoriságot a beállításokban módosíthatod.
      </p>
    </div>
  );
}
