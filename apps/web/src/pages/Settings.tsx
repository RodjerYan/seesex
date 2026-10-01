import { useMutation } from '@tanstack/react-query';
import { ChevronRight, Fingerprint, FileSpreadsheet, Lock, LogOut } from 'lucide-react';
import { type ReactElement } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Button, Card, ErrorText, SectionTitle } from '../components/ui/controls';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../components/ui/states';
import { errorMessage } from '../lib/errors';
import { formatDate } from '../lib/format';
import { useMe } from '../lib/queries';
import { useAuthStore } from '../stores/auth.store';

interface MenuItem {
  to: string;
  title: string;
  description: string;
  icon: ReactElement;
}

const MENU: MenuItem[] = [
  {
    to: '/settings/security',
    title: 'Безопасность',
    description: 'Блокировка приложения (PIN/пароль), 2FA, активные сессии',
    icon: <Lock className="h-4 w-4 text-primary-400" aria-hidden="true" />,
  },
  {
    to: '/settings/data',
    title: 'Данные и экспорт',
    description: 'Экспорт JSON/CSV, удаление всех данных (GDPR)',
    icon: <FileSpreadsheet className="h-4 w-4 text-emerald-400" aria-hidden="true" />,
  },
];

/** Настройки: профиль, переходы в разделы, выход из аккаунта. */
export default function Settings(): ReactElement {
  const navigate = useNavigate();
  const meQuery = useMe();
  const logout = useAuthStore((state) => state.logout);

  const onLogout = useMutation({
    mutationFn: () => logout(),
    onSuccess: () => {
      void meQuery.refetch();
      navigate('/login', { replace: true });
    },
  });

  return (
    <section className="px-4 py-6 sm:px-6">
      <div className="mb-4">
        <h1 className="text-lg font-bold tracking-tight text-slate-100">Настройки</h1>
      </div>

      <Card className="mb-4">
        <SectionTitle>Профиль</SectionTitle>
        {meQuery.isLoading ? (
          <LoadingBlock label="Загрузка профиля…" />
        ) : meQuery.isError ? (
          <ErrorBlock error={meQuery.error} onRetry={() => void meQuery.refetch()} />
        ) : meQuery.data ? (
          <dl>
            <div className="flex items-start justify-between gap-4 border-b border-white/10 py-2">
              <dt className="text-xs text-slate-500">E-mail</dt>
              <dd className="truncate text-sm text-slate-200">{meQuery.data.email ?? '—'}</dd>
            </div>
            <div className="flex items-start justify-between gap-4 py-2">
              <dt className="text-xs text-slate-500">В сервисе с</dt>
              <dd className="text-sm text-slate-200">{formatDate(meQuery.data.createdAt)}</dd>
            </div>
          </dl>
        ) : (
          <EmptyBlock title="Профиль недоступен" />
        )}
        <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-500">
          <Fingerprint className="h-3 w-3" aria-hidden="true" />
          Идентификатор: {meQuery.data?.id ?? '—'}
        </p>
      </Card>

      <ul className="mb-4 space-y-2">
        {MENU.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              className="flex items-center justify-between gap-3 rounded-xl glass p-4 transition-colors press hover:border-white/10 active:border-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 shrink-0">{item.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-100">{item.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{item.description}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>

      {onLogout.isError ? (
        <div className="mb-4">
          <ErrorText>{errorMessage(onLogout.error)}</ErrorText>
        </div>
      ) : null}

      <Button
        variant="danger"
        className="w-full"
        onClick={() => onLogout.mutate()}
        disabled={onLogout.isPending}
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
        {onLogout.isPending ? 'Выходим…' : 'Выйти из аккаунта'}
      </Button>
    </section>
  );
}
