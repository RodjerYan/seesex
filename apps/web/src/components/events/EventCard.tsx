/** Карточка события: дата, тип, статус, рейтинг, партнёры/позиции. */
import { Clock, Trash2 } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { formatDate, formatDuration, formatTime } from '../../lib/format';
import type { CalendarStatus, EventView } from '../../types/api';
import { cx } from '../ui/controls';
import { eventMeta } from '../../lib/eventMeta';
import { Stars } from '../ui/Stars';

export const STATUS_LABEL: Record<CalendarStatus, string> = {
  occurred: 'Состоялось',
  planned: 'Запланировано',
  turndown: 'Отказ',
};

const STATUS_CLASS: Record<CalendarStatus, string> = {
  occurred: 'border-red-500/40 bg-red-500/10 text-red-300',
  planned: 'border-violet-500/40 bg-violet-500/10 text-violet-300',
  turndown: 'border-white/10 bg-white/[0.06] text-slate-400',
};

interface EventCardProps {
  event: EventView;
  onDelete?: () => void;
  /** Показывать имя группового календаря (список группы). */
  showGroupName?: boolean;
}

export function EventCard({ event, onDelete, showGroupName }: EventCardProps): ReactElement {
  const date = new Date(event.date);
  const { Icon, color, label } = eventMeta(event.eventType);
  const partnerNames = event.partners.map((partner) => partner.name);
  const positionNames = event.positions.map((position) => position.name);

  return (
    <div className={cx('glass transition-colors press hover:ring-1 hover:ring-white/10 active:ring-1 active:ring-white/20')}>
      <Link to={`/events/${event.id}`} className="block p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-100">
              {formatDate(event.date)}
              <span className="ml-2 text-xs font-normal text-slate-500">{formatTime(date)}</span>
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              {event.title ? <p className="truncate text-xs text-slate-400">{event.title}</p> : null}
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]"
                style={{
                  borderColor: `${color}55`,
                  backgroundColor: `${color}1A`,
                  color,
                }}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
              </span>
              {event.isCustomType ? <span className="text-[11px] text-slate-500">свой тип</span> : null}
            </div>
          </div>
          <span
            className={cx(
              'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium',
              STATUS_CLASS[event.status],
            )}
          >
            {STATUS_LABEL[event.status]}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Stars value={event.rating} />
          {event.duration !== null ? (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {formatDuration(event.duration)}
            </span>
          ) : null}
        </div>

        {partnerNames.length > 0 ? (
          <p className="mt-2 truncate text-xs text-slate-400">Партнёры: {partnerNames.join(', ')}</p>
        ) : null}
        {positionNames.length > 0 ? (
          <p className="mt-1 truncate text-xs text-slate-500">{positionNames.join(', ')}</p>
        ) : null}
        {showGroupName && event.groupCalendar ? (
          <p className="mt-1 text-xs text-primary-400">Групповой календарь: {event.groupCalendar.name}</p>
        ) : null}
      </Link>

      {onDelete ? (
        <div className="flex justify-end border-t border-white/10 px-3 py-2">
          <button
            type="button"
            onClick={onDelete}
            aria-label="Удалить событие"
            className="press flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-red-400 active:bg-white/[0.12] active:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Удалить
          </button>
        </div>
      ) : null}
    </div>
  );
}