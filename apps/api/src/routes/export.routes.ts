import { Router } from 'express';
import * as exportController from '../controllers/export.controller';
import { requireAuth } from '../middleware/auth';

export const exportRouter: Router = Router();

exportRouter.post('/json', requireAuth, exportController.json);
exportRouter.post('/csv', requireAuth, exportController.csv);
