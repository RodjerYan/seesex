import 'dotenv/config';
import { app } from './app';
import { config } from './lib/config';
import { logger } from './lib/winston';
import { prisma } from './lib/prisma';

async function main(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('prisma connected');
  } catch (err) {
    logger.error('Failed to connect to database', { error: String(err) });
    process.exit(1);
  }

  const server = app.listen(config.PORT, () => {
    logger.info(`xtracker-api listening on :${config.PORT}`);
  });

  // Логируем (но не роняем процесс) — без вывода тел запросов/секретов.
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { reason: String(reason) });
  });
  process.on('uncaughtException', (err) => {
    logger.error(`Uncaught exception: ${err.message}`, { stack: err.stack });
  });

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      logger.info(`Received ${signal}, shutting down`);
      server.close(() => process.exit(0));
    });
  }
}

main();
