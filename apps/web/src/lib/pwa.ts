/**
 * PWA update controller.
 * Holds the update function returned by registerSW and exposes applyUpdate().
 */

export const PWA_NEED_REFRESH = 'pwa:need-refresh';

let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;
let needRefreshFired = false;

/**
 * Single-fire guard для reload страницы.
 * controllerchange может сработать более одного раза (и у workbox-листенера,
 * и у нашего собственного) — reload выполняется ровно один раз.
 */
let reloadTriggered = false;
const reloadOnce = (): void => {
  if (reloadTriggered) return;
  reloadTriggered = true;
  window.location.reload();
};

/** Гард от повторной подписки на controllerchange при повторных вызовах applyUpdate. */
let controllerListenerAttached = false;

/**
 * Sets the update function returned by registerSW.
 * Called once during app initialization in main.tsx.
 */
export function setUpdateSW(fn: (reloadPage?: boolean) => Promise<void>): void {
  updateSW = fn;
}

/**
 * Internal: called by onNeedRefresh callback BEFORE dispatching the event.
 * Marks that a refresh is needed, so late-mounted components can detect it.
 */
export function markNeedRefreshFired(): void {
  needRefreshFired = true;
}

/**
 * Checks if the 'pwa:need-refresh' event has already been fired.
 * Used by UpdatePrompt on mount to catch events that fired before mount.
 */
export function hasNeedRefreshFired(): boolean {
  return needRefreshFired;
}

/**
 * Applies the pending service worker update.
 * Три ветки (все сходятся к одному reload через controllerchange):
 * 1) Прямая подписка на controllerchange — reload РОВНО один раз
 *    (guard-флаг reloadTriggered). Срабатывает при принятии нового SW,
 *    включая случай, когда workbox не отследил waiting-SW.
 * 2) Прямой postMessage SKIP_WAITING в reg.waiting — не зависит от
 *    трекинга workbox: messageSkipWaiting() workbox-window молча ничего
 *    не делает, если SW установился до инициализации страницы / в прошлой
 *    сессии и workbox о нём «не знает».
 * 3) updateSW() из registerSW (workbox-путь) — fire-and-forget: подвисание
 *    промиса не должно мешать уже подписанному controllerchange.
 */
export async function applyUpdate(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    console.warn('[PWA] applyUpdate: navigator.serviceWorker is unavailable');
    return;
  }

  // Подписываемся ДО отправки SKIP_WAITING, чтобы не пропустить controllerchange
  if (!controllerListenerAttached) {
    controllerListenerAttached = true;
    navigator.serviceWorker.addEventListener('controllerchange', reloadOnce);
  }

  // Прямой путь: waiting-SW мог установиться до инициализации страницы —
  // workbox-window его не отследил, messageSkipWaiting() молча no-op.
  // reg.waiting.postMessage обходит workbox-трекинг.
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg?.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  } catch (err) {
    console.warn('[PWA] direct SKIP_WAITING postMessage failed:', err);
  }

  // Workbox-путь (registerSW): НЕ блокируемся — промис может подвиснуть,
  // но reload уже подписан через controllerchange выше.
  if (updateSW) {
    void Promise.resolve(updateSW()).catch(() => {
      /* не блокируем: controllerchange уже подписан */
    });
  } else {
    console.warn('[PWA] applyUpdate called but updateSW is not set');
  }
}

/**
 * Checks if an update is available (updateSW has been set).
 */
export function hasUpdateSW(): boolean {
  return updateSW !== null;
}

/**
 * Fire-and-forget: удаляет записи кэша API (api-cache) из Cache Storage.
 * Вызывается при logout и при сбое refresh — чтобы очистить персональные данные.
 */
export async function purgeApiCache(): Promise<void> {
  try {
    if (typeof caches === 'undefined') return;
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k.startsWith('api-cache')).map((k) => caches.delete(k)),
    );
  } catch {
    /* ничего: очистка кэша не должна ломать выход */
  }
}
