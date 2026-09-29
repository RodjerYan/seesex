import type { Response } from 'express';
import type { AuthedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { parseInput } from '../schemas/common';
import { deleteDataSchema } from '../schemas/settings.schema';
import * as settingsService from '../services/settings.service';

/**
 * DELETE /api/settings/data — GDPR-очистка.
 * Требует явного подтверждения { "confirm": "DELETE" }; аккаунт остаётся.
 */
export const deleteData = asyncHandler<AuthedRequest>(async (req: AuthedRequest, res: Response) => {
  parseInput(deleteDataSchema, req.body);
  res.status(200).json(await settingsService.deleteAllUserData(req.user.id));
});
