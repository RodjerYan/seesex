import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { Button, ErrorText, Field, Input } from '../components/ui/controls';
import { errorMessage } from '../lib/errors';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth.store';

const registerSchema = z
  .object({
    email: z.string().trim().min(1, 'Введите email').email('Некорректный email'),
    password: z
      .string()
      .min(8, 'Пароль должен быть не короче 8 символов')
      .max(128, 'Слишком длинный пароль'),
    confirmPassword: z.string().min(1, 'Повторите пароль'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  });

type RegisterForm = z.infer<typeof registerSchema>;

/** Регистрация: email + пароль + подтверждение; успех -> авто-логин -> /. */
export default function Register(): ReactElement {
  const navigate = useNavigate();
  const login = useAuthStore((store) => store.login);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await api.post('/api/auth/register', { email: values.email, password: values.password }, { auth: false });
    } catch (error) {
      setFormError(errorMessage(error));
      return;
    }

    // Успех -> авто-логин. Если во входе помешала 2FA/rate-limit — уводим на Login с флешем.
    try {
      const result = await login(values.email, values.password);
      if (result.kind === 'two_factor') {
        try {
          window.sessionStorage.setItem('xtracker.2fa', result.tmpToken);
        } catch {
          // storage может быть недоступен.
        }
        navigate('/2fa', { replace: true, state: { tmpToken: result.tmpToken } });
        return;
      }
      navigate('/', { replace: true });
    } catch {
      navigate('/login', { replace: true, state: { registered: true } });
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
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-slate-100">
            Регистрация
          </h1>
          <p className="mt-1 text-sm text-slate-500">Новый аккаунт SeeSex</p>
        </div>

        <form
          onSubmit={onSubmit}
          noValidate
          className="glass p-5"
        >
          <Field label="Email" htmlFor="reg-email" error={errors.email?.message}>
            <Input
              id="reg-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="ivan@example.com"
              invalid={Boolean(errors.email)}
              {...register('email')}
            />
          </Field>

          <Field
            label="Пароль"
            htmlFor="reg-password"
            hint="Минимум 8 символов"
            error={errors.password?.message}
          >
            <div className="relative">
              <Input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
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

          <Field
            label="Повторите пароль"
            htmlFor="reg-confirm"
            error={errors.confirmPassword?.message}
          >
            <Input
              id="reg-confirm"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="••••••••"
              invalid={Boolean(errors.confirmPassword)}
              {...register('confirmPassword')}
            />
          </Field>

          {formError ? <ErrorText>{formError}</ErrorText> : null}

          <Button type="submit" className="mt-2 w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              'Создаём аккаунт…'
            ) : (
              <>
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                Зарегистрироваться
              </>
            )}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-400">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="font-medium text-primary-400 hover:text-primary">
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}
