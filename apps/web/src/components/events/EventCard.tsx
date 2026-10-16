/** Карточка события: дата, тип, статус, рейтинг, партнёры. */
import { Clock, Trash2 } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { formatDate, formatDuration, formatTime } from '../../lib/format';
import type { CalendarStatus, EventView } from '../../types/api';
import { eventMeta } from '../../lib/eventMeta';
import { StatusPill } from '../ui/primitives';
import { Stars } from '../ui/Stars';

export const STATUS_LABEL: Record<CalendarStatus, string> = {
  occurred: 'Состоялось',
  planned: 'Запланировано',
  turndown: 'Отказ',
};

interface EventCardProps {
  event: EventView;
  onDelete?: () => void;
  /** Показывать имя группового календаря (список группы). */
  showGroupName?: boolean;
  /** Карточка в процессе удаления (optimistic) — показывать спиннер/дизейбл. */
  isDeleting?: boolean;
}

export function EventCard({ event, onDelete, showGroupName, isDeleting }: EventCardProps): ReactElement {
  const date = new Date(event.date);
  const types = event.eventTypes?.length ? event.eventTypes : [event.eventType];
  const partnerNames = event.partners.map((partner) => partner.name);

  return (
    <div className="glass transition-colors press hover:ring-1 hover:ring-white/10 active:ring-1 active:ring-white/20">
      <Link to={`/events/${event.id}`} className="block p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="num text-sm font-medium text-ink">
              {formatDate(event.date)}
              <span className="ml-2 text-xs font-normal text-ink-muted">{formatTime(date)}</span>
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              {event.title ? <p className="truncate text-xs text-ink-muted">{event.title}</p> : null}
              {types.map((type) => {
                const { Icon, color, label } = eventMeta(type);
                return (
                  <span
                    key={type}
                    // S3 (review M-02): read-only чип — однократный twinkle при
                    // mount. Hover/press-glow (sensual-chip) намеренно НЕ тут:
                    // карточка не интерактивна по чипам; интерактивные чипы —
                    // в EventForm (sensual-chip press-pop).
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] animate-sensual-pop"
                    style={{
                      borderColor: `${color}55`,
                      backgroundColor: `${color}1A`,
                      color,
                    }}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {label}
                  </span>
                );
              })}
              {types.length > 3 && <span className="text-[11px] text-ink-dim">+{types.length - 3}</span>}
              {event.isCustomType ? <span className="text-[11px] text-ink-dim">свой тип</span> : null}
            </div>
          </div>
          <StatusPill status={event.status} className="shrink-0">
            {STATUS_LABEL[event.status]}
          </StatusPill>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Stars value={event.rating} />
          {event.duration !== null ? (
            <span className="num flex items-center gap-1 text-xs text-ink-muted">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {formatDuration(event.duration)}
            </span>
          ) : null}
        </div>

        {partnerNames.length > 0 ? (
          <p className="mt-2 truncate text-xs text-ink-muted">Партнёры: {partnerNames.join(', ')}</p>
        ) : null}
        {showGroupName && event.groupCalendar ? (
          <p className="mt-1 text-xs text-primary-400">Групповой календарь: {event.groupCalendar.name}</p>
        ) : null}
      </Link>

      {onDelete ? (
        <div className="flex justify-end border-t border-white/[0.08] px-3 py-2">
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            aria-label="Удалить событие"
            className="press flex min-h-[40px] items-center gap-1 rounded-full px-3 py-1.5 text-xs text-ink-dim transition-colors hover:bg-white/[0.06] hover:text-red-400 active:bg-white/[0.12] active:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? (
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="none"
                  strokeDasharray="31.4 31.4"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {isDeleting ? 'Удаление…' : 'Удалить'}
          </button>
        </div>
      ) : null}
    </div>
  );
}