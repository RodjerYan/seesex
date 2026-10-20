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
import dotenv from 'dotenv';
import { driveConfigured, downloadDatabase } from './lib/drive';

const DEFAULT_DB_PATH = path.resolve(process.cwd(), 'data', 'seesex.db');

/** Render Secret File (или локальный файл) с GOOGLE_* — вне git и вне env-логов. */
function loadGoogleSecrets(): void {
  const dirs = [
    '/etc/secrets',
    process.cwd(),
    path.resolve(process.cwd(), '..'),
    path.resolve(process.cwd(), '..', '..'),
  ];
  const found: string[] = [];
  for (const dir of dirs) {
    try {
      if (!fs.existsSync(dir)) {
        console.log(`[boot] secrets: ${dir} not found`);
        continue;
      }
      const entries = fs.readdirSync(dir);
      console.log(`[boot] secrets: ${dir} -> ${entries.slice(0, 25).join(', ') || '(empty)'}`);
      for (const entry of entries) {
        if (entry === 'seesex-google.env' || entry.endsWith('.env') || entry.includes('google')) {
          found.push(path.join(dir, entry));
        }
      }
    } catch (error) {
      console.log(`[boot] secrets: ${dir} error ${String(error)}`);
    }
  }
  for (const candidate of found) {
    if (fs.existsSync(candidate)) {
      dotenv.config({ path: candidate });
      console.log(`[boot] Google secrets loaded from ${candidate}`);
      return;
    }
  }
  console.log('[boot] Google secrets file not found');
}

async function main(): Promise<void> {
  loadGoogleSecrets();
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
