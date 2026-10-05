import { Router } from 'express';
import * as partnersController from '../controllers/partners.controller';
import { requireAuth } from '../middleware/auth';

export const partnersRouter: Router = Router();

partnersRouter.use(requireAuth);

partnersRouter.get('/', partnersController.list);
partnersRouter.post('/', partnersController.create);
partnersRouter.get('/:id', partnersController.get);
partnersRouter.put('/:id', partnersController.update);
partnersRouter.delete('/:id', partnersController.remove);
partnersRouter.put('/:id/primary', partnersController.setPrimary);
