import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { requireAuth, requireAuthOrTmpToken } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimit';

export const authRouter: Router = Router();

// Публичные (без requireAuth): register, login, refresh — на них жёсткий rate-limit.
authRouter.post('/register', authLimiter, authController.register);
authRouter.post('/login', authLimiter, authController.login);
authRouter.post('/refresh', authLimiter, authController.refresh);

// Защищённые requireAuth (Bearer access JWT).
authRouter.post('/logout', requireAuth, authController.logout);
authRouter.post('/totp/setup', requireAuth, authController.totpSetup);
authRouter.post('/totp/disable', requireAuth, authController.totpDisable);
authRouter.get('/sessions', requireAuth, authController.listSessions);
authRouter.delete('/sessions/:id', requireAuth, authController.deleteSession);

// Профиль (никнейм + аватар) и смена пароля.
authRouter.get('/profile', requireAuth, authController.getProfile);
authRouter.patch('/profile', requireAuth, authController.updateProfile);
authRouter.post('/password', requireAuth, authController.changePassword);

// verify принимает access JWT ИЛИ короткоживущий tmpToken (purpose=2fa).
authRouter.post('/totp/verify', requireAuthOrTmpToken, authController.totpVerify);
