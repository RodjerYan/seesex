import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Прокси /api -> локальный Express в режиме разработки.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // В этом окружении 'localhost' резолвится в IPv6-only [::1],
    // к которому нет доступа — слушаем IPv4 явно.
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
