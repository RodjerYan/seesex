import { PrismaClient } from '@prisma/client';

/**
 * Единственный экземпляр PrismaClient на процесс.
 * Подключение происходит лениво (при первом запросе), поэтому импорт модуля
 * безопасен и в тестах (там клиент подменён через vi.mock).
 */
export const prisma = new PrismaClient();
