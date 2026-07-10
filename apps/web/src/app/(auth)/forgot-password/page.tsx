'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'motion/react';
import { ArrowLeft, CheckCircle2, Loader2, Mail } from 'lucide-react';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@nabh/shared';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

export default function ForgotPasswordPage() {
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = async (data: ForgotPasswordInput) => {
    setPending(true);
    setServerError(null);
    try {
      await api.post('/auth/forgot-password', data, { skipAuth: true });
      setSuccess(true);
    } catch (err) {
      setServerError(
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.',
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
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(56,189,248,0.4), transparent)',
            }}
          />

          {!success ? (
            <>
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
                  <Mail className="w-6 h-6 text-brand-teal" />
                </div>
                <h1 className="text-2xl font-extrabold gradient-text mb-1">Reset Password</h1>
                <p className="text-slate-500 text-sm">
                  Enter your email and we&apos;ll send a reset link
                </p>
              </motion.div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  <label className="block text-[0.72rem] font-bold text-slate-500 uppercase tracking-widest mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="doctor@kmio.ac.in"
                    {...register('email')}
                    className={cn(
                      'w-full px-4 py-3 rounded-xl text-[0.9rem] text-slate-100',
                      'bg-white/[0.04] border transition-all duration-200',
                      'placeholder:text-slate-500 focus:outline-none focus:ring-2',
                      errors.email
                        ? 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/15'
                        : 'border-white/8 focus:border-brand-teal/50 focus:ring-brand-teal/15',
                    )}
                  />
                  {errors.email && (
                    <p className="text-red-400 text-xs mt-1.5">{errors.email.message}</p>
                  )}
                </motion.div>

                {serverError && (
                  <div
                    className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
                    style={{
                      background: 'rgba(239,68,68,0.08)',
                      border: '1px solid rgba(239,68,68,0.2)',
                      color: '#FCA5A5',
                    }}
                  >
                    <span>⚠</span> {serverError}
                  </div>
                )}

                <motion.button
                  type="submit"
                  disabled={pending}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className={cn(
                    'relative w-full py-3.5 rounded-xl font-bold text-sm text-white overflow-hidden',
                    'transition-all duration-200 disabled:opacity-65 disabled:cursor-not-allowed',
                    pending
                      ? 'bg-brand-teal/60'
                      : 'bg-gradient-to-r from-brand-teal-dark via-brand-teal to-brand-cyan hover:shadow-xl hover:shadow-brand-teal/20 hover:scale-[1.015] active:scale-[0.99]',
                  )}
                >
                  {pending ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Sending…
                    </span>
                  ) : (
                    'Send Reset Link'
                  )}
                </motion.button>
              </form>
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-4"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 mb-5"
              >
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </motion.div>
              <h2 className="text-xl font-bold text-slate-100 mb-2">Check your inbox</h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-1">
                If{' '}
                <span className="text-brand-teal font-medium">{getValues('email')}</span>{' '}
                is registered, a password reset link has been sent.
              </p>
              <p className="text-slate-600 text-xs">Link expires in 1 hour.</p>
            </motion.div>
          )}

          <div className="mt-7 pt-5 border-t text-center" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-teal transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Sign In
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
