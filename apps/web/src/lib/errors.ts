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
  POSITION_NOT_FOUND: 'Позиция не найдена',
  WISHLIST_NOT_FOUND: 'Запись вишлиста не найдена',
  CALENDAR_NOT_FOUND: 'Групповой календарь не найден',
  ALREADY_MEMBER: 'Вы уже участник этого календаря',
  NOT_A_MEMBER: 'Вы не участник этого календаря',
  PHOTO_LIMIT_EXCEEDED: 'Достигнут лимит фотографий',
  SYSTEM_POSITION: 'Системные позиции нельзя изменить',
  NO_FILES: 'Выберите изображение для загрузки',
  FILE_TOO_LARGE: 'Файл слишком большой (лимит 5 МБ)',
  INVALID_FILE_TYPE: 'Можно загружать только изображения',
  SESSION_NOT_FOUND: 'Сессия не найдена',
  SESSION_EXPIRED: 'Сессия истекла — войдите заново',
};

/** Ошибка API (или сетевая) -> текст для пользователя. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const mapped = MESSAGES[error.code];
    if (mapped) return mapped;
    if (error.status === 429) return MESSAGES.RATE_LIMITED;
    if (error.status === 0) return 'Нет соединения с сервером';
    if (error.status >= 500) return 'Сервер недоступен — попробуйте позже';
    return error.message;
  }
  if (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
    return 'Сервер не отвечает — проверьте соединение и повторите';
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Что-то пошло не так';
}
