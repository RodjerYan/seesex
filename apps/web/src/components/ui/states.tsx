/**
 * Единые состояния загрузки/ошибки/пустого списка (S1 «Премиальный нуар»).
 * Язык состояний (design-spec.md):
 * - Loading — скелетон на elevated (.skeleton + .glass у CardSkeleton)
 * - Error — иконка в тонированной rose-плитке 48px + текст 15 + ghost-CTA
 * - Empty — иконка в тонированной плитке 48px, заголовок 15/600,
 *   подсказка 13 muted, CTA ghost (снаружи через проп action)
 * API/экспорты (LoadingBlock/ErrorBlock/EmptyBlock) не менялись.
 */
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

import { errorMessage } from '../../lib/errors';
import { Button } from './controls';

export function LoadingBlock({ label = 'Загрузка…' }: { label?: string }): ReactElement {
  return (
    <div role="status" className="space-y-3 py-6" aria-label={label}>
      <div className="skeleton h-4 w-3/4 rounded-lg" aria-hidden="true" />
      <div className="skeleton h-4 w-1/2 rounded-lg" aria-hidden="true" />
      <div className="skeleton h-4 w-2/3 rounded-lg" aria-hidden="true" />
      <div className="skeleton h-4 w-1/3 rounded-lg" aria-hidden="true" />
    </div>
  );
}

export function ErrorBlock({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}): ReactElement {
  return (
    <div className="glass p-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-500/10 ring-1 ring-red-500/20"
        >
          <AlertTriangle className="h-5 w-5 text-red-400" />
        </span>
        <p className="min-w-0 pt-1 text-[15px] leading-5 text-red-300">{errorMessage(error)}</p>
      </div>
      {onRetry ? (
        <Button variant="ghost" className="mt-3" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Повторить
        </Button>
      ) : null}
    </div>
  );
}

/** Плитка-иконка пустого состояния — общий стиль EmptyBlock/EmptyState. */
export function EmptyIconTile({ children }: { children: ReactNode }): ReactElement {
  return (
    <span
      aria-hidden="true"
      className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-elev-2 ring-1 ring-white/[0.08]"
    >
      {children}
    </span>
  );
}

export function EmptyBlock({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}): ReactElement {
  return (
    <div className="glass px-4 py-8 text-center">
      <EmptyIconTile>
        <Inbox className="h-6 w-6 text-ink-dim" />
      </EmptyIconTile>
      <p className="mt-3 text-[15px] font-semibold leading-5 text-ink">{title}</p>
      {description ? <p className="mx-auto mt-1 max-w-xs text-[13px] text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
