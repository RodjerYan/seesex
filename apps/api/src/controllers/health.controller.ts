import type { Response } from 'express';
import type { AuthedRequest, DeviceTokenRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { parseInput } from '../schemas/common';
import { appleIngestSchema, tokenActionSchema } from '../schemas/health.schema';
import * as healthService from '../services/health.service';

/**
 * POST /api/health/apple — шорткат iPhone шлёт пробы Apple Health.
 * Авторизация: Bearer device-token (не JWT).
 */
export const ingestApple = asyncHandler<DeviceTokenRequest>(
  async (req: DeviceTokenRequest, res: Response) => {
    const input = parseInput(appleIngestSchema, req.body);
    res.status(200).json(await healthService.ingestAppleSamples(req.deviceToken, input));
  },
);

/** POST /api/health/token (JWT): { action: "create" | "revoke" }. */
export const manageToken = asyncHandler<AuthedRequest>(async (req: AuthedRequest, res: Response) => {
  const { action } = parseInput(tokenActionSchema, req.body);
  if (action === 'create') {
    // Токен показывается в UI один раз — хранится открытым (комментарий в сервисе).
    res.status(201).json({ token: await healthService.createDeviceToken(req.user.id) });
    return;
  }
  res.status(200).json(await healthService.revokeDeviceTokens(req.user.id));
});

/** GET /api/health/token (JWT): статус токенов для UI. */
export const tokenStatus = asyncHandler<AuthedRequest>(async (req: AuthedRequest, res: Response) => {
  res.status(200).json(await healthService.deviceTokenStatus(req.user.id));
});
