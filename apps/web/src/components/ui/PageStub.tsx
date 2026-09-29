/** Универсальная страница-заглушка S4 (наполнение — в S5). */
export interface PageStubProps {
  title: string;
  description?: string;
}

export function PageStub({ title, description = 'Страница в разработке (S5).' }: PageStubProps) {
  return (
    <section className="px-4 py-6 sm:px-6">
      <h1 className="text-lg font-semibold tracking-tight text-slate-100 sm:text-xl">{title}</h1>
      <p className="mt-2 text-sm text-slate-400">{description}</p>
      <div className="mt-4 rounded-xl border border-dashed border-slate-700 bg-white/[0.06] p-4 text-xs text-slate-500">
        TODO(S5): наполнение страницы (формы, данные, календарь).
      </div>
    </section>
  );
}
