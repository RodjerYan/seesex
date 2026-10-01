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
 * Слот мобильной пилюли (T10-S1, ревизия S4): hit-area 48×48 (≥44pt HIG),
 * только иконка 24px (текстовый лейбл заменён на aria-label у NavLink).
 *
 * Активная вкладка — «дорогой» тёмный капсульный хайлайт поверх серой
 * пилюли: глубокий вертикальный градиент (капсуль всегда ТЁМНЕЕ пилюли,
 * контраст читается мгновенно), hairline-обводка ring-white/16, тонкая
 * световая линия по верхней кромке + внутренний inset-виньет (объём),
 * плотная нижняя тень (капсуль «приподнят») и очень мягкий розовый
 * ореол бренда; иконка вырастает (scale-110) и всегда pure white.
 * Иконки всех слотов получают лёгкий drop-shadow — контраст не тонет
 * в контенте, просвечивающем сквозь стекло пилюли.
 *
 * Переходы точечные: цвет/трансформ/тень плавные (200ms), background-color —
 * мгновенный, чтобы подсветка не «запаздывала» за пальцем. Tap-фидбэк
 * (T7-S2): active:scale-95 + instant-подсветка неактивного слота;
 * touch-manipulation убирает double-tap-zoom-задержку; active:opacity-100
 * глушит глобальный a:active-opacity (иначе пилюля мигала бы на десктопе).
 */
function tabLinkClassName(isActive: boolean): string {
  const base =
    'relative flex h-12 w-12 items-center justify-center rounded-full ' +
    'touch-manipulation transition-[color,transform,box-shadow] duration-200 ease-out ' +
    'active:scale-95 active:opacity-100 ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400';
  return isActive
    ? `${base} bg-gradient-to-b from-black/55 via-black/60 to-black/75 text-white ring-1 ring-white/[0.16] shadow-[inset_0_1px_0_rgba(255,255,255,0.28),inset_0_0_12px_rgba(0,0,0,0.5),0_6px_16px_-6px_rgba(0,0,0,0.85),0_0_14px_-7px_rgba(245,41,110,0.5)] active:bg-black/80`
    : `${base} text-white/70 hover:text-white hover:bg-white/[0.08] active:bg-white/20 active:text-white`;
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
        {/* Логотип по центру шапки (T10-S2): кнопка блокировки вынесена в
            absolute справа, чтобы не сдвигать/перекрывать надпись. */}
        <div className="relative mx-auto flex h-14 max-w-5xl items-center justify-center px-4">
          <span className="logo-script font-['Great_Vibes'] text-[26px] leading-none tracking-tight brand-gradient">
            SeeSex
          </span>
          <button
            type="button"
            aria-label="Заблокировать приложение"
            onClick={() => {
              if (settings.secretHash) lock();
              else navigate('/settings'); // Секрет не задан — предложить настроить PIN.
            }}
            className="press absolute right-4 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
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

      {/* Mobile: плавающая таб-пилюля (T10-S1, ревизия S4) — парит над
          контентом, контент прокручивается ПОД неё; отступ снизу учитывает
          home-indicator (var(--sab)), от краёв экрана ~16px, max-width
          ограничен (32.5rem). Геометрия пилюли не изменилась
          (h-12 слот + py-1.5 = 60px, как h-11 + py-2) — FAB-отступ
          (--tabbar-height) остаётся валидным.
          На sm+ скрыта — сайдбар остаётся без изменений. */}
      <nav
        aria-label="Основная навигация"
        className="glass-pill fixed bottom-[calc(var(--sab)_+_1rem)] left-[max(1rem,var(--sal))] right-[max(1rem,var(--sar))] z-30 mx-auto max-w-[32.5rem] rounded-full px-2 py-1.5 sm:hidden"
      >
        {/* flex-1 у каждого <li> → 5 слотов делят ширину поровну
            (эквивалент justify-around, но без «плавающих» краёв):
            5×48px + 4×4px gap + 2×8px padding = 272px ≤ 32.5rem. */}
        <ul className="flex items-center justify-between gap-1">
          {NAV_ITEMS.map(({ to, label, pillIcon: Icon, end, badge }) => (
            <li key={to} className="flex flex-1 items-center justify-center">
              <NavLink
                to={to}
                end={end}
                aria-label={label}
                className={({ isActive }) => tabLinkClassName(isActive)}
              >
                {({ isActive }) => (
                  <>
                    {/* 24px (≥24pt), у активной вкладки слегка крупнее;
                        drop-shadow — читаемость поверх контента за стеклом. */}
                    <Icon
                      className={`h-6 w-6 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] transition-transform duration-200 ${
                        isActive ? 'scale-110' : ''
                      }`}
                      aria-hidden="true"
                    />
                    {badge ? (
                      /* Слот красной точки-баджа (по макету). Сейчас триггера нет —
                         badge={false}, см. TODO у NAV_ITEMS выше. */
                      <span
                        aria-hidden="true"
                        className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-black/40"
                      />
                    ) : null}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}