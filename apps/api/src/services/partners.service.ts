import type { Partner, PartnerPhoto, PeriodEntry, PeriodTracking, Prisma } from '@prisma/client';
import { config } from '../lib/config';
import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error';
import { relativeUploadPath, unlinkUpload } from '../middleware/upload';
import type { CreatePartnerInput, UpdatePartnerInput } from '../schemas/partners.schema';

const partnerInclude = {
  photos: true,
  periodTracking: { include: { entries: true } },
} as const;

export interface PartnerRow extends Partner {
  photos?: PartnerPhoto[];
  periodTracking?: (PeriodTracking & { entries?: PeriodEntry[] }) | null;
}

/** Prisma Json может вернуть строку — нормализуем к объекту для ответа. */
function normalizeCustomFields(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return { value: parsed };
    } catch {
      return { value };
    }
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function photoView(photo: PartnerPhoto): Record<string, unknown> {
  return {
    id: photo.id,
    filePath: photo.filePath,
    caption: photo.caption,
    sortOrder: photo.sortOrder,
    createdAt: photo.createdAt,
    url: `/api/files?path=${encodeURIComponent(photo.filePath)}`,
  };
}

export function partnerView(partner: PartnerRow): Record<string, unknown> {
  return {
    id: partner.id,
    name: partner.name,
    nickname: partner.nickname,
    gender: partner.gender,
    sexualOrientation: partner.sexualOrientation,
    pronouns: partner.pronouns,
    relationshipStatus: partner.relationshipStatus,
    isPrimary: partner.isPrimary,
    customFields: normalizeCustomFields(partner.customFields),
    createdAt: partner.createdAt,
    updatedAt: partner.updatedAt,
    photos: (partner.photos ?? []).map(photoView),
    periodTracking: partner.periodTracking
      ? {
          lastPeriodStart: partner.periodTracking.lastPeriodStart,
          averageCycleLength: partner.periodTracking.averageCycleLength,
          averagePeriodLength: partner.periodTracking.averagePeriodLength,
          notes: partner.periodTracking.notes,
          entries: (partner.periodTracking.entries ?? []).map((entry) => ({
            id: entry.id,
            startDate: entry.startDate,
            endDate: entry.endDate,
            symptoms: entry.symptoms,
            notes: entry.notes,
          })),
        }
      : null,
  };
}

async function assertOwnPartner(userId: string, partnerId: string): Promise<PartnerRow> {
  const partner = (await prisma.partner.findUnique({
    where: { id: partnerId },
    include: partnerInclude,
  })) as PartnerRow | null;
  if (!partner || partner.userId !== userId) {
    throw ApiError.notFound('PARTNER_NOT_FOUND', 'Partner not found');
  }
  return partner;
}

export async function listPartners(userId: string): Promise<Record<string, unknown>[]> {
  const rows = (await prisma.partner.findMany({
    where: { userId },
    include: partnerInclude,
    orderBy: { createdAt: 'asc' },
  })) as PartnerRow[];
  return rows.map(partnerView);
}

export async function getPartner(userId: string, partnerId: string): Promise<Record<string, unknown>> {
  return partnerView(await assertOwnPartner(userId, partnerId));
}

/** customFields: объект → Prisma InputJsonValue; null/undefined → не пишем (останется null). */
function customFieldsInput(
  value: Record<string, unknown> | null | undefined,
): Prisma.InputJsonValue | undefined {
  if (value === null || value === undefined) return undefined;
  return value as unknown as Prisma.InputJsonValue;
}

type PartnerClient = Pick<typeof prisma, 'partner'>;

async function unsetOtherPrimaries(
  client: PartnerClient,
  userId: string,
  keepPartnerId: string,
): Promise<void> {
  await client.partner.updateMany({
    where: { userId, isPrimary: true, id: { not: keepPartnerId } },
    data: { isPrimary: false },
  });
}

export async function createPartner(
  userId: string,
  input: CreatePartnerInput,
): Promise<Record<string, unknown>> {
  const fields = customFieldsInput(input.customFields);
  const partner = (await prisma.$transaction(async (tx) => {
    const created = (await tx.partner.create({
      data: {
        userId,
        name: input.name,
        nickname: input.nickname ?? null,
        gender: input.gender ?? null,
        sexualOrientation: input.sexualOrientation ?? null,
        pronouns: input.pronouns ?? null,
        relationshipStatus: input.relationshipStatus ?? null,
        isPrimary: input.isPrimary ?? false,
        ...(fields !== undefined ? { customFields: fields } : {}),
      },
      include: partnerInclude,
    })) as PartnerRow;
    if (created.isPrimary) await unsetOtherPrimaries(tx, userId, created.id);
    return created;
  })) as PartnerRow;
  return partnerView(partner);
}

export async function updatePartner(
  userId: string,
  partnerId: string,
  input: UpdatePartnerInput,
): Promise<Record<string, unknown>> {
  await assertOwnPartner(userId, partnerId);
  const fields = customFieldsInput(input.customFields);
  const partner = (await prisma.$transaction(async (tx) => {
    const updated = (await tx.partner.update({
      where: { id: partnerId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.nickname !== undefined ? { nickname: input.nickname } : {}),
        ...(input.gender !== undefined ? { gender: input.gender } : {}),
        ...(input.sexualOrientation !== undefined
          ? { sexualOrientation: input.sexualOrientation }
          : {}),
        ...(input.pronouns !== undefined ? { pronouns: input.pronouns } : {}),
        ...(input.relationshipStatus !== undefined
          ? { relationshipStatus: input.relationshipStatus }
          : {}),
        ...(input.isPrimary !== undefined ? { isPrimary: input.isPrimary } : {}),
        ...(fields !== undefined ? { customFields: fields } : {}),
      },
      include: partnerInclude,
    })) as PartnerRow;
    if (input.isPrimary) await unsetOtherPrimaries(tx, userId, partnerId);
    return updated;
  })) as PartnerRow;
  return partnerView(partner);
}

export async function deletePartner(userId: string, partnerId: string): Promise<void> {
  const partner = await assertOwnPartner(userId, partnerId);
  for (const photo of partner.photos ?? []) unlinkUpload(photo.filePath);
  await prisma.partner.delete({ where: { id: partnerId } });
}

/** POST /api/partners/:id/photos — лимит MAX_PHOTOS_PER_PARTNER, иначе 400. */
export async function addPartnerPhotos(
  userId: string,
  partnerId: string,
  filenames: string[],
): Promise<Record<string, unknown>[]> {
  const partner = await assertOwnPartner(userId, partnerId);
  const existing = await prisma.partnerPhoto.count({ where: { partnerId } });
  const limit = config.MAX_PHOTOS_PER_PARTNER;
  if (existing + filenames.length > limit) {
    for (const filename of filenames) unlinkUpload(relativeUploadPath('partners', filename));
    throw ApiError.badRequest(
      'PHOTO_LIMIT_EXCEEDED',
      `A partner can have at most ${limit} photos`,
    );
  }
  for (const filename of filenames) {
    await prisma.partnerPhoto.create({
      data: {
        partnerId: partner.id,
        filePath: relativeUploadPath('partners', filename),
        sortOrder: existing,
      },
    });
  }
  const updated = (await prisma.partner.findUnique({
    where: { id: partnerId },
    include: partnerInclude,
  })) as PartnerRow;
  return (updated.photos ?? []).map(photoView);
}

export async function deletePartnerPhoto(
  userId: string,
  partnerId: string,
  photoId: string,
): Promise<void> {
  await assertOwnPartner(userId, partnerId);
  const photo = await prisma.partnerPhoto.findFirst({ where: { id: photoId, partnerId } });
  if (!photo) throw ApiError.notFound('PHOTO_NOT_FOUND', 'Photo not found');
  unlinkUpload(photo.filePath);
  await prisma.partnerPhoto.delete({ where: { id: photoId } });
}

/** PUT /api/partners/:id/primary — снять isPrimary у остальных в транзакции. */
export async function setPrimaryPartner(
  userId: string,
  partnerId: string,
): Promise<Record<string, unknown>> {
  await assertOwnPartner(userId, partnerId);
  const partner = (await prisma.$transaction(async (tx) => {
    await tx.partner.updateMany({
      where: { userId, isPrimary: true, id: { not: partnerId } },
      data: { isPrimary: false },
    });
    return (await tx.partner.update({
      where: { id: partnerId },
      data: { isPrimary: true },
      include: partnerInclude,
    })) as PartnerRow;
  })) as PartnerRow;
  return partnerView(partner);
}
