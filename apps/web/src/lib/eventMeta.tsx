/**
 * eventMeta — единый маппинг «тип события → { лейбл, иконка, цвет }».
 *
 * Лейблы НЕ дублируем: берём их из lib/eventTypeLabels (eventTypeLabel),
 * здесь — только источник иконки/цвета. Значения полей (eventType) не меняем,
 * модуль только для отображения (EventForm-чипы, карточки, легенды, статистика).
 */
import {
  Ban,
  Flame,
  Hand,
  Heart,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

import { eventTypeLabel } from './eventTypeLabels';

export interface EventMeta {
  label: string;
  Icon: LucideIcon;
  color: string;
}

export const EVENT_META: Record<string, EventMeta> = {
  SEX: { label: eventTypeLabel('SEX'), Icon: Heart, color: '#FF6BA3' },
  KISS: { label: eventTypeLabel('KISS'), Icon: Sparkles, color: '#E0B8FF' },
  MASSAGE: { label: eventTypeLabel('MASSAGE'), Icon: Hand, color: '#A78BFA' },
  ORAL: { label: eventTypeLabel('ORAL'), Icon: Flame, color: '#FB7185' },
  ANAL: { label: eventTypeLabel('ANAL'), Icon: Flame, color: '#FB923C' },
  OTHER: { label: eventTypeLabel('OTHER'), Icon: Flame, color: '#FF6BA3' },
  TURNDOWN: { label: eventTypeLabel('TURNDOWN'), Icon: Ban, color: '#6B7280' },
};

/** Иконка/цвет фоллбэка «своего» типа (CUSTOM и любой произвольный ключ). */
const CUSTOM_FALLBACK = { Icon: Sparkles, color: '#E0B8FF' };

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
