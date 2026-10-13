import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { registerSW } from 'virtual:pwa-register';

// Inter Variable: index.css разбивает subset'ы по unicode-range — браузер сам
// скачает только нужные (latin + cyrillic для русского UI).
import '@fontsource-variable/inter';
// Great Vibes — только логотип «SeeSex» (латиница): полный 400.css тянул
// 68KB латину + кириллицу/греческий/вьетнамский, которые не используются.
import '@fontsource/great-vibes/latin-400.css';
import AppRouter from './app/router';
import { queryClient } from './lib/queryClient';
import { setUpdateSW, markNeedRefreshFired, PWA_NEED_REFRESH } from './lib/pwa';
import './index.css';
import runAuditAutoLogin from './dev/auditAutologin';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Не найден контейнер #root в index.html');
}

const SW_CLEANUP_MARKER = 'sw-cleanup-v1';

/**
 * One-time legacy Service Worker cleanup.
 * Runs only once per browser profile (tracked via localStorage marker).
 * Unregisters all SW registrations and clears all Cache Storage entries.
 */
async function cleanupLegacySWOnce(): Promise<void> {
  if (localStorage.getItem(SW_CLEANUP_MARKER)) {
    return; // Already cleaned up in this profile
  }

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
    // Mark cleanup as done for this browser profile ONLY on success
    localStorage.setItem(SW_CLEANUP_MARKER, '1');
  } catch (err) {
    // Swallow errors; console.warn is acceptable per spec
    // Do NOT set marker on failure — next load will retry cleanup
    console.warn('[SW Cleanup] Failed to clean up legacy SW/caches:', err);
  }
}

/**
 * Registers the service worker with prompt-based update flow.
 * - immediate: true -> register immediately
 * - onNeedRefresh: fires when a new SW is waiting (user action needed)
 * - onRegisteredSW: called after registration; sets up visibility-based update check
 * - onRegisterError: logs registration errors
 */
function registerServiceWorker(): void {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh: () => {
      markNeedRefreshFired();
      window.dispatchEvent(new CustomEvent('pwa:need-refresh'));
    },
    onRegisteredSW: (_swUrl, registration) => {
      if (registration) {
        // Check for updates when page becomes visible again
        const abortController = new AbortController();
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            registration.update().catch(() => {
              // Ignore update check errors
            });
          }
        }, { signal: abortController.signal });
        // Note: AbortController is not aborted here since the registration
        // lives for the page lifetime. This prevents the leak warning
        // while keeping the listener active for the session.
      }
    },
    onRegisterError: (error) => {
      console.warn('SW register error', error);
    },
  });

  // Store the update function for later use by UpdatePrompt
  setUpdateSW(updateSW);
}

// === Self-heal версии (T-20261013-004) ===
// workbox видит новую версию только когда перезапрашивает sw.js; если по
// какой-то причине не увидел (например, старый HTTP-кэш на клиенте), этот
// чекер всё равно заметит смену сборки по /version.txt (вне precache →
// идёт по сети даже через старый SW) и покажет баннер «Обновить» —
// тот же PWA_NEED_REFRESH, что и у registerSW. Молчаливой перезагрузки
// нет: обновление всегда по кнопке (по запросу пользователя).
const VERSION_KEY = 'xtracker-version';

async function checkAppVersion(): Promise<void> {
  try {
    const res = await fetch('/version.txt', { cache: 'no-store' });
    if (!res.ok) return;
    const server = (await res.text()).trim();
    if (!server) return;
    const local = localStorage.getItem(VERSION_KEY);
    if (local === server) return;
    localStorage.setItem(VERSION_KEY, server);
    if (local !== null) {
      // Смена сборки: баннер «Обновить» (UpdatePrompt слушает это событие).
      markNeedRefreshFired();
      window.dispatchEvent(new CustomEvent(PWA_NEED_REFRESH));
    }
    // local===null — первый визит: только запоминаем метку.
  } catch {
    // offline / abort — молча игнорируем
  }
}

function startVersionWatcher(): void {
  void checkAppVersion();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkAppVersion();
  });
  setInterval(() => void checkAppVersion(), 5 * 60 * 1000);
}

// Run one-time cleanup, then register SW, then render app (non-blocking)
void cleanupLegacySWOnce().then(() => {
  registerServiceWorker();
  startVersionWatcher();
  void runAuditAutoLogin().finally(() => {
    createRoot(container).render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <AppRouter />
        </QueryClientProvider>
      </StrictMode>,
    );
  });
});