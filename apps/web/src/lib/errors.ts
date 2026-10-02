/** Человекочитаемые сообщения об ошибках API. */

import { ApiError } from './api';

const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'Неверный email или пароль',
  RATE_LIMITED: 'Слишком много попыток входа. Подождите пару минут и попробуйте снова.',
  EMAIL_TAKEN: 'Этот email уже зарегистрирован',
  INVALID_TOTP_CODE: 'Неверный код подтверждения',
  TWO_FA_NOT_CONFIGURED: 'Двухфакторная аутентификация не настроена',
  TOTP_SETUP_REQUIRED: 'Сначала запустите настройку 2FA',
  INVALID_SETUP_TOKEN: 'Сессия настройки 2FA истекла — начните заново',
  VALIDATION_ERROR: 'Проверьте правильность заполнения полей',
  NOT_FOUND: 'Запись не найдена',
  EVENT_NOT_FOUND: 'Событие не найдено',
  PARTNER_NOT_FOUND: 'Партнёр не найден',
  WISHLIST_NOT_FOUND: 'Запись вишлиста не найдена',
  CALENDAR_NOT_FOUND: 'Групповой календарь не найден',
  ALREADY_MEMBER: 'Вы уже участник этого календаря',
  NOT_A_MEMBER: 'Вы не участник этого календаря',
  PHOTO_LIMIT_EXCEEDED: 'Достигнут лимит фотографий',
  NO_FILES: 'Выберите изображение для загрузки',
  FILE_TOO_LARGE: 'Файл слишком большой (лимит 5 МБ)',
  INVALID_FILE_TYPE: 'Можно загружать только изображения',
  SESSION_NOT_FOUND: 'Сессия не найдена',
  SESSION_EXPIRED: 'Сессия истекла — войдите заново',
  // --- Токены/сессии ---
  TOKEN_EXPIRED: 'Сессия истекла — войдите заново',
  TOKEN_INVALID: 'Сессия недействительна — войдите заново',
  REFRESH_INVALID: 'Не удалось продлить сессию — войдите заново',
  MISSING_TOKEN: 'Требуется вход в аккаунт',
  UNAUTHORIZED: 'Требуется вход в аккаунт',
  USER_NOT_FOUND: 'Пользователь не найден',
  SESSION_FORBIDDEN: 'Нет доступа к чужой сессии',
  INVALID_SESSION_ID: 'Некорректный идентификатор сессии',
  // --- Доступ/конфликты ---
  FORBIDDEN: 'Доступ запрещён',
  CONFLICT: 'Такая запись уже существует',
  CALENDAR_ACCESS_DENIED: 'Нет доступа к этому календарю',
  // --- Файлы ---
  UPLOAD_FAILED: 'Не удалось загрузить файл — попробуйте другое изображение',
  FILE_NOT_FOUND: 'Файл не найден',
  PHOTO_NOT_FOUND: 'Фотография не найдена',
  // --- Прочие сущности ---
  MOOD_NOT_FOUND: 'Настроение не найдено',
  PLACE_NOT_FOUND: 'Место не найдено',
  ACCESSORY_NOT_FOUND: 'Аксессуар не найден',
  INVITE_CODE_FAILED: 'Не удалось создать код приглашения — повторите попытку',
  // --- Транспорт/сервер ---
  BAD_JSON: 'Некорректный запрос — повторите попытку',
  ROUTE_NOT_FOUND: 'Сервис недоступен — обновите страницу',
  INTERNAL_ERROR: 'Внутренняя ошибка сервера — повторите попытку',
};

/** Запасной текст: сырые EN-сообщения от API пользователю не показываем. */
const GENERIC_MESSAGE = 'Что-то пошло не так — повторите попытку';

/** Есть ли кириллица (локальные сообщения ошибок мы пишем по-русски). */
function hasCyrillic(text: string): boolean {
  return /[\u0400-\u04FF]/.test(text);
}

/** Ошибка API (или сетевая) -> текст для пользователя. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const mapped = MESSAGES[error.code];
    if (mapped) return mapped;
    if (error.status === 429) return MESSAGES.RATE_LIMITED;
    if (error.status === 0) return 'Нет соединения с сервером';
    if (error.status >= 500) return 'Сервер недоступен — попробуйте позже';
    // Неизвестный код: не отдаём сырую EN-строку от API.
    return `Произошла ошибка (${error.code})`;
  }
  if (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
    return 'Сервер не отвечает — проверьте соединение и повторите';
  }
  if (error instanceof Error && error.message && hasCyrillic(error.message)) return error.message;
  return GENERIC_MESSAGE;
}
