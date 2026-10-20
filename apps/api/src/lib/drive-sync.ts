/**
 * Синхронизация SQLite-файла БД с Google Drive.
 *
 * Схема: единственный экземпляр Render держит локальную копию файла,
 * периодически снимает консистентный снапшот (VACUUM INTO) и загружает
 * его в папку приложения на Drive. При старте файл скачивается обратно.
 */

import fs from 'node:fs';
import path from 'node:path';
import { prisma } from './prisma';
import { logger } from './winston';
import { driveConfigured, uploadDatabase } from './drive';

let timer: NodeJS.Timeout | null = null;
let uploading = false;
let lastUploadedMtimeMs = 0;
let started = false;

/** Путь к локальному SQLite-файлу из DATABASE_URL (file:...). */
export function currentDatabasePath(): string | null {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.startsWith('file:')) return null;
  const raw = url.slice('file:'.length);
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
}

function syncIntervalMs(): number {
  const value = Number(process.env.DRIVE_SYNC_INTERVAL_MS);
  return Number.isFinite(value) && value >= 10_000 ? value : 60_000;
}

async function uploadSnapshot(reason: string, force: boolean): Promise<void> {
  if (!driveConfigured() || uploading) return;

  const dbPath = currentDatabasePath();
  if (!dbPath || !fs.existsSync(dbPath)) return;

  const mtimeMs = fs.statSync(dbPath).mtimeMs;
  if (!force && reason === 'interval' && mtimeMs <= lastUploadedMtimeMs) return;

  uploading = true;
  const snapshotPath = `${dbPath}.snapshot`;
  try {
    try {
      fs.unlinkSync(snapshotPath);
    } catch {
      /* снапшота ещё нет */
    }

    let bytes: Buffer;
    try {
      // Консистентная копия без блокировки writers.
      await prisma.$executeRawUnsafe(`VACUUM INTO '${snapshotPath.replace(/'/g, "''")}'`);
      bytes = fs.readFileSync(snapshotPath);
    } catch (vacuumError) {
      logger.warn('drive sync: VACUUM INTO failed, fallback to file copy', {
        error: String(vacuumError),
      });
      bytes = fs.readFileSync(dbPath);
    }

    await uploadDatabase(bytes);
    lastUploadedMtimeMs = mtimeMs;
    logger.info('drive sync: database uploaded', { bytes: bytes.length, reason });
  } catch (error) {
    logger.error('drive sync: upload failed', { error: String(error), reason });
  } finally {
    uploading = false;
    try {
      fs.unlinkSync(snapshotPath);
    } catch {
      /* уже удалён */
    }
  }
}

/** Запустить фоновую синхронизацию (после успешного подключения Prisma). */
export function startDriveSync(): void {
  if (started || !driveConfigured()) return;
  started = true;

  const dbPath = currentDatabasePath();
  if (dbPath && fs.existsSync(dbPath)) {
    // Файл только что скачан из Drive — не перезаливаем его сразу.
    lastUploadedMtimeMs = fs.statSync(dbPath).mtimeMs;
  }

  timer = setInterval(() => {
    void uploadSnapshot('interval', false);
  }, syncIntervalMs());
  timer.unref?.();

  logger.info('drive sync: started', { intervalMs: syncIntervalMs() });
}

/** Принудительный flush (SIGTERM / graceful shutdown). */
export async function flushDrive(): Promise<void> {
  if (!driveConfigured()) return;
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  await uploadSnapshot('shutdown', true);
}
