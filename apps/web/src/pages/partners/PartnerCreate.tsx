import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
  PartnerForm,
  type PartnerPayload,
} from '../../components/partners/PartnerForm';
import { Button } from '../../components/ui/controls';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { partnersQueryKey } from '../../lib/queries';
import type { PartnerView } from '../../types/api';

/** Создание партнёра: POST /api/partners. */
export default function PartnerCreate(): ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: PartnerPayload) =>
      api.post<{ partner: PartnerView }>('/api/partners', payload),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: partnersQueryKey });
      navigate(`/partners/${data.partner.id}`, { replace: true });
    },
    onError: (error) => setFormError(errorMessage(error)),
  });

  return (
    <section className="px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center gap-3">
        <Link
          to="/partners"
          aria-label="Назад к списку"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-white/[0.06] hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <h1 className="min-w-0 text-[22px] font-semibold leading-7 text-ink">Новый партнёр</h1>
      </div>

      <PartnerForm
        submitLabel="Создать"
        submitting={mutation.isPending}
        formError={formError}
        onSubmit={(payload) => {
          setFormError(null);
          mutation.mutate(payload);
        }}
      />

      <Button variant="ghost" className="mt-4 w-full" onClick={() => navigate('/partners')}>
        Отмена
      </Button>
    </section>
  );
}
