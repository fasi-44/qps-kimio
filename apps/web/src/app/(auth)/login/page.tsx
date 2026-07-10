'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Eye, EyeOff, Loader2, Activity, AlertCircle, ArrowRight,
  ClipboardCheck, ShieldCheck, Flower2, Lock,
  CheckCircle2, Clock, TrendingUp, BarChart2, Award,
} from 'lucide-react';
import { loginSchema, type LoginInput } from '@nabh/shared';
import { api, ApiError } from '@/lib/api';
import { useAuthStore, type AuthUser } from '@/stores/auth.store';
import { cn } from '@/lib/utils';

// ─── Static data ──────────────────────────────────────────────────────────────

const DEPARTMENTS = [
  { name: 'Emergency',  score: 91, color: '#22C55E' },
  { name: 'Blood Bank', score: 88, color: '#22C55E' },
  { name: 'ICU',        score: 84, color: '#22C55E' },
  { name: 'OPD',        score: 82, color: '#22C55E' },
  { name: 'Pharmacy',   score: 76, color: '#EAB308' },
  { name: 'Laboratory', score: 68, color: '#F97316' },
];

const OVERALL = Math.round(DEPARTMENTS.reduce((s, d) => s + d.score, 0) / DEPARTMENTS.length);

const ACTIVITY = [
  { msg: 'Emergency Q1 Approved',    sub: '91% · Target exceeded',     icon: CheckCircle2, color: '#22C55E' },
  { msg: 'ICU checklist submitted',  sub: 'Awaiting HOD review',        icon: Clock,        color: '#00B4FF' },
  { msg: 'OPD assessment sent back', sub: 'Revision requested',         icon: AlertCircle,  color: '#EAB308' },
  { msg: 'Pharmacy compliance +6%',  sub: 'Q2 improvement over Q1',     icon: TrendingUp,   color: '#A78BFA' },
];

const MODULE_CHIPS = [
  { label: 'NQAS',      icon: ClipboardCheck, color: '#00B4FF', bg: 'rgba(0,180,255,0.1)',   border: 'rgba(0,180,255,0.22)' },
  { label: 'NABH',      icon: ShieldCheck,    color: '#A78BFA', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.22)' },
  { label: 'Kayakalpa', icon: Flower2,         color: '#34D399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.22)' },
];

// ─── Floating bokeh field ─────────────────────────────────────────────────────
// Soft glowing particles that rise slowly behind the card. Positions/timings are
// derived deterministically (sine hash, not Math.random) so server + client render
// identically — no hydration mismatch — while still looking organically scattered.
const BOKEH_COLORS = ['14,165,233', '6,182,212', '56,189,248', '129,140,248'];
const hash = (i: number, seed: number) => {
  const x = Math.sin((i + 1) * seed) * 43758.5453;
  return x - Math.floor(x);
};
// 12 specks, alternating left/right edge bands so the centre (where the card
// sits) stays clear — no crowding behind the card or side panels.
const BOKEH = Array.from({ length: 12 }, (_, i) => {
  const onLeft = i % 2 === 0;
  const slot = Math.floor(i / 2);                         // 0–5, evenly spaced
  const left = Math.round((onLeft ? 4 + slot * 4 : 74 + slot * 4) + hash(i, 78.2) * 3);
  const dur = 16 + Math.round(hash(i, 37.719) * 12);      // 16–28 s
  return {
    size: 8 + Math.round(hash(i, 12.9898) * 16),          // 8–24 px (small, crisp)
    left,
    dur,
    delay: -Math.round(hash(i, 3.71) * dur),
    op: +(0.30 + hash(i, 9.13) * 0.22).toFixed(3),        // 0.30–0.52
    sway: Math.round(hash(i, 5.37) * 14 - 7),             // -7–7 px (gentle)
    color: BOKEH_COLORS[Math.floor(hash(i, 101.7) * BOKEH_COLORS.length)],
  };
});

// ─── Floating-label input ─────────────────────────────────────────────────────

function FloatField({
  id, label, type = 'text', error, focused, value, suffix, inputProps,
}: {
  id: string; label: string; type?: string; error?: string;
  focused: boolean; value: string; suffix?: React.ReactNode;
  inputProps: React.InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> };
}) {
  const innerRef = useRef<HTMLInputElement>(null);
  const [autofilled, setAutofilled] = useState(false);
  // Float the label when focused, when there's a value, OR when the browser has
  // autofilled the field — otherwise the centred label overlaps autofilled creds.
  const floating = focused || !!value || autofilled;

  const { ref: regRef, ...restInput } = inputProps;
  const setRef = (el: HTMLInputElement | null) => {
    innerRef.current = el;
    if (typeof regRef === 'function') regRef(el);
    else if (regRef && typeof regRef === 'object') (regRef as React.RefObject<HTMLInputElement | null>).current = el;
  };

  // Chrome fills shortly after mount; the pseudo-class + the autofill animation
  // (see globals.css) both signal it.
  useEffect(() => {
    const t = setTimeout(() => {
      try { if (innerRef.current?.matches(':-webkit-autofill')) setAutofilled(true); } catch { /* unsupported */ }
    }, 150);
    return () => clearTimeout(t);
  }, []);

  return (
    <div>
      <div className="relative">
        <input
          id={id}
          type={type}
          ref={setRef}
          {...restInput}
          onAnimationStart={(e) => {
            if (e.animationName === 'onAutoFillStart') setAutofilled(true);
            else if (e.animationName === 'onAutoFillCancel') setAutofilled(false);
          }}
          className={cn(
            'w-full px-4 pr-11 rounded-xl text-sm text-white outline-none transition-all duration-200',
            floating ? 'pt-6 pb-2.5' : 'pt-[15px] pb-[15px]',
            error
              ? 'border border-red-500/40 bg-red-500/5'
              : 'border border-white/[0.1] bg-white/[0.04] focus:border-[rgba(14,165,233,0.55)] focus:bg-white/[0.06]',
          )}
          style={{ caretColor: '#0EA5E9' }}
        />
        <label
          htmlFor={id}
          className={cn(
            'absolute left-4 pointer-events-none transition-all duration-200 select-none',
            floating
              ? 'top-[7px] text-[0.6rem] font-bold uppercase tracking-widest'
              : 'top-1/2 -translate-y-1/2 text-[0.83rem]',
            focused ? 'text-[rgba(14,165,233,0.85)]' : 'text-slate-500',
          )}
        >
          {label}
        </label>
        {suffix && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{suffix}</div>
        )}
      </div>
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-1.5 text-xs text-red-400 pl-1"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
}

// ─── Auth types ───────────────────────────────────────────────────────────────

interface LoginResponse { accessToken: string; refreshToken: string; user: AuthUser; }

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router    = useRouter();
  const setAuth   = useAuthStore((s) => s.setAuth);
  const user      = useAuthStore((s) => s.user);
  const hydrated  = useAuthStore((s) => s.hydrated);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const reduce    = useReducedMotion();

  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending]           = useState(false);
  const [serverError, setServerError]   = useState<string | null>(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused]   = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    const hasCookie = document.cookie.split(';').some((c) => c.trim().startsWith('auth_token='));
    if (!hasCookie && user) { clearAuth(); return; }
    if (user) router.replace('/select-module');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const emailVal = watch('email') || '';
  const passVal  = watch('password') || '';

  const onSubmit = async (data: LoginInput) => {
    setPending(true);
    setServerError(null);
    try {
      const res = await api.post<LoginResponse>('/auth/login', data, { skipAuth: true });
      setAuth(res.user, res.accessToken, res.refreshToken);
      router.push('/select-module');
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Login failed. Please try again.');
    } finally {
      setPending(false);
    }
  };

  const { ref: emailRef, onBlur: emailOnBlur, onChange: emailOnChange, name: emailName } = register('email');
  const { ref: passRef,  onBlur: passOnBlur,  onChange: passOnChange,  name: passName  } = register('password');

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden" style={{ background: '#030812' }}>

      {/* ══════════════════════ BACKGROUND LAYER ══════════════════════ */}

      {/* Layered aurora base — rich, premium colour field */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background:
          'radial-gradient(120% 80% at 50% -20%, rgba(14,165,233,0.16), transparent 55%),' +
          'radial-gradient(90% 70% at 88% 112%, rgba(129,140,248,0.12), transparent 55%),' +
          'radial-gradient(80% 60% at 5% 95%, rgba(6,182,212,0.10), transparent 55%),' +
          'linear-gradient(180deg, #05070F 0%, #070C1A 55%, #04070E 100%)',
      }} />

      {/* Two large ambient glows — slow, static bloom that anchors the colour field */}
      <div className="absolute rounded-full pointer-events-none mix-blend-screen"
        style={{ width: 700, height: 700, top: '-26%', left: '-14%',
          background: 'radial-gradient(circle, rgba(14,165,233,0.10) 0%, transparent 64%)', filter: 'blur(96px)' }} />
      <div className="absolute rounded-full pointer-events-none mix-blend-screen"
        style={{ width: 540, height: 540, bottom: '-22%', right: '-12%',
          background: 'radial-gradient(circle, rgba(129,140,248,0.09) 0%, transparent 64%)', filter: 'blur(96px)' }} />

      {/* Floating bokeh — soft glowing particles rising slowly (Design 4) */}
      {!reduce && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
          {BOKEH.map((b, i) => (
            <span
              key={i}
              className="login-bokeh"
              style={{
                left: `${b.left}%`,
                width: b.size,
                height: b.size,
                background: `radial-gradient(circle at 35% 35%, rgba(${b.color},0.5), rgba(${b.color},0.14) 55%, transparent 72%)`,
                boxShadow: `0 0 ${Math.round(b.size / 2)}px rgba(${b.color},0.22)`,
                ['--bokeh-dur' as string]: `${b.dur}s`,
                ['--bokeh-delay' as string]: `${b.delay}s`,
                ['--bokeh-op' as string]: `${b.op}`,
                ['--bokeh-sway' as string]: `${b.sway}px`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}

      {/* Fine grid — masked to fade toward the edges (depth, not a flat dot field) */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px),' +
          'linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)',
        backgroundSize: '46px 46px',
        maskImage: 'radial-gradient(ellipse 78% 68% at 50% 44%, #000 22%, transparent 86%)',
        WebkitMaskImage: 'radial-gradient(ellipse 78% 68% at 50% 44%, #000 22%, transparent 86%)',
      }} />

      {/* Top-light + bottom vignette for depth */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background:
          'radial-gradient(120% 46% at 50% 0%, rgba(56,189,248,0.07), transparent 50%),' +
          'linear-gradient(180deg, transparent 58%, rgba(0,0,0,0.38) 100%)',
      }} />

      {/* Brand motif — faint EKG line with a glowing pulse travelling along it */}
      <svg className="absolute left-0 right-0 top-[62%] w-full h-[64px] pointer-events-none" viewBox="0 0 1440 100" preserveAspectRatio="none" aria-hidden>
        <defs>
          <filter id="ekgGlow" x="-5%" y="-60%" width="110%" height="220%">
            <feGaussianBlur stdDeviation="3.2" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <path
          d="M0 50 H320 l16 0 l9 -28 l15 52 l11 -38 l9 14 l7 0 H700 l16 0 l9 -28 l15 52 l11 -38 l9 14 l7 0 H1080 l16 0 l9 -28 l15 52 l11 -38 l9 14 l7 0 H1440"
          fill="none" stroke="rgba(14,165,233,0.12)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        />
        {!reduce && (
          <motion.path
            d="M0 50 H320 l16 0 l9 -28 l15 52 l11 -38 l9 14 l7 0 H700 l16 0 l9 -28 l15 52 l11 -38 l9 14 l7 0 H1080 l16 0 l9 -28 l15 52 l11 -38 l9 14 l7 0 H1440"
            fill="none" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            filter="url(#ekgGlow)" pathLength={1} strokeDasharray="0.05 0.95"
            animate={{ strokeDashoffset: [1, 0] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: 'linear' }}
          />
        )}
      </svg>

      {/* ══════════════════════ HEADER BAR ══════════════════════ */}

      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-20 shrink-0 flex items-center justify-between px-6 sm:px-10 h-14"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)' }}
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(14,165,233,0.14)', border: '1px solid rgba(14,165,233,0.28)' }}>
            <Activity className="w-4 h-4" style={{ color: '#0EA5E9' }} strokeWidth={1.8} />
          </div>
          <div>
            <div className="text-[0.85rem] font-extrabold text-white tracking-wide leading-none">
              QPS<span style={{ color: '#0EA5E9' }}>·</span>KMIO
            </div>
            <div className="text-[0.52rem] text-slate-600 uppercase tracking-[0.2em] mt-0.5 font-semibold hidden sm:block">
              Quality Platform
            </div>
          </div>
        </div>

        {/* Hospital name — center */}
        <div className="hidden md:flex flex-col items-center">
          <span className="text-[0.62rem] font-semibold text-slate-400 tracking-wide leading-none">
            Kidwai Memorial Institute of Oncology
          </span>
          <span className="text-[0.5rem] text-slate-600 uppercase tracking-[0.18em] mt-0.5">Bengaluru · Karnataka</span>
        </div>

        {/* Right: accreditation + live */}
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="text-[0.54rem] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
              style={{ background: 'rgba(167,139,250,0.1)', color: '#A78BFA', border: '1px solid rgba(167,139,250,0.2)' }}>
              NABH
            </span>
            <span className="text-[0.54rem] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
              style={{ background: 'rgba(14,165,233,0.1)', color: '#0EA5E9', border: '1px solid rgba(14,165,233,0.2)' }}>
              NQAS
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
            style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)' }}>
            <span className="relative flex w-1.5 h-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-70" style={{ background: '#22C55E' }} />
              <span className="relative rounded-full w-1.5 h-1.5 inline-flex" style={{ background: '#22C55E' }} />
            </span>
            <span className="text-[0.56rem] font-bold tracking-wider" style={{ color: '#22C55E' }}>LIVE</span>
          </div>
        </div>
      </motion.header>

      {/* ══════════════════════ MAIN AREA ══════════════════════ */}

      <div className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6">

        {/* Concentric rings behind card — static, subtle frame */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {[280, 420, 580, 760, 960].map((size, i) => (
            <div
              key={size}
              className="absolute rounded-full"
              style={{
                width: size,
                height: size,
                border: `1px solid rgba(14,165,233,${(0.08 - i * 0.014).toFixed(3)})`,
              }}
            />
          ))}
        </div>

        {/* ─ LEFT: Department compliance panel ─ */}
        <motion.div
          initial={{ opacity: 0, x: -28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.45, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="absolute left-6 xl:left-14 top-1/2 -translate-y-1/2 hidden lg:block"
          style={{ width: '196px' }}
        >
          <div className="rounded-2xl p-4"
            style={{ background: 'linear-gradient(165deg, rgba(13,22,40,0.85), rgba(6,11,24,0.78))', border: '1px solid rgba(255,255,255,0.09)', backdropFilter: 'blur(24px)', boxShadow: '0 12px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)' }}>

            {/* Panel header */}
            <div className="flex items-center gap-1.5 mb-3.5">
              <BarChart2 className="w-3 h-3 shrink-0" style={{ color: '#0EA5E9' }} />
              <span className="text-[0.54rem] font-bold uppercase tracking-widest text-slate-500">Dept. Compliance · Q1</span>
            </div>

            {/* Bars */}
            <div className="space-y-2.5">
              {DEPARTMENTS.map((d, i) => (
                <div key={d.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[0.6rem] font-medium text-slate-400">{d.name}</span>
                    <span className="text-[0.6rem] font-extrabold tabular-nums" style={{ color: d.color }}>{d.score}%</span>
                  </div>
                  <div className="h-[3px] rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: `linear-gradient(to right, ${d.color}99, ${d.color})` }}
                      initial={{ width: 0 }}
                      animate={{ width: `${d.score}%` }}
                      transition={{ delay: 0.75 + i * 0.08, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Overall */}
            <div className="mt-4 pt-3 flex items-center justify-between"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="text-[0.56rem] font-bold uppercase tracking-wider text-slate-600">Overall</span>
              <span className="text-[0.82rem] font-extrabold tabular-nums" style={{ color: '#0EA5E9' }}>{OVERALL}%</span>
            </div>
          </div>

          {/* Mini accreditation card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="mt-2.5 rounded-xl px-3.5 py-2.5 flex items-center gap-2.5"
            style={{ background: 'linear-gradient(165deg, rgba(13,22,40,0.85), rgba(6,11,24,0.78))', border: '1px solid rgba(255,255,255,0.09)', backdropFilter: 'blur(24px)', boxShadow: '0 12px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)' }}
          >
            <Award className="w-4 h-4 shrink-0" style={{ color: '#EAB308' }} />
            <div>
              <p className="text-[0.58rem] font-bold text-slate-300 leading-none">NABH Accredited</p>
              <p className="text-[0.5rem] text-slate-600 mt-0.5">District Hospital · Level 4</p>
            </div>
          </motion.div>
        </motion.div>

        {/* ─ RIGHT: Stats + activity panel ─ */}
        <motion.div
          initial={{ opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="absolute right-6 xl:right-14 top-1/2 -translate-y-1/2 hidden lg:block"
          style={{ width: '188px' }}
        >
          {/* Stat trio */}
          <div className="grid grid-cols-3 gap-1.5 mb-2.5">
            {[
              { label: 'Total', value: '847+', color: '#0EA5E9' },
              { label: 'Passed', value: '631',  color: '#22C55E' },
              { label: 'Avg',   value: `${OVERALL}%`, color: '#EAB308' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl py-2.5 px-1.5 text-center"
                style={{ background: 'linear-gradient(165deg, rgba(13,22,40,0.85), rgba(6,11,24,0.78))', border: '1px solid rgba(255,255,255,0.09)', backdropFilter: 'blur(24px)', boxShadow: '0 12px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
                <p className="text-[0.92rem] font-extrabold tabular-nums leading-none" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[0.5rem] text-slate-600 uppercase tracking-wide mt-1 font-bold">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Activity feed */}
          <div className="rounded-2xl p-3.5"
            style={{ background: 'linear-gradient(165deg, rgba(13,22,40,0.85), rgba(6,11,24,0.78))', border: '1px solid rgba(255,255,255,0.09)', backdropFilter: 'blur(24px)', boxShadow: '0 12px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-1.5 mb-3">
              <span className="relative flex w-1.5 h-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#0EA5E9' }} />
                <span className="relative inline-flex rounded-full w-1.5 h-1.5" style={{ background: '#0EA5E9' }} />
              </span>
              <span className="text-[0.52rem] font-bold uppercase tracking-widest text-slate-600">Live Activity</span>
            </div>
            <div className="space-y-2.5">
              {ACTIVITY.map((a, i) => (
                <motion.div
                  key={a.msg}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.85 + i * 0.1 }}
                  className="flex items-start gap-2"
                >
                  <div className="w-4 h-4 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: `${a.color}15`, border: `1px solid ${a.color}30` }}>
                    <a.icon className="w-2.5 h-2.5" style={{ color: a.color }} strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[0.58rem] text-slate-300 leading-tight font-medium truncate">{a.msg}</p>
                    <p className="text-[0.52rem] text-slate-600 truncate mt-0.5">{a.sub}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ─ CENTER: Login card ─ */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 w-full max-w-sm"
        >
          {/* Animated gradient-glow halo behind the card */}
          <motion.div
            aria-hidden
            className="absolute -inset-5 rounded-[1.9rem] pointer-events-none"
            style={{
              background: 'conic-gradient(from 0deg, rgba(14,165,233,0), rgba(14,165,233,0.38), rgba(6,182,212,0.30), rgba(129,140,248,0.32), rgba(14,165,233,0))',
              filter: 'blur(26px)',
            }}
            animate={reduce ? undefined : { rotate: 360 }}
            transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
          />
          <div className="relative rounded-2xl px-7 py-7"
            style={{
              background: 'rgba(4,8,20,0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(56px)',
              boxShadow: '0 0 0 1px rgba(14,165,233,0.06), 0 32px 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.07)',
            }}
          >
            {/* Top glow accent */}
            <div className="absolute inset-x-0 -top-px h-px rounded-t-2xl"
              style={{ background: 'linear-gradient(to right, transparent, rgba(14,165,233,0.5) 50%, transparent)' }}
            />

            {/* Brand */}
            <div className="flex items-center justify-center mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(14,165,233,0.22), rgba(14,165,233,0.08))',
                    border: '1px solid rgba(14,165,233,0.3)',
                    boxShadow: '0 0 24px rgba(14,165,233,0.2)',
                  }}>
                  <Activity className="w-5 h-5" style={{ color: '#0EA5E9' }} strokeWidth={1.7} />
                </div>
                <div>
                  <div className="text-[1rem] font-extrabold text-white tracking-wide leading-none">
                    QPS<span style={{ color: '#0EA5E9' }}>·</span>KMIO
                  </div>
                  <div className="text-[0.54rem] text-slate-600 uppercase tracking-[0.2em] mt-0.5 font-semibold">
                    Secure Workspace
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="mb-5 h-px"
              style={{ background: 'linear-gradient(to right, transparent, rgba(14,165,233,0.2) 50%, transparent)' }}
            />

            {/* Heading */}
            <div className="text-center mb-5">
              <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl mb-3"
                style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)' }}>
                <Lock className="w-4 h-4" style={{ color: '#0EA5E9' }} strokeWidth={1.8} />
              </div>
              <h1 className="text-[1.45rem] font-extrabold text-white leading-tight tracking-tight">
                Welcome back
              </h1>
              <p className="text-[0.75rem] text-slate-500 mt-1">
                Sign in to your assessment workspace
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>

              <FloatField
                id="email" label="Email address" type="email"
                error={errors.email?.message} focused={emailFocused} value={emailVal}
                inputProps={{
                  ref: emailRef, name: emailName, autoComplete: 'email',
                  onFocus: () => setEmailFocused(true),
                  onBlur: (e) => { setEmailFocused(false); emailOnBlur(e); },
                  onChange: emailOnChange,
                }}
              />

              <FloatField
                id="password" label="Password"
                type={showPassword ? 'text' : 'password'}
                error={errors.password?.message} focused={passFocused} value={passVal}
                suffix={
                  <button type="button" onClick={() => setShowPassword((v) => !v)}
                    className="text-slate-600 hover:text-slate-300 transition-colors" tabIndex={-1}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
                inputProps={{
                  ref: passRef, name: passName, autoComplete: 'current-password',
                  onFocus: () => setPassFocused(true),
                  onBlur: (e) => { setPassFocused(false); passOnBlur(e); },
                  onChange: passOnChange,
                }}
              />

              <AnimatePresence mode="wait">
                {serverError && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm text-red-400"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {serverError}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex justify-end">
                <a href="/forgot-password" className="text-[0.68rem] text-slate-500 hover:text-[#0EA5E9] transition-colors">
                  Forgot password?
                </a>
              </div>

              <motion.button
                type="submit" disabled={pending}
                whileHover={{ scale: pending ? 1 : 1.01 }}
                whileTap={{ scale: pending ? 1 : 0.98 }}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm text-white transition-all duration-200 disabled:cursor-not-allowed"
                style={{
                  background: pending ? 'rgba(14,165,233,0.3)' : 'linear-gradient(135deg, #0284C7 0%, #0EA5E9 60%, #38BDF8 100%)',
                  boxShadow: pending ? 'none' : '0 4px 24px rgba(14,165,233,0.38)',
                  opacity: pending ? 0.7 : 1,
                }}
              >
                {pending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
                  : <>Sign In <ArrowRight className="w-4 h-4" /></>}
              </motion.button>
            </form>

            {/* Module chips */}
            <div className="mt-5 pt-4 flex items-center justify-center gap-2 flex-wrap"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              {MODULE_CHIPS.map((m) => (
                <span key={m.label}
                  className="flex items-center gap-1.5 text-[0.58rem] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
                  style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}` }}>
                  <m.icon className="w-2.5 h-2.5" strokeWidth={2.5} />
                  {m.label}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* ══════════════════════ FOOTER BAR ══════════════════════ */}

      <motion.footer
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="relative z-20 shrink-0 flex items-center justify-between px-6 sm:px-10 h-12"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        <span className="text-[0.55rem] text-slate-700 tracking-wide font-medium">
          © 2025 Kidwai Memorial Institute of Oncology · Bengaluru
        </span>

        <div className="hidden sm:flex items-center gap-3">
          <span className="text-[0.52rem] text-slate-700 uppercase tracking-widest">Accreditation Modules</span>
          <div className="flex items-center gap-1.5">
            {MODULE_CHIPS.map((m) => (
              <span key={m.label}
                className="text-[0.5rem] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}` }}>
                {m.label}
              </span>
            ))}
          </div>
        </div>
      </motion.footer>
    </div>
  );
}
