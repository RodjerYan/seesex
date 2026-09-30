/**
 * Состояния списков (T7-S2): карточный скелетон загрузки и пустое состояние.
 * Скелетон — тот же компонент, что fallback контентной зоны в Layout
 * (единая разметка, без дублирования), пустое состояние — глиф-иллюстрация,
 * понятный текст и primary-CTA через существующие кнопки проекта.
 */
import type { LucideIcon } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

/** Скелетон из glass-карточек: shimmer-полоски (.skeleton) + пульсация (.skeleton-card). */
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

/** Пустое состояние списка: глиф в glass-капле, заголовок, объяснение, primary-CTA. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}): ReactElement {
  return (
    <div className="glass px-4 py-8 text-center">
      <span
        aria-hidden="true"
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/10"
      >
        <Icon className="h-7 w-7 text-primary-400" />
      </span>
      <p className="mt-3 text-sm font-medium text-slate-200">{title}</p>
      {description ? <p className="mx-auto mt-1 max-w-xs text-xs text-slate-500">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
