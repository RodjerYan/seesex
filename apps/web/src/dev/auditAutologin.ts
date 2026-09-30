/**
 * DEV-only auto-login triggered by ?audit_login=1 query parameter.
 * Stripped completely in production (import.meta.env.DEV guard).
 *
 * MUST be awaited before rendering the app — otherwise RequireAuth
 * redirects to /login before the token arrives.
 */
import { useAuthStore } from '../stores/auth.store';

export default async function runAuditAutoLogin(): Promise<void> {
  if (!import.meta.env.DEV) return;
  const params = new URLSearchParams(location.search);
  if (params.get('audit_login') !== '1') return;
  try {
    await useAuthStore.getState().login('audit@test.local', 'Audit12345');
    history.replaceState(history.state, '', `${location.pathname}${location.hash}`);
  } catch (e) {
    // QA: тихо залогировать и продолжить — приложение рендерится как есть.
    console.warn('audit_login autologin failed', e);
  }
}
