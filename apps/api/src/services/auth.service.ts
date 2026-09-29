import type { Session, User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import type { AuthUser } from '../middleware/auth';
import { ApiError } from '../middleware/error';
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_MS } from '../lib/config';
import {
  sha256Hex,
  signAccessToken,
  signRefreshToken,
  signTotpSetupToken,
  signTwoFaToken,
  verifyRefreshToken,
  verifyTotpSetupToken,
} from '../lib/jwt';
import { prisma } from '../lib/prisma';
import { buildOtpauthUri, generateTotpSecret, verifyTotpCode } from '../lib/totp';
import type { LoginInput, RegisterInput } from '../schemas/auth.schema';

const BCRYPT_ROUNDS = 12;

export interface PublicUser {
  id: string;
  email: string | null;
  createdAt: Date;
  lockEnabled: boolean;
  lockMethod: string;
  autoLockTimeout: number;
  hasTotp: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RequestMeta {
  userAgent?: string | null;
  ip?: string | null;
}

export type LoginResult =
  | { kind: 'two_factor'; tmpToken: string }
  | { kind: 'tokens'; tokens: AuthTokens; user: PublicUser };

export interface SessionView {
  id: string;
  userAgent: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
}

export interface TotpSetupResult {
  secret: string;
  otpauthUrl: string;
  setupToken: string;
}

export interface TotpVerifyArgs {
  auth: AuthUser;
  code: string;
  setupToken?: string | undefined;
  meta: RequestMeta;
}

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
    lockEnabled: user.lockEnabled,
    lockMethod: user.lockMethod,
    autoLockTimeout: user.autoLockTimeout,
    hasTotp: user.totpSecret !== null,
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 'P2002'
  );
}

const invalidCredentials = (): ApiError =>
  ApiError.unauthorized('INVALID_CREDENTIALS', 'Invalid email or password');

/** Создаёт User + дефолтный Profile. Хэш пароля (bcrypt cost 12) наружу не возвращается. */
export async function register(input: RegisterInput): Promise<PublicUser> {
  const email = normalizeEmail(input.email);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw ApiError.conflict('EMAIL_TAKEN', 'This email is already registered');
  }
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email, passwordHash } });
      await tx.profile.create({ data: { userId: user.id } });
      return toPublicUser(user);
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw ApiError.conflict('EMAIL_TAKEN', 'This email is already registered');
    }
    throw err;
  }
}

/** Выпускает access + refresh (хэш в RefreshToken) и Session. */
async function issueTokens(user: User, meta: RequestMeta): Promise<AuthTokens> {
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  const session: Session = await prisma.session.create({
    data: {
      userId: user.id,
      userAgent: meta.userAgent ? meta.userAgent.slice(0, 255) : null,
      ipHash: meta.ip ? sha256Hex(meta.ip) : null,
      expiresAt,
    },
  });
  const refreshToken = signRefreshToken(user.id, session.id);
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash: sha256Hex(refreshToken), expiresAt },
  });
  return {
    accessToken: signAccessToken(user.id, user.email),
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  };
}

export async function login(input: LoginInput, meta: RequestMeta): Promise<LoginResult> {
  const email = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw invalidCredentials();
  const passwordOk = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordOk) throw invalidCredentials();

  // Включённая 2FA: access не выдаём до проверки TOTP-кода.
  if (user.totpSecret) {
    return { kind: 'two_factor', tmpToken: signTwoFaToken(user.id) };
  }
  return { kind: 'tokens', tokens: await issueTokens(user, meta), user: toPublicUser(user) };
}

/** Ротация refresh-токена: старый помечается revoked, новый выпускается. */
export async function refresh(refreshToken: string): Promise<AuthTokens> {
  const claims = verifyRefreshToken(refreshToken);
  const tokenHash = sha256Hex(refreshToken);
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  const now = Date.now();
  if (!record || record.revokedAt !== null || record.expiresAt.getTime() <= now) {
    throw ApiError.unauthorized('REFRESH_INVALID', 'Refresh token is invalid or expired');
  }
  if (!claims.sid) {
    throw ApiError.unauthorized('REFRESH_INVALID', 'Refresh token is invalid or expired');
  }
  const session = await prisma.session.findUnique({ where: { id: claims.sid } });
  if (!session || session.userId !== record.userId || session.expiresAt.getTime() <= now) {
    throw ApiError.unauthorized('SESSION_EXPIRED', 'Session is no longer valid');
  }
  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (!user) throw invalidCredentials();

  // Ротация: старый refresh — revoked, новый — в ту же сессию.
  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  });
  await prisma.session.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() },
  });
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  const newRefreshToken = signRefreshToken(user.id, session.id);
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash: sha256Hex(newRefreshToken), expiresAt },
  });
  return {
    accessToken: signAccessToken(user.id, user.email),
    refreshToken: newRefreshToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  };
}

/** Идемпотентный logout: revoke refresh-токена + удаление сессии, ответ 204. */
export async function logout(refreshToken: string): Promise<void> {
  let sessionId: string | null = null;
  let userId: string | null = null;
  try {
    const claims = verifyRefreshToken(refreshToken);
    sessionId = claims.sid ?? null;
    userId = claims.sub ?? null;
  } catch {
    // Невалидный токен — logout всё равно успешен (идемпотентность).
  }
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: sha256Hex(refreshToken) },
  });
  if (record && record.revokedAt === null) {
    await prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });
  }
  if (sessionId && userId) {
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (session && session.userId === userId) {
      await prisma.session.delete({ where: { id: session.id } });
    }
  }
}

/** Шаг 1 включения 2FA: секрет живёт только в setupToken, в БД не пишется. */
export async function totpSetup(auth: AuthUser): Promise<TotpSetupResult> {
  const user = await prisma.user.findUnique({ where: { id: auth.id } });
  if (!user) throw ApiError.unauthorized('USER_NOT_FOUND', 'User not found');
  const secret = generateTotpSecret();
  return {
    secret,
    otpauthUrl: buildOtpauthUri(user.email ?? user.id, secret),
    setupToken: signTotpSetupToken(user.id, secret),
  };
}

/**
 * Шаг 2: проверка 6-значного кода (окно ±1), сохранение totpSecret,
 * выпуск access+refresh. Работает и с access JWT, и с tmpToken (purpose=2fa).
 */
export async function verifyTotp(args: TotpVerifyArgs): Promise<{
  tokens: AuthTokens;
  user: PublicUser;
}> {
  const user = await prisma.user.findUnique({ where: { id: args.auth.id } });
  if (!user) throw ApiError.unauthorized('USER_NOT_FOUND', 'User not found');

  let secret: string | null;
  if (args.auth.purpose === '2fa') {
    secret = user.totpSecret;
    if (!secret) {
      throw ApiError.unauthorized('TWO_FA_NOT_CONFIGURED', 'Two-factor is not configured');
    }
  } else if (args.setupToken) {
    const claims = verifyTotpSetupToken(args.setupToken);
    if (claims.sub !== user.id || typeof claims.secret !== 'string') {
      throw ApiError.badRequest('INVALID_SETUP_TOKEN', 'Invalid TOTP setup token');
    }
    secret = claims.secret;
  } else {
    secret = user.totpSecret;
    if (!secret) {
      throw ApiError.badRequest('TOTP_SETUP_REQUIRED', 'Run POST /api/auth/totp/setup first');
    }
  }

  const valid = await verifyTotpCode(args.code, secret);
  if (!valid) {
    throw ApiError.unauthorized('INVALID_TOTP_CODE', 'Invalid authentication code');
  }

  // Секрет сохраняем только после успешной проверки кода.
  const updated =
    user.totpSecret === secret
      ? user
      : await prisma.user.update({ where: { id: user.id }, data: { totpSecret: secret } });
  return { tokens: await issueTokens(updated, args.meta), user: toPublicUser(updated) };
}

/** Список сессий текущего пользователя (для Settings). */
export async function listSessions(auth: AuthUser): Promise<SessionView[]> {
  const sessions = await prisma.session.findMany({
    where: { userId: auth.id },
    orderBy: { createdAt: 'desc' },
  });
  return sessions.map((session) => ({
    id: session.id,
    userAgent: session.userAgent,
    createdAt: session.createdAt,
    lastSeenAt: session.lastSeenAt,
    expiresAt: session.expiresAt,
  }));
}

/** Закрытие своей сессии; чужая → 403, неизвестная → 404. */
export async function deleteSession(auth: AuthUser, sessionId: string): Promise<void> {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) {
    throw ApiError.notFound('SESSION_NOT_FOUND', 'Session not found');
  }
  if (session.userId !== auth.id) {
    throw ApiError.forbidden('SESSION_FORBIDDEN', "Cannot access another user's session");
  }
  await prisma.session.delete({ where: { id: session.id } });
}
