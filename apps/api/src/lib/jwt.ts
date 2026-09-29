import { createHash, randomUUID } from 'node:crypto';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { ApiError } from '../middleware/error';
import { config } from './config';

export type TokenPurpose = 'access' | 'refresh' | '2fa' | 'totp_setup';

export interface BaseClaims extends JwtPayload {
  purpose: TokenPurpose;
}

export interface AccessClaims extends BaseClaims {
  purpose: 'access';
  email?: string;
}

export interface RefreshClaims extends BaseClaims {
  purpose: 'refresh';
  /** id сессии, для которой выдан refresh-токен (для logout/revoke). */
  sid?: string;
}

export interface TwoFaClaims extends BaseClaims {
  purpose: '2fa';
}

export interface TotpSetupClaims extends BaseClaims {
  purpose: 'totp_setup';
  /** Временно храним секрет до подтверждения кодом (не пишем в БД). */
  secret?: string;
}

/** SHA-256 hex — для хэшей refresh-токенов и IP (приватность, не сырой IP). */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function sign(
  payload: Record<string, unknown>,
  subject: string,
  expiresIn: SignOptions['expiresIn'],
): string {
  return jwt.sign(payload, config.JWT_SECRET, { subject, expiresIn } satisfies SignOptions);
}

export function signAccessToken(userId: string, email: string | null): string {
  return sign({ purpose: 'access', email: email ?? undefined }, userId, '15m');
}

export function signRefreshToken(userId: string, sessionId: string): string {
  // jti (случайный UUID) гарантирует уникальность токена: без него два
  // refresh-токена с одинаковыми claims, выданные в одну секунду, были бы
  // байт-в-байт идентичны (детерминированный HS256) и сломали бы ротацию.
  return sign({ purpose: 'refresh', sid: sessionId, jti: randomUUID() }, userId, '7d');
}

/** Короткоживущий tmp-токен (5m) для второго шага 2FA при login. */
export function signTwoFaToken(userId: string): string {
  return sign({ purpose: '2fa' }, userId, '5m');
}

/** Короткоживущий (5m) токен, переносящий секрет TOTP от setup к verify. */
export function signTotpSetupToken(userId: string, secret: string): string {
  return sign({ purpose: 'totp_setup', secret }, userId, '5m');
}

function verifyToken<T extends BaseClaims>(token: string, expectedPurpose: T['purpose']): T {
  let payload: string | JwtPayload;
  try {
    payload = jwt.verify(token, config.JWT_SECRET);
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw ApiError.unauthorized('TOKEN_EXPIRED', 'Token expired');
    }
    if (err instanceof jwt.JsonWebTokenError) {
      throw ApiError.unauthorized('TOKEN_INVALID', 'Invalid token');
    }
    throw err;
  }
  if (typeof payload === 'string' || payload.purpose !== expectedPurpose) {
    throw ApiError.unauthorized('TOKEN_INVALID', 'Invalid token');
  }
  const claims = payload as unknown as T;
  if (typeof claims.sub !== 'string' || claims.sub.length === 0) {
    throw ApiError.unauthorized('TOKEN_INVALID', 'Invalid token');
  }
  return claims;
}

export function verifyAccessToken(token: string): AccessClaims {
  return verifyToken<AccessClaims>(token, 'access');
}

export function verifyRefreshToken(token: string): RefreshClaims {
  return verifyToken<RefreshClaims>(token, 'refresh');
}

export function verifyTwoFaToken(token: string): TwoFaClaims {
  return verifyToken<TwoFaClaims>(token, '2fa');
}

export function verifyTotpSetupToken(token: string): TotpSetupClaims {
  return verifyToken<TotpSetupClaims>(token, 'totp_setup');
}
