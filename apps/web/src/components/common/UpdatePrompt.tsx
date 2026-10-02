import { useState, useEffect } from 'react';
import { X, RefreshCw, AlertCircle } from 'lucide-react';
import { applyUpdate, PWA_NEED_REFRESH, hasNeedRefreshFired } from '../../lib/pwa';

/**
 * UpdatePrompt — fixed bottom banner shown only when a new SW version is waiting.
 * Listens for 'pwa:need-refresh' event dispatched by registerSW's onNeedRefresh callback.
 * - "Обновить" button: calls applyUpdate() (skipWaiting + reload on controllerchange)
 * - "Сбросить кэш" link: fallback — unregister all SW + clear caches + hard reload
 */
export function UpdatePrompt(): JSX.Element | null {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    // Check if the event already fired before we mounted (race condition fix)
    if (hasNeedRefreshFired()) {
      setUpdateAvailable(true);
    }

    const handleNeedRefresh = (): void => {
      setUpdateAvailable(true);
    };

    window.addEventListener(PWA_NEED_REFRESH, handleNeedRefresh);

    return () => {
      window.removeEventListener(PWA_NEED_REFRESH, handleNeedRefresh);
    };
  }, []);

  if (!updateAvailable) return null;

  const handleApplyUpdate = async (): Promise<void> => {
    if (updating) return;
    setUpdating(true);
    try {
      await applyUpdate();
    } catch (err) {
      console.warn('[UpdatePrompt] applyUpdate failed:', err);
    } finally {
      setUpdating(false);
    }
  };

  const handleHardReset = async (): Promise<void> => {
    try {
      // Unregister all service worker registrations
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((reg) => reg.unregister()));
      }
      // Delete all Cache Storage entries
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((key) => caches.delete(key)));
      }
    } catch (err) {
      console.warn('[UpdatePrompt] Hard reset cleanup failed:', err);
    }
    // Force reload
    window.location.reload();
  };

  const handleDismiss = (): void => {
    setUpdateAvailable(false);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 sm:pb-6 pointer-events-none"
    >
      <div className="pointer-events-auto mx-auto max-w-[32.5rem] glass rounded-2xl border border-white/10 shadow-[0_12px_32px_rgba(0,0,0,0.45)] overflow-hidden">
        <div className="flex items-start justify-between gap-3 p-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <AlertCircle className="h-5 w-5 text-primary-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-100 truncate">
                Доступна новая версия приложения
              </p>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                Обновите, чтобы получить последние изменения
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            <button
              type="button"
              onClick={handleApplyUpdate}
              disabled={updating}
              className="grad-intimate px-4 py-2 rounded-xl text-sm font-medium text-white transition-all duration-200 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60 disabled:cursor-not-allowed"
              aria-label="Обновить приложение"
              aria-busy={updating}
            >
              <RefreshCw className="h-4 w-4 inline-block mr-1.5" aria-hidden="true" />
              {updating ? 'Обновление…' : 'Обновить'}
            </button>
            <button
              type="button"
              onClick={handleHardReset}
              className="press px-3 py-2 rounded-xl text-xs text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              aria-label="Сбросить кэш и перезагрузить"
            >
              Не обновляется? Сбросить кэш
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="press p-2 rounded-xl text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              aria-label="Скрыть баннер"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}