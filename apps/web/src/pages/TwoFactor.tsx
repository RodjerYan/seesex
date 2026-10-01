import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { Button, ErrorText, Field, Input } from '../components/ui/controls';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useAuthStore } from '../stores/auth.store';
import type { SessionUser } from '../types';

const codeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Введите 6 цифр'),
});

type CodeForm = z.infer<typeof codeSchema>;

const TMP_TOKEN_KEY = 'xtracker.2fa';

interface VerifyResponse {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

/** Шаг 2 входа: 6-значный TOTP-код + tmpToken (purpose=2fa) -> сессия -> /. */
export default function TwoFactor(): ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((store) => store.setSession);

  const tmpToken = useMemo(() => {
    const fromState = (location.state as { tmpToken?: string } | null)?.tmpToken;
    if (fromState) return fromState;
    try {
      return window.sessionStorage.getItem(TMP_TOKEN_KEY);
    } catch {
      return null;
    }
  }, [location.state]);

  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CodeForm>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    if (!tmpToken) return;
    try {
      const data = await api.post<VerifyResponse>(
        '/api/auth/totp/verify',
        { code: values.code },
        { auth: false, headers: { Authorization: `Bearer ${tmpToken}` } },
      );
      try {
        window.sessionStorage.removeItem(TMP_TOKEN_KEY);
      } catch {
        // storage может быть недоступен.
      }
      setSession(
        { accessToken: data.accessToken, refreshToken: data.refreshToken },
        data.user,
      );
      navigate('/', { replace: true });
    } catch (error) {
      setFormError(errorMessage(error));
    }
  });

  if (!tmpToken) {
    return (
      <AuthShell title="Двухфакторная защита">
        <ErrorText>Сессия подтверждения не найдена — войдите заново.</ErrorText>
        <Link to="/login" className="mt-4 block text-center text-sm text-primary-400 hover:text-primary">
          ← Вернуться ко входу
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Двухфакторная защита">
      <form onSubmit={onSubmit} noValidate>
        <Field
          label="Код из приложения-аутентификатора"
          htmlFor="totp-code"
          error={errors.code?.message}
        >
          <Input
            id="totp-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={6}
            className="text-center text-xl tracking-[0.5em]"
            invalid={Boolean(errors.code)}
            {...register('code')}
          />
        </Field>

        {formError ? <ErrorText>{formError}</ErrorText> : null}

        <Button type="submit" className="mt-2 w-full" disabled={isSubmitting}>
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          {isSubmitting ? 'Проверяем…' : 'Подтвердить'}
        </Button>
      </form>

      <Link
        to="/login"
        className="mt-4 flex items-center justify-center gap-1 text-sm text-slate-400 hover:text-slate-200"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Другой аккаунт
      </Link>
    </AuthShell>
  );
}

function AuthShell({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <div className="flex app-dvh items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span
            aria-hidden="true"
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-white"
          >
            S
          </span>
          <h1 className="mt-3 text-xl font-bold tracking-tight text-slate-100">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">Введите 6-значный код</p>
        </div>
        <div className="glass p-5">{children}</div>
      </div>
    </div>
  );
}
