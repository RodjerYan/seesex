import { prisma } from '../lib/prisma';
import { unlinkUpload } from '../middleware/upload';

/**
 * GDPR: полная очистка данных пользователя (события, партнёры,
 * вишлист, групповые календари, словари) + файлы фото на диске.
 * Сам User (аккаунт, сессии, refresh-токены) остаётся — юзер может продолжать входить.
 */

export interface DeleteSummary {
  events: number;
  eventPhotos: number;
  partners: number;
  partnerPhotos: number;
  wishlists: number;
  groupCalendars: number;
  calendarMemberships: number;
  moods: number;
  places: number;
  accessories: number;
  profile: number;
}

export interface DeleteResult {
  deleted: DeleteSummary;
  userRetained: true;
}

export async function deleteAllUserData(userId: string): Promise<DeleteResult> {
  // 1. Файлы фото — до каскадного удаления строк (нужны filePath).
  const [eventRows, partnerRows] = await Promise.all([
    prisma.event.findMany({ where: { userId }, include: { photos: true } }),
    prisma.partner.findMany({ where: { userId }, include: { photos: true } }),
  ]);
  let eventPhotos = 0;
  let partnerPhotos = 0;
  for (const row of eventRows) {
    for (const photo of row.photos) {
      unlinkUpload(photo.filePath);
      eventPhotos += 1;
    }
  }
  for (const row of partnerRows) {
    for (const photo of row.photos) {
      unlinkUpload(photo.filePath);
      partnerPhotos += 1;
    }
  }

  // 2. Строки данных. Порядок безопасен: FK-ссылки каскадируются/setNull.
  const [
    events,
    partners,
    wishlists,
    calendars,
    memberships,
    moods,
    places,
    accessories,
    profile,
  ] = await Promise.all([
    prisma.event.deleteMany({ where: { userId } }),
    prisma.partner.deleteMany({ where: { userId } }),
    prisma.wishlist.deleteMany({ where: { userId } }),
    prisma.groupCalendar.deleteMany({ where: { createdBy: userId } }),
    prisma.groupCalendarMember.deleteMany({ where: { userId } }),
    prisma.mood.deleteMany({ where: { userId } }),
    prisma.place.deleteMany({ where: { userId } }),
    prisma.accessory.deleteMany({ where: { userId } }),
    prisma.profile.deleteMany({ where: { userId } }),
  ]);

  return {
    deleted: {
      events: events.count,
      eventPhotos,
      partners: partners.count,
      partnerPhotos,
      wishlists: wishlists.count,
      groupCalendars: calendars.count,
      calendarMemberships: memberships.count,
      moods: moods.count,
      places: places.count,
      accessories: accessories.count,
      profile: profile.count,
    },
    userRetained: true,
  };
}
