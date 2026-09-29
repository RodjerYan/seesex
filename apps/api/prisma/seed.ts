// Seed: системный пользователь + каталог системных позиций (>= 400 записей).
// Запуск: npx prisma db seed  (см. "prisma.seed" в package.json)
// Если БД недоступна — падает с понятной инструкцией (код выхода 1).

import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { buildSystemPositions, MIN_SYSTEM_POSITIONS } from './positions-catalog';

const SEED_EMAIL = 'seed@xtracker.local';
// Случайный одноразовый пароль: хэш сохраняется, сам пароль — нет,
// поэтому в коде/репозитории нет ни одного working-credential.
const SEED_PASSWORD_HASH = bcrypt.hashSync(randomBytes(32).toString('hex'), 12);

async function main(): Promise<void> {
  const positions = buildSystemPositions();
  if (positions.length < MIN_SYSTEM_POSITIONS) {
    throw new Error(
      `Seed-каталог позиций слишком мал: ${positions.length} < ${MIN_SYSTEM_POSITIONS}`,
    );
  }

  const prisma = new PrismaClient();

  try {
    // 1. Seed-пользователь — владельцем системных позиций (schema требует userId).
    const seedUser = await prisma.user.upsert({
      where: { email: SEED_EMAIL },
      update: {},
      create: {
        email: SEED_EMAIL,
        passwordHash: SEED_PASSWORD_HASH,
        lockEnabled: false, // системный аккаунт не блокируется
      },
    });

    // 2. Идемпотентность: при повторном запуске не дублируем записи.
    const existing = await prisma.position.count({
      where: { userId: seedUser.id, isSystem: true },
    });

    if (existing >= positions.length) {
      // eslint-disable-next-line no-console
      console.log(`[seed] Уже загружено ${existing} системных позиций — пропускаем.`);
      return;
    }

    // Частично залитые состояния (0 < existing < total) чистим и заливаем заново.
    if (existing > 0) {
      await prisma.position.deleteMany({
        where: { userId: seedUser.id, isSystem: true },
      });
    }

    const created = await prisma.position.createMany({
      data: positions.map((p) => ({
        ...p,
        userId: seedUser.id,
        isSystem: true,
        isCustom: false,
      })),
      skipDuplicates: true,
    });

    // eslint-disable-next-line no-console
    console.log(`[seed] OK: пользователь ${seedUser.email}, системных позиций: ${created.count}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  // eslint-disable-next-line no-console
  console.error('[seed] Ошибка:', message);
  if (
    message.includes('P1001') ||
    message.includes("Can't reach database server") ||
    message.includes('ECONNREFUSED') ||
    message.includes('ENV_VAR_NOT_FOUND')
  ) {
    // eslint-disable-next-line no-console
    console.error(
      '[seed] БД недоступна. Проверьте: 1) docker compose up -d (postgres:15), ' +
        '2) apps/api/.env существует и DATABASE_URL указан верно, ' +
        '3) выполнена миграция (npx prisma migrate deploy).',
    );
  }
  process.exit(1);
});
