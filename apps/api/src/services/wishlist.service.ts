import type { Wishlist } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error';
import type { CompleteWishlistInput, CreateWishlistInput } from '../schemas/wishlist.schema';

interface WishlistRow extends Wishlist {
  position?: { id: string; name: string; category: string; iconName: string | null } | null;
}

const include = { position: true } as const;

export function wishlistView(entry: WishlistRow): Record<string, unknown> {
  const position = entry.position;
  return {
    id: entry.id,
    positionId: entry.positionId,
    customName: entry.customName,
    customCategory: entry.customCategory,
    isCompleted: entry.isCompleted,
    completedAt: entry.completedAt,
    createdAt: entry.createdAt,
    position: position
      ? {
          id: position.id,
          name: position.name,
          category: position.category,
          iconName: position.iconName,
        }
      : null,
  };
}

async function assertOwnEntry(userId: string, entryId: string): Promise<WishlistRow> {
  const entry = (await prisma.wishlist.findUnique({
    where: { id: entryId },
    include,
  })) as WishlistRow | null;
  if (!entry || entry.userId !== userId) {
    throw ApiError.notFound('WISHLIST_NOT_FOUND', 'Wishlist entry not found');
  }
  return entry;
}

export async function listWishlist(userId: string): Promise<Record<string, unknown>[]> {
  const rows = (await prisma.wishlist.findMany({
    where: { userId },
    include,
    orderBy: { createdAt: 'desc' },
  })) as WishlistRow[];
  return rows.map(wishlistView);
}

export async function createWishlistEntry(
  userId: string,
  input: CreateWishlistInput,
): Promise<Record<string, unknown>> {
  if (input.positionId) {
    const position = await prisma.position.findFirst({
      where: { id: input.positionId, OR: [{ userId }, { isSystem: true }] },
    });
    if (!position) {
      throw ApiError.badRequest('POSITION_NOT_FOUND', 'Unknown position id');
    }
  }
  const entry = (await prisma.wishlist.create({
    data: {
      userId,
      positionId: input.positionId ?? null,
      customName: input.customName ?? null,
      customCategory: input.customCategory ?? null,
    },
    include,
  })) as WishlistRow;
  return wishlistView(entry);
}

/** PUT /api/wishlist/:id/complete — отметить выполненным (completed=false снимает отметку). */
export async function completeWishlistEntry(
  userId: string,
  entryId: string,
  input: CompleteWishlistInput,
): Promise<Record<string, unknown>> {
  await assertOwnEntry(userId, entryId);
  const entry = (await prisma.wishlist.update({
    where: { id: entryId },
    data: {
      isCompleted: input.completed,
      completedAt: input.completed ? new Date() : null,
    },
    include,
  })) as WishlistRow;
  return wishlistView(entry);
}

export async function deleteWishlistEntry(userId: string, entryId: string): Promise<void> {
  await assertOwnEntry(userId, entryId);
  await prisma.wishlist.delete({ where: { id: entryId } });
}
