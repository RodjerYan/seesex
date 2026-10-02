import type { DeviceToken } from '@prisma/client';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { verifyAccessToken, verifyTwoFaToken, type TokenPurpose } from '../lib/jwt';
import { prisma } from '../lib/prisma';
import { ApiError } from './error';

/** Пользователь, прикреплённый requireAuth-ом к запросу. */
export interface AuthUser {
  id: string;
  email: string | null;
  purpose: TokenPurpose;
}

/** Request с гарантированно заполненным user (типобезопасный каст без any). */
export type AuthedRequest = Request & { user: AuthUser };

/** Request с device-токеном Apple Health (POST /api/health/apple). */
export type DeviceTokenRequest = Request & { deviceToken: DeviceToken };

function extractBearer(req: Request): string {
  const header = req.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
    throw ApiError.unauthorized('MISSING_TOKEN', 'Bearer access token required');
  }
  const token = header.slice('Bearer '.length).trim();
  if (token.length === 0) {
    throw ApiError.unauthorized('MISSING_TOKEN', 'Bearer access token required');
  }
  return token;
}

/**
 * Bearer access JWT (purpose=access) → req.user; невалиден/отсутствует → 401.
 * Подключён ко всем auth-эндпоинтам, кроме register/login/refresh.
 */
export const requireAuth: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  try {
    const claims = verifyAccessToken(extractBearer(req));
    const target = req as AuthedRequest;
    target.user = { id: claims.sub as string, email: claims.email ?? null, purpose: 'access' };
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Для POST /api/auth/totp/verify: принимает access JWT (включить 2FA)
 * или короткоживущий tmpToken purpose=2fa (шаг 2 входа).
 */
export const requireAuthOrTmpToken: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const token = extractBearer(req);
    try {
      const claims = verifyAccessToken(token);
      const target = req as AuthedRequest;
      target.user = { id: claims.sub as string, email: claims.email ?? null, purpose: 'access' };
    } catch {
      const claims = verifyTwoFaToken(token);
      const target = req as AuthedRequest;
      target.user = { id: claims.sub as string, email: null, purpose: '2fa' };
    }
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Bearer device-token (НЕ JWT) для POST /api/health/apple:
 * ищем DeviceToken по token, иначе 401 INVALID_DEVICE_TOKEN.
 * Успех → req.deviceToken (владелец — deviceToken.userId).
 */
export const requireDeviceToken: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  void (async () => {
    const token = extractBearer(req);
    const deviceToken = await prisma.deviceToken.findUnique({ where: { token } });
    if (!deviceToken) {
      throw ApiError.unauthorized('INVALID_DEVICE_TOKEN', 'Unknown device token');
    }
    const target = req as DeviceTokenRequest;
    target.deviceToken = deviceToken;
    next();
  })().catch(next);
};
