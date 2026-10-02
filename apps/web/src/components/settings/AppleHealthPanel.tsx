/**
 * Настройки → Apple Health (T-20261002-019 / H3):
 *  - статус device-токена (подключено/не подключено, число токенов, дата синхронизации);
 *  - создание/отзыв токена (показывается один раз — с копированием);
 *  - пошаговая инструкция подключения шортката на iPhone и «как это работает».
 */
import { Check, Copy, Heart, Info, Smartphone, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';

import { Button, Card, ErrorText, SectionTitle, cx } from '../ui/controls';
import { ErrorBlock, LoadingBlock } from '../ui/states';
import { errorMessage } from '../../lib/errors';
import { formatDateTime } from '../../lib/format';
import { HEALTH_STATUS_LABEL, tr } from '../../lib/labels';
import { useCreateHealthToken, useHealthTokenStatus, useRevokeHealthToken } from '../../lib/queries';

/** URL приёма проб — шорткат шлёт POST сюда (прод-хост, показываем как есть). */
const APPLE_INGEST_URL = 'https://xtracker-web-2xn8.onrender.com/api/health/apple';

/** Имя шортката для шага инструкции (должно совпадать с lib/appleHealth.ts). */
const SHORTCUT_NAME = 'XTracker Health';

/** Заголовки запроса шортката (копируются построчно). */
const HEADER_AUTH = 'Authorization: Bearer <твой токен>';
const HEADER_CONTENT_TYPE = 'Content-Type: application/json';

/** Рабочий пример тела POST /api/health/apple — плейсхолдеры вместо реальных значений. */
const EXAMPLE_BODY = `{
  "eventId": "<uuid события>",
  "samples": [
    { "type": "heartRate", "start": "<ISO дата/время события>", "end": "<ISO start + длительность>", "value": 88 },
    { "type": "activeEnergy", "start": "<ISO дата/время события>", "end": "<ISO start + длительность>", "value": 181 }
  ]
}`;

/** Успешный ответ шортката при проверке (шаг 6). */
const EXAMPLE_RESPONSE = '{ "ok": true }';

/** Копирование в буфер: одна подсветка «скопировано» на 2 сек. (как в GroupCalendarView). */
function useCopy(): { copiedKey: string | null; copyError: boolean; copy: (key: string) => void } {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copyError, setCopyError] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Гасим таймер при размонтировании — иначе setState после ухода со страницы.
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const copy = (value: string): void => {
    void navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopyError(false);
        setCopiedKey(value);
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => setCopiedKey(null), 2000);
      })
      .catch(() => {
        setCopiedKey(null);
        setCopyError(true);
      });
  };

  return { copiedKey, copyError, copy };
}

/** Строка «метка + значение с кнопкой копирования» (URL, заголовки, JSON). */
function CopyRow({
  label,
  value,
  copied,
  copyError,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  copyError: boolean;
  onCopy: (value: string) => void;
}): ReactElement {
  return (
    <div className="mb-2 min-w-0">
      <p className="mb-1 text-[11px] text-slate-500">{label}</p>
      <div className="flex items-start gap-2">
        <code className="min-w-0 flex-1 whitespace-pre-wrap break-all rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-slate-200">
          {value}
        </code>
        <button
          type="button"
          aria-label={`Скопировать: ${label}`}
          onClick={() => onCopy(value)}
          className={cx(
            'press flex h-8 shrink-0 items-center gap-1 rounded-lg border px-2 text-[11px] transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
            copied
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
              : 'border-white/10 bg-white/[0.06] text-slate-300 hover:bg-white/[0.12]',
          )}
        >
          {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
          {copied ? 'Скопировано' : 'Копировать'}
        </button>
      </div>
      {copyError ? <p className="mt-1 text-[11px] text-red-400">Не удалось скопировать — скопируйте вручную.</p> : null}
    </div>
  );
}

/** Шаг инструкции: номер + текст. */
function Step({ n, children }: { n: number; children: ReactNode }): ReactElement {
  return (
    <li className="flex gap-2.5">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[10px] font-semibold text-slate-400">
        {n}
      </span>
      <div className="min-w-0 text-xs leading-relaxed text-slate-300">{children}</div>
    </li>
  );
}

/** Панель «Apple Health» для страницы настроек.
 * Локализация: enum-значения — через tr()/HEALTH_STATUS_LABEL (labels.ts);
 * тексты инструкции намеренно захардкожены по-русски (приложение русскоязычное,
 * инструкция — разовая справка, не интерфейсная строка). */
export function AppleHealthPanel(): ReactElement {
  const statusQuery = useHealthTokenStatus();
  const createToken = useCreateHealthToken();
  const revokeToken = useRevokeHealthToken();

  /** Токен живёт только до перезагрузки страницы — на сервере он не отдаётся. */
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const { copiedKey, copyError, copy } = useCopy();

  const status = statusQuery.data;
  const hasToken = status?.hasToken ?? false;

  const onCreate = (): void => {
    createToken.mutate(undefined, {
      onSuccess: (data) => setCreatedToken(data.token),
    });
  };

  const onRevoke = (): void => {
    if (!window.confirm('Отозвать токен? Шорткат перестанет отправлять данные до создания нового.')) return;
    revokeToken.mutate(undefined, {
      onSuccess: () => setCreatedToken(null),
    });
  };

  return (
    <>
      <Card className="mb-4">
        <SectionTitle>Apple Health</SectionTitle>

        {statusQuery.isLoading ? (
          <LoadingBlock label="Загрузка статуса…" />
        ) : statusQuery.isError ? (
          <ErrorBlock error={statusQuery.error} onRetry={() => void statusQuery.refetch()} />
        ) : status ? (
          <dl>
            <div className="flex items-start justify-between gap-4 border-b border-white/10 py-2">
              <dt className="text-xs text-slate-500">Статус</dt>
              <dd className={cx('text-sm font-medium', hasToken ? 'text-emerald-300' : 'text-slate-200')}>
                <span className="inline-flex items-center gap-1.5">
                  <Heart className="h-3.5 w-3.5" aria-hidden="true" />
                  {tr(HEALTH_STATUS_LABEL, hasToken ? 'connected' : 'disconnected')}
                </span>
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4 border-b border-white/10 py-2">
              <dt className="text-xs text-slate-500">Токенов</dt>
              <dd className="text-sm text-slate-200">{status.tokensCount}</dd>
            </div>
            <div className="flex items-start justify-between gap-4 py-2">
              <dt className="text-xs text-slate-500">Последняя синхронизация</dt>
              <dd className="text-right text-sm text-slate-200">{formatDateTime(status.lastSyncAt)}</dd>
            </div>
          </dl>
        ) : null}

        {createToken.isError ? <ErrorText>{errorMessage(createToken.error)}</ErrorText> : null}
        {revokeToken.isError ? <ErrorText>{errorMessage(revokeToken.error)}</ErrorText> : null}

        {hasToken ? (
          <Button variant="danger" className="mt-3 w-full" onClick={onRevoke} disabled={revokeToken.isPending}>
            {revokeToken.isPending ? 'Отзываем…' : 'Отозвать токен'}
          </Button>
        ) : (
          <Button className="mt-3 w-full" onClick={onCreate} disabled={createToken.isPending}>
            {createToken.isPending ? 'Создаём…' : 'Создать токен'}
          </Button>
        )}

        {createdToken ? (
          <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
              <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Новый токен — показывается один раз
            </p>
            <div className="mt-2 flex items-start gap-2">
              <code className="min-w-0 flex-1 break-all rounded-lg bg-black/40 px-2 py-1.5 font-mono text-xs text-slate-100">
                {createdToken}
              </code>
              <button
                type="button"
                aria-label="Скопировать токен"
                onClick={() => copy(createdToken)}
                className={cx(
                  'press flex h-8 shrink-0 items-center gap-1 rounded-lg border px-2 text-[11px] transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                  copiedKey === createdToken
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-white/10 bg-white/[0.06] text-slate-300 hover:bg-white/[0.12]',
                )}
              >
                {copiedKey === createdToken ? (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {copiedKey === createdToken ? 'Скопировано' : 'Копировать'}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-amber-200/90">
              Сохрани его — снова мы его не покажем. Вставь его в шорткат (шаг 4).
            </p>
          </div>
        ) : null}
      </Card>

      <Card className="mb-4">
        <SectionTitle>Как подключить на iPhone</SectionTitle>
        <ol className="space-y-3">
          <Step n={1}>
            Откройте <span className="font-medium text-slate-200">Шорткаты</span> на iPhone → «+» →{' '}
            <span className="font-medium text-slate-200">Создать шорткат</span>.
          </Step>
          <Step n={2}>
            Добавьте действие <span className="font-medium text-slate-200">«Получить пробы из Здоровья»</span> и
            выберите типы проб: <span className="font-medium text-slate-200">Пульс (Heart Rate)</span> и{' '}
            <span className="font-medium text-slate-200">Активная энергия (Active Energy Burned)</span>.
          </Step>
          <Step n={3}>
            Окно выбора проб задаётся событием:{' '}
            <span className="font-medium text-slate-200">start</span> — дата/время события,{' '}
            <span className="font-medium text-slate-200">end</span> — start + длительность события.
          </Step>
          <Step n={4}>
            <p className="mb-1.5">
              Добавьте действие{' '}
              <span className="font-medium text-slate-200">«Получить содержимое URL»</span> (метод{' '}
              <span className="font-medium text-slate-200">POST</span>) и заполните:
            </p>
            <CopyRow
              label="URL"
              value={APPLE_INGEST_URL}
              copied={copiedKey === APPLE_INGEST_URL}
              copyError={copyError}
              onCopy={copy}
            />
            <CopyRow
              label="Заголовок"
              value={HEADER_AUTH}
              copied={copiedKey === HEADER_AUTH}
              copyError={copyError}
              onCopy={copy}
            />
            <CopyRow
              label="Заголовок"
              value={HEADER_CONTENT_TYPE}
              copied={copiedKey === HEADER_CONTENT_TYPE}
              copyError={copyError}
              onCopy={copy}
            />
            <CopyRow
              label="Тело запроса (JSON, вставить в «Тело запроса → JSON»)"
              value={EXAMPLE_BODY}
              copied={copiedKey === EXAMPLE_BODY}
              copyError={copyError}
              onCopy={copy}
            />
            <p className="text-[11px] text-slate-500">
              Значения полей подставляй своими: eventId — из input шортката, даты — по окну события.
            </p>
          </Step>
          <Step n={5}>
            <p className="mb-1.5">
              Назовите шорткат ровно{' '}
              <span className="font-medium text-slate-200">«{SHORTCUT_NAME}»</span> — это имя веб вызывает после
              сохранения события:
            </p>
            <CopyRow
              label="Название шортката"
              value={SHORTCUT_NAME}
              copied={copiedKey === SHORTCUT_NAME}
              copyError={copyError}
              onCopy={copy}
            />
          </Step>
          <Step n={6}>
            <p className="mb-1.5">
              Запустите шорткат вручную для проверки — должен вернуться JSON вида:
            </p>
            <CopyRow
              label="Ожидаемый ответ"
              value={EXAMPLE_RESPONSE}
              copied={copiedKey === EXAMPLE_RESPONSE}
              copyError={copyError}
              onCopy={copy}
            />
          </Step>
        </ol>
      </Card>

      <Card>
        <SectionTitle>Как это работает</SectionTitle>
        <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-400">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-400" aria-hidden="true" />
          <span>
            После сохранения события веб откроет Шорткаты — подтвердите запуск одним тапом (ограничение iOS).
            Шорткат пришлёт пробы из Здоровья на сервер, и событие покажет пульс и калории.
          </span>
        </p>
        <p className="mt-2 flex items-start gap-2 text-xs leading-relaxed text-slate-400">
          <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-400" aria-hidden="true" />
          <span>Работает только на iPhone/iPad — на других устройствах автоматический запуск шортката не происходит.</span>
        </p>
      </Card>
    </>
  );
}
