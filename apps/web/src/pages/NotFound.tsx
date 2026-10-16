import { Link } from 'react-router-dom';

/** 404. */
export default function NotFound() {
  return (
    <section className="px-4 py-10 text-center sm:px-6">
      <p className="type-display-lg text-ink-muted">Ошибка 404</p>
      <h1 className="mt-2 text-[22px] font-semibold leading-7 text-ink">Страница не найдена</h1>
      <Link
        to="/"
        className="press grad-intimate mt-6 inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-medium text-white"
      >
        На главную
      </Link>
    </section>
  );
}
