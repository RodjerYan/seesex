/**
 * Состояния списков (T7-S2): карточный скелетон загрузки и пустое состояние.
 * Скелетон — тот же компонент, что fallback контентной зоны в Layout
 * (единая разметка, без дублирования). S1 «Премиальный нуар»: скелетон
 * на elevated (.glass solid + hairline), пустое состояние — тот же язык,
 * что у EmptyBlock (states.tsx): плитка-иконка 48px, заголовок 15/600,
 * подсказка 13 muted, CTA снаружи. API/экспорты не менялись.
 */
import type { LucideIcon } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

import { cx } from './controls';
import { EmptyIconTile } from './states';

/** Скелетон из elevated-карточек: shimmer-полоски (.skeleton) + пульсация (.skeleton-card). */
export function CardSkeleton({
  count = 3,
  label = 'Загрузка…',
}: {
  count?: number;
  label?: string;
}): ReactElement {
  return (
    <div role="status" aria-label={label} className="space-y-4">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="skeleton-card glass p-5" aria-hidden="true">
          <div className="skeleton h-4 w-2/5 rounded-lg" />
          <div className="skeleton mt-3 h-3 w-full rounded-lg" />
          <div className="skeleton mt-2 h-3 w-3/4 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/** Пустое состояние списка: глиф в тонированной плитке 48px, заголовок, объяснение, CTA. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  iconClass,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  /** Доп. классы для глифа (например, animate-heart-beat в Wishlist). */
  iconClass?: string;
}): ReactElement {
  return (
    <div className="glass px-4 py-8 text-center">
      <EmptyIconTile>
        <Icon className={cx('h-6 w-6 text-primary-400', iconClass)} />
      </EmptyIconTile>
      <p className="mt-3 text-[15px] font-semibold leading-5 text-ink">{title}</p>
      {description ? (
        <p className="mx-auto mt-1 max-w-xs text-[13px] text-ink-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
