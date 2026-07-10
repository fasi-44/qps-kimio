'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, User, KeyRound, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { changePasswordSchema, type ChangePasswordInput } from '@nabh/shared';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrator',
  HOD: 'Head of Department',
  ASSESSOR: 'Assessor',
};

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  const [nameValue, setNameValue] = useState(user?.name ?? '');
  const [namePending, setNamePending] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });

  const handleNameSave = async () => {
    if (!nameValue.trim()) return;
    setNamePending(true);
    try {
      const updated = await api.patch<typeof user>('/auth/profile', { name: nameValue.trim() });
      updateUser({ name: updated!.name });
      toast.success('Profile updated');
    } catch (err) {
      toast.error('Update failed', err instanceof ApiError ? err.message : '');
    } finally {
      setNamePending(false);
    }
  };

  const onPasswordSubmit = async (data: ChangePasswordInput) => {
    try {
      await api.post('/auth/change-password', data);
      toast.success('Password changed successfully');
      reset();
    } catch (err) {
      toast.error('Password change failed', err instanceof ApiError ? err.message : '');
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-extrabold text-slate-100">My Profile</h1>
        <p className="text-slate-500 text-sm mt-1">Manage your account details and security</p>
      </motion.div>

      {/* Profile card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl p-6"
        style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/6">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black text-brand-teal"
            style={{ background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.2)' }}
          >
            {user?.name?.charAt(0).toUpperCase() ?? <User className="w-6 h-6" />}
          </div>
          <div>
            <p className="font-bold text-slate-100">{user?.name}</p>
            <p className="text-sm text-slate-500">{user?.email}</p>
            <span
              className="inline-block mt-1 text-[0.68rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border"
              style={{ color: '#0EA5E9', background: 'rgba(14,165,233,0.1)', borderColor: 'rgba(14,165,233,0.2)' }}
            >
              {ROLE_LABELS[user?.role ?? ''] ?? user?.role}
            </span>
          </div>
        </div>

        {/* Edit name */}
        <div className="space-y-2">
          <Label>Display Name</Label>
          <div className="flex gap-3">
            <input
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-white/[0.04] border border-white/8 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal/50 transition-all"
            />
            <button
              onClick={handleNameSave}
              disabled={namePending || nameValue === user?.name}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-brand-teal hover:bg-brand-teal-dark hover:shadow-lg hover:shadow-brand-teal/20 transition-all disabled:opacity-40 flex items-center gap-2"
            >
              {namePending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Save
            </button>
          </div>
        </div>

        {/* Email (read-only) */}
        <div className="space-y-2 mt-4">
          <Label>Email Address</Label>
          <input
            value={user?.email ?? ''}
            readOnly
            className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.02] border border-white/5 text-slate-500 cursor-not-allowed"
          />
        </div>

        {/* Department */}
        {user?.department && (
          <div className="space-y-2 mt-4">
            <Label>Department</Label>
            <input
              value={`${user.department.name} (${user.department.code})`}
              readOnly
              className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.02] border border-white/5 text-slate-500 cursor-not-allowed"
            />
          </div>
        )}
      </motion.div>

      {/* Change password */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl p-6"
        style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-5 pb-3 border-b border-white/6">
          <KeyRound className="w-4 h-4 text-brand-teal" />
          Change Password
        </h2>

        <form onSubmit={handleSubmit(onPasswordSubmit)} className="space-y-4">
          {/* Current */}
          <div className="space-y-2">
            <Label>Current Password</Label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                {...register('currentPassword')}
                placeholder="Current password"
                className={cn(
                  'w-full px-4 py-2.5 pr-10 rounded-xl text-sm bg-white/[0.04] border text-slate-100',
                  'placeholder:text-slate-600 focus:outline-none focus:ring-2 transition-all',
                  errors.currentPassword
                    ? 'border-red-500/50 focus:ring-red-500/15'
                    : 'border-white/8 focus:border-brand-teal/50 focus:ring-brand-teal/15',
                )}
              />
              <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors" tabIndex={-1}>
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New */}
          <div className="space-y-2">
            <Label>New Password</Label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                {...register('newPassword')}
                placeholder="Min 8 chars, uppercase, number, symbol"
                className={cn(
                  'w-full px-4 py-2.5 pr-10 rounded-xl text-sm bg-white/[0.04] border text-slate-100',
                  'placeholder:text-slate-600 focus:outline-none focus:ring-2 transition-all',
                  errors.newPassword
                    ? 'border-red-500/50 focus:ring-red-500/15'
                    : 'border-white/8 focus:border-brand-teal/50 focus:ring-brand-teal/15',
                )}
              />
              <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors" tabIndex={-1}>
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.newPassword && <p className="text-red-400 text-xs">{errors.newPassword.message}</p>}
          </div>

          {/* Confirm */}
          <div className="space-y-2">
            <Label>Confirm New Password</Label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                {...register('confirmPassword')}
                placeholder="Repeat new password"
                className={cn(
                  'w-full px-4 py-2.5 pr-10 rounded-xl text-sm bg-white/[0.04] border text-slate-100',
                  'placeholder:text-slate-600 focus:outline-none focus:ring-2 transition-all',
                  errors.confirmPassword
                    ? 'border-red-500/50 focus:ring-red-500/15'
                    : 'border-white/8 focus:border-brand-teal/50 focus:ring-brand-teal/15',
                )}
              />
              <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors" tabIndex={-1}>
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.confirmPassword && <p className="text-red-400 text-xs">{errors.confirmPassword.message}</p>}
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl font-bold text-sm text-white bg-brand-teal hover:bg-brand-teal-dark hover:shadow-lg hover:shadow-brand-teal/20 hover:scale-[1.01] active:scale-[0.99] transition-all"
          >
            Update Password
          </button>
        </form>
      </motion.div>
    </div>
  );
}
