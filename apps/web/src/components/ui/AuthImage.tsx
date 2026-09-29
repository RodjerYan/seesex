/**
 * Изображение с авторизацией.
 *
 * GET /api/files требует Bearer JWT, поэтому <img src> напрямую не работает —
 * файл забираем fetch'ем с токеном и показываем через object URL.
 */
import { ImageOff, Loader2 } from 'lucide-react';
import { useEffect, useState, type ReactElement } from 'react';

import { rawRequest } from '../../lib/api';

interface AuthImageProps {
  /** Относительный url вида /api/files?path=events/<file>. */
  src: string;
  alt: string;
  className?: string;
}

export function AuthImage({ src, alt, className }: AuthImageProps): ReactElement {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setUrl(null);
    setFailed(false);

    void (async () => {
      try {
        const response = await rawRequest(src, { method: 'GET' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-white/[0.08] text-slate-600 ${className ?? ''}`}
        role="img"
        aria-label={alt}
      >
        <ImageOff className="h-5 w-5" aria-hidden="true" />
      </div>
    );
  }

  if (!url) {
    return (
      <div
        className={`flex items-center justify-center bg-white/[0.08] ${className ?? ''}`}
        role="status"
        aria-label="Загрузка изображения"
      >
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" aria-hidden="true" />
      </div>
    );
  }

  return <img src={url} alt={alt} loading="lazy" className={className} />;
}
