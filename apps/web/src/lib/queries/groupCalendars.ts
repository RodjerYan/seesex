import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { api } from '../api';
import type { EventView, GroupCalendarView } from '../../types/api';

export const groupCalendarsQueryKey = ['group-calendars', 'list'] as const;
export const groupCalendarQueryKey = (id: string) => ['group-calendars', 'detail', id] as const;
export const groupCalendarEventsQueryKey = (id: string) => ['group-calendars', 'events', id] as const;

/** GET /api/group-calendars — мои (созданные + вступившие). */
export function useGroupCalendars(): UseQueryResult<GroupCalendarView[]> {
  return useQuery<GroupCalendarView[]>({
    queryKey: groupCalendarsQueryKey,
    queryFn: ({ signal }) =>
      api
        .get<{ calendars: GroupCalendarView[] }>('/api/group-calendars', { signal })
        .then((r) => r.calendars),
    staleTime: 30_000,
  });
}

/** GET /api/group-calendars/:id. */
export function useGroupCalendar(id: string | undefined): UseQueryResult<GroupCalendarView> {
  return useQuery<GroupCalendarView>({
    queryKey: groupCalendarQueryKey(id ?? ''),
    queryFn: ({ signal }) =>
      api
        .get<{ calendar: GroupCalendarView }>(`/api/group-calendars/${id}`, { signal })
        .then((r) => r.calendar),
    enabled: Boolean(id),
    staleTime: 15_000,
  });
}

/** GET /api/group-calendars/:id/events. */
export function useGroupCalendarEvents(id: string | undefined): UseQueryResult<EventView[]> {
  return useQuery<EventView[]>({
    queryKey: groupCalendarEventsQueryKey(id ?? ''),
    queryFn: ({ signal }) =>
      api
        .get<{ events: EventView[] }>(`/api/group-calendars/${id}/events`, { signal })
        .then((r) => r.events),
    enabled: Boolean(id),
    staleTime: 15_000,
  });
}
