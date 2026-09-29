import os from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Переменные для config.ts: тесты не требуют живую БД и реальные секреты.
    env: {
      // Файлы из тестов загрузки фото — во временный каталог, не в репозиторий.
      UPLOAD_DIR: path.join(os.tmpdir(), 'xtracker-test-uploads'),
      MAX_FILE_SIZE: '5242880',
      MAX_PHOTOS_PER_PARTNER: '3',
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@127.0.0.1:5432/xtracker_test',
      JWT_SECRET: 'vitest-local-secret-not-for-production',
      ENCRYPTION_KEY: '',
      FRONTEND_URL: 'http://localhost:5173',
      ALLOWED_ORIGINS: 'http://localhost:5173,http://localhost:3000',
      RATE_LIMIT_WINDOW_MS: '60000',
      RATE_LIMIT_MAX: '100000',
      AUTH_RATE_LIMIT_WINDOW_MS: '900000',
      AUTH_RATE_LIMIT_MAX: '1000',
      LOG_LEVEL: 'error',
      PORT: '3001',
    },
  },
});
