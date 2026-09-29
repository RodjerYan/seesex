import type { Request, Response } from 'express';
import type { AuthedRequest } from '../middleware/auth';
import { ApiError, asyncHandler } from '../middleware/error';
import {
  loginSchema,
  logoutSchema,
  parseBody,
  refreshSchema,
  registerSchema,
  totpVerifySchema,
} from '../schemas/auth.schema';
import type { RequestMeta } from '../services/auth.service';
import * as authService from '../services/auth.service';

function requestMeta(req: Request): RequestMeta {
  return { userAgent: req.get('user-agent') ?? null, ip: req.ip ?? null };
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const input = parseBody(registerSchema, req.body);
  const user = await authService.register(input);
  res.status(201).json({ user });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const input = parseBody(loginSchema, req.body);
  const result = await authService.login(input, requestMeta(req));
  if (result.kind === 'two_factor') {
    res.status(200).json({ requires2FA: true, tmpToken: result.tmpToken });
    return;
  }
  res.status(200).json({ ...result.tokens, user: result.user });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = parseBody(refreshSchema, req.body);
  const tokens = await authService.refresh(refreshToken);
  res.status(200).json(tokens);
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = parseBody(logoutSchema, req.body);
  await authService.logout(refreshToken);
  res.status(204).end();
});

export const totpSetup = asyncHandler<AuthedRequest>(async (req, res) => {
  const result = await authService.totpSetup(req.user);
  res.status(200).json(result);
});

export const totpVerify = asyncHandler<AuthedRequest>(async (req, res) => {
  const input = parseBody(totpVerifySchema, req.body);
  const { tokens, user } = await authService.verifyTotp({
    auth: req.user,
    code: input.code,
    setupToken: input.setupToken,
    meta: requestMeta(req),
  });
  res.status(200).json({ ...tokens, user });
});

export const listSessions = asyncHandler<AuthedRequest>(async (req, res) => {
  const sessions = await authService.listSessions(req.user);
  res.status(200).json({ sessions });
});

export const deleteSession = asyncHandler<AuthedRequest>(async (req, res) => {
  const sessionId: string = req.params.id;
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    throw ApiError.badRequest('INVALID_SESSION_ID', 'Session id is required');
  }
  await authService.deleteSession(req.user, sessionId);
  res.status(204).end();
});
