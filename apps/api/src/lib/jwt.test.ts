import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../middleware/error';
import { config } from './config';
import {
  signAccessToken,
  signRefreshToken,
  signTotpSetupToken,
  signTwoFaToken,
  sha256Hex,
  verifyAccessToken,
  verifyRefreshToken,
  verifyTotpSetupToken,
  verifyTwoFaToken,
} from './jwt';

describe('jwt lib', () => {
  it('sign/verify access roundtrip (15m, purpose=access)', () => {
    const token = signAccessToken('user-1', 'user@example.com');
    const claims = verifyAccessToken(token);

    expect(claims.sub).toBe('user-1');
    expect(claims.purpose).toBe('access');
    expect(claims.email).toBe('user@example.com');
    expect((claims.exp ?? 0) - (claims.iat ?? 0)).toBe(15 * 60);
  });

  it('rejects token with a foreign purpose', () => {
    const refreshToken = signRefreshToken('user-1', 'session-1');
    expect(() => verifyAccessToken(refreshToken)).toThrow(ApiError);

    const accessToken = signAccessToken('user-1', null);
    expect(() => verifyRefreshToken(accessToken)).toThrow(ApiError);
    expect(() => verifyTwoFaToken(accessToken)).toThrow(ApiError);
    expect(() => verifyTotpSetupToken(accessToken)).toThrow(ApiError);
  });

  it('rejects expired token with 401 TOKEN_EXPIRED', () => {
    const expired = jwt.sign({ purpose: 'access' }, config.JWT_SECRET, {
      subject: 'user-1',
      expiresIn: -10,
    });

    try {
      verifyAccessToken(expired);
      expect.unreachable('verifyAccessToken should throw for an expired token');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiError = err as ApiError;
      expect(apiError.status).toBe(401);
      expect(apiError.code).toBe('TOKEN_EXPIRED');
    }
  });

  it('rejects tampered signature', () => {
    const tampered = `${signAccessToken('user-1', null)}x`;
    expect(() => verifyAccessToken(tampered)).toThrow(ApiError);
  });

  it('purpose-specific claims survive (2fa / totp_setup / refresh.sid)', () => {
    const twoFa = signTwoFaToken('user-2');
    expect(verifyTwoFaToken(twoFa).sub).toBe('user-2');
    expect(verifyTwoFaToken(twoFa).purpose).toBe('2fa');

    const setup = signTotpSetupToken('user-2', 'BASE32SECRET');
    const setupClaims = verifyTotpSetupToken(setup);
    expect(setupClaims.secret).toBe('BASE32SECRET');
    expect((setupClaims.exp ?? 0) - (setupClaims.iat ?? 0)).toBe(5 * 60);

    const refresh = verifyRefreshToken(signRefreshToken('user-2', 'session-9'));
    expect(refresh.sid).toBe('session-9');
    expect((refresh.exp ?? 0) - (refresh.iat ?? 0)).toBe(7 * 24 * 60 * 60);
  });

  it('sha256Hex is deterministic and not equal to the input', () => {
    expect(sha256Hex('abc')).toBe(sha256Hex('abc'));
    expect(sha256Hex('abc')).not.toBe('abc');
    expect(sha256Hex('abc')).toHaveLength(64);
  });
});
