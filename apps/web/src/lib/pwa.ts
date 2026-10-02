/**
 * PWA update controller.
 * Holds the update function returned by registerSW and exposes applyUpdate().
 */

export const PWA_NEED_REFRESH = 'pwa:need-refresh';

let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;
let needRefreshFired = false;

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
 * This triggers skipWaiting on the waiting SW and reloads the page
 * when the new SW takes control (controllerchange).
 */
export async function applyUpdate(): Promise<void> {
  if (updateSW) {
    await updateSW();
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