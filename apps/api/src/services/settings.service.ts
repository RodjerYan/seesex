import { prisma } from '../lib/prisma';

/**
 * GDPR: полная очистка данных пользователя (события, партнёры,
 * вишлист, групповые календари, словари).
 * Сам User (аккаунт, сессии, refresh-токены) остаётся — юзер может продолжать входить.
 */

export interface DeleteSummary {
  events: number;
  partners: number;
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
  // Строки данных. Порядок безопасен: FK-ссылки каскадируются/setNull.
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
      partners: partners.count,
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
