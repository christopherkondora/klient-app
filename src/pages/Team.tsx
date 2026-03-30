import { useEffect, useState, useMemo } from 'react';
import {
  Plus, Search, Trash2, SquarePen, X, Users, Mail, Phone,
  Briefcase, UserCheck, FileText,
} from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';

const EMPLOYMENT_TYPES: { id: TeamMember['employment_type']; label: string }[] = [
  { id: 'employee', label: 'Alkalmazott' },
  { id: 'contractor', label: 'Alvállalkozó' },
  { id: 'freelancer', label: 'Szabadúszó' },
];

export default function Team() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [assignments, setAssignments] = useState<Map<string, MemberAssignment[]>>(new Map());
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [membersData, projectsData] = await Promise.all([
        window.electronAPI.getTeamMembers(),
        window.electronAPI.getProjects(),
      ]);
      setMembers(membersData);
      setProjects(projectsData);

      // Load assignments for all members
      const assignmentMap = new Map<string, MemberAssignment[]>();
      await Promise.all(
        membersData.map(async (m) => {
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
    EMPLOYMENT_TYPES.find(t => t.id === type)?.label || type;

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
          <h1 className="font-pixel text-xl text-cream">Csapat</h1>
          <p className="text-steel text-sm mt-2">{members.length} csapattag</p>
        </div>
        <button
          onClick={() => { setEditingMember(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-teal text-cream rounded-lg text-sm font-medium hover:bg-teal/80 transition-colors"
        >
          <Plus width={16} height={16} />
          Új csapattag
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search width={16} height={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-steel" />
          <input
            type="text"
            placeholder="Keresés név, email vagy pozíció alapján..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-surface-800/50 border border-teal/10 rounded-lg text-sm text-cream placeholder:text-steel/50 focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal/30"
          />
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <Users width={32} height={32} className="mx-auto text-steel/30 mb-3" />
          <p className="text-steel/60 text-sm">
            {search ? 'Nincs találat a keresésre' : 'Még nincsenek csapattagok. Adj hozzá egyet!'}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(member => {
            const memberAssignments = assignments.get(member.id) || [];
            const activeCount = memberAssignments.filter(a => a.project_status === 'active').length;
            return (
              <div
                key={member.id}
                className="flex items-center gap-4 bg-surface-800/50 rounded-lg border border-teal/10 px-5 py-3.5 hover:border-teal/25 transition-all group"
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-lg bg-teal/15 border border-teal/20 flex items-center justify-center text-teal font-bold text-sm shrink-0">
                  {member.name.charAt(0)}
                </div>

                {/* Name + Role */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-cream truncate">{member.name}</h3>
                    {member.role && (
                      <span className="text-xs text-steel shrink-0">· {member.role}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[11px] text-steel/60">
                    <span>{employmentLabel(member.employment_type)}</span>
                    {member.email && (
                      <span className="flex items-center gap-1">
                        <Mail width={10} height={10} /> {member.email}
                      </span>
                    )}
                    {member.phone && (
                      <span className="flex items-center gap-1">
                        <Phone width={10} height={10} /> {member.phone}
                      </span>
                    )}
                  </div>
                </div>

                {/* Active projects badge */}
                <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded shrink-0 ${
                  activeCount > 0 ? 'text-emerald-400 bg-emerald-400/10' : 'text-steel/60 bg-surface-900'
                }`}>
                  <Briefcase width={11} height={11} />
                  {activeCount} projekt
                </div>

                {/* Hourly rate */}
                {member.hourly_rate != null && member.hourly_rate > 0 && (
                  <span className="text-xs text-steel shrink-0">
                    {new Intl.NumberFormat('hu-HU').format(member.hourly_rate)} Ft/óra
                  </span>
                )}

                {/* Actions */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => { setEditingMember(member); setShowForm(true); }}
                    className="p-1.5 rounded-lg hover:bg-teal/10 text-steel"
                  >
                    <SquarePen width={13} height={13} />
                  </button>
                  <button
                    onClick={() => setDeleteId(member.id)}
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

      {/* Team Member Form Modal */}
      {showForm && (
        <TeamMemberForm
          member={editingMember}
          onSubmit={handleSubmit}
          onClose={() => { setShowForm(false); setEditingMember(null); }}
        />
      )}

      {/* Delete Confirmation */}
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
  const [name, setName] = useState(member?.name || '');
  const [email, setEmail] = useState(member?.email || '');
  const [phone, setPhone] = useState(member?.phone || '');
  const [role, setRole] = useState(member?.role || '');
  const [hourlyRate, setHourlyRate] = useState(member?.hourly_rate?.toString() || '');
  const [employmentType, setEmploymentType] = useState<TeamMember['employment_type']>(member?.employment_type || 'employee');
  const [notes, setNotes] = useState(member?.notes || '');

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onDoubleClick={onClose}>
      <div className="bg-surface-800 rounded-2xl border border-teal/15 w-full max-w-sm shadow-2xl overflow-hidden" onDoubleClick={e => e.stopPropagation()}>

        {/* Header accent */}
        <div className="h-1 bg-gradient-to-r from-teal via-steel to-teal/30" />

        <form
          onSubmit={e => {
            e.preventDefault();
            if (!name.trim()) return;
            onSubmit({
              name: name.trim(),
              email: email.trim() || null,
              phone: phone.trim() || null,
              role: role.trim() || null,
              hourly_rate: hourlyRate ? parseFloat(hourlyRate) : null,
              employment_type: employmentType as TeamMember['employment_type'],
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

          {/* Name — hero-style input */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg bg-teal/15 border border-teal/20 flex items-center justify-center text-teal font-bold text-sm shrink-0">
              {name ? name.charAt(0).toUpperCase() : '?'}
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

          {/* Contact row */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <span className="text-[10px] text-steel tracking-wider uppercase mb-1 block">Email</span>
              <div className="flex items-center gap-2 border-b border-teal/8 py-1.5">
                <Mail width={12} height={12} className="text-steel/60 shrink-0" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-cream focus:outline-none placeholder:text-steel/40"
                  placeholder="email@pelda.hu"
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

          {/* Role + Hourly Rate */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <span className="text-[10px] text-steel tracking-wider uppercase mb-1 block">Pozíció</span>
              <div className="flex items-center gap-2 border-b border-teal/8 py-1.5">
                <Briefcase width={12} height={12} className="text-steel/60 shrink-0" />
                <input
                  type="text"
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-cream focus:outline-none placeholder:text-steel/40"
                  placeholder="pl. Designer"
                />
              </div>
            </div>
            <div>
              <span className="text-[10px] text-steel tracking-wider uppercase mb-1 block">Óradíj (Ft)</span>
              <input
                type="number"
                value={hourlyRate}
                onChange={e => setHourlyRate(e.target.value)}
                className="w-full px-0 py-1.5 bg-transparent border-b border-teal/8 text-sm text-cream focus:outline-none focus:border-teal/25 placeholder:text-steel/40 transition-colors"
                placeholder="0"
                min="0"
              />
            </div>
          </div>

          {/* Employment Type */}
          <div className="mb-4">
            <span className="text-[10px] text-steel tracking-wider uppercase mb-1.5 block">Foglalkoztatás típusa</span>
            <div className="flex gap-2">
              {EMPLOYMENT_TYPES.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setEmploymentType(t.id)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    employmentType === t.id
                      ? 'border-teal bg-teal/15 text-cream'
                      : 'border-teal/10 text-steel hover:border-teal/25 hover:text-ash'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="mb-4">
            <span className="text-[10px] text-steel tracking-wider uppercase mb-1 block">Megjegyzés</span>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-0 py-1.5 bg-transparent border-b border-teal/8 text-sm text-cream focus:outline-none focus:border-teal/25 placeholder:text-steel/40 transition-colors resize-none"
              rows={2}
              placeholder="Bármilyen megjegyzés..."
            />
          </div>

          {/* Actions */}
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
