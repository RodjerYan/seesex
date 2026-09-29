/** Tailwind CSS v3 — iOS 27 Liquid Glass dark theme (pure black + system colors). */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0A84FF',
          400: '#409CFF',
          500: '#0A84FF',
          600: '#0060DF',
        },
        surface: '#000000',
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
    },
  },
  plugins: [],
};