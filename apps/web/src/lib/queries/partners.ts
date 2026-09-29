import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { api } from '../api';
import type { PartnerView } from '../../types/api';

export const partnersQueryKey = ['partners', 'list'] as const;
export const partnerQueryKey = (id: string) => ['partners', 'detail', id] as const;

/** GET /api/partners — все партнёры пользователя (без пагинации). */
export function usePartners(): UseQueryResult<PartnerView[]> {
  return useQuery<PartnerView[]>({
    queryKey: partnersQueryKey,
    queryFn: ({ signal }) =>
      api.get<{ partners: PartnerView[] }>('/api/partners', { signal }).then((r) => r.partners),
    staleTime: 30_000,
  });
}

/** GET /api/partners/:id. */
export function usePartner(id: string | undefined): UseQueryResult<PartnerView> {
  return useQuery<PartnerView>({
    queryKey: partnerQueryKey(id ?? ''),
    queryFn: ({ signal }) =>
      api.get<{ partner: PartnerView }>(`/api/partners/${id}`, { signal }).then((r) => r.partner),
    enabled: Boolean(id),
    staleTime: 15_000,
  });
}
