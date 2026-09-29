import { describe, expect, it } from 'vitest';
import { config } from './config';
import { decrypt, encrypt, isEncryptionEnabled } from './crypto';

const KEY = 'unit-test-encryption-key-0123456789abcdef';

/** Подменяет ENCRYPTION_KEY на время синхронного блока (кэш ключа пересчитывается). */
function withKey(key: string | undefined, run: () => void): void {
  const original = config.ENCRYPTION_KEY;
  config.ENCRYPTION_KEY = key;
  try {
    run();
  } finally {
    config.ENCRYPTION_KEY = original;
  }
}

describe('AES-256-GCM crypto (lib/crypto)', () => {
  it('roundtrips encrypt → decrypt with a random IV per call', () => {
    withKey(KEY, () => {
      expect(isEncryptionEnabled()).toBe(true);

      const cipher = encrypt('top secret заметки');
      expect(cipher).toMatch(/^enc:v1:/);
      expect(cipher).not.toContain('top secret');
      expect(decrypt(cipher)).toBe('top secret заметки');

      // IV случайный: два шифрования одного текста дают разный результат.
      const second = encrypt('top secret заметки');
      expect(second).not.toBe(cipher);
      expect(decrypt(second)).toBe('top secret заметки');
    });
  });

  it('decrypts legacy plaintext as-is (без префикса enc:v1:)', () => {
    withKey(KEY, () => {
      expect(decrypt('plain legacy notes')).toBe('plain legacy notes');
      expect(encrypt(null)).toBeNull();
      expect(encrypt('')).toBe('');
      expect(decrypt(null)).toBeNull();
    });
  });

  it('works in open mode without ENCRYPTION_KEY (warning, не падает)', () => {
    withKey(undefined, () => {
      expect(isEncryptionEnabled()).toBe(false);
      expect(encrypt('открытый текст')).toBe('открытый текст');
      expect(decrypt('открытый текст')).toBe('открытый текст');
    });
  });
});
