import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuthStore } from '../stores/auth.store';

/**
 * Защита маршрутов: нет access-токена -> редирект на /login.
 * 401 при запросах обрабатывает api.ts (refresh -> retry -> clearSession),
 * после чего accessToken становится null и guard переводит на /login.
 */
export function RequireAuth() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const location = useLocation();

  if (!accessToken) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return <Outlet />;
}
