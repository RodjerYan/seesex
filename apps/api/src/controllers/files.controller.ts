import fs from 'node:fs';
import type { AuthedRequest } from '../middleware/auth';
import { ApiError, asyncHandler } from '../middleware/error';
import { fileQuerySchema, parseInput } from '../schemas/common';
import * as filesService from '../services/files.service';

/**
 * GET /api/files?path=events/<file>|partners/<file> — отдача фото только
 * авторизованному владельцу (Bearer access JWT в query нельзя — только заголовок).
 */
export const serve = asyncHandler<AuthedRequest>(async (req, res, next) => {
  const { path: relativePath } = parseInput(fileQuerySchema, req.query);
  const absolute = await filesService.resolveFileForUser(req.user.id, relativePath);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    throw ApiError.notFound('FILE_NOT_FOUND', 'File not found');
  }
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.sendFile(absolute, (err) => {
    if (err) next(err);
  });
});
