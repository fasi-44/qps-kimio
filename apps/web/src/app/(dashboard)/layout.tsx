'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  ClipboardList,
  CheckSquare2,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Activity,
  Bell,
  ChevronRight,
  User,
  Users,
  Wifi,
  WifiOff,
  PanelLeftClose,
  PanelLeftOpen,
  Layers,
  ArrowLeftRight,
  ChevronDown,
  Sun,
  Moon,
  Building2,
  Landmark,
  Gauge,
  SlidersHorizontal,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Shield,
  Mail,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuthStore, type AppModule } from '@/stores/auth.store';
import { useSocket } from '@/lib/socket-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type NavSection = 'main' | 'assess' | 'quality' | 'admin';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: string[];
  section: NavSection;
  badge?: number;
  createHref?: string;
  createRoles?: string[];
  modules?: AppModule[]; // if set, only shown when one of these modules is active
}

const NAV_SECTIONS: { key: NavSection; label: string }[] = [
  { key: 'main', label: '' },
  { key: 'assess', label: 'Assessments' },
  { key: 'quality', label: 'Quality & Patient Safety' },
  { key: 'admin', label: 'Administration' },
];

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'HOD', 'ASSESSOR'], section: 'main' },

  { href: '/assessment-cycles', label: 'Assessment Cycles', icon: Building2, roles: ['ADMIN', 'HOD', 'ASSESSOR'], section: 'assess', createHref: '/assessment-cycles/new', createRoles: ['ADMIN'] },
  { href: '/approvals', label: 'Approvals', icon: CheckSquare2, roles: ['ADMIN', 'HOD'], section: 'assess' },

  { href: '/indicators', label: 'Quality Indicators', icon: Gauge, roles: ['ADMIN'], section: 'quality' },
  { href: '/kpi-templates', label: 'Indicator Setup', icon: SlidersHorizontal, roles: ['SUPER_ADMIN'], section: 'quality' },
  { href: '/committees', label: 'Committees', icon: Landmark, roles: ['ADMIN', 'HOD', 'ASSESSOR'], section: 'quality', modules: ['NQAS'], createHref: '/committees/new', createRoles: ['ADMIN', 'HOD'] },
  { href: '/reports', label: 'Reports', icon: BarChart3, roles: ['ADMIN', 'HOD', 'ASSESSOR'], section: 'quality' },

  { href: '/users', label: 'Users', icon: Users, roles: ['ADMIN'], section: 'admin' },
  { href: '/email-templates', label: 'Email Templates', icon: Mail, roles: ['ADMIN'], section: 'admin' },
  { href: '/audit-logs', label: 'Audit Logs', icon: Shield, roles: ['ADMIN'], section: 'admin' },
  { href: '/settings', label: 'Settings', icon: Settings, roles: ['ADMIN'], section: 'admin' },
];

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  ADMIN: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  HOD: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  ASSESSOR: 'text-brand-teal bg-brand-teal/10 border-brand-teal/20',
};

function formatRelTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const NOTIF_ICON: Record<string, React.ElementType> = {
  ASSESSMENT_APPROVED: CheckCircle2,
  ASSESSMENT_REJECTED: XCircle,
  ASSESSMENT_SENT_BACK: RotateCcw,
  ASSESSMENT_SUBMITTED: ClipboardList,
  ASSESSMENT_OVERDUE: Clock,
};

const NOTIF_COLOR: Record<string, { bg: string; border: string; icon: string }> = {
  ASSESSMENT_APPROVED: { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.2)', icon: '#22C55E' },
  ASSESSMENT_REJECTED: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)', icon: '#EF4444' },
  ASSESSMENT_SENT_BACK: { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)', icon: '#F59E0B' },
  ASSESSMENT_SUBMITTED: { bg: 'rgba(0,180,255,0.1)', border: 'rgba(0,180,255,0.2)', icon: '#38bdf8' },
  ASSESSMENT_OVERDUE: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)', icon: '#F97316' },
};

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-8 h-8" />;
  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="p-2 rounded-lg text-slate-500 hover:text-slate-400 hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer"
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, refreshToken, clearAuth, clearSelectedModule, setSelectedModule, hydrated, selectedModule } = useAuthStore();
  const { connected, socket } = useSocket();
  const qc = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const [idleWarning, setIdleWarning] = useState(false);
  const [countdown, setCountdown] = useState(300);
  const resetIdleRef = useRef<(() => void) | null>(null);

  // Auth guard — must be before any early return
  useEffect(() => {
    if (!hydrated) return;
    if (!user) { router.replace('/login'); return; }
    // A module persisted from a previous session that this user can't access would
    // silently hide module-scoped nav (e.g. Committees). Correct it in place to the
    // user's first accessible module — no redirect, so the sidebar never flickers.
    // Guard on a populated moduleAccess so a missing list can't cause a loop.
    if (selectedModule && user.moduleAccess?.length && !user.moduleAccess.includes(selectedModule)) {
      setSelectedModule(user.moduleAccess[0]);
      return;
    }
    if (!selectedModule) { router.replace('/select-module'); }
  }, [hydrated, user, selectedModule, router, setSelectedModule]);

  // Idle timeout: warn at 55 min, auto-logout at 60 min
  useEffect(() => {
    if (!user) return;

    let idleTimer: ReturnType<typeof setTimeout>;
    let logoutTimer: ReturnType<typeof setTimeout>;
    let tickInterval: ReturnType<typeof setInterval>;

    const startWarning = () => {
      setIdleWarning(true);
      setCountdown(300);
      tickInterval = setInterval(() => {
        setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      logoutTimer = setTimeout(() => {
        clearAuth();
        router.replace('/login');
      }, 5 * 60 * 1000);
    };

    const reset = () => {
      // Dismiss warning if visible
      setIdleWarning(false);
      clearInterval(tickInterval);
      clearTimeout(logoutTimer);
      // Restart 55-min idle timer
      clearTimeout(idleTimer);
      idleTimer = setTimeout(startWarning, 55 * 60 * 1000);
    };

    resetIdleRef.current = reset;

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset(); // start immediately

    return () => {
      clearTimeout(idleTimer);
      clearTimeout(logoutTimer);
      clearInterval(tickInterval);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [user, clearAuth, router]);

  // Close mobile sidebar on route change — must be before any early return
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Restore collapsed state from localStorage — must be before any early return
  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    if (stored === 'true') setCollapsed(true);
  }, []);

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close notification panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Real-time notification push via WebSocket
  useEffect(() => {
    if (!socket) return;
    const handler = () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications-unread'] });
    };
    socket.on('notification', handler);
    return () => { socket.off('notification', handler); };
  }, [socket, qc]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await api.post('/auth/logout', { refreshToken: refreshToken ?? '' });
    } catch {
      // Ignore errors on logout
    } finally {
      clearAuth();
      router.push('/login');
    }
  };

  // Must be before early return — hooks cannot be conditional
  const { data: rolePerms } = useQuery<{ role: string; pageAccess: string[] }[]>({
    queryKey: ['role-permissions'],
    queryFn: () => api.get('/permissions/roles'),
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  });

  const { data: notifData, isLoading: notifLoading } = useQuery<{ data: any[]; total: number; unreadCount: number }>({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications?limit=20'),
    enabled: !!user && notifOpen,
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['notifications-unread'],
    queryFn: () => api.get('/notifications/unread-count'),
    enabled: !!user,
    refetchInterval: 60_000,
  });

  const notifications = notifData?.data ?? [];
  const unreadCount = unreadData?.count ?? 0;

  // All hooks are above — safe to early-return now
  if (!hydrated || !user || !selectedModule) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-brand-teal border-t-transparent animate-spin" />
          <p className="text-sm text-slate-500">Loading…</p>
        </div>
      </div>
    );
  }

  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const allowedPages = rolePerms?.find((r) => r.role === user.role)?.pageAccess ?? null;
  const visibleNav = NAV_ITEMS.filter((item) => {
    // SUPER_ADMIN is a superset of ADMIN — it sees every ADMIN item plus its own.
    const roleOk = item.roles.includes(user.role) || (isSuperAdmin && item.roles.includes('ADMIN'));
    if (!roleOk) return false;
    // Module-scoped items (e.g. Committees under NQAS) only show when that module is active
    if (item.modules && (!selectedModule || !item.modules.includes(selectedModule))) return false;
    // ADMIN / SUPER_ADMIN always see every nav item they have role access to — they own the config
    if (user.role === 'ADMIN' || isSuperAdmin) return true;
    const pageKey = item.href.slice(1); // '/dashboard' → 'dashboard'
    return allowedPages ? allowedPages.includes(pageKey) : true;
  });

  const Sidebar = ({
    mobile = false,
    nav,
    isCollapsed = false,
    onToggle,
  }: {
    mobile?: boolean;
    nav: NavItem[];
    isCollapsed?: boolean;
    onToggle?: () => void;
  }) => (
    <div className={cn('flex flex-col h-full', mobile ? 'p-0' : 'py-6')}>
      {/* Logo */}
      <div
        className={cn(
          'mb-8',
          mobile ? 'px-5 pt-5' : isCollapsed ? 'flex justify-center px-2' : 'px-5',
        )}
      >
        <Link href="/dashboard" className="flex items-center gap-3 group" title={isCollapsed ? 'QPS·KMIO' : undefined}>
          <div
            className="relative w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(135deg, rgba(0,180,255,0.2), rgba(6,182,212,0.1))',
              border: '1px solid rgba(0,180,255,0.3)',
            }}
          >
            <Activity className="w-5 h-5 text-brand-teal" strokeWidth={1.8} />
          </div>
          {!isCollapsed && (
            <div>
              <div className="text-[0.82rem] font-extrabold text-slate-100 leading-none tracking-wide">
                QPS<span className="text-brand-teal">·</span>KMIO
              </div>
              <div className="text-[0.66rem] text-slate-600 font-medium mt-0.5 tracking-wider uppercase">
                {selectedModule ?? 'Platform'}
              </div>
            </div>
          )}
        </Link>
      </div>

      {/* Module badge */}
      {selectedModule && (
        <div className={cn('mb-3', isCollapsed ? 'px-2' : 'px-3')}>
          {isCollapsed ? (
            <div
              className="flex justify-center py-1.5 rounded-lg"
              title={`Module: ${selectedModule}`}
              style={{ background: 'rgba(0,180,255,0.08)', border: '1px solid rgba(0,180,255,0.15)' }}
            >
              <Layers className="w-3.5 h-3.5 text-brand-teal" />
            </div>
          ) : (
            <div
              className="flex items-center justify-between px-3 py-2 rounded-xl"
              style={{ background: 'rgba(0,180,255,0.08)', border: '1px solid rgba(0,180,255,0.15)' }}
            >
              <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                <div>
                  <div className="text-[0.65rem] text-slate-500 uppercase tracking-widest leading-none mb-0.5">Module</div>
                  <div className="text-xs font-bold text-brand-teal">{selectedModule}</div>
                </div>
              </div>
              {(user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && (
                <button
                  onClick={() => { clearSelectedModule(); router.push('/select-module'); }}
                  title="Switch module"
                  className="p-1 rounded-lg text-slate-500 hover:text-brand-teal hover:bg-brand-teal/10 transition-all"
                >
                  <ArrowLeftRight className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className={cn('flex-1 space-y-3 overflow-y-auto', isCollapsed ? 'px-2' : 'px-3')}>
        {NAV_SECTIONS.map((section) => {
          const items = nav.filter((i) => i.section === section.key);
          if (!items.length) return null;
          return (
            <div key={section.key} className="space-y-0.5">
              {!isCollapsed && section.label ? (
                <div className="px-3 pb-1 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-slate-500/80">{section.label}</div>
              ) : isCollapsed && section.key !== 'main' ? (
                <div className="mx-2 mb-1 h-px bg-white/[0.06]" />
              ) : null}
              {items.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const showCreate = !isCollapsed && item.createHref && item.createRoles?.includes(user.role);
          return (
            <div key={item.href} className="flex items-center gap-1">
              <Link
                href={item.href}
                title={isCollapsed ? item.label : undefined}
                className={cn(
                  'group flex items-center rounded-xl text-sm font-medium transition-all duration-150',
                  isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
                  showCreate ? 'flex-1' : 'w-full',
                  isActive
                    ? 'bg-brand-teal/10 text-brand-teal border border-brand-teal/15'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.05] border border-transparent',
                )}
              >
                <item.icon
                  className={cn(
                    'shrink-0 transition-transform duration-150 group-hover:scale-110',
                    isCollapsed ? 'w-5 h-5' : 'w-4.5 h-4.5',
                    isActive ? 'text-brand-teal' : 'text-slate-500 group-hover:text-slate-300',
                  )}
                  strokeWidth={isActive ? 2 : 1.8}
                />
                {!isCollapsed && (
                  <>
                    <span className="flex-1 truncate">{item.label}</span>
                    {!showCreate && isActive && <ChevronRight className="w-3.5 h-3.5 text-brand-teal/50" />}
                    {item.badge ? (
                      <span className="text-xs font-bold text-white bg-brand-teal rounded-full px-1.5 py-0.5 leading-none min-w-[18px] text-center">
                        {item.badge}
                      </span>
                    ) : null}
                  </>
                )}
              </Link>
              {showCreate && (
                <Link
                  href={item.createHref!}
                  title="New Assessment Cycle"
                  className="p-1.5 rounded-lg text-slate-600 hover:text-brand-teal hover:bg-brand-teal/10 transition-all shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          );
              })}
            </div>
          );
        })}
      </nav>

      {/* Footer: connection status + user card + collapse toggle */}
      <div className={cn('mt-4 space-y-1.5', isCollapsed ? 'px-2' : 'px-3')}>
        {/* Connection status */}
        {isCollapsed ? (
          <div
            className="flex justify-center py-1.5"
            title={connected ? 'Connected' : 'Offline'}
          >
            {connected ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-slate-600" />
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5">
            {connected ? (
              <Wifi className="w-3 h-3 text-emerald-400" />
            ) : (
              <WifiOff className="w-3 h-3 text-slate-600" />
            )}
            <span className={cn('text-xs', connected ? 'text-emerald-400/70' : 'text-slate-600')}>
              {connected ? 'Connected' : 'Offline'}
            </span>
          </div>
        )}

        {/* User card */}
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-1.5 py-1">
            <Link href="/profile" title={user.name}>
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-brand-teal"
                style={{
                  background: 'rgba(0,180,255,0.12)',
                  border: '1px solid rgba(0,180,255,0.2)',
                }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
            </Link>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              title="Sign out"
              className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-white/5 transition-all disabled:opacity-50"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div
            className="px-3 py-3 rounded-xl"
            style={{
              background: 'var(--inner-bg)',
              border: '1px solid var(--inner-border)',
            }}
          >
            <Link href="/profile" className="flex items-start gap-2.5 group">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold text-brand-teal"
                style={{
                  background: 'rgba(0,180,255,0.12)',
                  border: '1px solid rgba(0,180,255,0.2)',
                }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[0.8rem] font-semibold text-slate-200 truncate group-hover:text-brand-teal transition-colors">
                  {user.name}
                </p>
                <p className="text-[0.7rem] text-slate-600 truncate">{user.email}</p>
              </div>
            </Link>
            <div className="mt-2.5 flex items-center justify-between">
              <span
                className={cn(
                  'text-[0.65rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border',
                  ROLE_COLORS[user.role] ?? 'text-slate-400 bg-slate-500/10 border-slate-500/20',
                )}
              >
                {user.role}
              </span>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex items-center gap-1 text-[0.72rem] text-slate-600 hover:text-red-400 transition-colors disabled:opacity-50"
              >
                <LogOut className="w-3 h-3" />
                {loggingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          </div>
        )}

        {/* Collapse toggle (desktop only) */}
        {!mobile && onToggle && (
          <button
            onClick={onToggle}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'w-full flex items-center rounded-xl py-2 text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all',
              isCollapsed ? 'justify-center px-2' : 'gap-2 px-3',
            )}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <>
                <PanelLeftClose className="w-4 h-4" />
                <span className="text-xs font-medium">Collapse</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-surface">

      {/* ── Desktop sidebar ── */}
      <aside
        className={cn(
          'hidden lg:flex flex-col shrink-0 fixed inset-y-0 left-0 z-30 transition-all duration-200 overflow-hidden',
          collapsed ? 'w-16' : 'w-60',
        )}
        style={{
          background: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--sidebar-border)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <Sidebar nav={visibleNav} isCollapsed={collapsed} onToggle={toggleCollapsed} />
      </aside>

      {/* ── Mobile sidebar overlay ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              key="drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed inset-y-0 left-0 z-50 w-72 lg:hidden"
              style={{
                background: 'var(--sidebar-bg)',
                borderRight: '1px solid var(--sidebar-border)',
              }}
            >
              <div className="absolute top-4 right-4">
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/10 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <Sidebar mobile nav={visibleNav} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main content ── */}
      <div
        className={cn(
          'flex-1 flex flex-col transition-all duration-200',
          collapsed ? 'lg:pl-16' : 'lg:pl-60',
        )}
      >
        {/* Top bar */}
        <header
          className="sticky top-0 z-20 flex items-center gap-4 px-4 sm:px-6 h-14"
          style={{
            background: 'var(--topbar-bg)',
            borderBottom: '1px solid var(--topbar-border)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Mobile menu toggle */}
          <button
            className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/10 transition-all"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Breadcrumb / page title */}
          <div className="flex-1">
            <PageTitle pathname={pathname} />
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Active module chip */}
            {selectedModule && (
              (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') ? (
                <button
                  onClick={() => { clearSelectedModule(); router.push('/select-module'); }}
                  className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all hover:opacity-80"
                  style={{ background: 'rgba(0,180,255,0.1)', color: '#38bdf8', borderColor: 'rgba(0,180,255,0.2)' }}
                  title="Switch module"
                >
                  <Layers className="w-3 h-3" />
                  {selectedModule}
                  <ArrowLeftRight className="w-3 h-3 opacity-60" />
                </button>
              ) : (
                <div
                  className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border"
                  style={{ background: 'rgba(0,180,255,0.1)', color: '#38bdf8', borderColor: 'rgba(0,180,255,0.2)' }}
                >
                  <Layers className="w-3 h-3" />
                  {selectedModule}
                </div>
              )
            )}
            {/* Theme toggle — suppress hydration diff by only rendering after mount */}
            <ThemeToggle />

            {/* Notifications */}
            <div ref={notifRef} className="relative">
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className="relative p-2 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/10 transition-all cursor-pointer"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-brand-teal ring-2 ring-surface" />
                )}
              </button>

              <AnimatePresence>
                {notifOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.96 }}
                    transition={{ duration: 0.14, ease: 'easeOut' }}
                    className="absolute right-0 top-full mt-2 w-80 rounded-2xl overflow-hidden z-50"
                    style={{
                      background: 'var(--sidebar-bg)',
                      border: '1px solid var(--sidebar-border)',
                      boxShadow: 'var(--card-shadow)',
                      backdropFilter: 'blur(24px)',
                    }}
                  >
                    {/* Header */}
                    <div
                      className="px-4 py-3 flex items-center justify-between"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-200">Notifications</span>
                        {unreadCount > 0 && (
                          <span className="text-[0.65rem] font-bold bg-brand-teal text-white px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <button
                          onClick={async () => {
                            await api.patch('/notifications/read-all');
                            qc.invalidateQueries({ queryKey: ['notifications'] });
                            qc.invalidateQueries({ queryKey: ['notifications-unread'] });
                          }}
                          className="text-xs text-brand-teal hover:underline transition-colors"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    {/* List */}
                    <div className="max-h-80 overflow-y-auto divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                      {notifLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="px-4 py-3 flex gap-3 animate-pulse">
                            <div className="w-8 h-8 rounded-lg bg-white/5 shrink-0" />
                            <div className="flex-1 space-y-1.5 py-1">
                              <div className="h-3 w-32 rounded bg-white/5" />
                              <div className="h-2.5 w-48 rounded bg-white/5" />
                            </div>
                          </div>
                        ))
                      ) : notifications.length ? (
                        notifications.map((n: any) => {
                          const NIcon = NOTIF_ICON[n.type] ?? Bell;
                          const colors = NOTIF_COLOR[n.type] ?? { bg: 'rgba(0,180,255,0.1)', border: 'rgba(0,180,255,0.2)', icon: '#38bdf8' };
                          return (
                            <div
                              key={n.id}
                              onClick={async () => {
                                if (!n.isRead) {
                                  await api.patch(`/notifications/${n.id}/read`);
                                  qc.invalidateQueries({ queryKey: ['notifications'] });
                                  qc.invalidateQueries({ queryKey: ['notifications-unread'] });
                                }
                                if (n.meta?.assessmentId) {
                                  setNotifOpen(false);
                                  router.push(`/assessments/${n.meta.assessmentId}`);
                                } else if (n.meta?.committeeId) {
                                  setNotifOpen(false);
                                  router.push(
                                    n.meta.meetingId
                                      ? `/committees/${n.meta.committeeId}/meetings/${n.meta.meetingId}`
                                      : `/committees/${n.meta.committeeId}`,
                                  );
                                }
                              }}
                              className="px-4 py-3 flex gap-3 cursor-pointer hover:bg-white/[0.03] transition-colors"
                              style={{ background: n.isRead ? undefined : 'rgba(0,180,255,0.03)' }}
                            >
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
                              >
                                <NIcon className="w-4 h-4" style={{ color: colors.icon }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-semibold text-slate-200 truncate">{n.title}</p>
                                  {!n.isRead && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-brand-teal shrink-0" />
                                  )}
                                </div>
                                <p className="text-[0.7rem] text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                                <p className="text-[0.65rem] text-slate-600 mt-1">{formatRelTime(n.createdAt)}</p>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="py-10 text-center">
                          <Bell className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                          <p className="text-xs text-slate-500">No notifications yet</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* User chip with dropdown */}
            <div ref={userMenuRef} className="relative hidden sm:block">
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl transition-all hover:bg-white/[0.06]"
                style={{ border: '1px solid transparent' }}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-brand-teal shrink-0"
                  style={{
                    background: 'rgba(0,180,255,0.12)',
                    border: '1px solid rgba(0,180,255,0.22)',
                  }}
                >
                  {user?.name?.charAt(0)?.toUpperCase() ?? <User className="w-3.5 h-3.5" />}
                </div>
                <span className="text-sm text-slate-400 font-medium max-w-[100px] truncate">
                  {user?.name}
                </span>
                <ChevronDown
                  className={cn(
                    'w-3.5 h-3.5 text-slate-600 transition-transform duration-200',
                    userMenuOpen && 'rotate-180',
                  )}
                />
              </button>

              <AnimatePresence>
                {userMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.96 }}
                    transition={{ duration: 0.14, ease: 'easeOut' }}
                    className="absolute right-0 top-full mt-2 w-60 rounded-2xl overflow-hidden z-50"
                    style={{
                      background: 'var(--sidebar-bg)',
                      border: '1px solid var(--sidebar-border)',
                      boxShadow: 'var(--card-shadow)',
                      backdropFilter: 'blur(24px)',
                    }}
                  >
                    {/* User info */}
                    <div className="px-4 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold text-brand-teal shrink-0"
                          style={{
                            background: 'rgba(0,180,255,0.12)',
                            border: '1px solid rgba(0,180,255,0.22)',
                          }}
                        >
                          {user?.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-200 truncate">{user?.name}</p>
                          <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <span
                          className={cn(
                            'text-[0.63rem] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border',
                            ROLE_COLORS[user?.role ?? ''] ?? 'text-slate-400 bg-slate-500/10 border-slate-500/20',
                          )}
                        >
                          {user?.role}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="p-2">
                      <Link
                        href="/profile"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] transition-all"
                      >
                        <User className="w-4 h-4" />
                        My Profile
                      </Link>
                      <button
                        onClick={() => { setUserMenuOpen(false); handleLogout(); }}
                        disabled={loggingOut}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:text-red-300 hover:bg-red-500/[0.07] transition-all disabled:opacity-50"
                      >
                        <LogOut className="w-4 h-4" />
                        {loggingOut ? 'Signing out…' : 'Sign out'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          {children}
        </main>
      </div>

      {/* ── Idle timeout warning toast ── */}
      {idleWarning && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-sm px-4 pointer-events-none">
          <div
            className="rounded-2xl overflow-hidden pointer-events-auto"
            style={{
              background: 'var(--sidebar-bg)',
              border: '1px solid rgba(234,179,8,0.35)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(234,179,8,0.1)',
              backdropFilter: 'blur(24px)',
            }}
          >
            {/* Shrinking progress bar */}
            <div className="h-1" style={{ background: 'rgba(234,179,8,0.15)' }}>
              <div
                className="h-full bg-yellow-400 transition-all duration-1000 ease-linear"
                style={{ width: `${(countdown / 300) * 100}%` }}
              />
            </div>

            <div className="px-5 py-4">
              <div className="flex items-start gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: 'rgba(234,179,8,0.12)',
                    border: '1px solid rgba(234,179,8,0.25)',
                  }}
                >
                  <Clock className="w-4 h-4 text-yellow-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-200">Session expiring soon</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    You&apos;ll be logged out due to inactivity in{' '}
                    <span className="text-yellow-400 font-mono font-bold tabular-nums">
                      {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
                    </span>
                  </p>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => resetIdleRef.current?.()}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: 'rgba(0,180,255,0.1)',
                    color: '#38bdf8',
                    border: '1px solid rgba(0,180,255,0.2)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,180,255,0.2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0,180,255,0.1)')}
                >
                  Stay logged in
                </button>
                <button
                  onClick={() => { clearAuth(); router.replace('/login'); }}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold text-red-400 transition-all"
                  style={{ border: '1px solid rgba(239,68,68,0.2)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  Logout now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PageTitle({ pathname }: { pathname: string }) {
  const segments = pathname.split('/').filter(Boolean);
  const primary = segments[0];

  const titles: Record<string, string> = {
    dashboard: 'Dashboard',
    assessments: 'Assessments',
    'assessment-cycles': 'Assessment Cycles',
    approvals: 'Approvals',
    committees: 'Committees',
    reports: 'Reports & Analytics',
    indicators: 'Quality Indicators',
    'kpi-templates': 'Indicator Setup',
    'audit-logs': 'Audit Logs',
    settings: 'Settings',
    users: 'User Management',
    profile: 'My Profile',
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-slate-500 font-medium">KMIO</span>
      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
      <span className="font-semibold capitalize" style={{ color: 'var(--text-base)' }}>
        {titles[primary] ?? primary}
      </span>
    </div>
  );
}
