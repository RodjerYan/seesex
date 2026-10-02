import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';

import '@fontsource-variable/inter';
import '@fontsource/great-vibes/400.css';
import AppRouter from './app/router';
import { queryClient } from './lib/queryClient';
import './index.css';
import runAuditAutoLogin from './dev/auditAutologin';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Не найден контейнер #root в index.html');
}

/**
 * Cleanup legacy Service Worker registrations and caches.
 * Runs before app render to prevent "eternal skeleton" from stale SW.
 */
async function cleanupLegacySW(): Promise<void> {
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
    // Swallow errors; console.warn is acceptable per spec
    console.warn('[SW Cleanup] Failed to clean up legacy SW/caches:', err);
  }
}

void cleanupLegacySW().finally(() => {
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
