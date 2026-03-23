import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useThemedColor } from '../utils/colors';
import {
  Plus, Search, Mail, Phone, Building2, Trash2, SquarePen,
  LayoutGrid, List, Briefcase, ChevronRight, X,
} from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';
import { hu } from 'date-fns/locale';
import HexColorPicker from '../components/HexColorPicker';
import ConfirmDialog from '../components/ConfirmDialog';

const COLORS = ['#598392', '#AEC3B0', '#124559', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6'];

export default function Clients() {
  const navigate = useNavigate();
  const tc = useThemedColor();
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-pixel text-xl text-cream">Ügyfelek</h1>
          <p className="text-steel text-sm mt-2">{clients.length} ügyfél</p>
        </div>
        <button
          onClick={() => { setEditingClient(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-teal text-cream rounded-lg text-sm font-medium hover:bg-teal/80 transition-colors"
        >
          <Plus width={16} height={16} />
          Új ügyfél
        </button>
      </div>

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
        <div className="flex bg-surface-800/50 border border-teal/10 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-md transition-colors ${view === 'grid' ? 'bg-teal/20 text-cream' : 'text-steel hover:text-ash'}`}
            title="Rács nézet"
          >
            <LayoutGrid width={16} height={16} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-md transition-colors ${view === 'list' ? 'bg-teal/20 text-cream' : 'text-steel hover:text-ash'}`}
            title="Lista nézet"
          >
            <List width={16} height={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-steel/60 text-sm">
            {search ? 'Nincs találat a keresésre' : 'Még nincsenek ügyfelek. Adj hozzá egyet!'}
          </p>
        </div>
      ) : view === 'grid' ? (
        /* ── Grid View ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(client => {
            const stats = clientStats.get(client.id);
            const isActive = (stats?.activeProjects ?? 0) > 0;
            return (
              <div
                key={client.id}
                className="bg-surface-800/50 rounded-lg border border-teal/10 hover:border-teal/25 hover:border-l-[3px] hover:border-l-steel transition-all cursor-pointer group"
                onClick={() => navigate(`/clients/${client.id}`)}
              >
                {/* Top: Avatar + Identity */}
                <div className="p-5 pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3.5">
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center text-ink font-bold text-base shrink-0"
                        style={{ backgroundColor: tc(client.color) }}
                      >
                        {client.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-cream">{client.name}</h3>
                          <div className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-emerald-400' : 'bg-steel/40'}`} />
                        </div>
                        {client.company && (
                          <p className="text-xs text-steel mt-0.5">{client.company}</p>
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
                  <div className={`font-medium ${(stats?.pendingAmount ?? 0) > 0 ? 'text-amber-400' : 'text-steel/50'}`}>
                    {(stats?.pendingAmount ?? 0) > 0 ? formatCurrency(stats!.pendingAmount) : 'Rendben'}
                  </div>
                  <div className="text-steel/60">
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
            return (
              <div
                key={client.id}
                onClick={() => navigate(`/clients/${client.id}`)}
                className="flex items-center gap-4 bg-surface-800/50 rounded-lg border border-teal/10 px-5 py-3.5 hover:border-teal/25 hover:border-l-[3px] hover:border-l-steel transition-all cursor-pointer group"
              >
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-ink font-bold text-sm shrink-0"
                  style={{ backgroundColor: tc(client.color) }}
                >
                  {client.name.charAt(0)}
                </div>

                {/* Name + Company */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-cream truncate">{client.name}</h3>
                    <div className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-emerald-400' : 'bg-steel/40'}`} />
                    {client.company && (
                      <span className="text-xs text-steel shrink-0">· {client.company}</span>
                    )}
                  </div>
                </div>

                {/* Status badge */}
                <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded shrink-0 ${
                  isActive ? 'text-emerald-400 bg-emerald-400/10' : 'text-steel/60 bg-surface-900'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-steel/40'}`} />
                  {isActive ? 'Aktív' : 'Inaktív'}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6 shrink-0 text-xs">
                  <span className="text-steel w-16">
                    {stats?.activeProjects ?? 0} projekt
                  </span>
                  <span className={`w-24 text-right font-medium ${(stats?.pendingAmount ?? 0) > 0 ? 'text-amber-400' : 'text-steel/50'}`}>
                    {(stats?.pendingAmount ?? 0) > 0 ? formatCurrency(stats!.pendingAmount) : 'Rendben'}
                  </span>
                  <span className="text-steel/60 w-24 text-right">
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
  const [name, setName] = useState(client?.name || '');
  const [email, setEmail] = useState(client?.email || '');
  const [phone, setPhone] = useState(client?.phone || '');
  const [company, setCompany] = useState(client?.company || '');
  const [address, setAddress] = useState(client?.address || '');
  const [color, setColor] = useState(client?.color || '#598392');

  const COLORS = ['#598392', '#AEC3B0', '#124559', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6'];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), email, phone, company, address, color });
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onDoubleClick={onClose}>
      <div className="bg-surface-800 rounded-2xl border border-teal/15 w-full max-w-sm shadow-2xl overflow-hidden" onDoubleClick={e => e.stopPropagation()}>

        {/* Header accent */}
        <div className="h-1 bg-gradient-to-r from-teal via-steel to-teal/30" />

        <form onSubmit={handleSubmit} className="p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-pixel text-[14px] text-cream">
              {client ? 'Ügyfél szerkesztése' : 'Új ügyfél'}
            </h2>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-teal/10 text-steel hover:text-cream cursor-pointer transition-colors duration-150 ease-out">
              <X width={14} height={14} />
            </button>
          </div>

          {/* Name — hero-style input */}
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-ink font-bold text-sm shrink-0 transition-colors duration-150"
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

          {/* Contact row */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] text-steel tracking-wider uppercase mb-1 block">Email</span>
              <div className="flex items-center gap-2 border-b border-teal/8 py-1.5">
                <Mail width={12} height={12} className="text-steel/60 shrink-0" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-cream focus:outline-none placeholder:text-steel/40"
                  placeholder="email@example.com"
                />
              </div>
            </div>
            <div>
              <span className="text-[10px] text-steel tracking-wider uppercase mb-1 block">Telefon</span>
              <div className="flex items-center gap-2 border-b border-teal/8 py-1.5">
                <Phone width={12} height={12} className="text-steel/60 shrink-0" />
                <input
                  type="text"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-cream focus:outline-none placeholder:text-steel/40"
                  placeholder="+36 ..."
                />
              </div>
            </div>
          </div>

          {/* Company + Address */}
          <div className="mt-4 space-y-3">
            <div>
              <span className="text-[10px] text-steel tracking-wider uppercase mb-1 block">Cég</span>
              <div className="flex items-center gap-2 border-b border-teal/8 py-1.5">
                <Building2 width={12} height={12} className="text-steel/60 shrink-0" />
                <input
                  type="text"
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-cream focus:outline-none placeholder:text-steel/40"
                  placeholder="Cég neve (opcionális)"
                />
              </div>
            </div>
            <div>
              <span className="text-[10px] text-steel tracking-wider uppercase mb-1 block">Cím</span>
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="w-full px-0 py-1.5 bg-transparent border-b border-teal/8 text-sm text-cream focus:outline-none focus:border-teal/25 placeholder:text-steel/40 transition-colors"
                placeholder="Cím (opcionális)"
              />
            </div>
          </div>

          {/* Color picker */}
          <div className="mt-5">
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

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-steel hover:text-cream transition-colors duration-150 ease-out cursor-pointer">
              Mégse
            </button>
            <button type="submit" className="px-5 py-2 bg-teal text-cream rounded-lg text-xs font-medium hover:bg-teal/80 transition-colors duration-150 ease-out cursor-pointer">
              {client ? 'Mentés' : 'Létrehozás'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
