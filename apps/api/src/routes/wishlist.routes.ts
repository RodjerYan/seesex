import { Router } from 'express';
import * as wishlistController from '../controllers/wishlist.controller';
import { requireAuth } from '../middleware/auth';

export const wishlistRouter: Router = Router();

wishlistRouter.use(requireAuth);

wishlistRouter.get('/', wishlistController.list);
wishlistRouter.post('/', wishlistController.create);
wishlistRouter.put('/:id/complete', wishlistController.complete);
wishlistRouter.delete('/:id', wishlistController.remove);
