/** Рейтинг-звёзды 1–5 (просмотр и выбор в форме события). */
import { Star } from 'lucide-react';
import type { ReactElement } from 'react';

import { cx } from './controls';

interface StarsProps {
  value: number | null | undefined;
  /** Если задан — звёзды кликабельны (выбор оценки). */
  onChange?: (value: number) => void;
  /** Сброс оценки (только в режиме редактирования). */
  onClear?: () => void;
  size?: 'sm' | 'md';
}

export function Stars({ value, onChange, onClear, size = 'sm' }: StarsProps): ReactElement {
  const iconClass = size === 'md' ? 'h-6 w-6' : 'h-4 w-4';
  const rating = value ?? 0;

  if (!onChange) {
    if (!rating) return <span className="text-xs text-slate-500">Без оценки</span>;
    return (
      <span className="inline-flex items-center gap-0.5" aria-label={`Оценка ${rating} из 5`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            aria-hidden="true"
            className={cx(iconClass, star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-700')}
          />
        ))}
        <span className="ml-1 text-xs text-slate-400">{rating}/5</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          aria-label={`Оценка ${star}`}
          onClick={() => onChange(star)}
          className="rounded p-0.5 transition-colors hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        >
          <Star
            aria-hidden="true"
            className={cx(
              iconClass,
              star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-600',
            )}
          />
        </button>
      ))}
      {onClear && rating > 0 ? (
        <button
          type="button"
          onClick={onClear}
          className="ml-1 rounded px-1 text-xs text-slate-500 hover:text-slate-300"
        >
          сбросить
        </button>
      ) : null}
    </span>
  );
}
