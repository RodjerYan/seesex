import { Plus, Star, Users } from 'lucide-react';
import { type ReactElement } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Button } from '../../components/ui/controls';
import { Badge } from '../../components/ui/primitives';
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
        <h1 className="text-[22px] font-semibold leading-7 text-ink">Партнёры</h1>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          {partnersQuery.data ? (
            <>
              <span className="num">{partnersQuery.data.length}</span> чел.
            </>
          ) : (
            '\u00A0'
          )}
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
                className="glass press flex items-center gap-3 p-4 transition-colors hover:ring-1 hover:ring-white/10 active:ring-1 active:ring-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {/* Плитка-инициал: rounded-tile + elev2 + hairline (декор, скрыт от SR) */}
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-tile bg-elev-2 text-[15px] font-semibold text-ink-muted ring-1 ring-white/[0.08]"
                >
                  {partner.name.trim().slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[15px] font-medium text-ink">
                    <span className="truncate">{partner.name}</span>
                    {partner.isPrimary ? (
                      <Badge tone="amber">
                        <Star className="h-2.5 w-2.5 fill-amber-400" aria-hidden="true" />
                        основной
                      </Badge>
                    ) : null}
                  </p>
                  <p className="mt-0.5 truncate text-[13px] text-ink-muted">
                    {[
                      partner.nickname,
                      partner.pronouns,
                      tr(RELATIONSHIP_LABEL, partner.relationshipStatus, partner.relationshipStatus ?? ''),
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Без дополнительных данных'}
                  </p>
                </div>
                <span className="num shrink-0 text-[13px] text-ink-muted">{formatDate(partner.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        aria-label="Добавить партнёра"
        onClick={() => navigate('/partners/new')}
        className="press fab-mobile grad-intimate flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg shadow-black/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <Plus className="h-6 w-6" aria-hidden="true" />
      </button>
    </section>
  );
}
