import type { Position, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error';
import type {
  CreatePositionInput,
  SystemPositionsQuery,
  UpdatePositionInput,
} from '../schemas/positions.schema';

export function positionView(position: Position): Record<string, unknown> {
  return {
    id: position.id,
    name: position.name,
    category: position.category,
    iconName: position.iconName,
    isCustom: position.isCustom,
    isSystem: position.isSystem,
    userId: position.userId,
  };
}

/** Свои + системные. */
export async function listPositions(
  userId: string,
  category?: string,
): Promise<Record<string, unknown>[]> {
  const where: Prisma.PositionWhereInput = { OR: [{ userId }, { isSystem: true }] };
  if (category) where.category = category;
  const rows = await prisma.position.findMany({ where, orderBy: [{ category: 'asc' }, { name: 'asc' }] });
  return rows.map(positionView);
}

/** Только системные, с пагинацией и фильтром категории. */
export async function listSystemPositions(
  query: SystemPositionsQuery,
): Promise<{ positions: Record<string, unknown>[]; total: number; limit: number; offset: number }> {
  const where: Prisma.PositionWhereInput = { isSystem: true };
  if (query.category) where.category = query.category;
  const [total, rows] = await Promise.all([
    prisma.position.count({ where }),
    prisma.position.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      skip: query.offset,
      take: query.limit,
    }),
  ]);
  return {
    positions: rows.map(positionView),
    total,
    limit: query.limit,
    offset: query.offset,
  };
}

/** Уникальные категории (системных + своих) с количеством. */
export async function listCategories(userId: string): Promise<{ categories: string[] }> {
  const groups = await prisma.position.groupBy({
    by: ['category'],
    where: { OR: [{ userId }, { isSystem: true }] },
    _count: true,
  });
  const categories = groups.map((group) => group.category).sort();
  return { categories };
}

export async function createPosition(
  userId: string,
  input: CreatePositionInput,
): Promise<Record<string, unknown>> {
  const position = await prisma.position.create({
    data: {
      userId,
      name: input.name,
      category: input.category,
      iconName: input.iconName ?? null,
      isCustom: true,
      isSystem: false,
    },
  });
  return positionView(position);
}

/** Свои !isSystem — редактируем; системные → 403; чужие → 404. */
async function assertOwnEditable(userId: string, positionId: string): Promise<Position> {
  const position = await prisma.position.findUnique({ where: { id: positionId } });
  if (!position) throw ApiError.notFound('POSITION_NOT_FOUND', 'Position not found');
  if (position.isSystem) {
    throw ApiError.forbidden('SYSTEM_POSITION', 'System positions cannot be modified');
  }
  if (position.userId !== userId) {
    throw ApiError.notFound('POSITION_NOT_FOUND', 'Position not found');
  }
  return position;
}

export async function updatePosition(
  userId: string,
  positionId: string,
  input: UpdatePositionInput,
): Promise<Record<string, unknown>> {
  await assertOwnEditable(userId, positionId);
  const position = await prisma.position.update({
    where: { id: positionId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.iconName !== undefined ? { iconName: input.iconName } : {}),
    },
  });
  return positionView(position);
}

export async function deletePosition(userId: string, positionId: string): Promise<void> {
  await assertOwnEditable(userId, positionId);
  await prisma.position.delete({ where: { id: positionId } });
}
