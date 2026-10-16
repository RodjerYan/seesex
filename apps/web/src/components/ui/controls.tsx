/**
 * Базовые элементы форм (mobile-first, тема: S1 «Премиальный нуар»).
 * Вынесены сюда, чтобы одинаковые стили не дублировались по всем страницам.
 * Правила (design-spec.md): контролы — elev2, radius 12, высота 48,
 * focus ring rose; secondary — elev2 + hairline; primary — градиент CTA + glow.
 */
import { forwardRef } from 'react';
import type {
  ButtonHTMLAttributes,
  ElementType,
  InputHTMLAttributes,
  ReactElement,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

/** Контрол формы: elev2 + hairline, radius 12 (control), высота 48. */
export const inputClass =
  'w-full min-w-0 max-w-full rounded-control border border-white/[0.08] bg-elev-2 h-12 px-3 py-2.5 text-left text-[16px] leading-5 text-ink ' +
  'placeholder:text-ink-dim focus:border-primary/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,77,141,0.35)] ' +
  'disabled:opacity-50';

export const inputErrorClass = 'border-red-500/70';

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/**
 * Карточка — базовый контентный блок (.glass: solid elev1 + hairline, без blur).
 * `as` — рендер другим тегом (проп опциональный, обратно совместим).
 */
export function Card({
  children,
  className,
  as,
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'aside';
}): ReactElement {
  const Comp = (as ?? 'div') as ElementType;
  return <Comp className={cx('glass p-4', className)}>{children}</Comp>;
}

/** Заголовок секции: метка 12/500 tracking +0.04em (type-label). */
export function SectionTitle({ children }: { children: ReactNode }): ReactElement {
  return (
    <h2 className="type-label mb-3 uppercase text-ink-dim">
      {children}
    </h2>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
}): ReactElement {
  return (
    <div className="mb-4 min-w-0">
      <label htmlFor={htmlFor} className="type-label mb-1 block text-ink-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-[13px] text-red-400">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-[13px] text-ink-dim">{hint}</p>
      ) : null}
    </div>
  );
}

/** forwardRef — обязателен: react-hook-form передаёт ref через {...register()}. */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...props }, ref) {
    return (
      <input {...props} ref={ref} className={cx(inputClass, invalid && inputErrorClass, className)} />
    );
  },
);

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function TextArea({ className, invalid, ...props }, ref) {
  return (
    <textarea
      {...props}
      ref={ref}
      className={cx(inputClass, 'min-h-[5rem] resize-y', invalid && inputErrorClass, className)}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(function Select({ className, invalid, children, ...props }, ref) {
  return (
    <select
      {...props}
      ref={ref}
      className={cx(inputClass, 'appearance-none pr-8', invalid && inputErrorClass, className)}
    >
      {children}
    </select>
  );
});

type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'quiet';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  // primary — градиент CTA 135deg #FF4D7E→#A855F7 + glow (в .grad-intimate)
  primary: 'grad-intimate text-white hover:brightness-110 active:brightness-95',
  // secondary — elev2 + hairline, никакого backdrop-blur
  ghost: 'bg-elev-2 text-ink border border-white/[0.08] hover:bg-elev-3 active:bg-elev-3',
  // semantic red (iOS) не трогаем
  danger: 'bg-red-500 text-white hover:bg-red-600 active:bg-red-600',
  quiet: 'text-ink-muted hover:text-ink hover:bg-white/[0.06] active:bg-white/[0.06]',
};

export function Button({
  variant = 'primary',
  className,
  type = 'button',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }): ReactElement {
  return (
    <button
      type={type}
      {...props}
      className={cx(
        'press inline-flex items-center justify-center gap-2 rounded-full h-12 px-5 text-sm font-medium',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        'disabled:cursor-not-allowed disabled:opacity-50',
        BUTTON_VARIANTS[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Круглая кнопка FAB (mobile): «+» на списках. */
export function Fab({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}): ReactElement {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="press fab-mobile flex h-14 w-14 items-center justify-center rounded-full glass text-primary shadow-lg shadow-black/30 transition-transform hover:scale-[1.02] active:scale-[0.98]"
    >
      {children}
    </button>
  );
}

export function ErrorText({ children }: { children: ReactNode }): ReactElement {
  return (
    <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
      {children}
    </p>
  );
}

export function MutedText({ children }: { children: ReactNode }): ReactElement {
  return <p className="text-[13px] text-ink-muted">{children}</p>;
}