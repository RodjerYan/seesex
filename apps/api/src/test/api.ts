import type { Express } from 'express';
import request from 'supertest';

/** Общие фабрики для интеграционных тестов поверх createApp + fake-prisma. */

export const PASSWORD = 'correct-horse-battery-1';

let emailCounter = 0;

export function uniqueEmail(): string {
  emailCounter += 1;
  return `user${emailCounter}-${Date.now()}@example.com`;
}

export interface AuthedUser {
  email: string;
  userId: string;
  accessToken: string;
}

/** Регистрация + вход; падает с понятной ошибкой, если статус неожиданный. */
export async function registerAndLogin(
  app: Express,
  email: string = uniqueEmail(),
): Promise<AuthedUser> {
  const registered = await request(app)
    .post('/api/auth/register')
    .send({ email, password: PASSWORD });
  if (registered.status !== 201) {
    throw new Error(`register failed: ${registered.status} ${JSON.stringify(registered.body)}`);
  }
  const login = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
  if (login.status !== 200) {
    throw new Error(`login failed: ${login.status} ${JSON.stringify(login.body)}`);
  }
  return {
    email,
    userId: login.body.user.id as string,
    accessToken: login.body.accessToken as string,
  };
}

/** Заголовки для авторизованного запроса: .set(auth(user)). */
export function auth(user: AuthedUser): { Authorization: string } {
  return { Authorization: `Bearer ${user.accessToken}` };
}
