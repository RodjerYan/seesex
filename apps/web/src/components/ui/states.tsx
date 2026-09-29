/** Единые состояния загрузки/ошибки/пустого списка для страниц S5. */
import { AlertTriangle, Loader2, Inbox, RefreshCw } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

import { errorMessage } from '../../lib/errors';
import { Button } from './controls';

export function LoadingBlock({ label = 'Загрузка…' }: { label?: string }): ReactElement {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      {label}
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
    <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
        <p className="text-sm text-red-300">{errorMessage(error)}</p>
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
    <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 px-4 py-8 text-center">
      <Inbox className="mx-auto h-6 w-6 text-slate-600" aria-hidden="true" />
      <p className="mt-2 text-sm font-medium text-slate-300">{title}</p>
      {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
