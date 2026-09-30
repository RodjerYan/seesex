/**
 * Скачивание экспорта (POST /api/export/json|csv) как Blob.
 * Отдельно от api.ts: нужен Content-Disposition (имя файла) и text/csv,
 * а request() всегда разбирает JSON.
 */

import { ApiError, rawRequest } from './api';

export type ExportKind = 'json' | 'csv';

const FALLBACK_NAME: Record<ExportKind, string> = {
  json: 'seesex-export.json',
  csv: 'seesex-events.csv',
};

function filenameFrom(header: string | null, kind: ExportKind): string {
  if (!header) return FALLBACK_NAME[kind];
  const match = /filename="?([^";]+)"?/i.exec(header);
  return match?.[1] ?? FALLBACK_NAME[kind];
}

/** Запрашивает экспорт и запускает скачивание файла. */
export async function downloadExport(kind: ExportKind): Promise<string> {
  const response = await rawRequest(`/api/export/${kind}`, { method: 'POST', body: {} });

  if (!response.ok) {
    let code = `HTTP_${response.status}`;
    let message = `Export failed with status ${response.status}`;
    try {
      const data = (await response.json()) as { error?: { code?: string; message?: string } };
      if (data.error?.code) code = data.error.code;
      if (data.error?.message) message = data.error.message;
    } catch {
      // Не JSON — оставляем общий текст.
    }
    throw new ApiError(response.status, code, message);
  }

  const blob = await response.blob();
  const name = filenameFrom(response.headers.get('Content-Disposition'), kind);
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // revoke позже: иначе Safari может не успеть начать скачивание.
  window.setTimeout(() => URL.revokeObjectURL(href), 10_000);
  return name;
}
