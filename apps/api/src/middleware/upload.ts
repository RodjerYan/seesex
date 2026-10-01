import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer, { MulterError } from 'multer';
import type { Request, RequestHandler } from 'express';
import { config } from '../lib/config';
import { logger } from '../lib/winston';
import { ApiError } from './error';

/**
 * Multipart-загрузка фото (events/partners): файлы кладутся в
 * UPLOAD_DIR/<kind>/, в БД пишется относительный путь "<kind>/<имя файла>".
 * Принимаем только image/*, ограничиваем MAX_FILE_SIZE.
 */

const IMAGE_MIME_PREFIX = 'image/';
const SAFE_EXT = /^\.[a-z0-9]{1,5}$/i;

function uploadRoot(): string {
  return path.resolve(process.cwd(), config.UPLOAD_DIR);
}

/** Абсолютный каталог загрузок для вида файлов (events / partners). */
export function uploadDirFor(kind: 'events' | 'partners'): string {
  return path.join(uploadRoot(), kind);
}

/** Относительный путь (для БД) из абсолютного файла multer. */
export function relativeUploadPath(kind: 'events' | 'partners', filename: string): string {
  return `${kind}/${filename}`;
}

/** Безопасное удаление файла с диска (отсутствующий файл — не ошибка). */
export function unlinkUpload(relativePath: string): void {
  const absolute = resolveUploadPath(relativePath);
  if (!absolute) return;
  try {
    fs.rmSync(absolute, { force: true });
  } catch (err) {
    logger.warn(`Failed to remove upload ${relativePath}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Резолвит относительный путь из БД в абсолютный внутри UPLOAD_DIR.
 * Возвращает null при попытке выйти за каталог (path traversal) или невалидном пути.
 */
export function resolveUploadPath(relativePath: string): string | null {
  if (typeof relativePath !== 'string' || relativePath.length === 0) return null;
  if (relativePath.includes('\0')) return null;
  const root = uploadRoot();
  const absolute = path.resolve(root, relativePath);
  const withSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (absolute !== root && !absolute.startsWith(withSep)) return null;
  return absolute;
}

function extensionFor(originalName: string, mime: string): string {
  const ext = path.extname(originalName ?? '').toLowerCase();
  if (SAFE_EXT.test(ext)) return ext;
  const byMime: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/heic': '.heic',
    'image/heif': '.heif',
  };
  return byMime[mime] ?? '.jpg';
}

function multerErrorToApiError(err: unknown): ApiError {
  if (err instanceof MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return new ApiError(
        413,
        'FILE_TOO_LARGE',
        `File exceeds MAX_FILE_SIZE (${config.MAX_FILE_SIZE} bytes)`,
      );
    }
    return ApiError.badRequest('UPLOAD_FAILED', `Upload failed: ${err.code}`);
  }
  if (err instanceof ApiError) return err;
  return ApiError.badRequest('UPLOAD_FAILED', 'File upload failed');
}

/** Удаляет уже сохранённые multer-файлы (вызывается при ошибке/лимите). */
function cleanupRequestFiles(req: Request): void {
  const files = req.files;
  if (!Array.isArray(files)) return;
  for (const file of files) {
    fs.rm(file.path, { force: true }, () => undefined);
  }
}

/**
 * Multer-мидлварь: дискетный storage в UPLOAD_DIR/<kind>, image/*, лимит размера.
 * Ошибки multer мапятся в ApiError (413/400); частично сохранённые файлы удаляются.
 */
export function uploadPhotos(kind: 'events' | 'partners'): RequestHandler {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = uploadDirFor(kind);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      cb(null, `${randomUUID()}${extensionFor(file.originalname, file.mimetype)}`);
    },
  });

  const handler = multer({
    storage,
    limits: { fileSize: config.MAX_FILE_SIZE, files: 20 },
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.toLowerCase().startsWith(IMAGE_MIME_PREFIX)) {
        cb(ApiError.badRequest('INVALID_FILE_TYPE', 'Only image/* files are allowed'));
        return;
      }
      cb(null, true);
    },
  }).any();

  return (req, res, next) => {
    handler(req, res, (err: unknown) => {
      if (err) {
        cleanupRequestFiles(req);
        next(multerErrorToApiError(err));
        return;
      }
      next();
    });
  };
}

/** Файлы из multer (типизированный доступ к req.files после uploadPhotos). */
export function uploadedFiles(req: Request): { filename: string; mimetype: string }[] {
  const files = req.files;
  if (!Array.isArray(files)) return [];
  return files.map((file) => ({ filename: file.filename, mimetype: file.mimetype }));
}
