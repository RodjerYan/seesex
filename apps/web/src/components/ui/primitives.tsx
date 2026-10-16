/**
 * Примитивы дизайн-системы «Премиальный нуар» (S1) — источник для экранов S2–S5.
 * Только разметка и стили: никакой логики, обработчиков и состояний.
 * Правила (apps/web/artifacts/design-spec.md):
 * - карточка = .glass (solid elev1 + hairline, без backdrop-blur);
 * - радиусы: карточки 20 / плитки 16 / контролы 12 / чипы full;
 * - типографика: H2 17/600, display 28–34/700 tabular-nums, label 12/500;
 * - статусы: occurred → rose-гамма, turndown → slate, planned → violet.
 * `Card` реэкспортируется из controls.tsx — единый компонент во всём приложении.
 */
import type { ElementType, ReactElement, ReactNode } from 'react';

import { cx } from './controls';

export { Card } from './controls';

/**
 * Заголовок секции: H2 17/600 (+ необязательное действие справа).
 * `as` — тег заголовка (по умолчанию h2).
 */
export function SectionHeader({
  children,
  action,
  className,
  as = 'h2',
}: {
  children: ReactNode;
  /** Кнопка/ссылка справа от заголовка. */
  action?: ReactNode;
  className?: string;
  as?: 'h2' | 'h3' | 'div';
}): ReactElement {
  const Comp = as as ElementType;
  return (
    <div className={cx('mb-3 flex items-center justify-between gap-3', className)}>
      <Comp className="min-w-0 text-[17px] font-semibold leading-6 text-ink">{children}</Comp>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/**
 * Строка списка (внутри .glass-карточки): leading-слот, контент 15px, trailing.
 * Разделители — по желанию вызывающего: `border-t border-white/[0.08]` в className.
 */
export function ListRow({
  leading,
  children,
  trailing,
  className,
  as = 'div',
}: {
  leading?: ReactNode;
  children: ReactNode;
  trailing?: ReactNode;
  className?: string;
  as?: 'div' | 'li';
}): ReactElement {
  const Comp = as as ElementType;
  return (
    <Comp className={cx('flex items-center gap-3 px-4 py-3', className)}>
      {leading ? <span className="shrink-0">{leading}</span> : null}
      <div className="min-w-0 flex-1 text-[15px] leading-5 text-ink">{children}</div>
      {trailing ? <span className="shrink-0 text-[13px] text-ink-muted">{trailing}</span> : null}
    </Comp>
  );
}

/**
 * Плитка метрики: крупное число (display, tabular-nums) + лейбл.
 * Радиус плитки 16 (rounded-tile поверх .glass).
 */
export function StatTile({
  value,
  label,
  hint,
  className,
}: {
  value: ReactNode;
  label: ReactNode;
  hint?: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <div className={cx('glass rounded-tile p-4', className)}>
      <div className="type-display text-ink">{value}</div>
      <div className="type-label mt-1 text-ink-dim">{label}</div>
      {hint ? <div className="mt-1 text-[13px] text-ink-muted">{hint}</div> : null}
    </div>
  );
}

export type BadgeTone = 'neutral' | 'rose' | 'red' | 'amber' | 'emerald' | 'violet' | 'sky' | 'slate';

/** Гаммы тонов: semantic iOS-цвета не ломаем, rose — только акцент бренда. */
const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-white/[0.06] text-ink-muted ring-white/[0.08]',
  rose: 'bg-primary/[0.14] text-primary-400 ring-primary/25',
  red: 'bg-red-500/15 text-red-400 ring-red-500/25',
  amber: 'bg-amber-500/15 text-amber-400 ring-amber-500/25',
  emerald: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25',
  violet: 'bg-violet-500/15 text-violet-300 ring-violet-500/25',
  sky: 'bg-sky-500/15 text-sky-300 ring-sky-500/25',
  slate: 'bg-slate-500/20 text-slate-300 ring-slate-400/25',
};

/** Универсальный чип-бейдж (полный радиус, hairline ring, тонированный фон). */
export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium leading-4 ring-1 ring-inset',
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Статус события (целевые значения для S2 — STATUS_PILL в CalendarView не трогаем). */
export type EventStatusKind = 'occurred' | 'turndown' | 'planned';

const STATUS_STYLES: Record<EventStatusKind, string> = {
  // occurred — приглушённая rose-гамма (вместо кричащего red)
  occurred: 'bg-primary/[0.16] text-primary-400 ring-primary/30',
  // turndown — slate (нейтральный отказ)
  turndown: 'bg-slate-500/20 text-slate-300 ring-slate-400/30',
  // planned — violet
  planned: 'bg-violet-500/15 text-violet-300 ring-violet-500/30',
};

const STATUS_DOT: Record<EventStatusKind, string> = {
  occurred: 'bg-[#F5296E]',
  turndown: 'bg-[#8E8E93]',
  planned: 'bg-[#BF5AF2]',
};

/** Пилюля статуса события: точка-индикатор + подпись (текст — снаружи). */
export function StatusPill({
  status,
  children,
  className,
  dot = true,
}: {
  status: EventStatusKind;
  children: ReactNode;
  className?: string;
  /** Точка-индикатор статуса (по умолчанию включена). */
  dot?: boolean;
}): ReactElement {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium leading-4 ring-1 ring-inset',
        STATUS_STYLES[status],
        className,
      )}
    >
      {dot ? (
        <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', STATUS_DOT[status])} aria-hidden="true" />
      ) : null}
      {children}
    </span>
  );
}
