'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserPlus, Search, Shield, Edit2, UserX, X, Eye, EyeOff, Loader2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { confirm } from '@/hooks/use-confirm';
import { cn } from '@/lib/utils';
import { MultiSelect } from '@/components/ui/multi-select';

interface Designation { id: string; name: string }

type UserRole = 'ADMIN' | 'HOD' | 'ASSESSOR';

interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  phone?: string | null;
  designation?: string | null;
  designations?: { id: string; name: string }[];
  department?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
}

interface UsersResponse {
  data: AppUser[];
  total: number;
  page: number;
  totalPages: number;
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'HOD', label: 'HOD' },
  { value: 'ASSESSOR', label: 'Assessor' },
];

const ROLE_STYLE: Record<UserRole, string> = {
  ADMIN: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  HOD: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  ASSESSOR: 'text-brand-teal bg-brand-teal/10 border-brand-teal/20',
};

const EMPTY_CREATE = { name: '', email: '', password: '', role: 'ASSESSOR' as UserRole, phone: '', designation: '', designationIds: [] as string[] };

export default function UsersPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<AppUser | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [editForm, setEditForm] = useState<Partial<AppUser & { isActive: boolean; designationIds: string[] }>>({});

  const { data: designations = [] } = useQuery<Designation[]>({
    queryKey: ['designations'], queryFn: () => api.get('/designations'),
  });

  const { data, isLoading } = useQuery<UsersResponse>({
    queryKey: ['users', page, search, roleFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '15' });
      if (search) params.set('search', search);
      if (roleFilter) params.set('role', roleFilter);
      return api.get(`/users?${params}`);
    },
  });

  const createMutation = useMutation({
    mutationFn: (body: typeof EMPTY_CREATE) => api.post('/users', body),
    onSuccess: () => {
      toast.success('User created');
      qc.invalidateQueries({ queryKey: ['users'] });
      setShowCreate(false);
      setCreateForm(EMPTY_CREATE);
    },
    onError: (err) => toast.error('Failed', err instanceof ApiError ? err.message : ''),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof editForm }) => api.patch(`/users/${id}`, data),
    onSuccess: () => {
      toast.success('User updated');
      qc.invalidateQueries({ queryKey: ['users'] });
      setEditUser(null);
    },
    onError: (err) => toast.error('Failed', err instanceof ApiError ? err.message : ''),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      toast.success('User deactivated');
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => toast.error('Failed', err instanceof ApiError ? err.message : ''),
  });

  const handleSearchChange = (v: string) => { setSearch(v); setPage(1); };
  const handleRoleFilter = (v: UserRole | '') => { setRoleFilter(v); setPage(1); };

  const openEdit = (u: AppUser) => {
    setEditUser(u);
    setEditForm({ name: u.name, email: u.email, role: u.role, phone: u.phone ?? '', designation: u.designation ?? '', designationIds: u.designations?.map((d) => d.id) ?? [], isActive: u.isActive });
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100">User Management</h1>
          <p className="text-slate-500 text-sm mt-1">Manage platform users and their roles</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white bg-brand-teal hover:bg-brand-teal-dark hover:shadow-lg hover:shadow-brand-teal/20 transition-all"
        >
          <UserPlus className="w-4 h-4" />
          Add User
        </button>
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm bg-white/[0.04] border border-white/8 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal/50 transition-all"
          />
        </div>
        <div className="flex gap-2">
          {(['', ...ROLE_OPTIONS.map(r => r.value)] as (UserRole | '')[]).map((r) => (
            <button
              key={r}
              onClick={() => handleRoleFilter(r)}
              className={cn(
                'px-3 py-2 rounded-xl text-xs font-semibold border transition-all',
                roleFilter === r
                  ? 'bg-brand-teal/15 text-brand-teal border-brand-teal/25'
                  : 'text-slate-500 border-white/8 hover:text-slate-300 hover:bg-white/5',
              )}
            >
              {r || 'All'}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-brand-teal animate-spin" />
          </div>
        ) : !data?.data.length ? (
          <div className="text-center py-20 text-slate-500 text-sm">No users found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                {['User', 'Role', 'Status', 'Last Login', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-5 py-3.5 text-[0.72rem] font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.data.map((u, i) => (
                <tr key={u.id}
                  className="transition-colors hover:bg-white/[0.025]"
                  style={{ borderBottom: i < data.data.length - 1 ? '1px solid var(--inner-border)' : undefined }}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-brand-teal shrink-0"
                        style={{ background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.2)' }}>
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-200">{u.name}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                        {u.designation && <p className="text-xs text-slate-600">{u.designation}</p>}
                        {!!u.designations?.length && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {u.designations.map((d) => (
                              <span key={d.id} className="text-[0.62rem] font-medium px-1.5 py-0.5 rounded text-brand-teal bg-brand-teal/10 border border-brand-teal/20">
                                {d.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={cn('text-[0.68rem] font-bold uppercase tracking-wider px-2 py-1 rounded-full border', ROLE_STYLE[u.role])}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={cn(
                      'text-[0.68rem] font-semibold px-2 py-1 rounded-full border',
                      u.isActive
                        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                        : 'text-slate-500 bg-slate-500/10 border-slate-500/20',
                    )}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-500 text-xs">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Never'}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(u)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-brand-teal hover:bg-brand-teal/10 transition-all"
                        title="Edit">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {u.isActive && (
                        <button
                          onClick={async () => {
                            if (await confirm({
                              title: `Deactivate ${u.name}?`,
                              message: 'They will no longer be able to log in. You can reactivate them later.',
                              confirmLabel: 'Deactivate',
                            })) deactivateMutation.mutate(u.id);
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          title="Deactivate">
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </motion.div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>{data.total} users total</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-2 rounded-lg hover:bg-white/5 disabled:opacity-30 transition-all">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-slate-300 font-medium">Page {page} / {data.totalPages}</span>
            <button onClick={() => setPage(p => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages}
              className="p-2 rounded-lg hover:bg-white/5 disabled:opacity-30 transition-all">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      <AnimatePresence>
        {showCreate && (
          <Modal title="Add New User" onClose={() => setShowCreate(false)}>
            <div className="space-y-4">
              {[
                { key: 'name', label: 'Full Name', type: 'text', placeholder: 'Dr. Ravi Kumar' },
                { key: 'email', label: 'Email', type: 'email', placeholder: 'ravi@kmio.ac.in' },
                { key: 'phone', label: 'Phone (optional)', type: 'text', placeholder: '+91-9876543210' },
                { key: 'designation', label: 'Designation (optional)', type: 'text', placeholder: 'Senior Oncologist' },
              ].map(({ key, label, type, placeholder }) => (
                <div key={key}>
                  <label className="block text-[0.72rem] font-bold text-slate-500 uppercase tracking-widest mb-1.5">{label}</label>
                  <input type={type} placeholder={placeholder}
                    value={(createForm as unknown as Record<string, string>)[key] ?? ''}
                    onChange={(e) => setCreateForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.04] border border-white/8 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal/50 transition-all" />
                </div>
              ))}

              {/* Title (designation lookup) — a user may hold multiple */}
              <div>
                <label className="block text-[0.72rem] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Titles (optional)</label>
                <MultiSelect
                  options={designations.map((d) => ({ id: d.id, label: d.name }))}
                  values={createForm.designationIds}
                  onChange={(ids) => setCreateForm(f => ({ ...f, designationIds: ids }))}
                  placeholder="Select one or more titles"
                />
                <p className="text-[0.68rem] text-slate-600 mt-1">Used to resolve designation-based committee members.</p>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[0.72rem] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Password</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} placeholder="Min 8 chars, upper, lower, digit, symbol"
                    value={createForm.password}
                    onChange={(e) => setCreateForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full px-4 py-2.5 pr-10 rounded-xl text-sm bg-white/[0.04] border border-white/8 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal/50 transition-all" />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="block text-[0.72rem] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Role</label>
                <div className="flex gap-2">
                  {ROLE_OPTIONS.map(({ value, label }) => (
                    <button key={value} type="button"
                      onClick={() => setCreateForm(f => ({ ...f, role: value }))}
                      className={cn(
                        'flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5',
                        createForm.role === value ? ROLE_STYLE[value] : 'text-slate-500 border-white/8 hover:bg-white/5',
                      )}>
                      <Shield className="w-3 h-3" />{label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => createMutation.mutate(createForm)}
                disabled={createMutation.isPending || !createForm.name || !createForm.email || !createForm.password}
                className="w-full py-3 rounded-xl font-bold text-sm text-white bg-brand-teal hover:bg-brand-teal-dark hover:shadow-lg hover:shadow-brand-teal/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Create User
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Edit User Modal */}
      <AnimatePresence>
        {editUser && (
          <Modal title={`Edit — ${editUser.name}`} onClose={() => setEditUser(null)}>
            <div className="space-y-4">
              {[
                { key: 'name', label: 'Full Name', type: 'text' },
                { key: 'email', label: 'Email', type: 'email' },
                { key: 'phone', label: 'Phone', type: 'text' },
                { key: 'designation', label: 'Designation', type: 'text' },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <label className="block text-[0.72rem] font-bold text-slate-500 uppercase tracking-widest mb-1.5">{label}</label>
                  <input type={type}
                    value={(editForm as Record<string, string>)[key] ?? ''}
                    onChange={(e) => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.04] border border-white/8 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal/50 transition-all" />
                </div>
              ))}

              {/* Title (designation lookup) — a user may hold multiple */}
              <div>
                <label className="block text-[0.72rem] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Titles</label>
                <MultiSelect
                  options={designations.map((d) => ({ id: d.id, label: d.name }))}
                  values={editForm.designationIds ?? []}
                  onChange={(ids) => setEditForm(f => ({ ...f, designationIds: ids }))}
                  placeholder="Select one or more titles"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-[0.72rem] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Role</label>
                <div className="flex gap-2">
                  {ROLE_OPTIONS.map(({ value, label }) => (
                    <button key={value} type="button"
                      onClick={() => setEditForm(f => ({ ...f, role: value }))}
                      className={cn(
                        'flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5',
                        editForm.role === value ? ROLE_STYLE[value as UserRole] : 'text-slate-500 border-white/8 hover:bg-white/5',
                      )}>
                      <Shield className="w-3 h-3" />{label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active status */}
              <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--inner-bg)', border: '1px solid var(--inner-border)' }}>
                <div>
                  <p className="text-sm font-semibold text-slate-200">Account Status</p>
                  <p className="text-xs text-slate-500">{editForm.isActive ? 'User can log in' : 'Login blocked'}</p>
                </div>
                <button
                  onClick={() => setEditForm(f => ({ ...f, isActive: !f.isActive }))}
                  className={cn(
                    'relative w-11 h-6 rounded-full transition-colors',
                    editForm.isActive ? 'bg-brand-teal' : 'bg-slate-700',
                  )}>
                  <span className={cn(
                    'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform',
                    editForm.isActive ? 'translate-x-5' : 'translate-x-0',
                  )} />
                </button>
              </div>

              <button
                onClick={() => updateMutation.mutate({ id: editUser.id, data: editForm })}
                disabled={updateMutation.isPending}
                className="w-full py-3 rounded-xl font-bold text-sm text-white bg-brand-teal hover:bg-brand-teal-dark hover:shadow-lg hover:shadow-brand-teal/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="w-full max-w-md rounded-2xl p-6"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-slate-100">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/10 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}
