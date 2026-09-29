import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { EventForm, type EventPayload } from '../../components/events/EventForm';
import { Button } from '../../components/ui/controls';
import { ErrorBlock, LoadingBlock } from '../../components/ui/states';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { overviewQueryKey, useEvent } from '../../lib/queries';
import type { EventView } from '../../types/api';

/** Редактирование события: PUT /api/events/:id. */
export default function EventEdit(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const eventQuery = useEvent(id);
  const mutation = useMutation({
    mutationFn: (payload: EventPayload) =>
      api.put<{ event: EventView }>(`/api/events/${id}`, payload),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['events'] });
      void queryClient.invalidateQueries({ queryKey: overviewQueryKey });
      navigate(`/events/${data.event.id}`, { replace: true });
    },
    onError: (error) => setFormError(errorMessage(error)),
  });

  if (eventQuery.isLoading) return <LoadingBlock label="Загрузка события…" />;
  if (eventQuery.isError || !eventQuery.data) {
    return (
      <section className="px-4 py-6 sm:px-6">
        <ErrorBlock error={eventQuery.error} onRetry={() => void eventQuery.refetch()} />
      </section>
    );
  }

  return (
    <section className="px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center gap-3">
        <Link
          to={`/events/${id ?? ''}`}
          aria-label="Назад к событию"
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <h1 className="text-lg font-semibold tracking-tight text-slate-100">Редактирование</h1>
      </div>

      <EventForm
        initial={eventQuery.data}
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
