/** Русские словари для отображения сырых значений API (только UI).
 *  Значения полей в API/БД не меняем — переводим только то, что видит пользователь.
 *  Неизвестные значения отдаём как есть (fallback), ничего не теряем.
 */

/** Пол (PartnerForm: GENDERS). */
export const GENDER_LABEL: Record<string, string> = {
  female: 'Женский',
  male: 'Мужской',
  'non-binary': 'Небинарный',
  other: 'Другое',
};

/** Ориентация (PartnerForm: ORIENTATIONS) — короткие нейтральные формы для селекта. */
export const ORIENTATION_LABEL: Record<string, string> = {
  heterosexual: 'Гетеро',
  homosexual: 'Гомо',
  bisexual: 'Би',
  pansexual: 'Пан',
  asexual: 'Асексуальность',
  other: 'Другое',
};

/** Статус отношений (PartnerForm: RELATIONSHIPS). */
export const RELATIONSHIP_LABEL: Record<string, string> = {
  single: 'Не в отношениях',
  dating: 'Встречаются',
  partner: 'Партнёрство',
  married: 'Женаты/замужем',
  complicated: 'Сложно',
  other: 'Другое',
};

/** Категории позиций каталога (packages/shared POSITION_CATEGORIES). */
export const POSITION_CATEGORY_LABEL: Record<string, string> = {
  STANDARD: 'Базовые',
  ORAL: 'Оральные',
  ANAL: 'Анальные',
  KINKY: 'Кинк',
  BDSM: 'BDSM',
  ROLEPLAY: 'Ролевые',
  FANTASY: 'Фантазии',
  EXOTIC: 'Экзотика',
};

/** Роль участника группового календаря (API: OWNER | MEMBER). */
export const GROUP_ROLE_LABEL: Record<string, string> = {
  OWNER: 'Владелец',
  MEMBER: 'Участник',
};

/** Подпись значения из словаря; неизвестное/null — fallback (по умолчанию «—»). */
export function tr<T extends Record<string, string>>(
  dict: T,
  key: string | null | undefined,
  fallback = '—',
): string {
  return (key && dict[key]) || fallback;
}
