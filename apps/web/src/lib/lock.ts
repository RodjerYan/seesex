/**
 * Настройки экрана блокировки (SecurityLock).
 *
 * ВРЕМЕННОЕ РЕШЕНИЕ: эндпоинта для lock-настроек в API нет
 * (User.lockEnabled/lockMethod/autoLockTimeout существуют в схеме БД,
 * но update-эндпоинта нет, а читаемые из login-ответа значения неизменяемы).
 * Поэтому настройки и sha-256 хэш PIN/пароля храним в localStorage.
 */

export const LOCK_STORAGE_KEY = 'xtracker.lock';

/** Событие обновления настроек (Settings пишет -> SecurityLock перечитывает). */
export const LOCK_SETTINGS_EVENT = 'xtracker:lock-settings-changed';

export type LockMethod = 'PIN' | 'PASSWORD';

export interface LockSettings {
  lockEnabled: boolean;
  lockMethod: LockMethod;
  /** Секунды неактивности до автоблокировки. */
  autoLockTimeout: number;
  /** sha-256 (hex) PIN/пароля; null = секрет не задан -> блокировка не активна. */
  secretHash: string | null;
}

export const DEFAULT_LOCK_SETTINGS: LockSettings = {
  lockEnabled: false,
  lockMethod: 'PIN',
  autoLockTimeout: 60,
  secretHash: null,
};

export const TIMEOUT_OPTIONS = [30, 60, 300, 900] as const;

function readStorage(): LockSettings {
  try {
    const raw = window.localStorage.getItem(LOCK_STORAGE_KEY);
    if (!raw) return DEFAULT_LOCK_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<LockSettings>;
    return {
      lockEnabled: parsed.lockEnabled === true,
      lockMethod: parsed.lockMethod === 'PASSWORD' ? 'PASSWORD' : 'PIN',
      autoLockTimeout:
        typeof parsed.autoLockTimeout === 'number' && parsed.autoLockTimeout >= 5
          ? parsed.autoLockTimeout
          : DEFAULT_LOCK_SETTINGS.autoLockTimeout,
      secretHash: typeof parsed.secretHash === 'string' ? parsed.secretHash : null,
    };
  } catch {
    return DEFAULT_LOCK_SETTINGS;
  }
}

export function readLockSettings(): LockSettings {
  return readStorage();
}

export function writeLockSettings(patch: Partial<LockSettings>): LockSettings {
  const next = { ...readStorage(), ...patch };
  try {
    window.localStorage.setItem(LOCK_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Недоступный storage (private mode) — настройки останутся только в памяти.
  }
  window.dispatchEvent(new CustomEvent(LOCK_SETTINGS_EVENT));
  return next;
}

/** Проверка формы секрета до хэширования. */
export function isValidSecret(method: LockMethod, value: string): boolean {
  return method === 'PIN' ? /^\d{4,6}$/.test(value) : value.length >= 6;
}

/** sha-256 (hex) — для PIN/пароля экрана блокировки. */
export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await window.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
