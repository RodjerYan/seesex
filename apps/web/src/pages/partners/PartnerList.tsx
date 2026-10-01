import { Plus, Star, Users } from 'lucide-react';
import { type ReactElement } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Button, Fab } from '../../components/ui/controls';
import { CardSkeleton, EmptyState } from '../../components/ui/listStates';
import { ErrorBlock } from '../../components/ui/states';
import { formatDate } from '../../lib/format';
import { RELATIONSHIP_LABEL, tr } from '../../lib/labels';
import { usePartners } from '../../lib/queries';

/** Список партнёров: карточки, бейдж «основной», FAB создания. */
export default function PartnerList(): ReactElement {
  const navigate = useNavigate();
  const partnersQuery = usePartners();

  return (
    <section className="px-4 py-6 sm:px-6">
      <div className="mb-4">
        <h1 className="text-lg font-bold tracking-tight text-slate-100">Партнёры</h1>
        <p className="text-xs text-slate-500">
          {partnersQuery.data ? `${partnersQuery.data.length} чел.` : '\u00A0'}
        </p>
      </div>

      {partnersQuery.isLoading ? (
        <CardSkeleton label="Загрузка партнёров…" />
      ) : partnersQuery.isError ? (
        <ErrorBlock error={partnersQuery.error} onRetry={() => void partnersQuery.refetch()} />
      ) : (partnersQuery.data ?? []).length === 0 ? (
        <EmptyState
          icon={Users}
          title="Партнёров пока нет"
          description="Добавьте первого партнёра, чтобы отмечать события с ним."
          action={<Button onClick={() => navigate('/partners/new')}>Добавить партнёра</Button>}
        />
      ) : (
        <ul className="stagger space-y-3">
          {(partnersQuery.data ?? []).map((partner) => (
            <li key={partner.id}>
              <Link
                to={`/partners/${partner.id}`}
                className="flex items-center justify-between gap-3 rounded-xl glass p-4 transition-colors press hover:ring-1 hover:ring-white/10 active:ring-1 active:ring-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-slate-100">
                    <span className="truncate">{partner.name}</span>
                    {partner.isPrimary ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-300">
                        <Star className="h-2.5 w-2.5 fill-amber-400" aria-hidden="true" />
                        основной
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {[
                      partner.nickname,
                      partner.pronouns,
                      tr(RELATIONSHIP_LABEL, partner.relationshipStatus, partner.relationshipStatus ?? ''),
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Без дополнительных данных'}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-slate-500">{formatDate(partner.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Fab label="Добавить партнёра" onClick={() => navigate('/partners/new')}>
        <Plus className="h-6 w-6" aria-hidden="true" />
      </Fab>
    </section>
  );
}