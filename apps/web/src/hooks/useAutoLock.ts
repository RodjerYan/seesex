/**
 * useAutoLock — автоблокировка приложения (SecurityLock).
 *
 * - активность (pointer/touch/keydown) сбрасывает таймер;
 * - после `autoLockTimeout` секунд неактивности — блокировка;
 * - уход вкладки в background (visibilitychange) — мгновенная блокировка;
 * - ручная блокировка (кнопка в шапке).
 *
 * Блокировка включается только когда задан секрет (PIN/пароль в localStorage),
 * иначе пользователь не смог бы разблокироваться. Нет эндпоинта для lock-настроек —
 * см. lib/lock.ts (временное решение).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  LOCK_SETTINGS_EVENT,
  readLockSettings,
  sha256Hex,
  type LockSettings,
} from '../lib/lock';

const CHECK_INTERVAL_MS = 1_000;
const ACTIVITY_EVENTS = ['pointerdown', 'touchstart', 'keydown'] as const;

export interface AutoLockState {
  locked: boolean;
  settings: LockSettings;
  /** Ручная блокировка (безопасно делать только при заданном секрете). */
  lock: () => void;
  /** Разблокировка: true — верный PIN/пароль. */
  unlock: (secret: string) => Promise<boolean>;
  /** Перечитать настройки из localStorage (после их изменения в Settings). */
  reloadSettings: () => void;
}

export function useAutoLock(): AutoLockState {
  const [settings, setSettings] = useState<LockSettings>(() => readLockSettings());
  const [locked, setLocked] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());

  const reloadSettings = useCallback(() => {
    setSettings(readLockSettings());
  }, []);

  // Настройки могли измениться в другом месте приложения.
  useEffect(() => {
    const onSettingsChanged = () => setSettings(readLockSettings());
    window.addEventListener(LOCK_SETTINGS_EVENT, onSettingsChanged);
    return () => window.removeEventListener(LOCK_SETTINGS_EVENT, onSettingsChanged);
  }, []);

  const isEnabled = settings.lockEnabled && settings.secretHash !== null;

  const lock = useCallback(() => {
    if (readLockSettings().secretHash === null) return;
    setLocked(true);
  }, []);

  const unlock = useCallback(
    async (secret: string): Promise<boolean> => {
      const current = readLockSettings();
      if (!current.secretHash) {
        setLocked(false);
        return true;
      }
      let hash: string;
      try {
        hash = await sha256Hex(secret);
      } catch {
        return false;
      }
      if (hash !== current.secretHash) return false;
      lastActivityRef.current = Date.now();
      setLocked(false);
      return true;
    },
    [],
  );

  // Сброс таймера активности.
  useEffect(() => {
    const onTouch = () => {
      lastActivityRef.current = Date.now();
    };
    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, onTouch, { passive: true });
    return () => {
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, onTouch);
    };
  }, []);

  // Периодическая проверка таймера неактивности.
  useEffect(() => {
    if (!isEnabled) return undefined;
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= settings.autoLockTimeout * 1000) setLocked(true);
    }, CHECK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isEnabled, settings.autoLockTimeout]);

  // Блокировка при уходе вкладки в background.
  useEffect(() => {
    if (!isEnabled) return undefined;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') setLocked(true);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [isEnabled]);

  return { locked, settings, lock, unlock, reloadSettings };
}
