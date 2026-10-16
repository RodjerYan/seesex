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
    if (!rating) return <span className="text-xs text-ink-dim">Без оценки</span>;
    return (
      <span className="inline-flex items-center gap-0.5" aria-label={`Оценка ${rating} из 5`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            aria-hidden="true"
            className={cx(iconClass, star <= rating ? 'fill-primary text-primary' : 'text-white/15')}
          />
        ))}
        <span className="num ml-1 text-xs text-ink-muted">{rating} из 5</span>
      </span>
    );
  }

  return (
    // S8: тап-зона каждой звезды ≥40px (p-2 при иконке 24px у «md»);
    // gap сжат (0.5), чтобы ряд не разъезжался и влезал в карточку на узких экранах.
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          aria-label={`Оценка ${star}`}
          onClick={() => onChange(star)}
          className="rounded p-2 transition-colors hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        >
          <Star
            aria-hidden="true"
            className={cx(
              iconClass,
              star <= rating ? 'fill-primary text-primary' : 'text-white/15',
              // S3: волна слева-направо по выбранной оценке.
              // 45ms — stagger между звёздами (magic number макета, review m-02):
              // достаточно, чтобы волна читалась, короче star-wave (380ms).
              star <= rating && rating > 0 ? 'animate-star-wave' : '',
            )}
            style={star <= rating && rating > 0 ? { animationDelay: `${(star - 1) * 45}ms` } : undefined}
          />
        </button>
      ))}
      {onClear && rating > 0 ? (
        <button
          type="button"
          onClick={onClear}
          className="ml-1 rounded px-1 text-xs text-ink-dim hover:text-ink"
        >
          сбросить
        </button>
      ) : null}
    </span>
  );
}
