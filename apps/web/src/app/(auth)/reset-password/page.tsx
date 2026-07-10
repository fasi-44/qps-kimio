'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'motion/react';
import { Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { resetPasswordSchema, type ResetPasswordInput } from '@nabh/shared';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token },
  });

  const onSubmit = async (data: ResetPasswordInput) => {
    setPending(true);
    setServerError(null);
    try {
      await api.post('/auth/reset-password', data, { skipAuth: true });
      router.push('/login?reset=1');
    } catch (err) {
      setServerError(
        err instanceof ApiError ? err.message : 'Reset failed. Link may have expired.',
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden flex items-center justify-center">
      <div className="absolute inset-0 animated-gradient" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(14,165,233,0.1) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md px-4 sm:px-0"
      >
        <div
          className="rounded-3xl p-8 sm:p-10"
          style={{
            background: 'rgba(10, 17, 40, 0.82)',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            border: '1px solid rgba(255,255,255,0.09)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          <div
            className="absolute top-0 left-8 right-8 h-px pointer-events-none"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(56,189,248,0.4), transparent)' }}
          />

          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="text-center mb-8"
          >
            <div
              className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
              style={{
                background: 'linear-gradient(135deg, rgba(14,165,233,0.15), rgba(6,182,212,0.08))',
                border: '1px solid rgba(14,165,233,0.25)',
              }}
            >
              <KeyRound className="w-6 h-6 text-brand-teal" />
            </div>
            <h1 className="text-2xl font-extrabold gradient-text mb-1">New Password</h1>
            <p className="text-slate-500 text-sm">Choose a strong password for your account</p>
          </motion.div>

          {!token && (
            <div className="text-center py-6">
              <p className="text-red-400 text-sm mb-4">Invalid or missing reset token.</p>
              <Link href="/forgot-password" className="text-brand-teal text-sm hover:underline">
                Request a new link
              </Link>
            </div>
          )}

          {token && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <input type="hidden" {...register('token')} />

              {/* New password */}
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
                <label className="block text-[0.72rem] font-bold text-slate-500 uppercase tracking-widest mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    placeholder="Min 8 chars, uppercase, number, symbol"
                    {...register('password')}
                    className={cn(
                      'w-full px-4 py-3 pr-12 rounded-xl text-[0.9rem] text-slate-100',
                      'bg-white/[0.04] border transition-all duration-200',
                      'placeholder:text-slate-500 focus:outline-none focus:ring-2',
                      errors.password
                        ? 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/15'
                        : 'border-white/8 focus:border-brand-teal/50 focus:ring-brand-teal/15',
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-600 hover:text-slate-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-400 text-xs mt-1.5">{errors.password.message}</p>
                )}
              </motion.div>

              {/* Confirm password */}
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.33 }}>
                <label className="block text-[0.72rem] font-bold text-slate-500 uppercase tracking-widest mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Repeat password"
                    {...register('confirmPassword')}
                    className={cn(
                      'w-full px-4 py-3 pr-12 rounded-xl text-[0.9rem] text-slate-100',
                      'bg-white/[0.04] border transition-all duration-200',
                      'placeholder:text-slate-500 focus:outline-none focus:ring-2',
                      errors.confirmPassword
                        ? 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/15'
                        : 'border-white/8 focus:border-brand-teal/50 focus:ring-brand-teal/15',
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-600 hover:text-slate-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-red-400 text-xs mt-1.5">{errors.confirmPassword.message}</p>
                )}
              </motion.div>

              {serverError && (
                <div
                  className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#FCA5A5' }}
                >
                  <span>⚠</span> {serverError}
                </div>
              )}

              <motion.button
                type="submit"
                disabled={pending}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.42 }}
                className={cn(
                  'w-full py-3.5 rounded-xl font-bold text-sm text-white',
                  'transition-all duration-200 disabled:opacity-65 disabled:cursor-not-allowed',
                  pending
                    ? 'bg-brand-teal/60'
                    : 'bg-gradient-to-r from-brand-teal-dark via-brand-teal to-brand-cyan hover:shadow-xl hover:shadow-brand-teal/20 hover:scale-[1.015] active:scale-[0.99]',
                )}
              >
                {pending ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Updating…
                  </span>
                ) : (
                  'Set New Password'
                )}
              </motion.button>
            </form>
          )}

          <div className="mt-7 pt-5 border-t text-center" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <Link href="/login" className="text-sm text-slate-500 hover:text-brand-teal transition-colors">
              Back to Sign In
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
