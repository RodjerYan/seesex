import path from 'node:path';
import winston from 'winston';
import { config } from './config';

const { combine, timestamp, printf, colorize } = winston.format;

const lineFormat = printf(({ level, message, timestamp: ts, ...meta }) => {
  const rest = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `${String(ts)} ${level}: ${String(message)}${rest}`;
});

/**
 * Winston-логгер: console + файл logs/error.log (только error).
 * Уровень — из env LOG_LEVEL. Пароли/токены в логи не попадают:
 * вызывающий код передаёт только id/код ошибки, тела запросов не логируются.
 */
export const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  silent: config.NODE_ENV === 'test',
  format: combine(timestamp(), lineFormat),
  transports: [
    new winston.transports.Console({
      format: combine(
        config.NODE_ENV === 'development' ? colorize() : winston.format.uncolorize(),
        lineFormat,
      ),
    }),
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
      format: combine(timestamp(), lineFormat),
    }),
  ],
});
