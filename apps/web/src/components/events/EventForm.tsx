/**
 * EventForm — создание/редактирование события (RHF + zod).
 *
 * Поля по спеке: дата/время, длительность, eventType (+свой тип), партнёры
 * (мультивыбор), позиции (мультивыбор с поиском), настроения/места/аксессуары
 * (free-text чипы — см. TagInput), оценка 1–5, калории, пульс, инициатор,
 * заметки, статус (occurred/planned/turndown).
 *
 * Статус: бэкенд статус НЕ хранит — он выводится из даты и eventType
 * (TURNDOWN/REFUSED => «отказ»). Поэтому «отказ» => eventType=TURNDOWN,
 * а planned/occurred сверяются с датой (валидация в схеме).
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { dayKey, formatTime } from '../../lib/format';
import { PositionIcon } from '../../lib/positionIcons';
import { useAllPositions, usePartners } from '../../lib/queries';
import type { EventView } from '../../types/api';
import { Stars } from '../ui/Stars';
import { Button, Card, ErrorText, Field, Input, MutedText, SectionTitle, Select, TextArea, cx } from '../ui/controls';
import { LoadingBlock } from '../ui/states';
import { TagInput, type TagGroup } from './TagInput';

/** Пресеты типов событий; свой тип уходит как isCustomType=true. */
const EVENT_TYPE_PRESETS = ['SEX', 'KISS', 'MASSAGE', 'ORAL', 'OTHER', 'CUSTOM'] as const;

export type EventStatusValue = 'occurred' | 'planned' | 'turndown';

export interface EventPayload {
  title?: string;
  eventType: string;
  isCustomType: boolean;
  date: string;
  duration: number | null;
  rating: number | null;
  notes: string | null;
  calories: number | null;
  heartRate: number | null;
  initiatedBy: string | null;
  partnerIds: string[];
  positionIds: string[];
  moodIds: string[];
  placeIds: string[];
  accessoryIds: string[];
}

interface EventFormValues {
  date: string;
  time: string;
  duration: string;
  status: EventStatusValue;
  eventType: string;
  customType: string;
  title: string;
  calories: string;
  heartRate: string;
  initiatedBy: string;
  notes: string;
}

/**
 * Проверка «целое число ≤ max»: null — значение корректно, иначе текст ошибки.
 *
 * Важно: zod `.refine(check)` считает непустую строку truthy, т.е. check,
 * возвращающий текст ошибки, НЕ создаёт issue. Поэтому проверяем через
 * `superRefine` + `ctx.addIssue` — иначе ошибки «только целое число»/«не больше N»
 * молча пропускались бы (поле отправлялось бы пустым/обнулённым).
 */
function digitsIssue(value: string, max: number, label: string): string | null {
  if (value === '') return null;
  if (!/^\d+$/.test(value)) return `${label}: только целое число`;
  if (Number(value) > max) return `${label}: не больше ${max}`;
  return null;
}

/** Добавляет issue в контекст superRefine, если значение некорректно. */
function checkDigits(ctx: z.RefinementCtx, value: string, max: number, label: string): void {
  const issue = digitsIssue(value, max, label);
  if (issue) ctx.addIssue({ code: z.ZodIssueCode.custom, message: issue });
}

const eventFormSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Укажите дату'),
    time: z.string().regex(/^\d{2}:\d{2}$/, 'Укажите время'),
    duration: z.string().superRefine((value, ctx) => checkDigits(ctx, value, 43_200, 'Длительность')),
    status: z.enum(['occurred', 'planned', 'turndown']),
    eventType: z.string().min(1, 'Укажите тип события'),
    customType: z.string().max(64, 'Свой тип: не больше 64 символов'),
    title: z.string().max(200, 'Название: не больше 200 символов'),
    calories: z.string().superRefine((value, ctx) => checkDigits(ctx, value, 100_000, 'Калории')),
    heartRate: z.string().superRefine((value, ctx) => checkDigits(ctx, value, 400, 'Пульс')),
    initiatedBy: z.string().max(100, 'Инициатор: не больше 100 символов'),
    notes: z.string().max(20_000, 'Заметки: не больше 20 000 символов'),
  })
  .superRefine((values, ctx) => {
    const dateTime = new Date(`${values.date}T${values.time}`);
    if (Number.isNaN(dateTime.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['date'], message: 'Некорректные дата/время' });
      return;
    }
    if (values.status === 'planned' && dateTime.getTime() <= Date.now()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['date'],
        message: 'Запланированное событие должно быть в будущем — измените дату или статус',
      });
    }
    if (values.status === 'occurred' && dateTime.getTime() > Date.now()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['date'],
        message: 'Состоявшееся событие должно быть в прошлом — измените дату или статус',
      });
    }
    if (values.status !== 'turndown' && values.eventType === 'CUSTOM' && !values.customType.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['customType'],
        message: 'Укажите название типа события',
      });
    }
  });

interface EventFormProps {
  /** Данные для редактирования; без неё — создание. */
  initial?: EventView;
  submitLabel: string;
  submitting: boolean;
  formError?: string | null;
  /**
   * «Отмена»: вызывается после подтверждения, если форма изменена
   * (isDirty). Без пропа кнопка «Отмена» не показывается — её рисует сама
   * страница (см. EventEdit).
   */
  onCancel?: () => void;
  onSubmit: (payload: EventPayload) => void;
}

function toLocalParts(iso: string): { date: string; time: string } {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return { date: dayKey(new Date()), time: formatTime(new Date()) };
  return { date: dayKey(parsed), time: formatTime(parsed) };
}

function emptyGroup(items: { id: string; name: string }[] = []): TagGroup {
  return { saved: items, local: [] };
}

function toNumber(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  return Number(value);
}

export function EventForm({
  initial,
  submitLabel,
  submitting,
  formError,
  onCancel,
  onSubmit,
}: EventFormProps): ReactElement {
  const now = new Date();
  const initialParts = initial ? toLocalParts(initial.date) : { date: dayKey(now), time: formatTime(now) };
  const initialType = initial?.eventType ?? 'SEX';
  const initialPreset: string =
    !initial || (EVENT_TYPE_PRESETS as readonly string[]).includes(initialType)
      ? initialType
      : 'CUSTOM';

  const defaultValues: EventFormValues = {
    date: initialParts.date,
    time: initialParts.time,
    duration: initial?.duration === null || initial?.duration === undefined ? '' : String(initial.duration),
    status: initial?.status ?? 'occurred',
    eventType: initialPreset,
    customType: initial && initialPreset === 'CUSTOM' ? initialType : '',
    title: initial?.title ?? '',
    calories: initial?.calories === null || initial?.calories === undefined ? '' : String(initial.calories),
    heartRate:
      initial?.heartRate === null || initial?.heartRate === undefined ? '' : String(initial.heartRate),
    initiatedBy: initial?.initiatedBy ?? '',
    notes: initial?.notes ?? '',
  };

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
  } = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues,
    mode: 'onBlur',
  });

  const status = watch('status');
  const eventType = watch('eventType');

  const [rating, setRating] = useState<number | null>(initial?.rating ?? null);
  const [partnerIds, setPartnerIds] = useState<string[]>(initial?.partners.map((item) => item.id) ?? []);
  const [positionIds, setPositionIds] = useState<string[]>(
    initial?.positions.map((item) => item.id) ?? [],
  );
  const [moods, setMoods] = useState<TagGroup>(emptyGroup(initial?.moods));
  const [places, setPlaces] = useState<TagGroup>(emptyGroup(initial?.places));
  const [accessories, setAccessories] = useState<TagGroup>(emptyGroup(initial?.accessories));
  const [positionSearch, setPositionSearch] = useState('');

  const partnersQuery = usePartners();
  const positionsQuery = useAllPositions();

  const filteredPositions = useMemo(() => {
    const all = positionsQuery.data ?? [];
    const needle = positionSearch.trim().toLowerCase();
    const matched = needle
      ? all.filter((position) => position.name.toLowerCase().includes(needle))
      : all;
    return matched.slice(0, 60);
  }, [positionsQuery.data, positionSearch]);

  const toggle = (id: string, current: string[], setter: (value: string[]) => void): void => {
    setter(current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const submit = handleSubmit((values) => {
    const isTurndown = values.status === 'turndown';
    const useCustomType = !isTurndown && values.eventType === 'CUSTOM';
    const eventTypeValue = isTurndown ? 'TURNDOWN' : useCustomType ? values.customType.trim() : values.eventType;

    onSubmit({
      // При редактировании пустой заголовок шлём как '' (очистка), при создании — опускаем.
      title: initial ? values.title.trim() : values.title.trim() || undefined,
      eventType: eventTypeValue,
      isCustomType: useCustomType,
      date: new Date(`${values.date}T${values.time}`).toISOString(),
      duration: toNumber(values.duration),
      rating,
      notes: values.notes.trim() ? values.notes : null,
      calories: toNumber(values.calories),
      heartRate: toNumber(values.heartRate),
      initiatedBy: values.initiatedBy.trim() ? values.initiatedBy.trim() : null,
      partnerIds,
      positionIds,
      moodIds: moods.saved.map((item) => item.id),
      placeIds: places.saved.map((item) => item.id),
      accessoryIds: accessories.saved.map((item) => item.id),
    });
  });

  const typeFieldDisabled = status === 'turndown';

  /** Явный отказ от сохранения: при изменённой форме — подтверждение ухода. */
  const handleCancel = (): void => {
    if (isDirty && !window.confirm('Есть несохранённые изменения. Выйти без сохранения?')) return;
    onCancel?.();
  };

  // Сбой сохранения показываем баннером вверху формы — доскроливаем до него,
  // иначе пользователь, стоящий у кнопки, его не увидит.
  const errorBannerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (formError) errorBannerRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [formError]);

  return (
    <form onSubmit={submit} noValidate>
      {formError ? (
        <div
          ref={errorBannerRef}
          role="alert"
          className="mb-4 scroll-mt-20 rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-3 text-sm font-medium text-red-300"
        >
          {formError}
        </div>
      ) : null}

      <Card className="mb-4">
        <SectionTitle>Когда и что</SectionTitle>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Дата" htmlFor="ev-date" error={errors.date?.message}>
            <Input id="ev-date" type="date" invalid={Boolean(errors.date)} {...register('date')} />
          </Field>
          <Field label="Время" htmlFor="ev-time" error={errors.time?.message}>
            <Input id="ev-time" type="time" invalid={Boolean(errors.time)} {...register('time')} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Статус" htmlFor="ev-status" hint="Отказ кодируется типом TURNDOWN">
            <Select id="ev-status" {...register('status')}>
              <option value="occurred">Состоялось</option>
              <option value="planned">Запланировано</option>
              <option value="turndown">Отказ</option>
            </Select>
          </Field>
          <Field label="Длительность, мин" htmlFor="ev-duration" error={errors.duration?.message}>
            <Input
              id="ev-duration"
              inputMode="numeric"
              placeholder="например, 45"
              invalid={Boolean(errors.duration)}
              {...register('duration')}
            />
          </Field>
        </div>

        <Field label="Тип события" htmlFor="ev-type" error={errors.customType?.message}>
          <Select id="ev-type" disabled={typeFieldDisabled} {...register('eventType')}>
            {EVENT_TYPE_PRESETS.filter((item) => item !== 'CUSTOM').map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
            <option value="CUSTOM">Свой тип…</option>
          </Select>
          {typeFieldDisabled ? (
            <MutedText>При статусе «Отказ» тип события будет TURNDOWN.</MutedText>
          ) : null}
        </Field>

        {!typeFieldDisabled && eventType === 'CUSTOM' ? (
          <Field label="Свой тип" htmlFor="ev-custom-type" error={errors.customType?.message}>
            <Input
              id="ev-custom-type"
              placeholder="Например, POOL"
              maxLength={64}
              invalid={Boolean(errors.customType)}
              {...register('customType')}
            />
          </Field>
        ) : null}

        <Field label="Название (необязательно)" htmlFor="ev-title" error={errors.title?.message}>
          <Input id="ev-title" maxLength={200} placeholder="Короткая заметка в заголовке" {...register('title')} />
        </Field>
      </Card>

      <Card className="mb-4">
        <SectionTitle>Кто</SectionTitle>
        {partnersQuery.isLoading ? (
          <LoadingBlock label="Загрузка партнёров…" />
        ) : partnersQuery.isError ? (
          <ErrorText>Не удалось загрузить партнёров</ErrorText>
        ) : (partnersQuery.data ?? []).length === 0 ? (
          <MutedText>Партнёров пока нет — добавьте их во вкладке «Партнёры».</MutedText>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {(partnersQuery.data ?? []).map((partner) => {
              const active = partnerIds.includes(partner.id);
              return (
                <button
                  key={partner.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggle(partner.id, partnerIds, setPartnerIds)}
                  className={cx(
                    'rounded-full border px-3 py-1 text-xs transition-colors',
                    active
                      ? 'border-primary-400 bg-primary/20 text-primary-400'
                      : 'border-slate-700 text-slate-400 hover:bg-white/[0.06]',
                  )}
                >
                  {partner.name}
                  {partner.isPrimary ? ' ★' : ''}
                </button>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="mb-4">
        <SectionTitle>Позиции</SectionTitle>
        {positionsQuery.isLoading ? (
          <LoadingBlock label="Загрузка каталога…" />
        ) : positionsQuery.isError ? (
          <ErrorText>Не удалось загрузить позиции</ErrorText>
        ) : (
          <>
            <div className="relative mb-3">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                aria-hidden="true"
              />
              <Input
                aria-label="Поиск позиции"
                placeholder="Поиск по названию…"
                className="pl-9"
                value={positionSearch}
                onChange={(event) => setPositionSearch(event.target.value)}
              />
            </div>

            <div className="max-h-56 overflow-y-auto rounded-lg border border-white/10">
              {filteredPositions.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-slate-500">Ничего не найдено</p>
              ) : (
                filteredPositions.map((position) => {
                  const active = positionIds.includes(position.id);
                  return (
                    <button
                      key={position.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggle(position.id, positionIds, setPositionIds)}
                      className={cx(
                        'flex w-full items-center justify-between gap-2 border-b border-white/10 px-3 py-2 text-left text-xs transition-colors last:border-b-0',
                        active ? 'bg-primary/15 text-primary-400' : 'text-slate-300 hover:bg-white/[0.06]',
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <PositionIcon name={position.name} className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="truncate">{position.name}</span>
                      </div>
                      <span className="shrink-0 text-[10px] uppercase text-slate-500">
                        {position.category}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
            <MutedText>
              Выбрано: {positionIds.length}. Показано {filteredPositions.length} из{' '}
              {(positionsQuery.data ?? []).length}.
            </MutedText>
          </>
        )}
      </Card>

      <Card className="mb-4">
        <SectionTitle>Детали</SectionTitle>

        <div className="mb-4">
          <p className="mb-1 block text-xs font-medium text-slate-400">Оценка</p>
          <Stars value={rating} onChange={setRating} onClear={() => setRating(null)} size="md" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Калории" htmlFor="ev-cal" error={errors.calories?.message}>
            <Input id="ev-cal" inputMode="numeric" placeholder="0" invalid={Boolean(errors.calories)} {...register('calories')} />
          </Field>
          <Field label="Пульс, уд/мин" htmlFor="ev-hr" error={errors.heartRate?.message}>
            <Input id="ev-hr" inputMode="numeric" placeholder="0" invalid={Boolean(errors.heartRate)} {...register('heartRate')} />
          </Field>
        </div>

        <Field label="Инициатор" htmlFor="ev-init" error={errors.initiatedBy?.message}>
          <Input id="ev-init" maxLength={100} placeholder="Кто инициировал" {...register('initiatedBy')} />
        </Field>

        <TagInput
          label="Настроения"
          placeholder="Например, нежное"
          group={moods}
          onChange={setMoods}
        />
        <TagInput label="Места" placeholder="Например, дома" group={places} onChange={setPlaces} />
        <TagInput
          label="Аксессуары"
          placeholder="Например, свечи"
          group={accessories}
          onChange={setAccessories}
        />

        <Field label="Заметки" htmlFor="ev-notes" error={errors.notes?.message}>
          <TextArea id="ev-notes" maxLength={20_000} placeholder="Заметка (хранится в зашифрованном виде)" {...register('notes')} />
        </Field>
      </Card>

      <div className="flex gap-2">
        {onCancel ? (
          <Button
            type="button"
            variant="ghost"
            className="flex-1"
            disabled={submitting}
            onClick={handleCancel}
          >
            Отмена
          </Button>
        ) : null}
        <Button type="submit" className={onCancel ? 'flex-1' : 'w-full'} disabled={submitting}>
          {submitting ? 'Сохраняем…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
