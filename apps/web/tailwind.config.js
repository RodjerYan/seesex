/**
 * Tailwind CSS v3 — «Премиальный нуар» dark theme (S1, apps/web/artifacts/design-spec.md).
 * Палитра статусов (semantic iOS) не трогаем — только добавляем нуар-токены.
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#F5296E',
          400: '#FF6BA3',
          500: '#F5296E',
          600: '#D0134F',
        },
        surface: '#0A0A0F', // нейтральный графит — синхронен с body/bg_base (S1 нуар)
        // --- S1 «Премиальный нуар»: глубокие фоны и elevated-слои ---
        bg: {
          deep: '#050507', // верх градиента body / самые глубокие подложки
          base: '#0A0A0F', // основной фон приложения
        },
        elev: {
          1: '#101016', // карточка (.glass)
          2: '#16161E', // вложенные плитки, input/select, secondary-кнопки
          3: '#1E1E28', // тосты, шторки, максимальный подъём
        },
        ink: {
          DEFAULT: '#EDEDF2', // основной текст
          muted: '#A6A6B2', // вторичный текст
          dim: '#6C6C7A', // подписи, плейсхолдеры
        },
        line: {
          DEFAULT: 'rgba(255,255,255,0.08)', // hairline-обводка контента
          strong: 'rgba(255,255,255,0.12)', // hairline стекла (шапка/таббар/сайдбар)
        },
        // iOS neutral grays (slate override)
        slate: {
          50: '#F2F2F7',
          100: '#E5E5EA',
          200: '#D1D1D6',
          300: '#C7C7CC',
          400: '#AEAEB2',
          500: '#8E8E93',
          600: '#636366',
          700: '#48484A',
          800: '#3A3A3C',
          900: '#2C2C2E',
          950: '#1C1C1E',
        },
        // iOS systemRed
        red: {
          300: '#FF8A80',
          400: '#FF6961',
          500: '#FF453A',
          600: '#D70015',
        },
        // iOS systemOrange (amber/yellow-ish)
        amber: {
          300: '#FFE24D',
          400: '#FFD60A',
          500: '#FF9F0A',
          600: '#E09000',
        },
        // iOS systemGreen
        emerald: {
          300: '#66E07A',
          400: '#32D746',
          500: '#30D158',
          600: '#248A3D',
        },
        // iOS systemPurple
        violet: {
          300: '#E0B8FF',
          400: '#CC7EF3',
          500: '#BF5AF2',
          600: '#A550D9',
        },
        // iOS systemTeal / systemBlue light (sky)
        sky: {
          300: '#7BD5FF',
          400: '#64D2FF',
          500: '#5AC8FA',
          600: '#3FB9E8',
        },
      },
      // Радиусная шкала S1 (спека): карточки 20 / плитки 16 / контролы 12 /
      // шторки 24 (верх) / чипы full. Избегаем radius ≥32 на мелких элементах.
      borderRadius: {
        card: '20px',
        tile: '16px',
        control: '12px',
        sheet: '24px',
      },
      // Типографика S1: только Inter, никаких font-light/thin в UI.
      fontSize: {
        display: ['28px', { lineHeight: '1.18', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-lg': ['34px', { lineHeight: '1.12', letterSpacing: '-0.02em', fontWeight: '700' }],
        label: ['12px', { lineHeight: '16px', letterSpacing: '0.04em', fontWeight: '500' }],
      },
      boxShadow: {
        // Мягкое свечение CTA/акцентов (glow accent #F5296E, alpha 0.35).
        glow: '0 8px 24px -8px rgba(255,77,141,0.35)',
        // Контентная карточка: плотная, без «стеклянного шума».
        card: '0 1px 2px rgba(0,0,0,0.35), 0 12px 32px -16px rgba(0,0,0,0.7)',
      },
    },
  },
  plugins: [],
};