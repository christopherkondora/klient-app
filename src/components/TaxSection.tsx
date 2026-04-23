import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronDown, Settings, AlertTriangle, TrendingUp, Receipt, Building2, MapPin, Check } from 'lucide-react';
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
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 }).format(amount);
}

export default function TaxSection({ yearlyRevenue, yearlyNetRevenue, vatPayable, vatDeductible, vatBalance, vatStatus = 'exempt', onVatChanged }: TaxSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [estimate, setEstimate] = useState<TaxEstimate | null>(null);
  const [warnings, setWarnings] = useState<TaxWarning[]>([]);
  const [comparison, setComparison] = useState<TaxComparison[]>([]);
  const [profileSummary, setProfileSummary] = useState<{ tipus: string; forma: string; telepules: string; foglalkozas: string; szakkepzettseg: boolean } | null>(null);
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

      const [est, warns, comp] = await Promise.all([
        window.electronAPI.getFullTaxEstimate(undefined, currentYear, yearlyRevenue),
        window.electronAPI.getTaxWarnings(undefined, yearlyRevenue, currentYear),
        window.electronAPI.compareTaxForms(yearlyRevenue, 0, currentYear, profile.hipaKulcs),
      ]);
      setEstimate(est);
      setWarnings(warns);
      setComparison(comp);
    } catch (e) {
      console.error('Tax data load error:', e);
    }
  }, [yearlyRevenue, currentYear]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleWizardSaved = () => {
    setShowWizard(false);
    loadData();
  };

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
            {(estimate?.egyebAdo ?? 0) > 0 && (
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
                  {comparison
                    .sort((a, b) => a.osszesen - b.osszesen)
                    .map((c, i) => {
                      const isActive = profileSummary?.forma === c.label.split(' ')[0] ||
                        (profileSummary?.forma === 'Átalányadó' && c.forma === 'atalany') ||
                        (profileSummary?.forma === 'VSZJA' && c.forma === 'vszja') ||
                        (profileSummary?.forma === c.forma);
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
                              {i === 0 && <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-medium">Legkedvezőbb</span>}
                              <span className={isActive ? 'text-cream font-medium' : 'text-steel'}>{c.label}</span>
                              {isActive && <span className="text-[9px] text-teal">(Jelenlegi)</span>}
                            </div>
                            <span className={isActive ? 'text-cream font-bold' : 'text-steel font-medium'}>{formatCurrency(c.osszesen)}</span>
                          </div>
                          {/* Description + breakdown */}
                          {c.forma === 'atalany' && (
                            <div className="text-[10px] text-steel/50 space-y-1">
                              <p>Egyéni vállalkozóknak. A bevétel {Math.round((d.koltseghanyad as number ?? 0.45) * 100)}%-a költséghányad, a maradék az adóköteles jövedelem. Adómentes sáv: {formatCurrency(d.adomentesSav as number ?? 0)}.</p>
                              <div className="flex gap-3 pt-0.5">
                                <span>SZJA: {formatCurrency(d.szja as number ?? 0)}</span>
                                <span>TB: {formatCurrency(d.tb as number ?? 0)}</span>
                                <span>SZOCHO: {formatCurrency(d.szocho as number ?? 0)}</span>
                              </div>
                            </div>
                          )}
                          {c.forma === 'vszja' && (
                            <div className="text-[10px] text-steel/50 space-y-1">
                              <p>Egyéni vállalkozóknak, tételes költségelszámolással. A vállalkozói jövedelem után 9%, a kivét után SZJA + járulékok.</p>
                              <div className="flex gap-3 pt-0.5">
                                <span>Váll. SZJA (9%): {formatCurrency(d.vallSzja as number ?? 0)}</span>
                                <span>Kivét SZJA: {formatCurrency(d.kivetSzja as number ?? 0)}</span>
                                <span>TB+SZOCHO: {formatCurrency((d.kivetTb as number ?? 0) + (d.kivetSzocho as number ?? 0))}</span>
                              </div>
                            </div>
                          )}
                          {c.forma === 'TAO' && (
                            <div className="text-[10px] text-steel/50 space-y-1">
                              <p>Társasági adó (Kft/Bt). TAO 9% az eredmény után, az osztalék után SZJA 15% + SZOCHO 13% (plafonig). 70%-os osztalék-kifizetéssel kalkulálva.</p>
                              <div className="flex gap-3 pt-0.5">
                                <span>TAO: {formatCurrency(d.tao as number ?? 0)}</span>
                                <span>Osztalék SZJA: {formatCurrency(d.osztalekSzja as number ?? 0)}</span>
                                <span>Osztalék SZOCHO: {formatCurrency(d.osztalekSzocho as number ?? 0)}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
                <p className="text-[10px] text-steel/40 mt-3 leading-relaxed">
                  Az összehasonlítás tájékoztató jellegű. A Kft opció nem tartalmazza a könyvelői díjat, alapítási költséget és adminisztrációs terheket. A VSZJA a rögzített kiadásokat használja költségként — ha nincs rögzített kiadás, 0 Ft költséggel számol. A TAO kalkuláció 70%-os osztalékkifizetéssel számol.
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
    </>
  );
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

  // AAM 12M Ft limit
  const aamLimit = 12_000_000;
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
            ? `Átlépted a 12M Ft-os AAM limitet (${formatCurrency(yearlyRevenue)}). Kötelező áfakörbe belépni.`
            : `Közeledsz a 12M Ft-os AAM limithez (${formatCurrency(yearlyRevenue)} / 12 000 000 Ft).`}
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
              Éves nettó árbevétel: <span className="text-steel">{formatCurrency(yearlyNetRevenue)}</span> · Bruttó: <span className="text-steel">{formatCurrency(yearlyRevenue)}</span>. Az áfa bevallás negyedévente vagy havonta esedékes a vállalkozás forgalmától függően.
            </p>
          )}
        </div>
      )}

      <p className="text-[10px] text-steel/50">
        Az ÁFA státuszt és a kulcsot a beállításokban módosíthatod.
      </p>
    </div>
  );
}
