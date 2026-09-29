import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  PartnerForm,
  type PartnerPayload,
} from '../../components/partners/PartnerForm';
import { Button } from '../../components/ui/controls';
import { ErrorBlock, LoadingBlock } from '../../components/ui/states';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { partnerQueryKey, partnersQueryKey, usePartner } from '../../lib/queries';
import type { PartnerView } from '../../types/api';

/** Редактирование партнёра: PUT /api/partners/:id. */
export default function PartnerEdit(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const partnerQuery = usePartner(id);
  const mutation = useMutation({
    mutationFn: (payload: PartnerPayload) =>
      api.put<{ partner: PartnerView }>(`/api/partners/${id ?? ''}`, payload),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: partnersQueryKey });
      void queryClient.invalidateQueries({ queryKey: partnerQueryKey(id ?? '') });
      navigate(`/partners/${data.partner.id}`, { replace: true });
    },
    onError: (error) => setFormError(errorMessage(error)),
  });

  if (partnerQuery.isLoading) return <LoadingBlock label="Загрузка партнёра…" />;
  if (partnerQuery.isError || !partnerQuery.data) {
    return (
      <section className="px-4 py-6 sm:px-6">
        <ErrorBlock error={partnerQuery.error} onRetry={() => void partnerQuery.refetch()} />
      </section>
    );
  }

  return (
    <section className="px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center gap-3">
        <Link
          to={`/partners/${id ?? ''}`}
          aria-label="Назад к партнёру"
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-100"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <h1 className="text-lg font-semibold tracking-tight text-slate-100">
          Редактирование: {partnerQuery.data.name}
        </h1>
      </div>

      <PartnerForm
        initial={partnerQuery.data}
        submitLabel="Сохранить"
        submitting={mutation.isPending}
        formError={formError}
        onSubmit={(payload) => {
          setFormError(null);
          mutation.mutate(payload);
        }}
      />

      <Button variant="ghost" className="mt-4 w-full" onClick={() => navigate(-1)}>
        Отмена
      </Button>
    </section>
  );
}
