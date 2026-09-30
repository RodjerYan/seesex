import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// dev: /api -> Express (default порт 3001, см. apps/api/src/lib/config.ts).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Единственный регистратор — явный import { registerSW } из
      // 'virtual:pwa-register' в src/main.tsx (workbox-window). 'auto' генерировал
      // бы dist/registerSW.js с второй navigator.serviceWorker.register() в проде.
      injectRegister: false,
      registerType: 'autoUpdate',
      manifest: {
        name: 'SeeSex — Личный дневник событий, статистика и календарь',
        short_name: 'SeeSex',
        description: 'Личный дневник событий, статистика и календарь',
        start_url: '/',
        display: 'standalone',
        background_color: '#07040A',
        theme_color: '#07040A',
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
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
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
    sourcemap: true,
  },
});
