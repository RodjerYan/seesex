import { Router } from 'express';
import * as statisticsController from '../controllers/statistics.controller';
import { requireAuth } from '../middleware/auth';

export const statisticsRouter: Router = Router();

statisticsRouter.use(requireAuth);

statisticsRouter.get('/overview', statisticsController.overview);
statisticsRouter.get('/frequency', statisticsController.frequency);
statisticsRouter.get('/partners', statisticsController.partners);
statisticsRouter.get('/ratings', statisticsController.ratings);
statisticsRouter.get('/periods', statisticsController.periods);
statisticsRouter.get('/custom', statisticsController.custom);
