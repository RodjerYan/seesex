import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';

import AppRouter from './app/router';
import { queryClient } from './lib/queryClient';
import './index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Не найден контейнер #root в index.html');
}

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppRouter />
    </QueryClientProvider>
  </StrictMode>,
);
