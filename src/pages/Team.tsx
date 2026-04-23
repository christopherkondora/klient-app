import { useEffect, useState } from 'react';
import {
  Plus, Search, Trash2, SquarePen, X, Users, Mail, Phone,
  Briefcase, Landmark,
} from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import PageHeader from '../components/PageHeader';
import { fmtNum, parseNum } from '../utils/numberFormat';

const CURRENCIES = ['HUF', 'EUR', 'USD'] as const;

const EMPLOYMENT_TYPES: { id: TeamMember['employment_type']; label: string }[] = [
  { id: 'employee', label: 'Alkalmazott' },
  { id: 'contractor', label: 'Alvállalkozó' },
  { id: 'freelancer', label: 'Szabadúszó' },
];

type MemberStatus = NonNullable<TeamMember['status']>;
const STATUS_OPTIONS: { id: MemberStatus; label: string; color: string; dot: string }[] = [
  { id: 'active',   label: 'Aktív',      color: 'text-emerald-400 bg-emerald-400/10', dot: 'bg-emerald-400' },
  { id: 'vacation', label: 'Szabadság',  color: 'text-amber-400 bg-amber-400/10',     dot: 'bg-amber-400' },
  { id: 'inactive', label: 'Inaktív',    color: 'text-steel/60 bg-surface-900',       dot: 'bg-steel/40' },
];

/** Deterministic pastel colour from a name string */
function avatarColor(name: string): { bg: string; text: string; border: string } {
  const palettes = [
    { bg: 'bg-teal/20',       text: 'text-teal',        border: 'border-teal/30' },
    { bg: 'bg-steel/20',      text: 'text-steel',       border: 'border-steel/30' },
    { bg: 'bg-emerald-500/15',text: 'text-emerald-400', border: 'border-emerald-400/25' },
    { bg: 'bg-violet-500/15', text: 'text-violet-400',  border: 'border-violet-400/25' },
    { bg: 'bg-amber-500/15',  text: 'text-amber-400',   border: 'border-amber-400/25' },
    { bg: 'bg-cyan-500/15',   text: 'text-cyan-400',    border: 'border-cyan-400/25' },
    { bg: 'bg-rose-500/15',   text: 'text-rose-400',    border: 'border-rose-400/25' },
    { bg: 'bg-indigo-500/15', text: 'text-indigo-400',  border: 'border-indigo-400/25' },
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palettes[Math.abs(hash) % palettes.length];
}

function statusMeta(status?: string | null) {
  return STATUS_OPTIONS.find(s => s.id === status) ?? STATUS_OPTIONS[0];
}

function formatPhone(raw: string): string {
  // Strip everything except + and digits
  const digits = raw.replace(/[^\d+]/g, '');
  // Hungarian mobile: +36 XX XXX XXXX
  const m = digits.match(/^(\+36)(\d{2})(\d{3})(\d{4})$/);
  if (m) return `${m[1]} ${m[2]} ${m[3]} ${m[4]}`;
  // Hungarian local (06…): 06 XX XXX XXXX
  const m2 = digits.match(/^(06)(\d{2})(\d{3})(\d{4})$/);
  if (m2) return `+36 ${m2[2]} ${m2[3]} ${m2[4]}`;
  // Generic 11-digit starting with +: +XX XXXX XXXX X
  const m3 = digits.match(/^(\+\d{2})(\d{2})(\d{3})(\d{4})$/);
  if (m3) return `${m3[1]} ${m3[2]} ${m3[3]} ${m3[4]}`;
  // Fallback: return as-is
  return raw;
}

export default function Team() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [assignments, setAssignments] = useState<Map<string, MemberAssignment[]>>(new Map());
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [membersData] = await Promise.all([
        window.electronAPI.getTeamMembers(),
      ]);
      setMembers(membersData);

      const assignmentMap = new Map<string, MemberAssignment[]>();
      await Promise.all(
        membersData.map(async (m: TeamMember) => {
          const a = await window.electronAPI.getMemberAssignments(m.id);
          assignmentMap.set(m.id, a);
        })
      );
      setAssignments(assignmentMap);
    } catch (err) {
      console.error('Failed to load team data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(formData: Partial<TeamMember>) {
    try {
      if (editingMember) {
        await window.electronAPI.updateTeamMember(editingMember.id, formData);
      } else {
        await window.electronAPI.createTeamMember(formData);
      }
      setShowForm(false);
      setEditingMember(null);
      loadData();
    } catch (err) {
      console.error('Failed to save team member:', err);
    }
  }

  async function handleDelete(id: string) {
    try {
      await window.electronAPI.deleteTeamMember(id);
      setDeleteId(null);
      loadData();
    } catch (err) {
      console.error('Failed to delete team member:', err);
    }
  }

  const filtered = members.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.email?.toLowerCase().includes(search.toLowerCase()) ||
    m.role?.toLowerCase().includes(search.toLowerCase())
  );

  const employmentLabel = (type: string) =>
    EMPLOYMENT_TYPES.find(t => t.id === type)?.label ?? type;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-steel" />
      </div>
    );
  }

  const activeCount = members.filter(m => !m.status || m.status === 'active').length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Csapat"
        subtitle={`${members.length} csapattag · ${activeCount} aktív`}
        actions={
          <button
            onClick={() => { setEditingMember(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-teal text-cream rounded-lg text-sm font-medium hover:bg-teal/80 transition-colors"
          >
            <Plus width={15} height={15} />
            Új csapattag
          </button>
        }
      />

      {/* Search */}
      <div className="relative">
        <Search width={15} height={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-steel pointer-events-none" />
        <input
          type="text"
          placeholder="Keresés név, email vagy pozíció alapján..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-surface-800/50 border border-teal/10 rounded-lg text-sm text-cream placeholder:text-steel/50 focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal/30"
        />
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <Users width={36} height={36} className="mx-auto text-steel/20 mb-4" />
          <p className="text-steel/50 text-sm font-medium">
            {search ? 'Nincs találat a keresésre' : 'Még nincsenek csapattagok'}
          </p>
          {!search && (
            <p className="text-steel/30 text-xs mt-1">Kattints az „Új csapattag" gombra a kezdéshez</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(member => {
            const memberAssignments = assignments.get(member.id) ?? [];
            const activeProjCount = memberAssignments.filter(a => a.project_status === 'active').length;
            const colors = avatarColor(member.name);
            const status = statusMeta(member.status);
            const initials = member.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

            return (
              <div
                key={member.id}
                className="relative flex items-center gap-4 bg-surface-800/50 rounded-xl border border-teal/10 px-5 py-4 hover:border-teal/25 transition-colors duration-200 cursor-default group overflow-hidden"
              >
                {/* Accent strip */}
                <div className="absolute left-0 inset-y-0 w-[3px] bg-steel origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] rounded-r-full" />

                {/* Avatar */}
                <div className={`w-10 h-10 rounded-xl ${colors.bg} border ${colors.border} flex items-center justify-center ${colors.text} font-bold text-sm shrink-0`}>
                  {initials}
                </div>

                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-cream text-sm truncate">{member.name}</h3>
                    {member.role && (
                      <span className="text-xs text-steel/60 shrink-0">· {member.role}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[11px] text-steel/50">
                    <span>{employmentLabel(member.employment_type)}</span>
                    {member.email && (
                      <span className="flex items-center gap-1 min-w-0">
                        <Mail width={10} height={10} className="shrink-0" />
                        <span className="truncate">{member.email}</span>
                      </span>
                    )}
                    {member.phone && (
                      <span className="flex items-center gap-1 shrink-0">
                        <Phone width={10} height={10} />
                        {formatPhone(member.phone)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Bér / projektdíj */}
                {member.employment_type === 'employee' && member.monthly_salary != null && member.monthly_salary > 0 ? (
                  <span className="text-xs text-steel/60 shrink-0 hidden sm:block">
                    {new Intl.NumberFormat('hu-HU').format(member.monthly_salary)} {member.salary_currency || 'HUF'}/hó
                  </span>
                ) : member.employment_type !== 'employee' ? (
                  <span className="text-[10px] text-steel/40 shrink-0 hidden sm:block italic">
                    projektenkénti díj
                  </span>
                ) : null}

                {/* Aktív projektek */}
                <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg shrink-0 ${
                  activeProjCount > 0 ? 'text-emerald-400 bg-emerald-400/10' : 'text-steel/50 bg-surface-900/60'
                }`}>
                  <Briefcase width={11} height={11} />
                  {activeProjCount} projekt
                </div>

                {/* Státusz */}
                <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg shrink-0 ${status.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${status.dot}`} />
                  {status.label}
                </div>

                {/* Actions */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0">
                  <button
                    onClick={() => { setEditingMember(member); setShowForm(true); }}
                    className="p-1.5 rounded-lg hover:bg-teal/10 text-steel hover:text-cream transition-colors"
                    title="Szerkesztés"
                  >
                    <SquarePen width={13} height={13} />
                  </button>
                  <button
                    onClick={() => setDeleteId(member.id)}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-steel hover:text-red-400 transition-colors"
                    title="Törlés"
                  >
                    <Trash2 width={13} height={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <TeamMemberForm
          member={editingMember}
          onSubmit={handleSubmit}
          onClose={() => { setShowForm(false); setEditingMember(null); }}
        />
      )}

      {deleteId && (
        <ConfirmDialog
          title="Csapattag törlése"
          message="Biztosan törölni szeretnéd ezt a csapattagot? A projekt-hozzárendelések is törlődnek."
          confirmLabel="Törlés"
          variant="danger"
          onConfirm={() => handleDelete(deleteId)}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

function TeamMemberForm({ member, onSubmit, onClose }: {
  member: TeamMember | null;
  onSubmit: (data: Partial<TeamMember>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(member?.name ?? '');
  const [email, setEmail] = useState(member?.email ?? '');
  const [phone, setPhone] = useState(member?.phone ?? '');
  const [role, setRole] = useState(member?.role ?? '');
  const [monthlySalary, setMonthlySalary] = useState(member?.monthly_salary?.toString() ?? '');
  const [salaryCurrency, setSalaryCurrency] = useState<string>(member?.salary_currency ?? 'HUF');
  const [employmentType, setEmploymentType] = useState<TeamMember['employment_type']>(member?.employment_type ?? 'employee');
  const [status, setStatus] = useState(member?.status ?? 'active');
  const [notes, setNotes] = useState(member?.notes ?? '');

  // Exchange rate for non-HUF salaries
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  useEffect(() => {
    if (salaryCurrency === 'HUF' || employmentType !== 'employee') { setExchangeRate(null); return; }
    let cancelled = false;
    window.electronAPI.getExchangeRate(salaryCurrency, 'HUF')
      .then(rate => { if (!cancelled) setExchangeRate(rate); })
      .catch(() => { if (!cancelled) setExchangeRate(null); });
    return () => { cancelled = true; };
  }, [salaryCurrency, employmentType]);

  const salaryHuf = (() => {
    const n = parseFloat(monthlySalary);
    if (!n || isNaN(n)) return null;
    if (salaryCurrency === 'HUF') return n;
    if (!exchangeRate) return null;
    return Math.round(n * exchangeRate);
  })();

  const colors = name ? avatarColor(name) : avatarColor('?');
  const initials = name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onDoubleClick={onClose}>
      <div className="bg-surface-800 rounded-2xl ring-1 ring-inset ring-teal/15 w-full max-w-md shadow-2xl overflow-hidden" onDoubleClick={e => e.stopPropagation()}>
        <div className="h-1 bg-teal" />
        <form
          onSubmit={e => {
            e.preventDefault();
            if (!name.trim()) return;
            const isEmployee = employmentType === 'employee';
            const salaryNum = monthlySalary ? parseFloat(monthlySalary) : null;
            onSubmit({
              name: name.trim(),
              email: email.trim() || null,
              phone: phone.trim() || null,
              role: role.trim() || null,
              employment_type: employmentType,
              status,
              monthly_salary: isEmployee ? salaryNum : null,
              salary_currency: isEmployee ? salaryCurrency : 'HUF',
              salary_huf: isEmployee ? salaryHuf : null,
              notes: notes.trim() || null,
            });
          }}
          className="p-5"
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-pixel text-[14px] text-cream">
              {member ? 'Csapattag szerkesztése' : 'Új csapattag'}
            </h2>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-teal/10 text-steel hover:text-cream cursor-pointer transition-colors duration-150 ease-out">
              <X width={14} height={14} />
            </button>
          </div>

          {/* Avatar + Name */}
          <div className="flex items-center gap-3 mb-5">
            <div className={`w-10 h-10 rounded-xl ${colors.bg} border ${colors.border} flex items-center justify-center ${colors.text} font-bold text-sm shrink-0`}>
              {initials}
            </div>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="flex-1 px-0 py-2 bg-transparent border-b border-teal/15 text-cream text-lg font-medium focus:outline-none focus:border-teal/40 placeholder:text-steel/50 transition-colors"
              placeholder="Csapattag neve..."
              required
              autoFocus
            />
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <span className="text-[10px] text-steel tracking-wider uppercase mb-1 block">Email</span>
              <div className="flex items-center gap-2 border-b border-teal/8 py-1.5">
                <Mail width={12} height={12} className="text-steel/60 shrink-0" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-cream focus:outline-none placeholder:text-steel/40"
                  placeholder="email@pelda.hu" />
              </div>
            </div>
            <div>
              <span className="text-[10px] text-steel tracking-wider uppercase mb-1 block">Telefon</span>
              <div className="flex items-center gap-2 border-b border-teal/8 py-1.5">
                <Phone width={12} height={12} className="text-steel/60 shrink-0" />
                <input type="text" value={phone}
                  onChange={e => {
                    const raw = e.target.value.replace(/[^\d+]/g, '');
                    const digits = raw.startsWith('+36') ? raw.slice(3) : raw.startsWith('06') ? raw.slice(2) : raw;
                    const prefix = (raw.startsWith('+36') || raw.startsWith('06')) ? '+36' : raw.startsWith('+') ? raw.slice(0, 3) : '';
                    const rest = prefix ? digits : raw;
                    if (!prefix) { setPhone(raw); return; }
                    const p1 = rest.slice(0, 2);
                    const p2 = rest.slice(2, 5);
                    const p3 = rest.slice(5, 9);
                    let formatted = prefix;
                    if (p1) formatted += ' ' + p1;
                    if (p2) formatted += ' ' + p2;
                    if (p3) formatted += ' ' + p3;
                    setPhone(formatted);
                  }}
                  className="flex-1 bg-transparent text-sm text-cream focus:outline-none placeholder:text-steel/40"
                  placeholder="+36 70 123 4567" />
              </div>
            </div>
          </div>

          {/* Role */}
          <div className="mb-4">
            <span className="text-[10px] text-steel tracking-wider uppercase mb-1 block">Pozíció</span>
            <div className="flex items-center gap-2 border-b border-teal/8 py-1.5">
              <Briefcase width={12} height={12} className="text-steel/60 shrink-0" />
              <input type="text" value={role} onChange={e => setRole(e.target.value)}
                className="flex-1 bg-transparent text-sm text-cream focus:outline-none placeholder:text-steel/40"
                placeholder="pl. Designer" />
            </div>
          </div>

          {/* Employment Type */}
          <div className="mb-4">
            <span className="text-[10px] text-steel tracking-wider uppercase mb-1.5 block">Foglalkoztatás típusa</span>
            <div className="flex gap-2">
              {EMPLOYMENT_TYPES.map(t => (
                <button key={t.id} type="button" onClick={() => setEmploymentType(t.id)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    employmentType === t.id ? 'border-teal bg-teal/15 text-cream' : 'border-teal/10 text-steel hover:border-teal/25 hover:text-ash'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Salary (only for employees) */}
          {employmentType === 'employee' ? (
            <div className="mb-4">
              <span className="text-[10px] text-steel tracking-wider uppercase mb-1.5 block">Havi bérköltség (bruttó)</span>
              <div className="flex items-center gap-2 border-b border-teal/8 py-1.5">
                <Landmark width={12} height={12} className="text-steel/60 shrink-0" />
                <input
                  type="text"
                  inputMode="numeric"
                  value={fmtNum(monthlySalary)}
                  onChange={e => setMonthlySalary(parseNum(e.target.value))}
                  className="flex-1 min-w-0 bg-transparent text-sm text-cream focus:outline-none placeholder:text-steel/40"
                  placeholder="650 000"
                />
                <select
                  value={salaryCurrency}
                  onChange={e => setSalaryCurrency(e.target.value)}
                  className="bg-transparent text-xs text-steel/80 focus:outline-none cursor-pointer"
                >
                  {CURRENCIES.map(c => <option key={c} value={c} className="bg-surface-800">{c}</option>)}
                </select>
              </div>
              {salaryCurrency !== 'HUF' && salaryHuf != null && (
                <p className="text-[10px] text-steel/50 mt-1">≈ {new Intl.NumberFormat('hu-HU').format(salaryHuf)} Ft/hó</p>
              )}
            </div>
          ) : (
            <div className="mb-4 flex items-start gap-2 p-3 bg-surface-900/60 rounded-lg border border-teal/8 text-[11px] text-steel/70">
              <Landmark width={13} height={13} className="text-steel/40 mt-0.5 shrink-0" />
              <span>
                {employmentType === 'contractor' ? 'Alvállalkozó' : 'Megbízott'} esetén a díj projektenként rögzíthető a projekt nézetben.
              </span>
            </div>
          )}

          {/* Status */}
          <div className="mb-4">
            <span className="text-[10px] text-steel tracking-wider uppercase mb-1.5 block">Státusz</span>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map(s => (
                <button key={s.id} type="button" onClick={() => setStatus(s.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    status === s.id ? 'border-teal bg-teal/15 text-cream' : 'border-teal/10 text-steel hover:border-teal/25 hover:text-ash'
                  }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="mb-4">
            <span className="text-[10px] text-steel tracking-wider uppercase mb-1 block">Megjegyzés</span>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full px-0 py-1.5 bg-transparent border-b border-teal/8 text-sm text-cream focus:outline-none focus:border-teal/25 placeholder:text-steel/40 transition-colors resize-none"
              rows={2} placeholder="Bármilyen megjegyzés..." />
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-steel hover:text-cream transition-colors duration-150 ease-out cursor-pointer">
              Mégse
            </button>
            <button type="submit" className="px-5 py-2 bg-teal text-cream rounded-lg text-xs font-medium hover:bg-teal/80 transition-colors duration-150 ease-out cursor-pointer">
              {member ? 'Mentés' : 'Létrehozás'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
