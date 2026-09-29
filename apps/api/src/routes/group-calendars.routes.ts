import { Router } from 'express';
import * as groupCalendarsController from '../controllers/group-calendars.controller';
import { requireAuth } from '../middleware/auth';

export const groupCalendarsRouter: Router = Router();

groupCalendarsRouter.use(requireAuth);

groupCalendarsRouter.get('/', groupCalendarsController.list);
groupCalendarsRouter.post('/', groupCalendarsController.create);
// /join — до /:id (иначе "join" ловится как id).
groupCalendarsRouter.post('/join', groupCalendarsController.join);
groupCalendarsRouter.get('/:id', groupCalendarsController.get);
groupCalendarsRouter.delete('/:id/leave', groupCalendarsController.leave);
groupCalendarsRouter.get('/:id/events', groupCalendarsController.listEvents);
groupCalendarsRouter.post('/:id/events', groupCalendarsController.createEvent);
