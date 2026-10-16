import { afterEach, describe, expect, it, vi } from 'vitest';

// Требуемые для EnvSchema переменные (vitest env их уже задаёт, но stubEnv — явно).
const REQUIRED_ENV = {
  DATABASE_URL: 'postgresql://test:test@127.0.0.1:5432/xtracker_test',
  JWT_SECRET: 'vitest-local-secret-not-for-production',
};

function stubRequired(): void {
  for (const [key, value] of Object.entries(REQUIRED_ENV)) {
    vi.stubEnv(key, value);
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('config: ENCRYPTION_KEY fail-fast in production', () => {
  it('throws on import when NODE_ENV=production and ENCRYPTION_KEY is missing/empty', async () => {
    stubRequired();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ENCRYPTION_KEY', '');
    vi.resetModules();

    await expect(import('./config')).rejects.toThrow(/ENCRYPTION_KEY is required in production/);
  });

  it('loads fine when NODE_ENV=production and ENCRYPTION_KEY is set', async () => {
    stubRequired();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ENCRYPTION_KEY', 'prod-encryption-key-0123456789abcdef');
    vi.resetModules();

    const { config } = await import('./config');
    expect(config.NODE_ENV).toBe('production');
    expect(config.ENCRYPTION_KEY).toBe('prod-encryption-key-0123456789abcdef');
  });

  it('keeps plaintext fallback in dev/test without ENCRYPTION_KEY (no throw)', async () => {
    stubRequired();
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('ENCRYPTION_KEY', '');
    vi.resetModules();

    const { config } = await import('./config');
    expect(config.NODE_ENV).toBe('test');
    expect(config.ENCRYPTION_KEY).toBeUndefined();
  });
});
