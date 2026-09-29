import 'dotenv/config';
import express, { type Express, type Request, type Response } from 'express';
import helmet from 'helmet';
import { config } from './lib/config';
import { errorHandler, notFoundHandler } from './middleware/error';
import { corsMiddleware } from './middleware/cors';
import { generalLimiter } from './middleware/rateLimit';
import { authRouter } from './routes/auth.routes';

function healthHandler(_req: Request, res: Response): void {
  res.json({ status: 'ok', service: 'xtracker-api', uptime: process.uptime() });
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
          defaultSrc: ["'none'"],
          baseUri: ["'none'"],
          objectSrc: ["'none'"],
          scriptSrc: ["'none'"],
          styleSrc: ["'none'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          formAction: ["'none'"],
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
  app.use(generalLimiter);

  // Health для render.yaml healthCheckPath (/health) + /api/health по спеке.
  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  app.use('/api/auth', authRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app: Express = createApp();
