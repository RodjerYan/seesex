/**
 * SecurityLock — оверлей-экран блокировки приложения (PIN 4-6 цифр или пароль).
 * Разблокировка локальная: сверяем sha-256 введённого секрета с localStorage
 * (см. lib/lock.ts — настроек lock на бэке нет, временное решение).
 */
import { LockKeyhole } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactElement } from 'react';

import { isValidSecret, type LockMethod, type LockSettings } from '../../lib/lock';
import { Button, Input } from '../ui/controls';

interface SecurityLockProps {
  locked: boolean;
  settings: LockSettings;
  onUnlock: (secret: string) => Promise<boolean>;
}

export function SecurityLock({ locked, settings, onUnlock }: SecurityLockProps): ReactElement | null {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const method: LockMethod = settings.lockMethod;
  const isPin = method === 'PIN';

  useEffect(() => {
    if (!locked) {
      setValue('');
      setError(null);
      return;
    }
    inputRef.current?.focus();
  }, [locked]);

  if (!locked) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    if (!isValidSecret(method, value)) {
      setError(isPin ? 'PIN — от 4 до 6 цифр' : 'Пароль от 6 символов');
      return;
    }
    setChecking(true);
    try {
      const ok = await onUnlock(value);
      if (!ok) setError(isPin ? 'Неверный PIN' : 'Неверный пароль');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Приложение заблокировано"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-surface px-6"
    >
      <span
        aria-hidden="true"
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary-400"
      >
        <LockKeyhole className="h-7 w-7" />
      </span>
      <h1 className="mt-4 text-lg font-semibold text-slate-100">Приложение заблокировано</h1>
      <p className="mt-1 text-sm text-slate-500">
        {isPin ? 'Введите PIN, чтобы продолжить' : 'Введите пароль, чтобы продолжить'}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 w-full max-w-xs">
        <Input
          ref={inputRef}
          type="password"
          inputMode={isPin ? 'numeric' : 'text'}
          autoComplete={isPin ? 'off' : 'current-password'}
          maxLength={isPin ? 6 : 128}
          placeholder={isPin ? '••••' : 'Пароль'}
          aria-label={isPin ? 'PIN' : 'Пароль'}
          value={value}
          invalid={Boolean(error)}
          className="text-center text-lg tracking-[0.4em]"
          onChange={(event) => setValue(event.target.value)}
        />
        {error ? (
          <p role="alert" className="mt-2 text-center text-xs text-red-400">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="mt-4 w-full" disabled={checking}>
          {checking ? 'Проверяем…' : 'Разблокировать'}
        </Button>
      </form>

      <p className="mt-6 max-w-xs text-center text-xs text-slate-600">
        Секрет хранится только на этом устройстве (sha-256 в localStorage).
      </p>
    </div>
  );
}
