import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type PluginOption } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Генерирует dist/version.txt с меткой сборки. main.tsx сравнивает её с
 * localStorage и перезагружается при расхождении — самое надёжное средство
 * от PWA-кэша: /version.txt НЕ входит в workbox-precache, fetch с cache:'no-store'
 * обходит даже застаревший Service Worker (он не знает этого маршрута → сеть).
 */
function emitVersionTxt(): PluginOption {
  return {
    name: 'emit-version-txt',
    apply: 'build',
    closeBundle() {
      writeFileSync(resolve(__dirname, 'dist/version.txt'), new Date().toISOString());
    },
  };
}

// dev: /api -> Express (default порт 3001, см. apps/api/src/lib/config.ts).
export default defineConfig({
  plugins: [
    react(),
    emitVersionTxt(),
    VitePWA({
      // Единственный регистратор — явный import { registerSW } из
      // 'virtual:pwa-register' в src/main.tsx (workbox-window). 'auto' генерировал
      // бы dist/registerSW.js с второй navigatorServiceWorker.register() в проде.
      injectRegister: false,
      // autoUpdate (T-20261013-004): новый SW активируется сам и страница
      // перезагружается автоматически — иначе registerType:'prompt' зависал:
      // пользователь не видел/не нажимал баннер «Обновить» и НЕПРЕРЫВНО
      // сидел на старой версии («заголовок не меняется»). UpdatePrompt
      // остаётся в коде, но при autoUpdate не показывается.
      registerType: 'autoUpdate',
      manifest: {
        name: 'SeeSex — Личный дневник событий, статистика и календарь',
        short_name: 'SeeSex',
        description: 'Личный дневник событий, статистика и календарь',
        start_url: '/',
        display: 'standalone',
        background_color: '#0D0A10',
        theme_color: '#0D0A10',
        orientation: 'portrait',
        lang: 'ru-RU',
        categories: ['health', 'lifestyle'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Относительный паттерн (любой origin + /api/...), НЕ api.seesex.app:
            // одиночный деплой — API раздаётся с того же origin, что и статика.
            // /api/auth (логин/refresh/сессии) НЕ кэшируем — устаревшие токены
            // в SW-кэше = вечный 401 после logout/login чужого аккаунта.
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/auth/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 86400,
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    // Прямой 'localhost' резолвится в IPv6-only [::1],
    // на котором vite не слушает — поэтому IPv4-петля.
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    // Прод-бандл без sourcemaps: меньше трафика и не отдаём исходники наружу.
    sourcemap: false,
  },
});
