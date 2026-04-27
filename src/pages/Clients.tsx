import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useThemedColor } from '../utils/colors';
import { useAuth } from '../contexts/AuthContext';
import {
  Plus, Search, Mail, Phone, Building2, Trash2, SquarePen,
  LayoutGrid, List, Briefcase, ChevronRight, X, AlertTriangle,
  Globe, Check, Loader2,
} from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';
import { hu } from 'date-fns/locale';
import HexColorPicker from '../components/HexColorPicker';
import ConfirmDialog from '../components/ConfirmDialog';
import PageHeader from '../components/PageHeader';
import { EU_COUNTRIES_WITH_HU } from '../utils/vat';

const COLORS = ['#598392', '#AEC3B0', '#124559', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6'];

/** Ország-lista számlázáshoz. Sorrend: HU először, EU tagállamok, egyéb. */
const COUNTRIES: { code: string; name: string; flag: string }[] = [
  { code: 'HU', name: 'Magyarország', flag: '🇭🇺' },
  { code: 'AT', name: 'Ausztria', flag: '🇦🇹' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪' },
  { code: 'BG', name: 'Bulgária', flag: '🇧🇬' },
  { code: 'HR', name: 'Horvátország', flag: '🇭🇷' },
  { code: 'CY', name: 'Ciprus', flag: '🇨🇾' },
  { code: 'CZ', name: 'Csehország', flag: '🇨🇿' },
  { code: 'DK', name: 'Dánia', flag: '🇩🇰' },
  { code: 'EE', name: 'Észtország', flag: '🇪🇪' },
  { code: 'FI', name: 'Finnország', flag: '🇫🇮' },
  { code: 'FR', name: 'Franciaország', flag: '🇫🇷' },
  { code: 'DE', name: 'Németország', flag: '🇩🇪' },
  { code: 'GR', name: 'Görögország', flag: '🇬🇷' },
  { code: 'IE', name: 'Írország', flag: '🇮🇪' },
  { code: 'IT', name: 'Olaszország', flag: '🇮🇹' },
  { code: 'LV', name: 'Lettország', flag: '🇱🇻' },
  { code: 'LT', name: 'Litvánia', flag: '🇱🇹' },
  { code: 'LU', name: 'Luxemburg', flag: '🇱🇺' },
  { code: 'MT', name: 'Málta', flag: '🇲🇹' },
  { code: 'NL', name: 'Hollandia', flag: '🇳🇱' },
  { code: 'PL', name: 'Lengyelország', flag: '🇵🇱' },
  { code: 'PT', name: 'Portugália', flag: '🇵🇹' },
  { code: 'RO', name: 'Románia', flag: '🇷🇴' },
  { code: 'SK', name: 'Szlovákia', flag: '🇸🇰' },
  { code: 'SI', name: 'Szlovénia', flag: '🇸🇮' },
  { code: 'ES', name: 'Spanyolország', flag: '🇪🇸' },
  { code: 'SE', name: 'Svédország', flag: '🇸🇪' },
  { code: 'GB', name: 'Egyesült Királyság', flag: '🇬🇧' },
  { code: 'CH', name: 'Svájc', flag: '🇨🇭' },
  { code: 'US', name: 'Egyesült Államok', flag: '🇺🇸' },
  { code: 'CA', name: 'Kanada', flag: '🇨🇦' },
  { code: 'NO', name: 'Norvégia', flag: '🇳🇴' },
  { code: 'IS', name: 'Izland', flag: '🇮🇸' },
  { code: 'UA', name: 'Ukrajna', flag: '🇺🇦' },
  { code: 'RS', name: 'Szerbia', flag: '🇷🇸' },
];

const CURRENCIES = ['HUF', 'EUR', 'USD', 'GBP', 'CHF'];
const INVOICE_LANGUAGES = [
  { code: 'hu', label: 'Magyar' },
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
];

/** Billing completeness check — tax_number only mandatory for HU clients. */
function isBillingIncomplete(c: Client): boolean {
  if (!c.postal_code?.trim() || !c.city?.trim() || !c.street?.trim()) return true;
  const cc = c.country_code || 'HU';
  if (cc === 'HU' && !c.tax_number?.trim()) return true;
  return false;
}

export default function Clients() {
  const navigate = useNavigate();
  const tc = useThemedColor();
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [view, setView] = useState<'grid' | 'list'>(() =>
    (localStorage.getItem('clients-view') as 'grid' | 'list') || 'grid'
  );

  useEffect(() => {
    loadData();
  }, []);

  function setViewMode(mode: 'grid' | 'list') {
    setView(mode);
    localStorage.setItem('clients-view', mode);
  }

  async function loadData() {
    try {
      const [clientsData, projectsData, invoicesData] = await Promise.all([
        window.electronAPI.getClients(),
        window.electronAPI.getProjects(),
        window.electronAPI.getInvoices(),
      ]);
      setClients(clientsData);
      setProjects(projectsData);
      setInvoices(invoicesData);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(formData: Partial<Client>) {
    try {
      if (editingClient) {
        await window.electronAPI.updateClient(editingClient.id, formData);
      } else {
        await window.electronAPI.createClient(formData);
      }
      setShowForm(false);
      setEditingClient(null);
      loadData();
    } catch (err) {
      console.error('Failed to save client:', err);
    }
  }

  async function handleDelete(id: string) {
    try {
      await window.electronAPI.deleteClient(id);
      setDeleteId(null);
      loadData();
    } catch (err) {
      console.error('Failed to delete client:', err);
    }
  }

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.company?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  // Enriched stats per client
  const clientStats = useMemo(() => {
    const map = new Map<string, { activeProjects: number; pendingAmount: number; lastActivity: string | null }>();
    for (const c of clients) {
      const cProjects = projects.filter(p => p.client_id === c.id);
      const activeCount = cProjects.filter(p => p.status === 'active').length;
      const cInvoices = invoices.filter(i => i.client_id === c.id);
      const pendingAmount = cInvoices.filter(i => i.status === 'pending').reduce((sum, i) => sum + (i.amount || 0), 0);

      // Last closed project date
      const closedDates = cProjects
        .map(p => p.closed_at)
        .filter(Boolean) as string[];
      const lastActivity = closedDates.length > 0
        ? closedDates.sort().reverse()[0]
        : null;

      map.set(c.id, { activeProjects: activeCount, pendingAmount, lastActivity });
    }
    return map;
  }, [clients, projects, invoices]);

  function formatCurrency(amount: number) {
    const formatted = new Intl.NumberFormat('hu-HU').format(amount);
    return `${formatted} Ft`;
  }

  const billingActive = user?.invoice_platform && user.invoice_platform !== 'none';

  const incompleteClients = useMemo(() => {
    if (!billingActive) return [];
    return clients.filter(isBillingIncomplete);
  }, [clients, billingActive]);

  function formatActivity(dateStr: string | null) {
    if (!dateStr) return 'Új ügyfél';
    try {
      const days = differenceInDays(new Date(), parseISO(dateStr));
      if (days === 0) return 'Ma';
      if (days === 1) return '1 napja';
      return `${days} napja`;
    } catch {
      return 'Nincs adat';
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-steel"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <PageHeader
        title="Ügyfelek"
        subtitle={`${clients.length} ügyfél`}
        actions={(
          <button
          onClick={() => { setEditingClient(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-teal text-cream rounded-lg text-sm font-medium hover:bg-teal/80 transition-colors"
        >
          <Plus width={16} height={16} />
          Új ügyfél
        </button>
        )}
      />

      {/* Search + View Toggle */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search width={16} height={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-steel" />
          <input
            type="text"
            placeholder="Keresés név, cég vagy email alapján..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-surface-800/50 border border-teal/10 rounded-lg text-sm text-cream placeholder:text-steel/50 focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal/30"
          />
        </div>
        <div className="flex bg-surface-800/50 border border-teal/10 rounded-lg">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-3 rounded-l-md transition-colors ${view === 'grid' ? 'bg-teal/20 text-cream' : 'text-steel hover:text-ash'}`}
            title="Rács nézet"
          >
            <LayoutGrid width={16} height={16} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-3 rounded-r-md transition-colors ${view === 'list' ? 'bg-teal/20 text-cream' : 'text-steel hover:text-ash'}`}
            title="Lista nézet"
          >
            <List width={16} height={16} />
          </button>
        </div>
      </div>

      {/* Missing billing fields warning */}
      {incompleteClients.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3 flex items-start gap-3">
          <AlertTriangle width={16} height={16} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="text-amber-300 font-medium">Hiányos számlázási adatok</p>
            <p className="text-amber-400/70 text-xs mt-1">
              {incompleteClients.length} ügyfélnél hiányzik az adószám, irányítószám, helység vagy utca.
              Számlát csak teljes adatokkal rendelkező ügyfeleknek lehet kiállítani.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {incompleteClients.slice(0, 5).map(c => (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/15 rounded text-[11px] text-amber-300 cursor-pointer hover:bg-amber-500/25 transition-colors"
                  onClick={() => navigate(`/clients/${c.id}`)}
                >
                  {c.name}
                </span>
              ))}
              {incompleteClients.length > 5 && (
                <span className="text-[11px] text-amber-400/60">+{incompleteClients.length - 5} további</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted text-sm">
            {search ? 'Nincs találat a keresésre' : 'Még nincsenek ügyfelek. Adj hozzá egyet!'}
          </p>
        </div>
      ) : view === 'grid' ? (
        /* ── Grid View ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(client => {
            const stats = clientStats.get(client.id);
            const isActive = (stats?.activeProjects ?? 0) > 0;
            const isIncomplete = billingActive && isBillingIncomplete(client);
            return (
              <div
                key={client.id}
                className={`relative bg-surface-800/50 rounded-lg border overflow-hidden hover:border-teal/25 transition-colors duration-200 cursor-pointer group ${isIncomplete ? 'border-amber-500/20' : 'border-teal/10'}`}
                onClick={() => navigate(`/clients/${client.id}`)}
              >
                {/* Animated left accent strip — absolute so it never shifts layout */}
                <div className="absolute left-0 inset-y-0 w-[3px] bg-steel origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] rounded-r-full" />
                {/* Top: Avatar + Identity */}
                <div className="p-5 pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3.5">
                      <div className="relative">
                        <div
                          className="w-12 h-12 rounded-lg flex items-center justify-center text-ink font-bold text-base shrink-0"
                          style={{ backgroundColor: tc(client.color) }}
                        >
                          {client.name.charAt(0)}
                        </div>
                        {isIncomplete && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center" title="Hiányos számlázási adatok">
                            <AlertTriangle width={10} height={10} className="text-ink" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-cream">{client.name}</h3>
                          <div className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-emerald-400' : 'bg-steel/40'}`} />
                        </div>
                        {client.company && (
                          <p className="text-muted text-xs mt-0.5">{client.company}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => { setEditingClient(client); setShowForm(true); }}
                        className="p-1.5 rounded-lg hover:bg-teal/10 text-steel"
                      >
                        <SquarePen width={13} height={13} />
                      </button>
                      <button
                        onClick={() => setDeleteId(client.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-steel hover:text-red-400"
                      >
                        <Trash2 width={13} height={13} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Bottom: Quick Stats */}
                <div className="border-t border-teal/8 px-5 py-3 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 text-steel">
                    <Briefcase width={11} height={11} />
                    <span>{stats?.activeProjects ?? 0} aktív</span>
                  </div>
                  <div className={`font-medium ${(stats?.pendingAmount ?? 0) > 0 ? 'text-amber-400' : 'text-muted-soft'}`}>
                    {(stats?.pendingAmount ?? 0) > 0 ? formatCurrency(stats!.pendingAmount) : 'Rendben'}
                  </div>
                  <div className="text-muted-soft">
                    {formatActivity(stats?.lastActivity ?? null)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── List View ── */
        <div className="space-y-1.5">
          {filtered.map(client => {
            const stats = clientStats.get(client.id);
            const isActive = (stats?.activeProjects ?? 0) > 0;
            const isIncomplete = billingActive && isBillingIncomplete(client);
            return (
              <div
                key={client.id}
                onClick={() => navigate(`/clients/${client.id}`)}
                className={`relative flex items-center gap-4 bg-surface-800/50 rounded-lg border overflow-hidden px-5 py-3.5 hover:border-teal/25 transition-colors duration-200 cursor-pointer group ${isIncomplete ? 'border-amber-500/20' : 'border-teal/10'}`}
              >
                {/* Animated left accent strip */}
                <div className="absolute left-0 inset-y-0 w-[3px] bg-steel origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] rounded-r-full" />
                {/* Avatar */}
                <div className="relative">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-ink font-bold text-sm shrink-0"
                    style={{ backgroundColor: tc(client.color) }}
                  >
                    {client.name.charAt(0)}
                  </div>
                  {isIncomplete && (
                    <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 rounded-full flex items-center justify-center" title="Hiányos számlázási adatok">
                      <AlertTriangle width={9} height={9} className="text-ink" />
                    </div>
                  )}
                </div>

                {/* Name + Company */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-cream truncate">{client.name}</h3>
                    <div className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-emerald-400' : 'bg-steel/40'}`} />
                    {client.company && (
                      <span className="text-muted text-xs shrink-0">· {client.company}</span>
                    )}
                  </div>
                </div>

                {/* Status badge */}
                <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded shrink-0 ${
                  isActive ? 'text-emerald-400 bg-emerald-400/10' : 'text-muted-soft bg-surface-900'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-steel/40'}`} />
                  {isActive ? 'Aktív' : 'Inaktív'}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6 shrink-0 text-xs">
                  <span className="text-muted w-16">
                    {stats?.activeProjects ?? 0} projekt
                  </span>
                  <span className={`w-24 text-right font-medium ${(stats?.pendingAmount ?? 0) > 0 ? 'text-amber-400' : 'text-muted-soft'}`}>
                    {(stats?.pendingAmount ?? 0) > 0 ? formatCurrency(stats!.pendingAmount) : 'Rendben'}
                  </span>
                  <span className="text-muted-soft w-24 text-right">
                    {formatActivity(stats?.lastActivity ?? null)}
                  </span>
                </div>

                {/* Arrow */}
                <ChevronRight width={14} height={14} className="text-steel/30 group-hover:text-steel transition-colors shrink-0" />

                {/* Actions (on hover) */}
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => { setEditingClient(client); setShowForm(true); }}
                    className="p-1.5 rounded-lg hover:bg-teal/10 text-steel"
                  >
                    <SquarePen width={13} height={13} />
                  </button>
                  <button
                    onClick={() => setDeleteId(client.id)}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-steel hover:text-red-400"
                  >
                    <Trash2 width={13} height={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Form */}
      {showForm && (
        <ClientForm
          client={editingClient}
          onSubmit={handleSubmit}
          onClose={() => { setShowForm(false); setEditingClient(null); }}
        />
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <ConfirmDialog
          title="Ügyfél törlése"
          message="Biztosan törölni szeretnéd ezt az ügyfelet? Ez törli az összes hozzá tartozó projektet is."
          confirmLabel="Törlés"
          variant="danger"
          onConfirm={() => handleDelete(deleteId)}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

export function ClientForm({ client, onSubmit, onClose }: { client: Client | null; onSubmit: (data: Partial<Client>) => void; onClose: () => void }) {
  const { user } = useAuth();
  const billingActive = user?.invoice_platform && user.invoice_platform !== 'none';
  const [name, setName] = useState(client?.name || '');
  const [email, setEmail] = useState(client?.email || '');
  const [phone, setPhone] = useState(client?.phone || '');
  const [company, setCompany] = useState(client?.company || '');
  const [address, setAddress] = useState(client?.address || '');
  const [postalCode, setPostalCode] = useState(client?.postal_code || '');
  const [city, setCity] = useState(client?.city || '');
  const [street, setStreet] = useState(client?.street || '');
  const [addressLine2, setAddressLine2] = useState(client?.address_line2 || '');
  const [taxNumber, setTaxNumber] = useState(client?.tax_number || '');
  const [countryCode, setCountryCode] = useState(client?.country_code || 'HU');
  const [euVatNumber, setEuVatNumber] = useState(client?.eu_vat_number || '');
  const [preferredCurrency, setPreferredCurrency] = useState(client?.preferred_currency || 'HUF');
  const [invoiceLanguage, setInvoiceLanguage] = useState(client?.invoice_language || 'hu');
  const [viesChecking, setViesChecking] = useState(false);
  const [viesResult, setViesResult] = useState<'valid' | 'invalid' | 'error' | null>(null);
  const [color, setColor] = useState(client?.color || '#598392');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const COLORS = ['#598392', '#AEC3B0', '#124559', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6'];

  function formatPhoneNumber(raw: string): string {
    const hasLeadingPlus = raw.startsWith('+');
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 0) return hasLeadingPlus ? '+' : '';

    // Hungarian: +36 or 06 prefix
    if (digits.startsWith('36') || digits.startsWith('06')) {
      const rest = digits.slice(2);
      let out = '+36';
      if (rest.length > 0) out += ' ' + rest.slice(0, 2);
      if (rest.length > 2) out += ' ' + rest.slice(2, 5);
      if (rest.length > 5) out += ' ' + rest.slice(5, 9);
      return out;
    }

    // User still typing country code with +
    if (hasLeadingPlus) return '+' + digits;

    // Bare digits (local HU format without prefix)
    let out = digits.slice(0, 2);
    if (digits.length > 2) out += ' ' + digits.slice(2, 5);
    if (digits.length > 5) out += ' ' + digits.slice(5, 9);
    return out;
  }

  function handlePhoneChange(value: string) {
    if (countryCode === 'HU') {
      // Hungarian numbers: structured formatting
      setPhone(formatPhoneNumber(value));
    } else {
      // International: allow +, digits, spaces, hyphens, parens — no forced format
      const cleaned = value.replace(/[^\d\s\-\+\(\)]/g, '').slice(0, 22);
      setPhone(cleaned);
    }
  }

  function handlePostalCodeChange(value: string) {
    // Foreign postal codes can contain letters/spaces (UK, NL, CA) — don't strip
    if (countryCode === 'HU') {
      setPostalCode(value.replace(/\D/g, '').slice(0, 4));
    } else {
      setPostalCode(value.slice(0, 10).toUpperCase());
    }
  }

  function handleCountryChange(newCode: string) {
    setCountryCode(newCode);
    // Reset address fields that are country-specific
    setPostalCode('');
    setCity('');
    // Reset deviza + nyelv to sensible defaults for the new country
    if (newCode === 'HU') {
      setPreferredCurrency('HUF');
      setInvoiceLanguage('hu');
    } else {
      // Keep user selection if already changed; only set default on first foreign switch
      setPreferredCurrency(prev => (prev === 'HUF' ? 'EUR' : prev));
      setInvoiceLanguage(prev => (prev === 'hu' ? 'en' : prev));
    }
    // Clear VIES result
    setViesResult(null);
    setEuVatNumber('');
  }

  useEffect(() => {
    // Zippopotam supports multiple countries; fetch only if format looks valid
    const cc = countryCode.toLowerCase();
    if (!postalCode.trim() || city) return;
    if (cc === 'hu' && !/^\d{4}$/.test(postalCode)) return;
    if (cc !== 'hu' && postalCode.length < 3) return;
    let cancelled = false;
    fetch(`https://api.zippopotam.us/${cc}/${postalCode}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!cancelled && data?.places?.[0]?.['place name']) {
          setCity(data.places[0]['place name']);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [postalCode, countryCode]);

  // Reset VIES state when EU VAT number changes
  useEffect(() => {
    setViesResult(null);
  }, [euVatNumber, countryCode]);

  async function handleViesCheck() {
    const cleaned = euVatNumber.replace(/[\s.-]/g, '').toUpperCase();
    if (cleaned.length < 4) return;
    // Country prefix is the first 2 chars (e.g. "DE123456789"); fall back to client's country_code
    const prefix = /^[A-Z]{2}/.test(cleaned) ? cleaned.slice(0, 2) : countryCode;
    const number = /^[A-Z]{2}/.test(cleaned) ? cleaned.slice(2) : cleaned;
    setViesChecking(true);
    setViesResult(null);
    try {
      // VIES doesn't expose CORS-friendly JSON; use a public REST proxy
      const res = await fetch(`https://api.vatcheckapi.com/v2/check?vat_number=${prefix}${number}`);
      if (res.ok) {
        const data = await res.json();
        setViesResult(data?.valid === true ? 'valid' : 'invalid');
      } else {
        setViesResult('error');
      }
    } catch {
      setViesResult('error');
    } finally {
      setViesChecking(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    if (billingActive) {
      const errors: Record<string, string> = {};
      if (!postalCode.trim()) errors.postalCode = 'Irányítószám megadása kötelező';
      if (!city.trim()) errors.city = 'Helység megadása kötelező';
      if (!street.trim()) errors.street = 'Utca és házszám megadása kötelező';
      // Tax number is only mandatory for HU clients (HU adószám). Foreign clients use EU VAT or are private persons.
      if (countryCode === 'HU' && !taxNumber.trim()) errors.taxNumber = 'Adószám megadása kötelező';
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }
    }
    setFieldErrors({});
    onSubmit({
      name: name.trim(),
      email,
      phone,
      company,
      address,
      postal_code: postalCode,
      city,
      street,
      address_line2: addressLine2,
      tax_number: taxNumber,
      country_code: countryCode,
      eu_vat_number: euVatNumber.trim(),
      preferred_currency: preferredCurrency,
      invoice_language: invoiceLanguage,
      color
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onDoubleClick={onClose}>
      <div
        className="bg-surface-800 rounded-2xl ring-1 ring-inset ring-teal/15 w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onDoubleClick={e => e.stopPropagation()}
      >
        {/* Accent strip */}
        <div className="h-1 bg-teal shrink-0" />

        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden min-h-0">

          {/* Static header */}
          <div className="px-5 pt-5 pb-4 shrink-0">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-pixel text-[14px] text-cream">
                {client ? 'Ügyfél szerkesztése' : 'Új ügyfél'}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-teal/10 text-steel hover:text-cream cursor-pointer transition-colors duration-150 ease-out"
              >
                <X width={14} height={14} />
              </button>
            </div>

            {/* Avatar + Name hero */}
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-ink font-bold text-sm shrink-0 transition-colors duration-150"
                style={{ backgroundColor: color }}
              >
                {name ? name.charAt(0).toUpperCase() : '?'}
              </div>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="flex-1 px-0 py-2 bg-transparent border-b border-teal/15 text-cream text-lg font-medium focus:outline-none focus:border-teal/40 placeholder:text-steel/50 transition-colors"
                placeholder="Ügyfél neve..."
                required
                autoFocus
              />
            </div>
          </div>

          {/* Scrollable body */}
          <div className="px-5 overflow-y-auto flex-1 min-h-0 space-y-4 pb-2">

            {/* Email + Cég */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] text-steel tracking-wider uppercase mb-1 block">Email</span>
                <div className="flex items-center gap-2 border-b border-teal/8 py-1.5">
                  <Mail width={12} height={12} className="text-steel/60 shrink-0" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="flex-1 min-w-0 bg-transparent text-sm text-cream focus:outline-none placeholder:text-steel/40"
                    placeholder="email@example.com"
                  />
                </div>
              </div>
              <div>
                <span className="text-[10px] text-steel tracking-wider uppercase mb-1 block">Cég</span>
                <div className="flex items-center gap-2 border-b border-teal/8 py-1.5">
                  <Building2 width={12} height={12} className="text-steel/60 shrink-0" />
                  <input
                    type="text"
                    value={company}
                    onChange={e => setCompany(e.target.value)}
                    className="flex-1 min-w-0 bg-transparent text-sm text-cream focus:outline-none placeholder:text-steel/40"
                    placeholder="Opcionális"
                  />
                </div>
              </div>
            </div>

            {/* Ország — előbb, hogy a telefon és adószám formázást vezérelje */}
            <div>
              <span className="text-[10px] text-steel tracking-wider uppercase mb-1 flex items-center gap-1.5">
                <Globe width={10} height={10} /> Ország
              </span>
              <select
                value={countryCode}
                onChange={e => handleCountryChange(e.target.value)}
                className="w-full px-0 py-1.5 bg-transparent border-b border-teal/8 text-sm text-cream focus:outline-none focus:border-teal/25 transition-colors cursor-pointer"
              >
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code} className="bg-surface-800">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Telefon + Adószám — ország-tudatos formázással */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] text-steel tracking-wider uppercase mb-1 block">Telefon</span>
                <div className="flex items-center gap-2 border-b border-teal/8 py-1.5">
                  <Phone width={12} height={12} className="text-steel/60 shrink-0" />
                  <input
                    type="text"
                    value={phone}
                    onChange={e => handlePhoneChange(e.target.value)}
                    className="flex-1 min-w-0 bg-transparent text-sm text-cream focus:outline-none placeholder:text-steel/40"
                    placeholder={countryCode === 'HU' ? '+36 12 345 6789' : '+XX XXX XXX XXX'}
                    maxLength={22}
                  />
                </div>
              </div>
              <div>
                <span className={`text-[10px] tracking-wider uppercase mb-1 block ${fieldErrors.taxNumber ? 'text-red-400' : 'text-steel'}`}>
                  {countryCode === 'HU' ? 'Adószám' : 'Adóazonosító'}{' '}
                  {billingActive && countryCode === 'HU' && <span className="text-red-400">*</span>}
                </span>
                <input
                  type="text"
                  value={taxNumber}
                  onChange={e => {
                    if (countryCode === 'HU') {
                      const raw = e.target.value.replace(/[^\d]/g, '').slice(0, 11);
                      let formatted = raw;
                      if (raw.length > 8) formatted = raw.slice(0, 8) + '-' + raw.slice(8);
                      if (raw.length > 9) formatted = raw.slice(0, 8) + '-' + raw.slice(8, 9) + '-' + raw.slice(9);
                      setTaxNumber(formatted);
                    } else {
                      setTaxNumber(e.target.value.slice(0, 32));
                    }
                    setFieldErrors(prev => { const { taxNumber: _, ...rest } = prev; return rest; });
                  }}
                  maxLength={countryCode === 'HU' ? 13 : 32}
                  className={`w-full px-0 py-1.5 bg-transparent border-b text-sm text-cream focus:outline-none transition-colors ${fieldErrors.taxNumber ? 'border-red-400/60 focus:border-red-400' : 'border-teal/8 focus:border-teal/25'} placeholder:text-steel/40`}
                  placeholder={countryCode === 'HU' ? '12345678-1-23' : 'pl. FI12345678'}
                />
                {fieldErrors.taxNumber && <span className="text-[10px] text-red-400 mt-0.5 block">{fieldErrors.taxNumber}</span>}
              </div>
            </div>

            {/* EU ÁFA szám — csak EU, nem HU */}
            {countryCode !== 'HU' && EU_COUNTRIES_WITH_HU.has(countryCode) && (
              <div>
                <span className="text-[10px] text-steel tracking-wider uppercase mb-1 block">
                  EU ÁFA szám{' '}
                  <span className="text-steel/40 normal-case tracking-normal font-normal">(B2B fordított adózáshoz)</span>
                </span>
                <div className="flex items-center gap-2 border-b border-teal/8 py-1.5">
                  <input
                    type="text"
                    value={euVatNumber}
                    onChange={e => setEuVatNumber(e.target.value.toUpperCase().slice(0, 20))}
                    className="flex-1 min-w-0 bg-transparent text-sm text-cream focus:outline-none placeholder:text-steel/40 uppercase"
                    placeholder={`${countryCode}123456789`}
                  />
                  {euVatNumber.trim().length >= 4 && (
                    <button
                      type="button"
                      onClick={handleViesCheck}
                      disabled={viesChecking}
                      className="text-[10px] px-2 py-1 rounded bg-teal/10 text-teal hover:bg-teal/20 transition-colors duration-150 ease-out cursor-pointer disabled:opacity-50 flex items-center gap-1 shrink-0"
                    >
                      {viesChecking
                        ? <Loader2 width={10} height={10} className="animate-spin" />
                        : viesResult === 'valid' ? <Check width={10} height={10} /> : null
                      }
                      {viesChecking ? 'Ellenőrzés…' : viesResult === 'valid' ? 'Érvényes' : viesResult === 'invalid' ? 'Érvénytelen' : viesResult === 'error' ? 'Hiba' : 'VIES'}
                    </button>
                  )}
                </div>
                {viesResult === 'invalid' && (
                  <span className="text-[10px] text-amber-400 mt-0.5 block">Nem szerepel a VIES adatbázisban.</span>
                )}
                {viesResult === 'error' && (
                  <span className="text-[10px] text-steel/60 mt-0.5 block">VIES nem érhető el — ellenőrizd kézzel.</span>
                )}
              </div>
            )}

            {/* Deviza + Számla nyelve — csak külföldi ügyfélnél */}
            {countryCode !== 'HU' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] text-steel tracking-wider uppercase mb-1 block">Deviza</span>
                  <select
                    value={preferredCurrency}
                    onChange={e => setPreferredCurrency(e.target.value)}
                    className="w-full px-0 py-1.5 bg-transparent border-b border-teal/8 text-sm text-cream focus:outline-none focus:border-teal/25 transition-colors cursor-pointer"
                  >
                    {CURRENCIES.map(c => <option key={c} value={c} className="bg-surface-800">{c}</option>)}
                  </select>
                </div>
                <div>
                  <span className="text-[10px] text-steel tracking-wider uppercase mb-1 block">Számla nyelve</span>
                  <select
                    value={invoiceLanguage}
                    onChange={e => setInvoiceLanguage(e.target.value)}
                    className="w-full px-0 py-1.5 bg-transparent border-b border-teal/8 text-sm text-cream focus:outline-none focus:border-teal/25 transition-colors cursor-pointer"
                  >
                    {INVOICE_LANGUAGES.map(l => <option key={l.code} value={l.code} className="bg-surface-800">{l.label}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* Cím */}
            <div className="space-y-3">
              <div className="grid grid-cols-5 gap-3">
                <div className="col-span-2">
                  <span className={`text-[10px] tracking-wider uppercase mb-1 block ${fieldErrors.postalCode ? 'text-red-400' : 'text-steel'}`}>
                    Ir.szám {billingActive && <span className="text-red-400">*</span>}
                  </span>
                  <input
                    type="text"
                    value={postalCode}
                    onChange={e => { handlePostalCodeChange(e.target.value); setFieldErrors(prev => { const { postalCode: _, ...rest } = prev; return rest; }); }}
                    className={`w-full px-0 py-1.5 bg-transparent border-b text-sm text-cream focus:outline-none transition-colors ${fieldErrors.postalCode ? 'border-red-400/60 focus:border-red-400' : 'border-teal/8 focus:border-teal/25'} placeholder:text-steel/40`}
                    placeholder={countryCode === 'HU' ? '1234' : countryCode === 'GB' ? 'SW1A' : '0000'}
                    maxLength={countryCode === 'HU' ? 4 : 10}
                  />
                  {fieldErrors.postalCode && <span className="text-[10px] text-red-400 mt-0.5 block">{fieldErrors.postalCode}</span>}
                </div>
                <div className="col-span-3">
                  <span className={`text-[10px] tracking-wider uppercase mb-1 block ${fieldErrors.city ? 'text-red-400' : 'text-steel'}`}>
                    Helység {billingActive && <span className="text-red-400">*</span>}
                  </span>
                  <input
                    type="text"
                    value={city}
                    onChange={e => { setCity(e.target.value); setFieldErrors(prev => { const { city: _, ...rest } = prev; return rest; }); }}
                    className={`w-full px-0 py-1.5 bg-transparent border-b text-sm text-cream focus:outline-none transition-colors ${fieldErrors.city ? 'border-red-400/60 focus:border-red-400' : 'border-teal/8 focus:border-teal/25'} placeholder:text-steel/40`}
                    placeholder="Budapest"
                  />
                  {fieldErrors.city && <span className="text-[10px] text-red-400 mt-0.5 block">{fieldErrors.city}</span>}
                </div>
              </div>
              <div>
                <span className={`text-[10px] tracking-wider uppercase mb-1 block ${fieldErrors.street ? 'text-red-400' : 'text-steel'}`}>
                  Utca és házszám {billingActive && <span className="text-red-400">*</span>}
                </span>
                <input
                  type="text"
                  value={street}
                  onChange={e => { setStreet(e.target.value); setFieldErrors(prev => { const { street: _, ...rest } = prev; return rest; }); }}
                  className={`w-full px-0 py-1.5 bg-transparent border-b text-sm text-cream focus:outline-none transition-colors ${fieldErrors.street ? 'border-red-400/60 focus:border-red-400' : 'border-teal/8 focus:border-teal/25'} placeholder:text-steel/40`}
                  placeholder="Fő utca 123"
                />
                {fieldErrors.street && <span className="text-[10px] text-red-400 mt-0.5 block">{fieldErrors.street}</span>}
              </div>
              <div>
                <span className="text-[10px] text-steel tracking-wider uppercase mb-1 block">Emelet, ajtó</span>
                <input
                  type="text"
                  value={addressLine2}
                  onChange={e => setAddressLine2(e.target.value)}
                  className="w-full px-0 py-1.5 bg-transparent border-b border-teal/8 text-sm text-cream focus:outline-none focus:border-teal/25 placeholder:text-steel/40 transition-colors"
                  placeholder="2. emelet, 3. ajtó"
                />
              </div>
            </div>

            {/* Szín */}
            <div className="pb-1">
              <span className="text-[10px] text-steel tracking-wider uppercase mb-2 block">Szín</span>
              <div className="flex gap-2 items-center">
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-6 h-6 rounded-full transition-all duration-150 ease-out cursor-pointer ${color === c ? 'ring-2 ring-offset-2 ring-offset-surface-800 ring-teal scale-110' : 'hover:scale-105'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <HexColorPicker value={color} onChange={setColor} presetColors={COLORS} />
              </div>
            </div>

          </div>

          {/* Footer — fixed, nem scrollozik */}
          <div className="flex justify-end gap-2 px-5 py-4 border-t border-teal/8 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-steel hover:text-cream transition-colors duration-150 ease-out cursor-pointer"
            >
              Mégse
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-teal text-cream rounded-lg text-xs font-medium hover:bg-teal/80 transition-colors duration-150 ease-out cursor-pointer"
            >
              {client ? 'Mentés' : 'Létrehozás'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
