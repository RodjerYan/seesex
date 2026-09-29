import { Router } from 'express';
import * as positionsController from '../controllers/positions.controller';
import { requireAuth } from '../middleware/auth';

export const positionsRouter: Router = Router();

positionsRouter.use(requireAuth);

// /system и /categories — статические, до /:id.
positionsRouter.get('/', positionsController.list);
positionsRouter.get('/system', positionsController.listSystem);
positionsRouter.get('/categories', positionsController.categories);
positionsRouter.post('/', positionsController.create);
positionsRouter.put('/:id', positionsController.update);
positionsRouter.delete('/:id', positionsController.remove);
