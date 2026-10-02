import { Router } from 'express';
import * as healthController from '../controllers/health.controller';
import { requireAuth, requireDeviceToken } from '../middleware/auth';

export const healthRouter: Router = Router();

// /apple — свой device-token middleware (не JWT): шорткат iPhone.
healthRouter.post('/apple', requireDeviceToken, healthController.ingestApple);

// /token — обычный JWT, как у events.
healthRouter.post('/token', requireAuth, healthController.manageToken);
healthRouter.get('/token', requireAuth, healthController.tokenStatus);
