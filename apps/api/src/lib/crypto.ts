import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { config } from './config';
import { logger } from './winston';

/**
 * AES-256-GCM для чувствительных полей (Event.notes и т.п.):
 * - ключ: sha256(ENCRYPTION_KEY) → ровно 32 байта;
 * - iv: 16 байт (случайный на каждое шифрование), authTag: 16 байт;
 * - формат хранения: "enc:v1:<iv b64>:<tag b64>:<ciphertext b64>".
 *
 * Если ENCRYPTION_KEY не задан (dev/тесты) — работаем без шифрования,
 * один раз пишем warning-лог. Расшифровка «старых» записей без префикса
 * возвращает значение как есть (лежало открытым текстом).
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const PREFIX = 'enc:v1:';

let cachedRaw: string | undefined;
let cachedKey: Buffer | null = null;
let warnedNoKey = false;

function resolveKey(): Buffer | null {
  const raw = config.ENCRYPTION_KEY?.trim();
  if (!raw) {
    if (!warnedNoKey) {
      warnedNoKey = true;
      logger.warn(
        'ENCRYPTION_KEY is not set — sensitive fields (Event.notes) are stored UNENCRYPTED',
      );
    }
    return null;
  }
  if (raw !== cachedRaw) {
    cachedKey = createHash('sha256').update(raw, 'utf8').digest();
    cachedRaw = raw;
  }
  return cachedKey;
}

/** true, если ENCRYPTION_KEY задан и поля реально шифруются. */
export function isEncryptionEnabled(): boolean {
  return resolveKey() !== null;
}

/** Шифрует строку; null/undefined → null; без ключа → открытый текст. */
export function encrypt(plaintext: string | null | undefined): string | null {
  if (plaintext === null || plaintext === undefined) return null;
  if (plaintext === '') return '';
  const key = resolveKey();
  if (!key) return plaintext;

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

/**
 * Расшифровывает значение из БД. Без префикса — открытый текст (legacy).
 * Повреждённая/чужая запись → null + error-лог (не отдаём ciphertext клиенту).
 */
export function decrypt(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (!value.startsWith(PREFIX)) return value;

  const parts = value.slice(PREFIX.length).split(':');
  if (parts.length !== 3) {
    logger.error('Encrypted value has malformed format (expected enc:v1:iv:tag:data)');
    return null;
  }
  const [ivB64, tagB64, dataB64] = parts as [string, string, string];
  const key = resolveKey();
  if (!key) {
    // Запись зашифрована, а ключа нет — честно сообщаем об ошибке, не падая.
    logger.error('Encrypted value found but ENCRYPTION_KEY is not set');
    return null;
  }
  try {
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString(
      'utf8',
    );
  } catch {
    logger.error('Failed to decrypt value (wrong ENCRYPTION_KEY or corrupted data)');
    return null;
  }
}
