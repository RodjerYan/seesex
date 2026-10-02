/**
 * Apple Health: открытие шортката iOS после сохранения события (T-20261002-019 / H3).
 *
 * Шорткат «XTracker Health» (именно это имя вызывает веб) читает пробы Здоровья
 * и шлёт их на POST /api/health/apple с device-токеном. iOS не даёт приложению
 * читать HealthKit напрямую из браузера — поэтому единственная связка через
 * запуск шортката custom-scheme'ом shortcuts://.
 */

/** Имя шортката — должно ТОЧНО совпадать с тем, как он назван на iPhone. */
export const HEALTH_SHORTCUT_NAME = 'XTracker Health';

/**
 * Задержка открытия шортката ПОСЛЕ SPA-редиректа (мс).
 *
 * Порядок «navigate → задержка → location.href» обязателен:
 * - открыть shortcuts:// ДО navigate нельзя — браузер уйдёт в Шорткаты,
 *   а вернувшийся SPA-navigate перезаписал бы адрес, не отрисовав событие;
 * - сразу после navigate нельзя — React ещё не отрисовал новую страницу.
 * Custom-scheme-переход делается через location.href ПОСЛЕ редиректа: это
 * навигация уровня браузера поверх уже отрисованного роута, при возврате в
 * веб-приложение событие остаётся на экране (результат сохранения не теряется).
 */
export const HEALTH_SHORTCUT_DELAY_MS = 800;

/** То, что шорткат получает как input: eventId события + параметры окна выбора проб. */
export interface HealthShortcutInput {
  /** uuid события (обогащение на сервере привязывается к нему). */
  eventId: string;
  /** Дата/время события в ISO — начало окна выбора проб. */
  startedAt: string;
  /** Длительность события в минутах (null → на сервере окно ±60 мин). */
  durationMin: number | null;
  /** Тип события (влияет на MET в фоллбэке калорий). */
  eventType?: string;
}

/** iOS (iPhone/iPad/iPod): только там существует схема shortcuts://. */
export function isAppleMobile(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Открывает шорткат «XTracker Health» с input-JSON (один тап подтверждения —
 * ограничение платформы: iOS всегда спрашивает «Запустить шорткат?»).
 * На не-iOS устройствах — no-op.
 *
 * Вызывать ПОСЛЕ navigate (см. HEALTH_SHORTCUT_DELAY_MS): до редиректа нельзя,
 * сразу после — тоже нельзя (страница ещё не отрисована).
 */
export function openHealthShortcut(input: HealthShortcutInput): void {
  if (!isAppleMobile()) return;
  const payload = JSON.stringify(input);
  window.location.href =
    `shortcuts://run-shortcut?name=${encodeURIComponent(HEALTH_SHORTCUT_NAME)}` +
    `&input=${encodeURIComponent(payload)}`;
}
