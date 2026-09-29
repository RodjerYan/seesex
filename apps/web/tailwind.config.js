/** Tailwind CSS v3 — mobile-first тема xTracker (спека: primary indigo, фон dark slate). */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#6366f1',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
        },
        surface: '#0f172a',
      },
    },
  },
  plugins: [],
};
