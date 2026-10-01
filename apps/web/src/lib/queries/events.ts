import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { api } from '../api';
import type { EventView, ListEventsResult } from '../../types/api';

export interface EventsFilter {
  dateFrom?: string;
  dateTo?: string;
  partnerId?: string;
  eventType?: string;
  limit?: number;
  offset?: number;
}

export const eventsQueryKey = (filter: EventsFilter) => ['events', 'list', filter] as const;
export const eventQueryKey = (id: string) => ['events', 'detail', id] as const;

/** GET /api/events — список с фильтрами (пагинация limit/offset). */
export function useEvents(filter: EventsFilter = {}): UseQueryResult<ListEventsResult> {
  return useQuery<ListEventsResult>({
    queryKey: eventsQueryKey(filter),
    queryFn: ({ signal }) =>
      api.get<ListEventsResult>('/api/events', { query: { ...filter }, signal }),
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

/** GET /api/events/:id. */
export function useEvent(id: string | undefined): UseQueryResult<EventView> {
  return useQuery<EventView>({
    queryKey: eventQueryKey(id ?? ''),
    queryFn: ({ signal }) => api.get<{ event: EventView }>(`/api/events/${id}`, { signal })
      .then((data) => data.event),
    enabled: Boolean(id),
    staleTime: 10_000,
  });
}
