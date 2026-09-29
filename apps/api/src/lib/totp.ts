import { generate, generateSecret, generateURI, verify } from 'otplib';

/** Окно проверки ±1 шаг (30 секунд) — RFC 6238 tolerance. */
const EPOCH_TOLERANCE_SECONDS = 30;

/** Генерация нового base32-секрета TOTP (RFC 6238). */
export function generateTotpSecret(): string {
  return generateSecret();
}

/** otpauth:// URI для QR-кода (Google Authenticator и др.). */
export function buildOtpauthUri(email: string, secret: string): string {
  return generateURI({ issuer: 'xTracker', label: email, secret });
}

/** Текущий 6-значный код (используется в тестах/отладке). */
export async function generateTotpCode(secret: string): Promise<string> {
  return generate({ secret });
}

/** Проверка 6-значного кода с окном ±1 шаг. Невалидные форматы → false. */
export async function verifyTotpCode(code: string, secret: string): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false;
  try {
    const result = await verify({ secret, token: code, epochTolerance: EPOCH_TOLERANCE_SECONDS });
    return result.valid;
  } catch {
    return false;
  }
}
