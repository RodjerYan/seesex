import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Каркасный entry (S1). Маршрутизация/PWA/экраны — S4/S5.
function App(): JSX.Element {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>xTracker</h1>
      <p>Каркас монорепо (S1). Фронтенд-экраны появятся в S4/S5.</p>
    </main>
  );
}

const container = document.getElementById('root');
if (!container) {
  throw new Error('Не найден #root в index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
