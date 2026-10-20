/**
 * Минимальный клиент Google Drive API (OAuth refresh-token пользователя).
 *
 * Используется только сервером: токен обновляется по refresh-token из env,
 * файл БД читается/пишется в папку, созданную этим же приложением
 * (scope drive.file — доступ только к своим файлам).
 */

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
export const DB_FILE_NAME = 'seesex.db';

type TokenCache = { accessToken: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

export function driveConfigured(): boolean {
  return Boolean(
    env('GOOGLE_CLIENT_ID') &&
      env('GOOGLE_CLIENT_SECRET') &&
      env('GOOGLE_REFRESH_TOKEN') &&
      env('GOOGLE_DRIVE_FOLDER_ID'),
  );
}

/** Access-token по refresh-token; кэшируется до истечения. */
async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.accessToken;
  }

  const clientId = env('GOOGLE_CLIENT_ID');
  const clientSecret = env('GOOGLE_CLIENT_SECRET');
  const refreshToken = env('GOOGLE_REFRESH_TOKEN');
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google Drive credentials are not configured');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google token refresh failed: ${res.status} ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in?: number };
  tokenCache = {
    accessToken: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return json.access_token;
}

async function driveFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(`${DRIVE_API}${path}`, { ...init, headers });
}

/** id файла БД в папке приложения (или null, если файла ещё нет). */
async function findDatabaseFile(): Promise<string | null> {
  const folderId = env('GOOGLE_DRIVE_FOLDER_ID');
  if (!folderId) return null;
  const q = `name='${DB_FILE_NAME}' and '${folderId}' in parents and trashed=false`;
  const res = await driveFetch(
    `/files?q=${encodeURIComponent(q)}&fields=files(id,name,size,modifiedTime)&supportAllDrives=true`,
    { signal: AbortSignal.timeout(20_000) },
  );
  if (!res.ok) {
    throw new Error(`Drive list failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  const json = (await res.json()) as { files?: { id: string }[] };
  return json.files && json.files.length > 0 ? json.files[0].id : null;
}

/** Скачать файл БД из Drive. null — файла нет (первый запуск). */
export async function downloadDatabase(): Promise<Buffer | null> {
  const fileId = await findDatabaseFile();
  if (!fileId) return null;

  const res = await driveFetch(`/files/${fileId}?alt=media&supportAllDrives=true`, {
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    throw new Error(`Drive download failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function buildMultipart(metadata: Record<string, unknown>, content: Buffer): {
  body: Buffer;
  contentType: string;
} {
  const boundary = `seesex_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const head = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`,
    'utf8',
  );
  const tail = Buffer.from(`\r\n--${boundary}--`, 'utf8');
  return {
    body: Buffer.concat([head, content, tail]),
    contentType: `multipart/related; boundary=${boundary}`,
  };
}

/** Загрузить файл БД в Drive (создать или обновить существующий). */
export async function uploadDatabase(content: Buffer): Promise<void> {
  const folderId = env('GOOGLE_DRIVE_FOLDER_ID');
  if (!folderId) throw new Error('GOOGLE_DRIVE_FOLDER_ID is not configured');

  const existingId = await findDatabaseFile();
  if (existingId) {
    const res = await fetch(
      `${DRIVE_UPLOAD}/files/${existingId}?uploadType=media&supportAllDrives=true`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${await getAccessToken()}`,
          'Content-Type': 'application/octet-stream',
        },
        body: new Uint8Array(content),
        signal: AbortSignal.timeout(120_000),
      },
    );
    if (!res.ok) {
      throw new Error(`Drive update failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
    }
    return;
  }

  const { body, contentType } = buildMultipart(
    { name: DB_FILE_NAME, parents: [folderId] },
    content,
  );
  const res = await fetch(
    `${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id,name,size&supportAllDrives=true`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await getAccessToken()}`,
        'Content-Type': contentType,
      },
      body: new Uint8Array(body),
      signal: AbortSignal.timeout(120_000),
    },
  );
  if (!res.ok) {
    throw new Error(`Drive upload failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
}
