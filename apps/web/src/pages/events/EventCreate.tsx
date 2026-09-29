import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { EventForm, type EventPayload } from '../../components/events/EventForm';
import { Toast } from '../../components/ui/Toast';
import { ApiError, api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { overviewQueryKey } from '../../lib/queries';
import type { EventView } from '../../types/api';

/** Сколько мс показываем «Событие создано» до перехода на страницу события. */
const SUCCESS_TOAST_MS = 1200;

/**
 * Понятное русское сообщение о сбое создания события:
 * - сетевой сбой (fetch бросает TypeError; ApiError status=0 — резерв) →
 *   «Нет соединения с сервером. Повторите попытку.»;
 * - ответ сервера 4xx/5xx → «Не удалось создать событие: <message>»,
 *   где message — перевод по code из lib/errors (или текст сервера).
 *
 * Форма при сбое НЕ очищается: значения остаются в react-hook-form,
 * состояние ошибки живёт здесь и рендерится баннером в EventForm.
 */
function createErrorMessage(error: unknown): string {
  if (error instanceof TypeError || (error instanceof ApiError && error.status === 0)) {
    return 'Нет соединения с сервером. Повторите попытку.';
  }
  return `Не удалось создать событие: ${errorMessage(error)}`;
}

/** Создание события: POST /api/events. */
export default function EventCreate(): ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const successTimer = useRef<number | null>(null);

  // Если ушли со страницы раньше, чем сработал таймер перехода — гасим его.
  useEffect(
    () => () => {
      if (successTimer.current !== null) window.clearTimeout(successTimer.current);
    },
    [],
  );

  const mutation = useMutation({
    mutationFn: (payload: EventPayload) =>
      api.post<{ event: EventView }>('/api/events', payload),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['events'] });
      void queryClient.invalidateQueries({ queryKey: overviewQueryKey });
      // Сначала — заметное подтверждение, потом переход (см. Toast).
      setCreated(true);
      successTimer.current = window.setTimeout(() => {
        navigate(`/events/${data.event.id}`, { replace: true });
      }, SUCCESS_TOAST_MS);
    },
    onError: (error) => setFormError(createErrorMessage(error)),
  });

  return (
    <section className="px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center gap-3">
        <Link
          to="/events"
          aria-label="Назад к списку"
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-100"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <h1 className="text-lg font-semibold tracking-tight text-slate-100">Новое событие</h1>
      </div>

      <EventForm
        submitLabel="Создать событие"
        submitting={mutation.isPending || created}
        formError={formError}
        onCancel={() => navigate('/events')}
        onSubmit={(payload) => {
          setFormError(null);
          mutation.mutate(payload);
        }}
      />

      {created ? <Toast message="Событие создано" tone="success" /> : null}
    </section>
  );
}
