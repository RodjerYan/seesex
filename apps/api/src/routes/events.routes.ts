import { Router } from 'express';
import * as eventsController from '../controllers/events.controller';
import { requireAuth } from '../middleware/auth';

export const eventsRouter: Router = Router();

eventsRouter.use(requireAuth);

// /calendar — до /:id, иначе "calendar" ловится как id.
eventsRouter.get('/', eventsController.list);
eventsRouter.get('/calendar', eventsController.calendar);
eventsRouter.post('/', eventsController.create);
eventsRouter.get('/:id', eventsController.get);
eventsRouter.put('/:id', eventsController.update);
eventsRouter.delete('/:id', eventsController.remove);
