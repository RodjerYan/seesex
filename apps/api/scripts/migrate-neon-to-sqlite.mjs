#!/usr/bin/env node
/**
 * Перенос данных SeeSex из PostgreSQL (Neon) в SQLite-файл, который затем
 * загружается в Google Drive и используется продом.
 *
 * Запуск (из apps/api):
 *   NEON_DATABASE_URL='postgresql://...' node scripts/migrate-neon-to-sqlite.mjs \
 *     --target data/seesex.db
 *
 * Скрипт идемпотентен: строки с существующими id пропускаются, пользователи
 * с тем же email не дублируются (их id переиспользуется, новые данные
 * привязываются к существующему аккаунту). Это позволяет безопасно накатить
 * перенос на уже работающую базу, не потеряв данные, созданные после запуска прода.
 *
 * Источник (Neon) только читается. Перед запуском делается копия целевого файла.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Client } = require('pg');

const API_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function arg(name, fallback = undefined) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) return true;
  return value;
}

const sourceUrl =
  (typeof arg('source') === 'string' && arg('source')) ||
  process.env.NEON_DATABASE_URL ||
  process.env.POSTGRES_URL ||
  '';
const targetPath = path.resolve(
  API_DIR,
  typeof arg('target') === 'string' ? arg('target') : process.env.SQLITE_PATH || 'data/seesex.db',
);
const skipPush = arg('no-push', false) === true;

if (!sourceUrl) {
  console.error('Нет строки подключения к Postgres. Укажите NEON_DATABASE_URL или --source.');
  process.exit(2);
}
fs.mkdirSync(path.dirname(targetPath), { recursive: true });
if (fs.existsSync(targetPath)) {
  const backup = `${targetPath}.backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  fs.copyFileSync(targetPath, backup);
  console.log(`[migrate] резервная копия цели: ${backup}`);
}

process.env.DATABASE_URL = `file:${targetPath.replace(/\\/g, '/')}`;

async function main() {
  const isLocal = /(^|@)(localhost|127\.0\.0\.1)[:/]/.test(sourceUrl) || sourceUrl.includes('sslmode=disable');
  const pg = new Client({
    connectionString: sourceUrl,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
  await pg.connect();
  console.log('[migrate] подключение к источнику установлено');

  if (!skipPush) {
    console.log('[migrate] prisma db push в целевой SQLite…');
    execFileSync(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['prisma', 'db', 'push', '--skip-generate', '--schema', 'prisma/schema.prisma'],
      { cwd: API_DIR, stdio: 'inherit', env: process.env, shell: process.platform === 'win32' },
    );
  }

  const prismaModule = await import('@prisma/client');
  const PrismaClient = prismaModule.PrismaClient ?? prismaModule.default.PrismaClient;
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

  const read = async (table) => (await pg.query(`SELECT * FROM "${table}"`)).rows;
  const stats = {};

  const migrateTable = async (table, delegate, mapRow) => {
    const rows = await read(table);
    const stat = (stats[table] = { source: rows.length, inserted: 0, skipped: 0, target: 0 });
    for (const row of rows) {
      const data = mapRow(row);
      const existing = await delegate.findUnique({ where: { id: data.id } });
      if (existing) {
        stat.skipped += 1;
        continue;
      }
      try {
        await delegate.create({ data });
        stat.inserted += 1;
      } catch (error) {
        if (error?.code === 'P2002') {
          // Уникальный ключ (например, Profile.userId при merge аккаунта).
          stat.skipped += 1;
          console.warn(`[migrate] ${table}: пропуск ${data.id} (unique constraint)`);
          continue;
        }
        throw error;
      }
    }
    return rows;
  };

  try {
    // --- Пользователи: id-маппинг для merge по email -----------------------
    const users = await read('User');
    const userStat = (stats.User = { source: users.length, inserted: 0, skipped: 0, target: 0 });
    const userIdMap = new Map();

    for (const row of users) {
      const byId = await prisma.user.findUnique({ where: { id: row.id } });
      if (byId) {
        userIdMap.set(row.id, byId.id);
        userStat.skipped += 1;
        continue;
      }
      if (row.email) {
        const byEmail = await prisma.user.findUnique({ where: { email: row.email } });
        if (byEmail) {
          // Аккаунт уже создан на проде после переезда: не плодим дубль,
          // старые данные привязываем к нему. Пароль оставляем текущий.
          userIdMap.set(row.id, byEmail.id);
          userStat.skipped += 1;
          continue;
        }
      }
      await prisma.user.create({
        data: {
          id: row.id,
          email: row.email ?? null,
          passwordHash: row.passwordHash,
          totpSecret: row.totpSecret ?? null,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          lockEnabled: row.lockEnabled,
          lockMethod: row.lockMethod,
          autoLockTimeout: row.autoLockTimeout,
        },
      });
      userIdMap.set(row.id, row.id);
      userStat.inserted += 1;
    }
    const mapUser = (id) => (id ? userIdMap.get(id) ?? id : id);

    await migrateTable('Profile', prisma.profile, (row) => ({
      id: row.id,
      userId: mapUser(row.userId),
      displayName: row.displayName ?? null,
      birthDate: row.birthDate ?? null,
      heightCm: row.heightCm ?? null,
      weightKg: row.weightKg ?? null,
      bio: row.bio ?? null,
      avatarUrl: row.avatarUrl ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    await migrateTable('DeviceToken', prisma.deviceToken, (row) => ({
      id: row.id,
      userId: mapUser(row.userId),
      token: row.token,
      createdAt: row.createdAt,
      lastSyncAt: row.lastSyncAt ?? null,
    }));

    await migrateTable('Session', prisma.session, (row) => ({
      id: row.id,
      userId: mapUser(row.userId),
      userAgent: row.userAgent ?? null,
      ipHash: row.ipHash ?? null,
      createdAt: row.createdAt,
      lastSeenAt: row.lastSeenAt,
      expiresAt: row.expiresAt,
    }));

    await migrateTable('RefreshToken', prisma.refreshToken, (row) => ({
      id: row.id,
      userId: mapUser(row.userId),
      tokenHash: row.tokenHash,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt ?? null,
      createdAt: row.createdAt,
    }));

    await migrateTable('Partner', prisma.partner, (row) => ({
      id: row.id,
      userId: mapUser(row.userId),
      name: row.name,
      nickname: row.nickname ?? null,
      gender: row.gender ?? null,
      sexualOrientation: row.sexualOrientation ?? null,
      pronouns: row.pronouns ?? null,
      relationshipStatus: row.relationshipStatus ?? null,
      isPrimary: row.isPrimary,
      customFields: row.customFields ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    await migrateTable('Wishlist', prisma.wishlist, (row) => ({
      id: row.id,
      userId: mapUser(row.userId),
      customName: row.customName ?? null,
      customCategory: row.customCategory ?? null,
      isCompleted: row.isCompleted,
      completedAt: row.completedAt ?? null,
      createdAt: row.createdAt,
    }));

    await migrateTable('GroupCalendar', prisma.groupCalendar, (row) => ({
      id: row.id,
      name: row.name,
      inviteCode: row.inviteCode,
      createdBy: mapUser(row.createdBy),
      createdAt: row.createdAt,
    }));

    await migrateTable('GroupCalendarMember', prisma.groupCalendarMember, (row) => ({
      id: row.id,
      groupCalendarId: row.groupCalendarId,
      userId: mapUser(row.userId),
      role: row.role,
      joinedAt: row.joinedAt,
    }));

    await migrateTable('Mood', prisma.mood, (row) => ({
      id: row.id,
      userId: row.userId ? mapUser(row.userId) : null,
      name: row.name,
      iconName: row.iconName ?? null,
      color: row.color ?? null,
    }));

    await migrateTable('Place', prisma.place, (row) => ({
      id: row.id,
      userId: row.userId ? mapUser(row.userId) : null,
      name: row.name,
      iconName: row.iconName ?? null,
    }));

    await migrateTable('Accessory', prisma.accessory, (row) => ({
      id: row.id,
      userId: row.userId ? mapUser(row.userId) : null,
      name: row.name,
      iconName: row.iconName ?? null,
    }));

    await migrateTable('Event', prisma.event, (row) => ({
      id: row.id,
      userId: mapUser(row.userId),
      title: row.title ?? null,
      eventType: row.eventType ?? 'SEX',
      eventTypes: JSON.stringify(Array.isArray(row.eventTypes) ? row.eventTypes : []),
      isCustomType: row.isCustomType,
      date: row.date,
      duration: row.duration ?? null,
      rating: row.rating ?? null,
      notes: row.notes ?? null,
      calories: row.calories ?? null,
      heartRate: row.heartRate ?? null,
      heartRateMax: row.heartRateMax ?? null,
      initiatedBy: row.initiatedBy ?? null,
      groupCalendarId: row.groupCalendarId ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    await migrateTable('PeriodTracking', prisma.periodTracking, (row) => ({
      id: row.id,
      partnerId: row.partnerId,
      lastPeriodStart: row.lastPeriodStart ?? null,
      averageCycleLength: row.averageCycleLength,
      averagePeriodLength: row.averagePeriodLength,
      notes: row.notes ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    await migrateTable('PeriodEntry', prisma.periodEntry, (row) => ({
      id: row.id,
      periodTrackingId: row.periodTrackingId,
      startDate: row.startDate,
      endDate: row.endDate ?? null,
      symptoms: row.symptoms ?? null,
      notes: row.notes ?? null,
      createdAt: row.createdAt,
    }));

    // --- M2M (implicit-таблицы Prisma) ------------------------------------
    // A/B — как в старых миграциях Postgres.
    for (const table of ['_EventToPartner', '_EventMoods', '_EventPlaces', '_EventAccessories']) {
      const rows = await read(table);
      const stat = (stats[table] = { source: rows.length, inserted: 0, skipped: 0, target: 0 });
      for (const row of rows) {
        const result = await prisma.$executeRawUnsafe(
          `INSERT OR IGNORE INTO "${table}" ("A","B") VALUES (?, ?)`,
          row.A,
          row.B,
        );
        if (result > 0) stat.inserted += 1;
        else stat.skipped += 1;
      }
    }

    // --- Проверка ---------------------------------------------------------
    const verify = async (table, delegate) => {
      const count = await delegate.count();
      if (!stats[table]) stats[table] = { source: 0, inserted: 0, skipped: 0, target: 0 };
      stats[table].target = count;
    };
    await verify('User', prisma.user);
    await verify('Profile', prisma.profile);
    await verify('DeviceToken', prisma.deviceToken);
    await verify('Session', prisma.session);
    await verify('RefreshToken', prisma.refreshToken);
    await verify('Partner', prisma.partner);
    await verify('Wishlist', prisma.wishlist);
    await verify('GroupCalendar', prisma.groupCalendar);
    await verify('GroupCalendarMember', prisma.groupCalendarMember);
    await verify('Mood', prisma.mood);
    await verify('Place', prisma.place);
    await verify('Accessory', prisma.accessory);
    await verify('Event', prisma.event);
    await verify('PeriodTracking', prisma.periodTracking);
    await verify('PeriodEntry', prisma.periodEntry);
    for (const table of ['_EventToPartner', '_EventMoods', '_EventPlaces', '_EventAccessories']) {
      const [{ count }] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS count FROM "${table}"`);
      stats[table].target = Number(count);
    }

    await prisma.$executeRawUnsafe('VACUUM');

    console.log('\n[migrate] таблица                   источник  вставлено  пропущено  в цели');
    for (const [table, stat] of Object.entries(stats)) {
      console.log(
        `[migrate] ${table.padEnd(25)} ${String(stat.source).padStart(8)} ` +
          `${String(stat.inserted).padStart(10)} ${String(stat.skipped).padStart(10)} ` +
          `${String(stat.target).padStart(7)}`,
      );
    }
    console.log(`\n[migrate] готово: ${targetPath} (${fs.statSync(targetPath).size} байт)`);
  } finally {
    await prisma.$disconnect();
    await pg.end();
  }
}

main().catch((error) => {
  console.error('[migrate] ОШИБКА:', error?.message ?? error);
  process.exit(1);
});
