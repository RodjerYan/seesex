import { BarChart3, Heart, Home, Lock, Settings, Users, type LucideIcon } from 'lucide-react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';

import { SecurityLock } from '../components/security/SecurityLock';
import { useAutoLock } from '../hooks/useAutoLock';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

/** Нижний таб-бар (mobile) и сайдбар (sm+) используют один набор пунктов. */
const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Главная', icon: Home, end: true },
  { to: '/events', label: 'События', icon: Heart },
  { to: '/partners', label: 'Партнёры', icon: Users },
  { to: '/statistics', label: 'Статистика', icon: BarChart3 },
  { to: '/settings', label: 'Настройки', icon: Settings },
];

function tabLinkClassName(isActive: boolean): string {
  const base = 'flex flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-2 transition-colors';
  return isActive
    ? `${base} text-primary tab-active-glow`
    : `${base} text-slate-500`;
}

function sidebarLinkClassName(isActive: boolean): string {
  const base = 'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors';
  return isActive
    ? `${base} text-primary bg-white/[0.06] tab-active-glow`
    : `${base} text-slate-400 hover:bg-white/[0.06] hover:text-slate-100`;
}

/**
 * Оболочка приложения: header + safe-area + нижняя таб-навигация (mobile-first)
 * и сайдбар на десктопе (sm+).
 */
export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  // Автоблокировка (неактивность / фон вкладки) + ручная блокировка из шапки.
  const { locked, settings, lock, unlock } = useAutoLock();

  return (
    <div className="min-h-dvh bg-surface text-slate-100">
      <header className="app-header fixed inset-x-0 top-0 z-30 glass-strong">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-lg grad-intimate text-sm font-bold text-white"
            >
              x
            </span>
            <span className="text-base font-semibold tracking-tight brand-gradient">SeeSex</span>
          </div>
          <button
            type="button"
            aria-label="Заблокировать приложение"
            onClick={() => {
              if (settings.secretHash) lock();
              else navigate('/settings'); // Секрет не задан — предложить настроить PIN.
            }}
            className="press rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Lock className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      <SecurityLock locked={locked} settings={settings} onUnlock={unlock} />

      {/* Desktop: сайдбар вместо нижнего таб-бара (sm+). */}
      <aside
        aria-label="Навигация"
        className="app-sidebar fixed bottom-0 left-0 z-20 hidden w-56 flex-col gap-1 glass-strong sm:flex"
      >
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => sidebarLinkClassName(isActive)}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </aside>

      <main className="app-main mx-auto max-w-3xl sm:max-w-4xl">
        <Outlet />
      </main>

      {/* Mobile: нижняя таб-навигация. */}
      <nav
        aria-label="Основная навигация"
        className="app-tabbar fixed inset-x-0 bottom-0 z-30 glass-strong sm:hidden"
      >
        <ul className="mx-auto flex max-w-lg items-stretch justify-around">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink to={to} end={end} className={({ isActive }) => tabLinkClassName(isActive)}>
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="text-[10px] font-medium">{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}