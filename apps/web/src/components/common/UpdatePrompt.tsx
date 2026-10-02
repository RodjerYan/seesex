import { useState } from 'react';
import { X, RefreshCw } from 'lucide-react';

/**
 * UpdatePrompt — фиксированный снизу баннер для выхода из «вечной загрузки».
 * Показывается всегда (escape-hatch). Компактный, с dismiss-кнопкой.
 * При клике на «Обновить» — unregister всех SW + очистка кэшей + reload.
 */
export function UpdatePrompt(): JSX.Element | null {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleRefresh = async (): Promise<void> => {
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
      console.warn('[UpdatePrompt] Cleanup failed:', err);
    }
    // Force reload
    window.location.reload();
  };

  const handleDismiss = (): void => {
    setDismissed(true);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 sm:pb-6 pointer-events-none"
    >
      <div className="pointer-events-auto mx-auto max-w-[32.5rem] glass rounded-2xl border border-white/10 shadow-[0_12px_32px_rgba(0,0,0,0.45)] overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <RefreshCw
              className="h-5 w-5 text-primary-400 flex-shrink-0"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-100 truncate">
                Приложение обновилось
              </p>
              <p className="text-xs text-slate-400 truncate">
                Если страница зависла — обновите
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={handleRefresh}
              className="grad-intimate px-4 py-2 rounded-xl text-sm font-medium text-white transition-all duration-200 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              aria-label="Обновить приложение"
            >
              Обновить
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