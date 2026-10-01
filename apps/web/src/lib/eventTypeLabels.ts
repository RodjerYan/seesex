/** Мягкие русские подписи для типов событий.
 *  Только отображение — значения полей (eventType) в API/данных не меняем.
 *  Чистая функция, без side-effect, строгие типы.
 */

export function eventTypeLabel(raw: string): string {
  const key = raw.trim().toUpperCase();

  const map: Record<string, string> = {
    SEX: 'Секс',
    KISS: 'Поцелуй',
    MASSAGE: 'Массаж',
    ORAL: 'Оральный',
    ANAL: 'Анальный',
    OTHER: 'Другое',
    TURNDOWN: 'Отказ',
    REFUSED: 'Отказ',
    'TURN DOWN': 'Отказ',
    PLANNED: 'Запланировано',
    OCCURRED: 'Состоялось',
  };

  if (map[key] !== undefined) {
    return map[key];
  }

  // Неизвестное значение: попытаться «обрезать кричащий ALL-CAPS»
  const words = key.split(/\s+/);
  if (
    words.length === 1
    && key === key.toUpperCase()
    && key.length <= 12
  ) {
    // Однократное ALL-CAPS слово ≤ 12 символов — вернуть с первой заглавной
    return key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
  }

  // Иное — возвращаем исходную строку без изменений
  return raw;
}