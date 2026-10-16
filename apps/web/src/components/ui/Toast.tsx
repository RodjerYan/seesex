/**
 * Toast — короткое всплывающее уведомление поверх контента (glass, auto-hide).
 *
 * Самодостаточный: не завязан на layout, позиционируется fixed над нижним
 * таб-баром (z-40 > z-30 у шапки/таббара). Используется, например, для
 * подтверждения «Событие создано» перед переходом на страницу события.
 */
import { useEffect, useState, type ReactElement } from 'react';
import { cx } from './controls';

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
  /** mounted: тост всегда в DOM — плавный fade через class-переключение (не return null). */
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), durationMs);
    return () => window.clearTimeout(timer);
  }, [durationMs, message]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
      className={cx(
        'pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4 transition-all duration-300',
        mounted && visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
      )}
      style={{
        /* 8px — визуальный зазор между тостом и верхней гранью таб-пилюли
           (magic number — константа макета, см. review m-01). */
        bottom: 'calc(var(--tabbar-height, 3.75rem) + var(--tabbar-bottom, 1rem) + 8px)',
      }}
    >
      <div className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-elev-3 px-4 py-3 text-[15px] font-medium leading-5 text-ink shadow-[0_12px_32px_-12px_rgba(0,0,0,0.7)]">
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
