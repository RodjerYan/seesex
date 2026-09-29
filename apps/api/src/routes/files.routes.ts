import { Router } from 'express';
import * as filesController from '../controllers/files.controller';
import { requireAuth } from '../middleware/auth';

export const filesRouter: Router = Router();

// Файлы фото — только по Bearer JWT + проверка владельца в сервисе.
filesRouter.get('/', requireAuth, filesController.serve);
