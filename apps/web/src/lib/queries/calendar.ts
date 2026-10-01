import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';

import { api } from '../api';
import type { CalendarResult } from '../../types/api';

export function calendarQueryKey(from: string, to: string): readonly [string, string, string, string] {
  return ['events', 'calendar', from, to] as const;
}

/**
 * GET /api/events/calendar?from&to — дни месяца со статусами
 * (occurred — красная точка, turndown — серая, planned — фиолетовая).
 */
export function useCalendar(
  from: string,
  to: string,
  options?: Omit<UseQueryOptions<CalendarResult>, 'queryKey' | 'queryFn'>
): UseQueryResult<CalendarResult> {
  return useQuery<CalendarResult>({
    queryKey: calendarQueryKey(from, to),
    queryFn: ({ signal }) =>
      api.get<CalendarResult>('/api/events/calendar', { query: { from, to }, signal }),
    staleTime: 0,
    refetchOnMount: 'always',
    ...options,
  });
}
