import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error';
import { resolveUploadPath } from '../middleware/upload';

/**
 * Доступ к файлам фото: только авторизованный владелец.
 * - events/<file>   → владелец события ИЛИ участник его группового календаря;
 * - partners/<file> → владелец партнёра;
 * - path traversal за UPLOAD_DIR → 404.
 */
export async function resolveFileForUser(userId: string, relativePath: string): Promise<string> {
  const notFound = ApiError.notFound('FILE_NOT_FOUND', 'File not found');
  const absolute = resolveUploadPath(relativePath);
  if (!absolute) throw notFound;

  const kind = relativePath.split('/')[0];
  if (kind === 'events') {
    const photo = await prisma.eventPhoto.findFirst({
      where: { filePath: relativePath },
      include: { event: true },
    });
    if (!photo) throw notFound;
    if (photo.event.userId === userId) return absolute;
    if (photo.event.groupCalendarId) {
      const membership = await prisma.groupCalendarMember.findFirst({
        where: { groupCalendarId: photo.event.groupCalendarId, userId },
      });
      if (membership) return absolute;
    }
    throw notFound;
  }

  if (kind === 'partners') {
    const photo = await prisma.partnerPhoto.findFirst({
      where: { filePath: relativePath },
      include: { partner: true },
    });
    if (!photo || photo.partner.userId !== userId) throw notFound;
    return absolute;
  }

  throw notFound;
}
