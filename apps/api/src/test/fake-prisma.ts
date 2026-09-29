import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

/**
 * In-memory фейк PrismaClient для интеграционных тестов (живая БД не нужна).
 * Поддерживает ровно те операции, которые использует auth-код S2:
 * user/profile/session/refreshToken + $transaction(callback).
 */

export interface FakeUser {
  id: string;
  email: string | null;
  passwordHash: string;
  totpSecret: string | null;
  createdAt: Date;
  updatedAt: Date;
  lockEnabled: boolean;
  lockMethod: string;
  autoLockTimeout: number;
}

export interface FakeProfile {
  id: string;
  userId: string;
  displayName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FakeSession {
  id: string;
  userId: string;
  userAgent: string | null;
  ipHash: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
}

export interface FakeRefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface FakeDb {
  users: FakeUser[];
  profiles: FakeProfile[];
  sessions: FakeSession[];
  refreshTokens: FakeRefreshToken[];
}

const db: FakeDb = { users: [], profiles: [], sessions: [], refreshTokens: [] };

export function getFakeDb(): FakeDb {
  return db;
}

export function resetFakeDb(): void {
  db.users.length = 0;
  db.profiles.length = 0;
  db.sessions.length = 0;
  db.refreshTokens.length = 0;
}

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;
type Data = Record<string, unknown>;

function matchRow<T extends object>(row: T, where: Where): boolean {
  const source = row as Row;
  return Object.entries(where).every(([key, value]) => source[key] === value);
}

function findRow<T extends object>(rows: readonly T[], where: Where): T | null {
  return rows.find((row) => matchRow(row, where)) ?? null;
}

interface FindUniqueArgs {
  where: Where;
  include?: Record<string, unknown>;
}

interface CreateArgs {
  data: Data;
}

interface UpdateArgs {
  where: Where;
  data: Data;
}

function createFakePrismaInner() {
  return {
    async $transaction(arg: unknown): Promise<unknown> {
      if (typeof arg === 'function') {
        return (arg as (tx: unknown) => unknown)(fake);
      }
      return Promise.all(arg as Promise<unknown>[]);
    },

    user: {
      async findUnique(
        args: FindUniqueArgs,
      ): Promise<(FakeUser & { profile?: FakeProfile | null }) | null> {
        const found = findRow(db.users, args.where);
        if (!found) return null;
        const copy: FakeUser & { profile?: FakeProfile | null } = { ...found };
        if (args.include?.profile === true) {
          copy.profile = db.profiles.find((p) => p.userId === found.id) ?? null;
        }
        return copy;
      },
      async create(args: CreateArgs): Promise<FakeUser> {
        const now = new Date();
        const user: FakeUser = {
          id: randomUUID(),
          email: (args.data.email as string | undefined) ?? null,
          passwordHash: args.data.passwordHash as string,
          totpSecret: (args.data.totpSecret as string | undefined) ?? null,
          createdAt: now,
          updatedAt: now,
          lockEnabled: (args.data.lockEnabled as boolean | undefined) ?? true,
          lockMethod: (args.data.lockMethod as string | undefined) ?? 'PIN',
          autoLockTimeout: (args.data.autoLockTimeout as number | undefined) ?? 60,
        };
        db.users.push(user);
        return { ...user };
      },
      async update(args: UpdateArgs): Promise<FakeUser> {
        const found = findRow(db.users, args.where);
        if (!found) throw new Error('Record to update not found.');
        Object.assign(found, args.data, { updatedAt: new Date() });
        return { ...found };
      },
    },

    profile: {
      async create(args: CreateArgs): Promise<FakeProfile> {
        const now = new Date();
        const profile: FakeProfile = {
          id: randomUUID(),
          userId: args.data.userId as string,
          displayName: (args.data.displayName as string | undefined) ?? null,
          createdAt: now,
          updatedAt: now,
        };
        db.profiles.push(profile);
        return { ...profile };
      },
    },

    session: {
      async create(args: CreateArgs): Promise<FakeSession> {
        const now = new Date();
        const session: FakeSession = {
          id: randomUUID(),
          userId: args.data.userId as string,
          userAgent: (args.data.userAgent as string | null | undefined) ?? null,
          ipHash: (args.data.ipHash as string | null | undefined) ?? null,
          createdAt: now,
          lastSeenAt: now,
          expiresAt: args.data.expiresAt as Date,
        };
        db.sessions.push(session);
        return { ...session };
      },
      async findUnique(args: FindUniqueArgs): Promise<FakeSession | null> {
        const found = findRow(db.sessions, args.where);
        return found ? { ...found } : null;
      },
      async findMany(args: {
        where?: Where;
        orderBy?: Record<string, 'asc' | 'desc'>;
      }): Promise<FakeSession[]> {
        let rows = db.sessions.slice();
        if (args.where) rows = rows.filter((row) => matchRow(row, args.where as Where));
        const orderBy = args.orderBy?.createdAt;
        if (orderBy === 'desc') rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        if (orderBy === 'asc') rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        return rows.map((row) => ({ ...row }));
      },
      async update(args: UpdateArgs): Promise<FakeSession> {
        const found = findRow(db.sessions, args.where);
        if (!found) throw new Error('Record to update not found.');
        Object.assign(found, args.data);
        return { ...found };
      },
      async delete(args: { where: Where }): Promise<FakeSession> {
        const index = db.sessions.findIndex((row) => matchRow(row, args.where));
        if (index < 0) throw new Error('Record to delete not found.');
        return db.sessions.splice(index, 1)[0];
      },
    },

    refreshToken: {
      async create(args: CreateArgs): Promise<FakeRefreshToken> {
        const token: FakeRefreshToken = {
          id: randomUUID(),
          userId: args.data.userId as string,
          tokenHash: args.data.tokenHash as string,
          expiresAt: args.data.expiresAt as Date,
          revokedAt: null,
          createdAt: new Date(),
        };
        db.refreshTokens.push(token);
        return { ...token };
      },
      async findUnique(args: FindUniqueArgs): Promise<FakeRefreshToken | null> {
        const found = findRow(db.refreshTokens, args.where);
        return found ? { ...found } : null;
      },
      async update(args: UpdateArgs): Promise<FakeRefreshToken> {
        const found = findRow(db.refreshTokens, args.where);
        if (!found) throw new Error('Record to update not found.');
        Object.assign(found, args.data);
        return { ...found };
      },
    },
  };
}

const fake = createFakePrismaInner();

/** Единый инстанс фейка (совместим по поведению с PrismaClient для S2). */
export function createFakePrisma(): PrismaClient {
  // Мок: структурное соответствие PrismaClient достигается cast'ом (реальная
  // типизация клиента проверяется в проде tsc по @prisma/client).
  return fake as unknown as PrismaClient;
}
