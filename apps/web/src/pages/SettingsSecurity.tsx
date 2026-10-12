import { zodResolver } from '@hookform/resolvers/zod';
import { QrCode, KeyRound, ShieldCheck, ShieldOff, LogOut } from 'lucide-react';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button, Card, ErrorText, Field, Input, SectionTitle } from '../components/ui/controls';
import { LoadingBlock } from '../components/ui/states';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { formatDate } from '../lib/format';
import { useMe } from '../lib/queries';
import {
  useChangePassword,
  useDeleteSession,
  useTotpDisable,
  useTotpSetup,
} from '../lib/queries/profile';
import { useSessions } from '../lib/queries/sessions';
import { useAuthStore } from '../stores/auth.store';
import type { SessionUser } from '../types';
import type { SessionView } from '../types/api';

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Введите текущий пароль'),
    newPassword: z
      .string()
      .min(8, 'Минимум 8 символов')
      .max(128, 'Слишком длинный пароль'),
    confirmPassword: z.string().min(1, 'Повторите новый пароль'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  });

type PasswordForm = z.infer<typeof passwordSchema>;

interface VerifyResponse {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

/** /settings/security: смена пароля, включение/выключение 2FA, сессии. */
export default function SettingsSecurity(): ReactElement {
  const meQuery = useMe();

  return (
    <section className="px-4 py-6 sm:px-6">
      <div className="mb-4">
        <h1 className="text-lg font-bold tracking-tight text-slate-100">Безопасность</h1>
      </div>

      <PasswordCard />
      <TwoFactorCard hasTotp={meQuery.data?.hasTotp ?? false} />
      <SessionsCard />
    </section>
  );
}

/** Смена пароля: POST /api/auth/password. */
function PasswordCard(): ReactElement {
  const changePassword = useChangePassword();
  const [ok, setOk] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setOk(false);
    try {
      await changePassword.mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      setOk(true);
      reset();
    } catch {
      // Ошибка — баннер ниже.
    }
  });

  return (
    <Card className="mb-4">
      <SectionTitle>Пароль</SectionTitle>
      <form onSubmit={onSubmit} noValidate>
        <Field label="Текущий пароль" htmlFor="pw-current" error={errors.currentPassword?.message}>
          <Input
            id="pw-current"
            type="password"
            autoComplete="current-password"
            invalid={Boolean(errors.currentPassword)}
            {...register('currentPassword')}
          />
        </Field>
        <Field label="Новый пароль" htmlFor="pw-new" error={errors.newPassword?.message}>
          <Input
            id="pw-new"
            type="password"
            autoComplete="new-password"
            invalid={Boolean(errors.newPassword)}
            {...register('newPassword')}
          />
        </Field>
        <Field label="Повторите новый пароль" htmlFor="pw-confirm" error={errors.confirmPassword?.message}>
          <Input
            id="pw-confirm"
            type="password"
            autoComplete="new-password"
            invalid={Boolean(errors.confirmPassword)}
            {...register('confirmPassword')}
          />
        </Field>

        {changePassword.isError ? <ErrorText>{errorMessage(changePassword.error)}</ErrorText> : null}
        {ok ? <p className="mb-2 text-sm text-emerald-400">Пароль обновлён</p> : null}

        <Button type="submit" className="w-full" disabled={isSubmitting || changePassword.isPending}>
          <KeyRound className="h-4 w-4" aria-hidden="true" />
          {changePassword.isPending ? 'Сохраняем…' : 'Сменить пароль'}
        </Button>
      </form>
    </Card>
  );
}

/**
 * 2FA: если выключена — setup → QR (otpauth) → код → verify (сессия перевыпускается);
 * если включена — отключение с подтверждением паролем.
 */
function TwoFactorCard({ hasTotp }: { hasTotp: boolean }): ReactElement {
  const setup = useTotpSetup();
  const disable = useTotpDisable();
  const setSession = useAuthStore((s) => s.setSession);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [setupToken, setSetupToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [disableOpen, setDisableOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const qrRendered = useRef(false);

  // QR рисуем вне React-рендера (qrcode-callback API), один раз на setup.
  useEffect(() => {
    if (!setup.data?.otpauthUrl || qrRendered.current) return;
    qrRendered.current = true;
    let cancelled = false;
    void import('qrcode')
      .then((QRCode) =>
        QRCode.toDataURL(setup.data.otpauthUrl, { margin: 1, width: 200, color: { dark: '#e2e8f0', light: '#00000000' } }),
      )
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => setQrDataUrl(null));
    return () => {
      cancelled = true;
    };
  }, [setup.data?.otpauthUrl]);

  const onStartSetup = async () => {
    setCodeError(null);
    setQrDataUrl(null);
    qrRendered.current = false;
    const result = await setup.mutateAsync();
    setSetupToken(result.setupToken);
  };

  const onVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    setCodeError(null);
    if (!/^\d{6}$/.test(code)) {
      setCodeError('Введите 6 цифр');
      return;
    }
    try {
      // Пользователь уже залогинен → обычный access JWT (auth по умолчанию);
      // setupToken (purpose=totp_setup) НЕ в заголовок — requireAuthOrTmpToken
      // его не примет — он идёт телом и проверяется внутри verifyTotp.
      const data = await api.post<VerifyResponse>('/api/auth/totp/verify', {
        code,
        setupToken: setupToken ?? undefined,
      });
      // verify перевыпускает сессию — обновляем store.
      setSession(
        { accessToken: data.accessToken, refreshToken: data.refreshToken },
        data.user,
      );
      setSetupToken(null);
      setCode('');
      setQrDataUrl(null);
      qrRendered.current = false;
    } catch (error) {
      setCodeError(errorMessage(error));
    }
  };

  const onDisable = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await disable.mutateAsync({ password: disablePassword });
      setDisableOpen(false);
      setDisablePassword('');
    } catch {
      // Баннер ниже.
    }
  };

  return (
    <Card className="mb-4">
      <SectionTitle>Двухфакторная защита (2FA)</SectionTitle>

      {hasTotp && !setupToken ? (
        <>
          <p className="mb-3 flex items-center gap-2 text-sm text-emerald-400">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            2FA включена — при входе нужен код из аутентификатора.
          </p>
          {!disableOpen ? (
            <Button variant="ghost" className="w-full" onClick={() => setDisableOpen(true)}>
              <ShieldOff className="h-4 w-4" aria-hidden="true" />
              Отключить 2FA
            </Button>
          ) : (
            <form onSubmit={onDisable} noValidate>
              <Field label="Пароль для подтверждения" htmlFor="totp-pw">
                <Input
                  id="totp-pw"
                  type="password"
                  autoComplete="current-password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                />
              </Field>
              {disable.isError ? <ErrorText>{errorMessage(disable.error)}</ErrorText> : null}
              <div className="flex gap-2">
                <Button type="submit" variant="danger" className="flex-1" disabled={disable.isPending || !disablePassword}>
                  Отключить
                </Button>
                <Button type="button" variant="ghost" className="flex-1" onClick={() => setDisableOpen(false)}>
                  Отмена
                </Button>
              </div>
            </form>
          )}
        </>
      ) : setupToken ? (
        <>
          <p className="mb-3 text-sm text-slate-400">
            Откройте аутентификатор (Google Authenticator, 1Password и т.п.), отсканируйте QR-код
            и введите 6-значный код.
          </p>
          <div className="mb-3 flex justify-center">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR-код для настройки 2FA" className="rounded-xl" />
            ) : (
              <LoadingBlock label="Готовим QR…" />
            )}
          </div>
          {setup.data ? (
            <details className="mb-3">
              <summary className="cursor-pointer text-xs text-slate-500">Код не сканируется? Введите ключ вручную</summary>
              <p className="mt-2 break-all rounded-lg bg-black/30 p-2 font-mono text-xs text-slate-300">
                {setup.data.secret}
              </p>
            </details>
          ) : null}
          <form onSubmit={onVerify} noValidate>
            <Field label="Код из аутентификатора" htmlFor="totp-setup-code" error={codeError ?? undefined}>
              <Input
                id="totp-setup-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                maxLength={6}
                className="text-center text-xl tracking-[0.5em]"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={!/^\d{6}$/.test(code)}>
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Подтвердить
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => {
                  setSetupToken(null);
                  setQrDataUrl(null);
                  qrRendered.current = false;
                }}
              >
                Отмена
              </Button>
            </div>
          </form>
        </>
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-400">
            При входе дополнительно потребуется 6-значный код из приложения-аутентификатора.
          </p>
          {setup.isError ? <ErrorText>{errorMessage(setup.error)}</ErrorText> : null}
          <Button className="w-full" onClick={() => void onStartSetup()} disabled={setup.isPending}>
            <QrCode className="h-4 w-4" aria-hidden="true" />
            {setup.isPending ? 'Готовим…' : 'Включить 2FA'}
          </Button>
        </>
      )}
    </Card>
  );
}

/** Активные сессии: GET /api/auth/sessions + DELETE /:id. */
function SessionsCard(): ReactElement {
  const sessionsQuery = useSessions();
  const deleteSession = useDeleteSession();

  return (
    <Card>
      <SectionTitle>Активные сессии</SectionTitle>
      {sessionsQuery.isLoading ? (
        <LoadingBlock label="Загрузка сессий…" />
      ) : sessionsQuery.isError ? (
        <ErrorText>{errorMessage(sessionsQuery.error)}</ErrorText>
      ) : (
        <ul className="space-y-2">
          {(sessionsQuery.data ?? []).map((session: SessionView) => (
            <li
              key={session.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-white/10 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-slate-200">
                  {session.userAgent ?? 'Неизвестное устройство'}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Вход: {formatDate(session.createdAt)} · Активность: {formatDate(session.lastSeenAt)}
                </p>
              </div>
              <button
                type="button"
                aria-label="Закрыть сессию"
                className="press shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                onClick={() => deleteSession.mutate(session.id)}
                disabled={deleteSession.isPending}
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
