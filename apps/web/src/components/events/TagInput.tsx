/**
 * TagInput — чипы free-text (настроения/места/аксессуары).
 *
 * Справочников moods/places/accessories на бэке НЕТ (нет эндпоинтов, а
 * POST /api/events принимает только moodIds/placeIds/accessoryIds существующих
 * записей), поэтому новые теги сохраняются локально в форме и не отправляются —
 * ранее сохранённые (id из ответа API) можно только снять.
 */
import { Plus, X } from 'lucide-react';
import { useState, type KeyboardEvent, type ReactElement } from 'react';

import { Input, cx } from '../ui/controls';

export interface TagGroup {
  /** Теги, пришедшие из API (есть id — уйдут в moodIds/placeIds/accessoryIds). */
  saved: { id: string; name: string }[];
  /** Новые free-text теги (только локально). */
  local: string[];
}

interface TagInputProps {
  label: string;
  placeholder: string;
  group: TagGroup;
  onChange: (group: TagGroup) => void;
}

export function TagInput({ label, placeholder, group, onChange }: TagInputProps): ReactElement {
  const [draft, setDraft] = useState('');

  const addLocal = (): void => {
    const value = draft.trim();
    if (!value) return;
    if (group.local.includes(value) || group.saved.some((item) => item.name === value)) {
      setDraft('');
      return;
    }
    onChange({ ...group, local: [...group.local, value] });
    setDraft('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addLocal();
    }
  };

  return (
    <div className="mb-4">
      <p className="mb-1 block text-xs font-medium text-slate-400">{label}</p>
      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          aria-label={label}
        />
        <button
          type="button"
          onClick={addLocal}
          aria-label={`Добавить: ${label}`}
          className="shrink-0 rounded-lg border border-slate-700 px-3 text-slate-300 transition-colors hover:bg-white/[0.06]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {group.saved.length + group.local.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {group.saved.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-white/[0.08] px-2 py-0.5 text-xs text-slate-300"
            >
              {item.name}
              <button
                type="button"
                aria-label={`Убрать ${item.name}`}
                onClick={() =>
                  onChange({ ...group, saved: group.saved.filter((tag) => tag.id !== item.id) })
                }
                className="text-slate-500 hover:text-red-400"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
          {group.local.map((item) => (
            <span
              key={`local-${item}`}
              className={cx(
                'inline-flex items-center gap-1 rounded-full border border-dashed border-slate-600 px-2 py-0.5 text-xs text-slate-400',
              )}
            >
              {item}
              <button
                type="button"
                aria-label={`Убрать ${item}`}
                onClick={() =>
                  onChange({ ...group, local: group.local.filter((tag) => tag !== item) })
                }
                className="text-slate-500 hover:text-red-400"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <p className="mt-1 text-[11px] text-slate-600">
        Пунктирные чипы — локальные: API справочников для этих полей нет, они не сохраняются.
      </p>
    </div>
  );
}
