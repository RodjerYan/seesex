/** Форма партнёра (создание/редактирование): базовые поля + динамические customFields. */
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, X } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { PartnerView } from '../../types/api';
import { Button, Card, Field, Input, SectionTitle, Select, cx } from '../ui/controls';

const GENDERS = ['', 'female', 'male', 'non-binary', 'other'];
const ORIENTATIONS = ['', 'heterosexual', 'homosexual', 'bisexual', 'pansexual', 'asexual', 'other'];
const RELATIONSHIPS = ['', 'single', 'dating', 'partner', 'married', 'complicated', 'other'];

const partnerSchema = z.object({
  name: z.string().trim().min(1, 'Укажите имя').max(120),
  nickname: z.string().max(120),
  gender: z.string().max(60),
  sexualOrientation: z.string().max(60),
  pronouns: z.string().max(60),
  relationshipStatus: z.string().max(60),
  isPrimary: z.boolean(),
});

type PartnerFormValues = z.infer<typeof partnerSchema>;

export interface PartnerPayload {
  name: string;
  nickname: string | null;
  gender: string | null;
  sexualOrientation: string | null;
  pronouns: string | null;
  relationshipStatus: string | null;
  isPrimary: boolean;
  customFields: Record<string, string> | null;
}

interface PartnerFormProps {
  initial?: PartnerView;
  submitLabel: string;
  submitting: boolean;
  formError?: string | null;
  onSubmit: (payload: PartnerPayload) => void;
}

interface CustomPair {
  key: string;
  value: string;
}

function pairsFrom(values: Record<string, unknown> | null): CustomPair[] {
  if (!values) return [];
  return Object.entries(values)
    .filter(([, value]) => typeof value === 'string' || typeof value === 'number')
    .map(([key, value]) => ({ key, value: String(value) }));
}

export function PartnerForm({
  initial,
  submitLabel,
  submitting,
  formError,
  onSubmit,
}: PartnerFormProps): ReactElement {
  const [pairs, setPairs] = useState<CustomPair[]>(() => pairsFrom(initial?.customFields ?? null));

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PartnerFormValues>({
    resolver: zodResolver(partnerSchema),
    defaultValues: {
      name: initial?.name ?? '',
      nickname: initial?.nickname ?? '',
      gender: initial?.gender ?? '',
      sexualOrientation: initial?.sexualOrientation ?? '',
      pronouns: initial?.pronouns ?? '',
      relationshipStatus: initial?.relationshipStatus ?? '',
      isPrimary: initial?.isPrimary ?? false,
    },
  });

  const isPrimary = watch('isPrimary');

  const submit = handleSubmit((values) => {
    const custom: Record<string, string> = {};
    for (const pair of pairs) {
      const key = pair.key.trim();
      if (key) custom[key] = pair.value;
    }
    onSubmit({
      name: values.name.trim(),
      nickname: values.nickname.trim() || null,
      gender: values.gender || null,
      sexualOrientation: values.sexualOrientation || null,
      pronouns: values.pronouns.trim() || null,
      relationshipStatus: values.relationshipStatus || null,
      isPrimary: values.isPrimary,
      customFields: Object.keys(custom).length > 0 ? custom : null,
    });
  });

  const updatePair = (index: number, patch: Partial<CustomPair>): void => {
    setPairs((current) => current.map((pair, i) => (i === index ? { ...pair, ...patch } : pair)));
  };

  return (
    <form onSubmit={submit} noValidate>
      <Card className="mb-4">
        <SectionTitle>Основное</SectionTitle>

        <Field label="Имя *" htmlFor="pf-name" error={errors.name?.message}>
          <Input id="pf-name" maxLength={120} invalid={Boolean(errors.name)} {...register('name')} />
        </Field>

        <Field label="Прозвище" htmlFor="pf-nickname" error={errors.nickname?.message}>
          <Input id="pf-nickname" maxLength={120} {...register('nickname')} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Пол" htmlFor="pf-gender">
            <Select id="pf-gender" {...register('gender')}>
              {GENDERS.map((value) => (
                <option key={value || 'none'} value={value}>
                  {value || 'Не указано'}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ориентация" htmlFor="pf-orientation">
            <Select id="pf-orientation" {...register('sexualOrientation')}>
              {ORIENTATIONS.map((value) => (
                <option key={value || 'none'} value={value}>
                  {value || 'Не указано'}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Местоимения" htmlFor="pf-pronouns" error={errors.pronouns?.message}>
            <Input id="pf-pronouns" placeholder="она/её" maxLength={60} {...register('pronouns')} />
          </Field>
          <Field label="Статус отношений" htmlFor="pf-relationship">
            <Select id="pf-relationship" {...register('relationshipStatus')}>
              {RELATIONSHIPS.map((value) => (
                <option key={value || 'none'} value={value}>
                  {value || 'Не указано'}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-600 bg-white/[0.08] text-primary focus:ring-primary-400"
            checked={isPrimary}
            onChange={(event) => setValue('isPrimary', event.target.checked)}
          />
          Основной партнёр
        </label>
      </Card>

      <Card className="mb-4">
        <SectionTitle>Дополнительные поля</SectionTitle>
        {pairs.map((pair, index) => (
          <div key={index} className="mb-2 flex gap-2">
            <Input
              aria-label={`Название поля ${index + 1}`}
              placeholder="Название"
              value={pair.key}
              onChange={(event) => updatePair(index, { key: event.target.value })}
            />
            <Input
              aria-label={`Значение поля ${index + 1}`}
              placeholder="Значение"
              value={pair.value}
              onChange={(event) => updatePair(index, { value: event.target.value })}
            />
            <button
              type="button"
              aria-label="Удалить поле"
              onClick={() => setPairs((current) => current.filter((_, i) => i !== index))}
              className="shrink-0 rounded-lg border border-slate-700 px-3 text-slate-400 hover:bg-white/[0.06] hover:text-red-400"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setPairs((current) => [...current, { key: '', value: '' }])}
          className={cx(
            'flex items-center gap-1 rounded-lg border border-dashed border-slate-700 px-3 py-2 text-xs text-slate-400',
            'transition-colors hover:border-primary-400 hover:text-primary-400',
          )}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Добавить поле
        </button>
      </Card>

      {formError ? (
        <p role="alert" className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {formError}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? 'Сохраняем…' : submitLabel}
      </Button>
    </form>
  );
}
