import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import express, { type Express, type Request, type Response } from 'express';
import helmet from 'helmet';
import { config } from './lib/config';
import { errorHandler, notFoundHandler } from './middleware/error';
import { corsMiddleware } from './middleware/cors';
import { generalLimiter } from './middleware/rateLimit';
import { authRouter } from './routes/auth.routes';
import { eventsRouter } from './routes/events.routes';
import { exportRouter } from './routes/export.routes';
import { filesRouter } from './routes/files.routes';
import { groupCalendarsRouter } from './routes/group-calendars.routes';
import { healthRouter } from './routes/health.routes';
import { partnersRouter } from './routes/partners.routes';
import { settingsRouter } from './routes/settings.routes';
import { statisticsRouter } from './routes/statistics.routes';
import { wishlistRouter } from './routes/wishlist.routes';
import { prisma } from './lib/prisma';

async function healthHandler(_req: Request, res: Response): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', service: 'xtracker-api', db: 'up', uptime: process.uptime() });
  } catch {
    res.status(503).json({ status: 'degraded', service: 'xtracker-api', db: 'down', uptime: process.uptime() });
  }
}

/** Фабрика express-приложения (используется и в index.ts, и в тестах). */
export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  // Render/nginx стоит перед приложением — доверяем первый hop для req.ip/rate-limit.
  app.set('trust proxy', 1);

  // Security middleware.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'none'"],
          objectSrc: ["'none'"],
          // SPA-бандлы и SW: только свои файлы (ранее 'none' — ломало прод-раздачу фронта).
          scriptSrc: ["'self'"],
          // Tailwind-бандл + инлайновые style-атрибуты React.
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          manifestSrc: ["'self'"],
          workerSrc: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          // HSTS — только в проде (на http-локале бесполезен).
          upgradeInsecureRequests: config.NODE_ENV === 'production' ? [] : null,
        },
      },
      // API отдаёт JSON фронтенду с другого origin.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(corsMiddleware);
  app.use(express.json({ limit: '100kb' }));

  // Health для render.yaml healthCheckPath (/health) + /api/health по спеке.
  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  // Limiter — только на API, статику и health не считаем.
  app.use('/api', generalLimiter);

  app.use('/api/auth', authRouter);
  app.use('/api/events', eventsRouter);
  app.use('/api/partners', partnersRouter);
  app.use('/api/wishlist', wishlistRouter);
  app.use('/api/statistics', statisticsRouter);
  app.use('/api/group-calendars', groupCalendarsRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/export', exportRouter);
  app.use('/api/files', filesRouter);
  // Apple Health (T-20261002-019): device-token приём проб + токены для UI.
  // ВАЖНО: после app.get('/api/health') — тот зарегистрирован раньше и
  // GET /api/health остаётся health-check'ом, а не роутом healthRouter.
  app.use('/api/health', healthRouter);

  // Статика собранного SPA (render.yaml: build копирует web/dist -> apps/api/public).
  // В dev её нет — SPA отдаёт vite dev-сервер, поэтому ветка условная.
  const spaDir = path.resolve(__dirname, '..', 'public');
  if (fs.existsSync(path.join(spaDir, 'index.html'))) {
    app.use(express.static(spaDir, { index: false, maxAge: '1h' }));
    // SPA fallback: любые не-API маршруты (React Router) -> index.html.
    app.get(/^\/(?!api\/|health$).*/, (req: Request, res: Response, next) => {
      res.setHeader('Cache-Control', 'no-store');
      res.sendFile(path.join(spaDir, 'index.html'), (err) => {
        if (err) next();
      });
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app: Express = createApp();
