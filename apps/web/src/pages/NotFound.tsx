import { Link } from 'react-router-dom';

/** 404. */
export default function NotFound() {
  return (
    <section className="px-4 py-10 text-center sm:px-6">
      <p className="text-sm text-slate-500">Ошибка 404</p>
      <h1 className="mt-2 text-lg font-bold text-slate-100">Страница не найдена</h1>
      <Link
        to="/"
        className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600"
      >
        На главную
      </Link>
    </section>
  );
}
