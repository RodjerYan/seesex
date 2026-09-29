import { Router } from 'express';
import * as settingsController from '../controllers/settings.controller';
import { requireAuth } from '../middleware/auth';

export const settingsRouter: Router = Router();

// GDPR: очистка данных (подтверждение { confirm: "DELETE" }), аккаунт остаётся.
settingsRouter.delete('/data', requireAuth, settingsController.deleteData);
