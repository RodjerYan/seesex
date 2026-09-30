import {
  BarChart3,
  CalendarDays,
  Heart,
  Home,
  Lock,
  Settings,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Suspense } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { SecurityLock } from '../components/security/SecurityLock';
import { CardSkeleton } from '../components/ui/listStates';
import { useAutoLock } from '../hooks/useAutoLock';

interface NavItem {
  to: string;
  label: string;
  /** Иконка сайдбара (sm+). */
  icon: LucideIcon;
  /** Иконка слота в мобильной пилюле (семантика по макету T10-S1). */
  pillIcon: LucideIcon;
  end?: boolean;
  /** Красная точка-бейдж слота (см. TODO у «Событий»). */
  badge?: boolean;
}

/**
 * Нижний таб-бар (mobile, пилюля) и сайдбар (sm+) используют один набор пунктов,
 * но иконки различаются: пилюля — только иконки по семантике макета
 * (home / календарь / сердце / график / профиль), сайдбар — без изменений.
 */
const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Главная', icon: Home, pillIcon: Home, end: true },
  // TODO(T10-S1): реального триггера для бейджа в существующих данных нет —
  // «непрочитанных» и сигнала «события сегодня» без нового сетевого запроса
  // в приложении не существует. Подключить источник (unread/notify), когда появится;
  // фейковые уведомления не показываем.
  { to: '/events', label: 'События', icon: Heart, pillIcon: CalendarDays, badge: false },
  { to: '/partners', label: 'Партнёры', icon: Users, pillIcon: Heart },
  { to: '/statistics', label: 'Статистика', icon: BarChart3, pillIcon: BarChart3 },
  { to: '/settings', label: 'Настройки', icon: Settings, pillIcon: User },
];

/**
 * Слот мобильной пилюли (T10-S1): hit-area 44×44, только иконка
 * (текстовый лейбл заменён на aria-label у NavLink), активная вкладка —
 * тёмный капсульный хайлайт (чёрный поверх серой пилюли) + solid white
 * иконка, переход плавный (transition). Tap-фидбэк (T7-S2): слегка сжимается
 * слот, неактивная вкладка подсвечивается на мгновение; active:opacity-100
 * глушит глобальный a:active-opacity (иначе пилюля мигала бы).
 */
function tabLinkClassName(isActive: boolean): string {
  const base =
    'relative flex h-11 w-11 items-center justify-center rounded-full ' +
    'transition duration-200 active:scale-95 active:opacity-100 ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400';
  return isActive
    ? `${base} bg-black/45 text-white active:bg-black/60`
    : `${base} text-white/60 hover:text-white/90 active:text-white/90`;
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
  // Автоблокировка (неактивность / фон вкладки) + ручная блокировка из шапки.
  const { locked, settings, lock, unlock } = useAutoLock();

  return (
    <div className="app-dvh bg-surface text-slate-100">
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
        {/* Suspense именно здесь: при загрузке lazy-чанка гаснет только контент,
            шапка/таб-бар/фон остаются на месте (fallback — общий скелетон,
            см. components/ui/listStates). */}
        <Suspense fallback={<CardSkeleton label="Загрузка страницы" />}>
          <Outlet />
        </Suspense>
      </main>

      {/* Mobile: плавающая таб-пилюля (T10-S1) — парит над контентом,
          контент прокручивается ПОД неё; отступ снизу учитывает home-indicator
          (var(--sab)), от краёв экрана ~16px, max-width ограничен (~520px).
          На sm+ скрыта — сайдбар остаётся без изменений. */}
      <nav
        aria-label="Основная навигация"
        className="glass-pill fixed bottom-[calc(var(--sab)_+_1rem)] left-[max(1rem,var(--sal))] right-[max(1rem,var(--sar))] z-30 mx-auto max-w-[32.5rem] rounded-full px-2 py-2 sm:hidden"
      >
        <ul className="flex items-center justify-between gap-1">
          {NAV_ITEMS.map(({ to, label, pillIcon: Icon, end, badge }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                aria-label={label}
                className={({ isActive }) => tabLinkClassName(isActive)}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {badge ? (
                  /* Слот красной точки-баджа (по макету). Сейчас триггера нет —
                     badge={false}, см. TODO у NAV_ITEMS выше. */
                  <span
                    aria-hidden="true"
                    className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-black/40"
                  />
                ) : null}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}