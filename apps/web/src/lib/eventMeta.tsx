/**
 * eventMeta — единый маппинг «тип события → { лейбл, иконка, цвет }».
 *
 * Лейблы НЕ дублируем: берём их из lib/eventTypeLabels (eventTypeLabel),
 * здесь — только источник иконки/цвета. Значения полей (eventType) не меняем,
 * модуль только для отображения (EventForm-чипы, карточки, легенды, статистика).
 */
import { eventTypeLabel } from './eventTypeLabels';

/**
 * EmojiIcon — компонент, рендерирующий эмодзи внутри span.
 * Принимает className и распределяет его, fontSize: '1em' (под h-3.5/w-3.5 и h-4/w-4).
 */
const emojiIcon = (emoji: string) =>
  function EmojiIcon({ className = '' }: { className?: string }) {
    return (
      <span
        aria-hidden="true"
        className={`inline-flex items-center justify-center leading-none ${className}`}
        style={{ fontSize: '1em' }}
      >
        {emoji}
      </span>
    );
  };

export interface EventMeta {
  label: string;
  Icon: ReturnType<typeof emojiIcon>; // ComponentType<{ className?: string }>
  color: string;
}

export const EVENT_META: Record<string, EventMeta> = {
  SEX: { label: eventTypeLabel('SEX'), Icon: emojiIcon('❤️'), color: '#FF6BA3' },
  KISS: { label: eventTypeLabel('KISS'), Icon: emojiIcon('💋'), color: '#E0B8FF' },
  MASSAGE: { label: eventTypeLabel('MASSAGE'), Icon: emojiIcon('💆'), color: '#A78BFA' },
  ORAL: { label: eventTypeLabel('ORAL'), Icon: emojiIcon('👄'), color: '#FB7185' },
  ANAL: { label: eventTypeLabel('ANAL'), Icon: emojiIcon('🍑'), color: '#FB923C' },
  OTHER: { label: eventTypeLabel('OTHER'), Icon: emojiIcon('🧩'), color: '#FF6BA3' },
  TURNDOWN: { label: eventTypeLabel('TURNDOWN'), Icon: emojiIcon('🚫'), color: '#6B7280' },
};

/* Иконка/цвет фоллбэка «своего» типа (CUSTOM и любой произвольный ключ). */
const CUSTOM_FALLBACK = { Icon: emojiIcon('✨'), color: '#E0B8FF' };

/**
 * Метаданные типа события по «сырому» значению из данных/API.
 *
 * - известный ключ (в т.ч. в разном регистре) → EVENT_META;
 * - REFUSED / «TURN DOWN» → meta(TURNDOWN) (тот же русский лейбл «Отказ»);
 * - всё прочее — кастомный тип: лейбл из eventTypeLabel, иконка/цвет — как «свой тип».
 */
export function eventMeta(raw: string): EventMeta {
  const key = raw.trim().toUpperCase();
  const known = EVENT_META[key];
  if (known) return known;
  if (key === 'REFUSED' || key === 'TURN DOWN') return EVENT_META.TURNDOWN;
  return { ...CUSTOM_FALLBACK, label: eventTypeLabel(raw) };
}
