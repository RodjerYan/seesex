import type { Response } from 'express';
import type { AuthedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { isoDay } from '../lib/date';
import * as exportService from '../services/export.service';

/** POST /api/export/json — полный дамп данных юзера (attachment). */
export const json = asyncHandler<AuthedRequest>(async (req: AuthedRequest, res: Response) => {
  const data = await exportService.exportJson(req.user.id);
  res.setHeader('Content-Disposition', `attachment; filename="xtracker-export-${isoDay()}.json"`);
  res.status(200).json(data);
});

/** POST /api/export/csv — CSV с секцией событий (attachment). */
export const csv = asyncHandler<AuthedRequest>(async (req: AuthedRequest, res: Response) => {
  const { csv, filename } = await exportService.exportEventsCsv(req.user.id);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(csv);
});
