'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity,
  ClipboardCheck,
  ShieldCheck,
  Flower2,
  LogOut,
  ArrowRight,
  Lock,
  Sparkles,
  ChevronDown,
  Sun,
  Moon,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuthStore, type AppModule } from '@/stores/auth.store';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

// ─── Module definitions ───────────────────────────────────────────────────────

interface ModuleConfig {
  id: AppModule;
  label: string;
  watermark: string;
  fullName: string;
  tagline: string;
  stats: { label: string; value: string }[];
  icon: React.ElementType;
  color: string;
  colorMid: string;
  glowRgb: string;
  implemented: boolean;
}

const MODULES: ModuleConfig[] = [
  {
    id: 'NQAS',
    label: 'NQAS',
    watermark: 'NQ',
    fullName: 'National Quality Assurance Standards',
    tagline: 'District Hospital Toolkit',
    stats: [
      { label: 'Departments', value: '14' },
      { label: 'Areas of Concern', value: '8' },
      { label: 'Measurable Elements', value: '380+' },
    ],
    icon: ClipboardCheck,
    color: '#00B4FF',
    colorMid: 'rgba(0,180,255,0.55)',
    glowRgb: '0,180,255',
    implemented: true,
  },
  {
    id: 'NABH',
    label: 'NABH',
    watermark: 'NB',
    fullName: 'National Accreditation Board for Hospitals',
    tagline: 'Hospital Accreditation Standards',
    stats: [
      { label: 'Chapters', value: '10' },
      { label: 'Standards', value: '100+' },
      { label: 'Objectives', value: '600+' },
    ],
    icon: ShieldCheck,
    color: '#A78BFA',
    colorMid: 'rgba(167,139,250,0.55)',
    glowRgb: '167,139,250',
    implemented: false,
  },
  {
    id: 'KAYAKALPA',
    label: 'Kayakalpa',
    watermark: 'KY',
    fullName: 'Hospital Cleanliness Programme',
    tagline: 'Swachh Bharat Initiative',
    stats: [
      { label: 'Areas', value: '12' },
      { label: 'Parameters', value: '50+' },
      { label: 'Score Points', value: '500' },
    ],
    icon: Flower2,
    color: '#34D399',
    colorMid: 'rgba(52,211,153,0.55)',
    glowRgb: '52,211,153',
    implemented: false,
  },
];

// ─── Module card ──────────────────────────────────────────────────────────────

function ModuleCard({
  mod,
  index,
  hasAccess,
  isSelecting,
  onSelect,
}: {
  mod: ModuleConfig;
  index: number;
  hasAccess: boolean;
  isSelecting: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const active = hasAccess && mod.implemented;

  return (
    <motion.div
      className="flex-1 min-w-0 h-full"
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.09, duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
    >
      <button
        onClick={active ? onSelect : undefined}
        onMouseEnter={() => active && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        disabled={!active || isSelecting}
        className="relative w-full h-full flex flex-col overflow-hidden rounded-2xl transition-all duration-300 focus:outline-none"
        style={{
          background: hovered
            ? `linear-gradient(170deg, rgba(${mod.glowRgb},0.09) 0%, rgba(5,6,16,0.98) 58%)`
            : active
              ? `linear-gradient(170deg, rgba(${mod.glowRgb},0.05) 0%, rgba(5,6,16,0.97) 68%)`
              : 'rgba(5,6,16,0.9)',
          border: `1px solid ${
            hovered
              ? `rgba(${mod.glowRgb},0.32)`
              : active
                ? `rgba(${mod.glowRgb},0.16)`
                : 'rgba(255,255,255,0.06)'
          }`,
          boxShadow: hovered
            ? `0 0 0 1px rgba(${mod.glowRgb},0.12), 0 16px 44px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)`
            : active
              ? `0 2px 18px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.035)`
              : 'none',
          transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
          opacity: !hasAccess ? 0.28 : 1,
          cursor: active ? 'pointer' : 'default',
        }}
      >
        {/* ── Top radial glow ── */}
        {active && (
          <div
            className="absolute inset-x-0 -top-20 h-40 pointer-events-none transition-opacity duration-400"
            style={{
              background: `radial-gradient(ellipse 60% 100% at 50% 0%, rgba(${mod.glowRgb},${hovered ? 0.16 : 0.07}) 0%, transparent 100%)`,
              opacity: hovered ? 0.9 : 0.5,
            }}
          />
        )}

        {/* ── Watermark (subtle background monogram) ── */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden"
          aria-hidden
        >
          <span
            className="font-black leading-none transition-colors duration-500"
            style={{
              fontSize: 'clamp(4.5rem, 8vw, 6.5rem)',
              color: `rgba(${mod.glowRgb},${hovered ? 0.045 : 0.025})`,
              letterSpacing: '-0.06em',
            }}
          >
            {mod.watermark}
          </span>
        </div>

        {/* ── Card content ── */}
        <div className="relative flex flex-col h-full p-5 sm:p-6">

          {/* Status row */}
          <div className="shrink-0 flex items-center justify-between mb-3">
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[0.58rem] font-bold uppercase tracking-wider"
              style={{
                background: active ? `rgba(${mod.glowRgb},0.09)` : 'rgba(255,255,255,0.04)',
                color: active ? mod.color : 'rgba(255,255,255,0.24)',
                border: `1px solid ${active ? `rgba(${mod.glowRgb},0.2)` : 'rgba(255,255,255,0.07)'}`,
              }}
            >
              {active ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: mod.color }} />
                  Active
                </>
              ) : !hasAccess ? (
                <><Lock className="w-2.5 h-2.5" />No Access</>
              ) : (
                <><Lock className="w-2.5 h-2.5" />Coming Soon</>
              )}
            </div>

            {active && (
              <span
                className="text-[0.55rem] font-bold uppercase tracking-[0.2em]"
                style={{ color: `rgba(${mod.glowRgb},0.5)` }}
              >
                Enabled
              </span>
            )}
          </div>

          {/* ── Center: icon + name ── */}
          <div className="flex-1 flex flex-col items-center justify-center text-center py-2 min-h-0">
            {/* Icon */}
            <div
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mb-5 transition-all duration-400"
              style={{
                background: active
                  ? `linear-gradient(135deg, rgba(${mod.glowRgb},0.2), rgba(${mod.glowRgb},0.07))`
                  : 'rgba(255,255,255,0.04)',
                border: `1px solid ${active ? `rgba(${mod.glowRgb},0.3)` : 'rgba(255,255,255,0.07)'}`,
                boxShadow: hovered ? `0 0 20px rgba(${mod.glowRgb},0.16)` : 'none',
              }}
            >
              <mod.icon
                className="w-7 h-7 sm:w-8 sm:h-8"
                style={{ color: active ? mod.color : 'rgba(255,255,255,0.18)' }}
                strokeWidth={1.5}
              />
            </div>

            {/* Module label */}
            <div
              className="font-extrabold leading-none mb-2 tracking-tight"
              style={{
                fontSize: 'clamp(1.6rem, 3vw, 2.15rem)',
                color: active ? '#fff' : 'rgba(255,255,255,0.22)',
              }}
            >
              {mod.label}
            </div>

            {/* Full name */}
            <div
              className="text-[0.65rem] sm:text-[0.68rem] font-semibold uppercase tracking-wider leading-snug max-w-[200px]"
              style={{ color: active ? mod.colorMid : 'rgba(255,255,255,0.18)' }}
            >
              {mod.fullName}
            </div>

            {/* Tagline pill */}
            <div
              className="mt-3 px-3 py-1 rounded-full text-[0.58rem] font-medium uppercase tracking-wider"
              style={{
                background: active ? `rgba(${mod.glowRgb},0.08)` : 'rgba(255,255,255,0.03)',
                color: active ? `rgba(${mod.glowRgb},0.75)` : 'rgba(255,255,255,0.18)',
                border: `1px solid ${active ? `rgba(${mod.glowRgb},0.15)` : 'rgba(255,255,255,0.05)'}`,
              }}
            >
              {mod.tagline}
            </div>
          </div>

          {/* ── Stats row ── */}
          <div
            className="shrink-0 grid grid-cols-3 mb-3 rounded-xl overflow-hidden"
            style={{ border: '1px solid rgba(255,255,255,0.055)' }}
          >
            {mod.stats.map((s, si) => (
              <div
                key={s.label}
                className="flex flex-col items-center justify-center py-3 px-1 text-center"
                style={{
                  background: si % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.035)',
                  borderRight: si < 2 ? '1px solid rgba(255,255,255,0.055)' : 'none',
                }}
              >
                <div
                  className="font-black leading-none mb-1"
                  style={{
                    fontSize: 'clamp(1rem, 2vw, 1.35rem)',
                    color: active ? mod.color : 'rgba(255,255,255,0.2)',
                  }}
                >
                  {s.value}
                </div>
                <div
                  className="text-[0.54rem] sm:text-[0.58rem] uppercase tracking-wide font-medium leading-tight"
                  style={{ color: 'rgba(255,255,255,0.28)' }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* ── CTA ── */}
          <div className="shrink-0">
            {active ? (
              <div
                className="flex items-center justify-center gap-2.5 py-3 rounded-xl text-sm font-bold transition-all duration-300"
                style={{
                  background: hovered
                    ? `rgba(${mod.glowRgb},0.2)`
                    : `rgba(${mod.glowRgb},0.09)`,
                  color: mod.color,
                  border: `1px solid rgba(${mod.glowRgb},${hovered ? 0.38 : 0.2})`,
                }}
              >
                {isSelecting ? (
                  <div
                    className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: `rgba(${mod.glowRgb},0.5)`, borderTopColor: 'transparent' }}
                  />
                ) : (
                  <>
                    <span>Enter Module</span>
                    <ArrowRight
                      className="w-4 h-4 transition-transform duration-300"
                      style={{ transform: hovered ? 'translateX(4px)' : 'translateX(0)' }}
                    />
                  </>
                )}
              </div>
            ) : (
              <div
                className="flex items-center justify-center gap-2 py-3 rounded-xl text-[0.76rem]"
                style={{
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  color: 'rgba(255,255,255,0.28)',
                }}
              >
                <Lock className="w-3 h-3" />
                {hasAccess ? 'Under Development' : 'Contact Admin for Access'}
              </div>
            )}
          </div>
        </div>
      </button>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SelectModulePage() {
  const router = useRouter();
  const { user, refreshToken, clearAuth, hydrated, selectedModule, setSelectedModule } = useAuthStore();
  const [selecting, setSelecting] = useState<AppModule | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = !mounted || resolvedTheme === 'dark';

  useEffect(() => {
    if (!hydrated) return;
    const hasCookie = document.cookie.split(';').some((c) => c.trim().startsWith('auth_token='));
    if (!hasCookie && user) { clearAuth(); router.replace('/login'); return; }
    if (!user) { router.replace('/login'); return; }
    if (selectedModule) { router.replace('/dashboard'); return; }

    // Admin and Super Admin pick their module on this screen. Other roles
    // auto-select their (single) accessible module and go straight in.
    const isAdminish = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
    if (!isAdminish) {
      const accessible = user.moduleAccess ?? ['NQAS'];
      handleSelect((accessible[0] ?? 'NQAS') as AppModule);
      return;
    }
    const accessible = user.moduleAccess ?? [];
    if (accessible.length === 1) handleSelect(accessible[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const handleSelect = (moduleId: AppModule) => {
    const mod = MODULES.find((m) => m.id === moduleId)!;
    if (!mod.implemented) {
      toast({ title: `${mod.label} — Coming Soon`, description: 'This module will be available soon.' });
      return;
    }
    setSelecting(moduleId);
    setSelectedModule(moduleId);
    router.push('/dashboard');
  };

  const handleLogout = async () => {
    try { await api.post('/auth/logout', { refreshToken: refreshToken ?? '' }); } catch { /* ignore */ }
    clearAuth();
    router.push('/login');
  };

  if (!hydrated || !user) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: dark ? '#04050C' : '#F0F4F9' }}>
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'rgba(0,180,255,0.4)', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  const accessibleModules: AppModule[] = user.moduleAccess ?? ['NQAS'];

  return (
    <div
      className="h-screen flex flex-col overflow-hidden transition-colors duration-300"
      style={{ background: dark ? '#04050C' : '#F0F4F9' }}
    >
      {/* ── Ambient background ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
        {/* Subtle dot grid */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: dark
              ? 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)'
              : 'radial-gradient(rgba(0,0,0,0.07) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
            opacity: 0.4,
          }}
        />
        {/* Color glows */}
        <div
          className="absolute -top-32 left-1/4 w-[50vw] h-[50vh] rounded-full"
          style={{
            background: `radial-gradient(ellipse, rgba(0,180,255,${dark ? '0.06' : '0.08'}) 0%, transparent 70%)`,
            filter: 'blur(60px)',
          }}
        />
        <div
          className="absolute -bottom-24 right-1/4 w-[40vw] h-[40vh] rounded-full"
          style={{
            background: `radial-gradient(ellipse, rgba(167,139,250,${dark ? '0.05' : '0.07'}) 0%, transparent 70%)`,
            filter: 'blur(60px)',
          }}
        />
      </div>

      {/* ── Header ── */}
      <header
        className="relative z-20 shrink-0 h-14 flex items-center justify-between px-6 sm:px-8 transition-colors duration-300"
        style={{
          background: dark ? 'rgba(4,5,12,0.92)' : 'rgba(240,244,249,0.92)',
          borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.07)'}`,
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(0,180,255,0.13)', border: '1px solid rgba(0,180,255,0.26)' }}
          >
            <Activity className="w-4 h-4" style={{ color: '#00B4FF' }} strokeWidth={1.8} />
          </div>
          <div>
            <div
              className="text-[0.8rem] font-extrabold leading-none tracking-wide transition-colors duration-300"
              style={{ color: dark ? '#fff' : '#0f172a' }}
            >
              QPS<span style={{ color: '#00B4FF' }}>·</span>KMIO
            </div>
            <div className="text-[0.56rem] text-slate-500 uppercase tracking-[0.2em] mt-0.5 font-medium">
              Quality Platform
            </div>
          </div>
        </div>

        {/* Right side: theme toggle + user area */}
        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          {mounted && (
            <button
              onClick={() => setTheme(dark ? 'light' : 'dark')}
              className="p-2 rounded-lg transition-all"
              style={{
                color: dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
                background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
              }}
              title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          )}

        {/* User area */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl transition-all"
            style={{
              border: `1px solid ${dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.09)'}`,
              background: dark ? 'transparent' : 'rgba(255,255,255,0.6)',
            }}
          >
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center text-[0.65rem] font-bold shrink-0"
              style={{
                background: 'rgba(0,180,255,0.13)',
                border: '1px solid rgba(0,180,255,0.24)',
                color: '#00B4FF',
              }}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
            <span
              className="hidden sm:block text-[0.78rem] font-medium max-w-[110px] truncate"
              style={{ color: dark ? 'rgb(203 213 225)' : '#334155' }}
            >
              {user.name}
            </span>
            <ChevronDown
              className={cn(
                'w-3 h-3 text-slate-600 transition-transform duration-200',
                userMenuOpen && 'rotate-180',
              )}
            />
          </button>

          <AnimatePresence>
            {userMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 5, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 5, scale: 0.95 }}
                transition={{ duration: 0.13 }}
                className="absolute right-0 top-full mt-2 w-52 rounded-2xl overflow-hidden z-50"
                style={{
                  background: 'rgba(6,8,18,0.98)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.8)',
                  backdropFilter: 'blur(24px)',
                }}
              >
                <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-[0.82rem] font-semibold text-slate-200 truncate">{user.name}</p>
                  <p className="text-[0.7rem] text-slate-500 truncate mt-0.5">{user.email}</p>
                  <span
                    className="inline-block mt-2 text-[0.58rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{
                      background: 'rgba(0,180,255,0.1)',
                      color: '#38bdf8',
                      border: '1px solid rgba(0,180,255,0.2)',
                    }}
                  >
                    {user.role}
                  </span>
                </div>
                <div className="p-2">
                  <button
                    onClick={() => { setUserMenuOpen(false); handleLogout(); }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[0.82rem] text-red-400 hover:text-red-300 hover:bg-red-500/[0.07] transition-all"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        </div>{/* end Right side */}
      </header>

      {/* ── Title strip ── */}
      <div className="relative z-10 shrink-0 flex items-center justify-between px-6 sm:px-8 py-4">
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-0.5 h-3.5 rounded-full"
              style={{ background: 'linear-gradient(to bottom, #00B4FF, rgba(0,180,255,0.15))' }}
            />
            <span className="text-[0.58rem] font-bold uppercase tracking-[0.22em] text-slate-600">
              Accreditation Portal
            </span>
          </div>
          <h1
            className="text-lg sm:text-xl font-extrabold leading-tight tracking-tight transition-colors duration-300"
            style={{ color: dark ? '#fff' : '#0f172a' }}
          >
            Select Your Module
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.22 }}
          className="hidden sm:flex items-center gap-2"
        >
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
            style={{
              background: 'rgba(0,180,255,0.07)',
              border: '1px solid rgba(0,180,255,0.13)',
            }}
          >
            <Sparkles className="w-3 h-3" style={{ color: '#00B4FF' }} />
            <span className="text-[0.72rem] font-medium" style={{ color: 'rgba(0,180,255,0.8)' }}>
              Welcome, {user.name.split(' ')[0]}
            </span>
          </div>
        </motion.div>
      </div>

      {/* ── Module cards ── */}
      <div className="relative z-10 flex-1 min-h-0 flex flex-col sm:flex-row gap-3 sm:gap-4 px-6 sm:px-8 pb-5 overflow-y-auto sm:overflow-hidden">
        {MODULES.map((mod, i) => (
          <ModuleCard
            key={mod.id}
            mod={mod}
            index={i}
            hasAccess={accessibleModules.includes(mod.id)}
            isSelecting={selecting === mod.id}
            onSelect={() => handleSelect(mod.id)}
          />
        ))}
      </div>
    </div>
  );
}
