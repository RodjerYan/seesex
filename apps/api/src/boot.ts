/**
 * Точка входа продакшена: сначала локальный SQLite-файл (скачивается из
 * Google Drive при первом запуске), затем `prisma db push` и старт API.
 *
 * Отдельный entry нужен потому, что DATABASE_URL должен быть выставлен
 * ДО импорта PrismaClient (иначе клиент возьмёт старое значение).
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { driveConfigured, downloadDatabase } from './lib/drive';

const DEFAULT_DB_PATH = path.resolve(process.cwd(), 'data', 'seesex.db');

async function main(): Promise<void> {
  const dbPath = process.env.SQLITE_PATH?.trim() || DEFAULT_DB_PATH;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  process.env.DATABASE_URL = `file:${dbPath.replace(/\\/g, '/')}`;

  if (!fs.existsSync(dbPath) && driveConfigured()) {
    try {
      const buffer = await downloadDatabase();
      if (buffer) {
        fs.writeFileSync(dbPath, buffer);
        console.log(`[boot] database downloaded from Google Drive (${buffer.length} bytes)`);
      }
    } catch (error) {
      console.error('[boot] Google Drive download failed:', String(error));
    }
  }

  try {
    execFileSync(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['prisma', 'db', 'push', '--skip-generate', '--schema', 'prisma/schema.prisma'],
      { stdio: 'inherit', env: process.env, shell: process.platform === 'win32' },
    );
    console.log('[boot] database schema is up to date');
  } catch (error) {
    // Не роняем старт: если файл уже существует и схема совместима, API поднимется.
    console.error('[boot] prisma db push failed:', String(error));
  }

  await import('./index');
}

void main();
