/**
 * Главная: приветствие + дата, мини-календарь месяца, события выбранного дня,
 * сводка (useOverview) и последние события + быстрые действия.
 */
import { ArrowRight, BarChart3, CalendarDays, Plus, Sparkles, Users } from 'lucide-react';
import { useMemo, useState, type ReactElement } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { CalendarView } from '../components/calendar/CalendarView';
import { EventCard } from '../components/events/EventCard';
import { StatTile } from '../components/statistics/Charts';
import { Button, Card, SectionTitle } from '../components/ui/controls';
import { CardSkeleton, EmptyState } from '../components/ui/listStates';
import { ErrorBlock } from '../components/ui/states';
import { dayKey, formatDate } from '../lib/format';
import { useEvents, useOverview, type EventsFilter } from '../lib/queries';

const WEEKDAYS_RU = [
  'воскресенье',
  'понедельник',
  'вторник',
  'среда',
  'четверг',
  'пятница',
  'суббота',
];

const RECENT_LIMIT = 5;
const DAY_LIMIT = 50;

function greetingFor(hour: number): string {
  if (hour < 5) return 'Доброй ночи';
  if (hour < 12) return 'Доброе утро';
  if (hour < 18) return 'Добрый день';
  return 'Добрый вечер';
}

/** Главная страница: календарь, события дня, сводка, последние события. */
export default function Dashboard(): ReactElement {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(() => dayKey(new Date()));

  const now = new Date();

  const dayFilter = useMemo<Pick<EventsFilter, 'dateFrom' | 'dateTo' | 'limit'>>(
    () => ({
      dateFrom: new Date(`${selectedDate}T00:00:00.000`).toISOString(),
      dateTo: new Date(`${selectedDate}T23:59:59.999`).toISOString(),
      limit: DAY_LIMIT,
    }),
    [selectedDate],
  );

  const dayQuery = useEvents(dayFilter);
  const recentQuery = useEvents({ limit: RECENT_LIMIT });
  const overviewQuery = useOverview();

  const dayEvents = dayQuery.data?.events ?? [];
  const recentEvents = recentQuery.data?.events ?? [];

  const handleAddEvent = (): void => navigate('/events/new');

  return (
    <section className="px-4 py-6 sm:px-6">
      <header className="mb-4">
        <h1 className="text-lg font-bold tracking-tight bg-[linear-gradient(95deg,#FFC2D6_0%,#FFFFFF_45%,#E3C9FF_100%)] bg-clip-text text-transparent">
          {greetingFor(now.getHours())}!
        </h1>
        <p className="mt-0.5 text-xs text-slate-500">
          {formatDate(now)}, {WEEKDAYS_RU[now.getDay()]}
        </p>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <Button onClick={handleAddEvent} className="grad-intimate">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Событие
        </Button>
        <Button variant="ghost" onClick={() => navigate('/partners')}>
          <Users className="h-4 w-4" aria-hidden="true" />
          Партнёры
        </Button>
      </div>

      <div className="mb-4">
        <CalendarView compact selectedDate={selectedDate} onSelectDate={setSelectedDate} />
      </div>

      <div className="mb-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              События дня
            </h2>
            <p className="text-xs text-slate-500">{formatDate(`${selectedDate}T00:00:00`)}</p>
          </div>
          <Link
            to={`/events?date=${selectedDate}`}
            className="flex shrink-0 items-center gap-1 text-xs text-primary-400 transition-colors hover:text-primary active:text-primary"
          >
            В списке
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        {dayQuery.isLoading ? (
          <CardSkeleton label="Загрузка событий дня…" />
        ) : dayQuery.isError ? (
          <ErrorBlock error={dayQuery.error} onRetry={() => void dayQuery.refetch()} />
        ) : dayEvents.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="В этот день событий нет"
            description="Выберите другой день в календаре или добавьте новое событие."
            action={
              <Button onClick={handleAddEvent}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Добавить событие
              </Button>
            }
          />
        ) : (
          <div className="stagger space-y-3">
            {dayEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>

      <div className="mb-4">
        <SectionTitle>Сводка</SectionTitle>
        {overviewQuery.isLoading ? (
          <CardSkeleton count={1} label="Загрузка сводки…" />
        ) : overviewQuery.isError ? (
          <ErrorBlock error={overviewQuery.error} onRetry={() => void overviewQuery.refetch()} />
        ) : overviewQuery.data ? (
          overviewQuery.data.totalEvents === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="Сводка появится после первого события"
              description="Пока данных нет — добавьте событие, чтобы увидеть статистику."
              action={
                <Button onClick={handleAddEvent}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Добавить событие
                </Button>
              }
            />
          ) : (
            <Card>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile
                  label="Событий"
                  value={String(overviewQuery.data.totalEvents)}
                  hint="за всё время"
                />
                <StatTile
                  label="Средняя оценка"
                  value={overviewQuery.data.avgRating === null ? '—' : String(overviewQuery.data.avgRating)}
                />
                <StatTile
                  label="Средняя длительность"
                  value={
                    overviewQuery.data.avgDurationMinutes === null
                      ? '—'
                      : `${Math.round(overviewQuery.data.avgDurationMinutes)} мин`
                  }
                />
                <StatTile label="Партнёров" value={String(overviewQuery.data.partnersCount)} />
              </div>
            </Card>
          )
        ) : null}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Последние события
          </h2>
          <Link
            to="/events"
            className="flex shrink-0 items-center gap-1 text-xs text-primary-400 transition-colors hover:text-primary active:text-primary"
          >
            Все события
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        {recentQuery.isLoading ? (
          <CardSkeleton label="Загрузка событий…" />
        ) : recentQuery.isError ? (
          <ErrorBlock error={recentQuery.error} onRetry={() => void recentQuery.refetch()} />
        ) : recentEvents.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="Событий пока нет"
            description="Начните с первого события — оно появится здесь."
            action={
              <Button onClick={handleAddEvent}>
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                Первое событие
              </Button>
            }
          />
        ) : (
          <div className="stagger space-y-3">
            {recentEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
