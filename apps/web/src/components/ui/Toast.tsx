/**
 * Toast — короткое всплывающее уведомление поверх контента (glass, auto-hide).
 *
 * Самодостаточный: не завязан на layout, позиционируется fixed над нижним
 * таб-баром (z-40 > z-30 у шапки/таббара). Используется, например, для
 * подтверждения «Событие создано» перед переходом на страницу события.
 */
import { useEffect, useState, type ReactElement } from 'react';

export interface ToastProps {
  message: string;
  /** success — #30D158 (iOS green), error — #FF453A (iOS red). */
  tone?: 'success' | 'error';
  /** Через сколько миллисекунд скрыться. */
  durationMs?: number;
}

const TONE_COLORS: Record<NonNullable<ToastProps['tone']>, string> = {
  success: '#30D158',
  error: '#FF453A',
};

export function Toast({
  message,
  tone = 'success',
  durationMs = 2400,
}: ToastProps): ReactElement | null {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), durationMs);
    return () => window.clearTimeout(timer);
  }, [durationMs, message]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-4"
    >
      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[rgba(28,28,30,0.9)] px-4 py-3 text-sm font-medium text-slate-100 shadow-lg backdrop-blur-md">
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: TONE_COLORS[tone] }}
        />
        {message}
      </div>
    </div>
  );
}
