import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { api } from '../api';
import type {
  CustomStatsResult,
  FrequencyResult,
  NamedStatItem,
  OverviewResult,
  PartnerStatsResult,
  PeriodsStatsResult,
  RatingsResult,
} from '../../types/api';

/** Диапазон дат для /statistics/frequency|ratings|partners. */
export interface StatsRange {
  from?: string;
  to?: string;
}

export const overviewQueryKey = ['statistics', 'overview'] as const;
export const statisticsRangeKey = (range: StatsRange) => ['statistics', range] as const;

export function useOverview(): UseQueryResult<OverviewResult> {
  return useQuery<OverviewResult>({
    queryKey: overviewQueryKey,
    queryFn: ({ signal }) => api.get<OverviewResult>('/api/statistics/overview', { signal }),
    staleTime: 30_000,
  });
}

export function useFrequency(range: StatsRange): UseQueryResult<FrequencyResult> {
  return useQuery<FrequencyResult>({
    queryKey: [...statisticsRangeKey(range), 'frequency'],
    queryFn: ({ signal }) =>
      api.get<FrequencyResult>('/api/statistics/frequency', { query: { ...range }, signal }),
    staleTime: 30_000,
  });
}

export function useRatings(range: StatsRange): UseQueryResult<RatingsResult> {
  return useQuery<RatingsResult>({
    queryKey: [...statisticsRangeKey(range), 'ratings'],
    queryFn: ({ signal }) =>
      api.get<RatingsResult>('/api/statistics/ratings', { query: { ...range }, signal }),
    staleTime: 30_000,
  });
}

export function usePartnerStats(range: StatsRange): UseQueryResult<PartnerStatsResult> {
  return useQuery<PartnerStatsResult>({
    queryKey: [...statisticsRangeKey(range), 'partners'],
    queryFn: ({ signal }) =>
      api.get<PartnerStatsResult>('/api/statistics/partners', { query: { ...range }, signal }),
    staleTime: 30_000,
  });
}

/** GET /api/statistics/custom — произвольный диапазон + groupIds (групповые календари). */
export function useCustomStats(
  range: StatsRange & { groupIds?: string },
): UseQueryResult<CustomStatsResult> {
  return useQuery<CustomStatsResult>({
    queryKey: [...statisticsRangeKey(range), 'custom'],
    queryFn: ({ signal }) =>
      api.get<CustomStatsResult>('/api/statistics/custom', { query: { ...range }, signal }),
    staleTime: 30_000,
  });
}

export function usePeriodStats(): UseQueryResult<PeriodsStatsResult> {
  return useQuery<PeriodsStatsResult>({
    queryKey: ['statistics', 'periods'],
    queryFn: ({ signal }) => api.get<PeriodsStatsResult>('/api/statistics/periods', { signal }),
    staleTime: 60_000,
  });
}

export type { NamedStatItem };
