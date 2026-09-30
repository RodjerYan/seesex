import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, LockKeyhole, LogIn } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { Button, ErrorText, Field, Input } from '../components/ui/controls';
import { errorMessage } from '../lib/errors';
import { useAuthStore } from '../stores/auth.store';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Введите email').email('Некорректный email'),
  password: z.string().min(1, 'Введите пароль').max(128),
});

type LoginForm = z.infer<typeof loginSchema>;

interface LocationState {
  from?: string;
  registered?: boolean;
  /** Флеш после подтверждения 2FA (запасной путь, если tmpToken протух). */
  notice?: string;
}

/** Вход: email + пароль, requires2FA -> /2fa с tmpToken. */
export default function Login(): ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as LocationState;
  const login = useAuthStore((store) => store.login);

  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await login(values.email, values.password);
      if (result.kind === 'two_factor') {
        // tmpToken (purpose=2fa) передаём в state и дублируем в sessionStorage,
        // чтобы перезагрузка страницы /2fa не теряла токен.
        try {
          window.sessionStorage.setItem('xtracker.2fa', result.tmpToken);
        } catch {
          // storage может быть недоступен — тогда живём только в state.
        }
        navigate('/2fa', { replace: true, state: { tmpToken: result.tmpToken } });
        return;
      }
      navigate(state.from ?? '/', { replace: true });
    } catch (error) {
      setFormError(errorMessage(error));
    }
  });

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span
            aria-hidden="true"
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-white"
          >
            S
          </span>
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-slate-100">Вход</h1>
          <p className="mt-1 text-sm text-slate-500">SeeSex — Интимный трекер</p>
        </div>

        <form
          onSubmit={onSubmit}
          noValidate
          className="glass p-5"
        >
          {state.registered ? (
            <p className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
              Аккаунт создан — теперь войдите.
            </p>
          ) : null}
          {state.notice ? (
            <p className="mb-4 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-300">
              {state.notice}
            </p>
          ) : null}

          <Field label="Email" htmlFor="login-email" error={errors.email?.message}>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="ivan@example.com"
              invalid={Boolean(errors.email)}
              {...register('email')}
            />
          </Field>

          <Field label="Пароль" htmlFor="login-password" error={errors.password?.message}>
            <div className="relative">
              <Input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                invalid={Boolean(errors.password)}
                className="pr-11"
                {...register('password')}
              />
              <button
                type="button"
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-400 transition-colors hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </Field>

          {formError ? <ErrorText>{formError}</ErrorText> : null}

          <Button type="submit" className="mt-4 w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              'Входим…'
            ) : (
              <>
                <LogIn className="h-4 w-4" aria-hidden="true" />
                Войти
              </>
            )}
          </Button>

          <p className="mt-4 flex items-center justify-center gap-1 text-xs text-slate-500">
            <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
            Данные доступны только вам
          </p>
        </form>

        <p className="mt-4 text-center text-sm text-slate-400">
          Нет аккаунта?{' '}
          <Link to="/register" className="font-medium text-primary-400 hover:text-primary">
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  );
}
