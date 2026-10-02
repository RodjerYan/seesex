/**
 * EventForm — создание/редактирование события (RHF + zod).
 *
 * Поля по спеке: дата/время, длительность, eventType (+свой тип), партнёры
 * (мультивыбор), настроения/места/аксессуары
 * (free-text чипы — см. TagInput), оценка 1–5, калории, пульс, инициатор,
 * заметки, статус (occurred/planned/turndown).
 *
 * Статус: бэкенд статус НЕ хранит — он выводится из даты и eventType
 * (TURNDOWN/REFUSED => «отказ»). Поэтому «отказ» => eventType=TURNDOWN,
 * а planned/occurred сверяются с датой (валидация в схеме).
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, Plus } from 'lucide-react';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { dayKey, formatTime } from '../../lib/format';
import { eventMeta } from '../../lib/eventMeta';
import { usePartners } from '../../lib/queries';
import type { EventView } from '../../types/api';
import { Stars } from '../ui/Stars';
import { Button, Card, ErrorText, Field, Input, MutedText, SectionTitle, Select, TextArea, cx } from '../ui/controls';
import { LoadingBlock } from '../ui/states';
import { TagInput, type TagGroup } from './TagInput';

/** Пресеты типов событий; свой тип уходит как isCustomType=true. */
const EVENT_TYPE_PRESETS = ['SEX', 'KISS', 'MASSAGE', 'ORAL', 'ANAL', 'OTHER', 'CUSTOM'] as const;

const PRESET_SET = new Set(EVENT_TYPE_PRESETS);

export type EventStatusValue = 'occurred' | 'planned' | 'turndown';

export interface EventPayload {
  title?: string;
  eventType?: string; // legacy: first element of eventTypes for backward compatibility
  eventTypes: string[];
  isCustomType: boolean;
  date: string;
  duration: number | null;
  rating: number | null;
  notes: string | null;
  calories: number | null;
  heartRate: number | null;
  initiatedBy: string | null;
  partnerIds: string[];
  moodIds: string[];
  placeIds: string[];
  accessoryIds: string[];
}

interface EventFormValues {
  date: string;
  time: string;
  duration: string;
  status: EventStatusValue;
  selectedTypes: string[];
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
    selectedTypes: z.array(z.string()).min(1, 'Выберите хотя бы один тип события'),
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
    // Note: selectedTypes and customType validation is done manually in submit handler
    // because zod doesn't have access to the selectedTypes state for conditional validation
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

  // Initialize selectedTypes from initial.eventTypes (new) or fall back to initial.eventType (legacy)
  // Split into preset types (known in EVENT_TYPE_PRESETS) and unknown types (custom from DB)
  const rawInitialTypes = initial?.eventTypes?.length
    ? initial.eventTypes
    : initial?.eventType
      ? [initial.eventType]
      : ['SEX'];

  const isPreset = (t: string): t is (typeof EVENT_TYPE_PRESETS)[number] => PRESET_SET.has(t as (typeof EVENT_TYPE_PRESETS)[number]);
  const presetTypes = rawInitialTypes.filter(isPreset);
  const unknownTypes = rawInitialTypes.filter((t) => !isPreset(t));
  const initialSelectedTypes = [...presetTypes, ...unknownTypes];

  const defaultValues: EventFormValues = {
    date: initialParts.date,
    time: initialParts.time,
    duration: initial?.duration === null || initial?.duration === undefined ? '' : String(initial.duration),
    status: initial?.status ?? 'occurred',
    selectedTypes: initialSelectedTypes,
    customType:
      initial &&
      initialSelectedTypes.includes('CUSTOM') &&
      !isPreset(initial.eventType)
        ? initial.eventType
        : '',
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
    setValue,
    setError,
    formState: { errors, isDirty },
  } = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues,
    mode: 'onBlur',
  });

  const status = watch('status');
  const selectedTypes = watch('selectedTypes');

  const [rating, setRating] = useState<number | null>(initial?.rating ?? null);
  const [partnerIds, setPartnerIds] = useState<string[]>(initial?.partners.map((item) => item.id) ?? []);
  const [moods, setMoods] = useState<TagGroup>(emptyGroup(initial?.moods));
  const [places, setPlaces] = useState<TagGroup>(emptyGroup(initial?.places));
  const [accessories, setAccessories] = useState<TagGroup>(emptyGroup(initial?.accessories));

  const partnersQuery = usePartners();

  const toggle = (id: string, current: string[], setter: (value: string[]) => void): void => {
    setter(current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const submit = handleSubmit((values) => {
    const isTurndown = values.status === 'turndown';
    const currentSelectedTypes = values.selectedTypes ?? [];

    // Manual validation for multi-select
    if (currentSelectedTypes.length === 0) {
      setError('selectedTypes', { type: 'manual', message: 'Выберите хотя бы один тип события' });
      return;
    }

    // Check if CUSTOM is selected but no custom type name provided
    const hasCustom = currentSelectedTypes.includes('CUSTOM');
    const customTypeName = values.customType?.trim() ?? '';
    if (!isTurndown && hasCustom && !customTypeName) {
      setError('customType', { type: 'manual', message: 'Укажите название своего типа' });
      return;
    }

    // Build final eventTypes array
    let finalTypes: string[];
    if (isTurndown) {
      finalTypes = ['TURNDOWN'];
    } else {
      finalTypes = currentSelectedTypes.map((t: string) => (t === 'CUSTOM' ? customTypeName : t));
    }

    // Determine isCustomType: true if any custom type was used (CUSTOM in selection and has name)
    const useCustomType = !isTurndown && hasCustom && Boolean(customTypeName);

    onSubmit({
      // При редактировании пустой заголовок шлём как '' (очистка), при создании — опускаем.
      title: initial ? values.title.trim() : values.title.trim() || undefined,
      eventType: finalTypes[0], // legacy: first type for backward compatibility
      eventTypes: finalTypes,
      isCustomType: useCustomType,
      date: new Date(`${values.date}T${values.time}`).toISOString(),
      duration: toNumber(values.duration),
      rating,
      notes: values.notes.trim() ? values.notes : null,
      calories: toNumber(values.calories),
      heartRate: toNumber(values.heartRate),
      initiatedBy: values.initiatedBy.trim() ? values.initiatedBy.trim() : null,
      partnerIds,
      moodIds: moods.saved.map((item) => item.id),
      placeIds: places.saved.map((item) => item.id),
      accessoryIds: accessories.saved.map((item) => item.id),
    });
  });

  const typeFieldDisabled = status === 'turndown';

  /** Toggle a type in the multi-select selection. */
  const toggleType = (type: string): void => {
    const current = selectedTypes;
    const next = current.includes(type) ? current.filter((t) => t !== type) : [...current, type];
    setValue('selectedTypes', next, { shouldDirty: true, shouldValidate: true });
  };

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

        {/* Дата и Время — одна строка, 2 колонки (EF-004). Наезд нативного
            datetime-контрола (intrinsic-width datetime-edit в iOS Safari)
            убран appearance:none в index.css (EF-001) — overflow-hidden и
            full-width костыли больше не нужны. */}
        <div className="grid grid-cols-2 gap-3 min-w-0">
          <Field label="Дата" htmlFor="ev-date" error={errors.date?.message}>
            <Input
              id="ev-date"
              type="date"
              invalid={Boolean(errors.date)}
              {...register('date')}
            />
          </Field>
          <Field label="Время" htmlFor="ev-time" error={errors.time?.message}>
            <Input
              id="ev-time"
              type="time"
              invalid={Boolean(errors.time)}
              {...register('time')}
            />
          </Field>
        </div>

        {/* Статус/Длительность остаются в 2 колонки: нативного bleed у этих
            контролов нет. min-w-0 у ячеек — чтобы ошибка (p.mt-1) переносилась
            внутри своей ячейки и не распирала соседнюю: у grid по умолчанию
            align-items:stretch, ячейки растут по высоте строки, контент — сверху,
            наездов строк быть не может. */}
        <div className="grid grid-cols-2 gap-3 min-w-0">
          <Field label="Статус" htmlFor="ev-status">
            <div className="relative min-w-0">
              {/* «Запланировано» (≈117px) + шеврон: расширяем текстовую зону —
                  padLeft 10 вместо 12, padRight 26 (было 32) и шеврон 14px:
                  тексту остаётся 120px, до шеврона ≈3px. tracking-tight —
                  запас, если letter-spacing применится к нативному select. */}
              <Select
                id="ev-status"
                className="appearance-none min-h-[44px] tracking-tight"
                style={{ paddingLeft: 10, paddingRight: 26 }}
                {...register('status')}
              >
                <option value="occurred">Состоялось</option>
                <option value="planned">Запланировано</option>
                <option value="turndown">Отказ</option>
              </Select>
              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
            </div>
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

        {/* Тип события — чипы с мультивыбором (multi-select).
            Значение хранится в selectedTypes (string[]), переключаем через toggleType. */}
        <Field label="Тип события" error={errors.selectedTypes?.message ?? errors.customType?.message}>
          <div
            role="group"
            aria-label="Тип события"
            data-testid="event-type-chips"
            className="flex flex-wrap gap-2"
          >
            {EVENT_TYPE_PRESETS.map((item) => {
              const meta = eventMeta(item);
              const active = selectedTypes.includes(item);
              const isCustom = item === 'CUSTOM';
              const Icon = isCustom ? Plus : meta.Icon;
              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleType(item)}
                  className={cx(
                    'inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                    active
                      ? 'border-primary-400 bg-primary/20 text-primary-400'
                      : 'border-slate-700 text-slate-400 hover:bg-white/[0.06]',
                    typeFieldDisabled && 'cursor-not-allowed opacity-50',
                  )}
                >
                  <Icon
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0"
                    style={active ? undefined : { color: meta.color }}
                  />
                  {isCustom ? 'Свой тип…' : meta.label}
                </button>
              );
            })}
            {/* Unknown types from DB (custom types not in presets, excluding CUSTOM) */}
            {selectedTypes
              .filter((t) => !isPreset(t))
              .map((type) => {
                const meta = eventMeta(type);
                return (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={true}
                    onClick={() => toggleType(type)}
                    className={cx(
                      'inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                      'border-primary-400 bg-primary/20 text-primary-400',
                      typeFieldDisabled && 'cursor-not-allowed opacity-50',
                    )}
                  >
                    <meta.Icon
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0"
                    />
                    {meta.label}
                  </button>
                );
              })}
          </div>
          {typeFieldDisabled ? (
            <MutedText>При статусе «Отказ» событие сохранится как отказ.</MutedText>
          ) : null}
        </Field>

        {!typeFieldDisabled && selectedTypes.includes('CUSTOM') ? (
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
        <SectionTitle>Детали</SectionTitle>

        <div className="mb-4">
          <p className="mb-1 block text-xs font-medium text-slate-400">Оценка</p>
          <Stars value={rating} onChange={setRating} onClear={() => setRating(null)} size="md" />
        </div>

        <div className="grid grid-cols-2 gap-3 min-w-0">
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
