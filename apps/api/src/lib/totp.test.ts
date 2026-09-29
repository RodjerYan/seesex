import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildOtpauthUri, generateTotpCode, generateTotpSecret, verifyTotpCode } from './totp';

afterEach(() => {
  vi.useRealTimers();
});

describe('totp lib (RFC 6238)', () => {
  it('generated 6-digit code verifies against its secret', async () => {
    const secret = generateTotpSecret();
    const code = await generateTotpCode(secret);

    expect(code).toMatch(/^\d{6}$/);
    expect(await verifyTotpCode(code, secret)).toBe(true);
  });

  it('rejects wrong code and wrong secret', async () => {
    const secret = generateTotpSecret();
    const otherSecret = generateTotpSecret();
    const code = await generateTotpCode(secret);

    expect(await verifyTotpCode('000000', secret)).toBe(false);
    expect(await verifyTotpCode(code, otherSecret)).toBe(false);
    expect(await verifyTotpCode('abcdef', secret)).toBe(false);
    expect(await verifyTotpCode('12345', secret)).toBe(false);
  });

  it('accepts ±1 step window and rejects beyond it', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const secret = generateTotpSecret();
    const code = await generateTotpCode(secret);

    expect(await verifyTotpCode(code, secret)).toBe(true);

    // +30 секунд (следующий шаг) — ещё в окне ±1
    vi.setSystemTime(new Date('2026-01-01T00:00:30.000Z'));
    expect(await verifyTotpCode(code, secret)).toBe(true);

    // +90 секунд (2 шага назад/вперёд) — уже вне окна
    vi.setSystemTime(new Date('2026-01-01T00:01:30.000Z'));
    expect(await verifyTotpCode(code, secret)).toBe(false);
  });

  it('builds otpauth:// URI for authenticator apps', () => {
    const uri = buildOtpauthUri('user@example.com', generateTotpSecret());
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain('secret=');
    expect(uri).toContain('xTracker');
  });
});
