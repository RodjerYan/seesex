/**
 * Генератор PWA-иконок xTracker (PNG, без внешних зависимостей).
 *
 * Рисует процедурно: фон — indigo #6366f1 (theme_color манифеста),
 * знак «x» — белые скруглённые штрихи с антиалиасингом (покрытие по
 * расстоянию до отрезка). Кодирует PNG вручную (IHDR/IDAT/IEND + CRC32),
 * используя node:zlib для сжатия строк изображения.
 *
 * Запуск: npm run icons -w apps/web
 * Файлы: apps/web/public/icons/*.png
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const BACKGROUND = [0x63, 0x66, 0xf1, 255]; // #6366f1
const FOREGROUND = [255, 255, 255, 255];

// --- PNG encoder -------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: None
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- Drawing -----------------------------------------------------------------

/** Расстояние от точки до отрезка. */
function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.min(1, Math.max(0, ((px - x1) * dx + (py - y1) * dy) / lengthSquared));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/**
 * Рендер иконки.
 * @param size размер стороны в пикселях
 * @param options.paddingRatio доля отступа (безопасная зона для maskable — больше)
 * @param options.strokeRatio толщина штриха «x» относительно размера
 */
function renderIcon(size, { paddingRatio, strokeRatio }) {
  const rgba = Buffer.alloc(size * size * 4);
  const pad = size * paddingRatio;
  const half = (size * strokeRatio) / 2;
  const feather = Math.max(1, size / 128); // сглаживание краёв

  const a = pad;
  const b = size - pad;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      const d = Math.min(
        distanceToSegment(px, py, a, a, b, b),
        distanceToSegment(px, py, b, a, a, b),
      );
      // Покрытие: 1 внутри штриха, 0 снаружи, плавный переход на feather.
      const coverage = Math.min(1, Math.max(0, 0.5 + (half - d) / feather));
      const offset = (y * size + x) * 4;
      // Alpha-blend белого штриха поверх фона.
      rgba[offset] = Math.round(BACKGROUND[0] * (1 - coverage) + FOREGROUND[0] * coverage);
      rgba[offset + 1] = Math.round(BACKGROUND[1] * (1 - coverage) + FOREGROUND[1] * coverage);
      rgba[offset + 2] = Math.round(BACKGROUND[2] * (1 - coverage) + FOREGROUND[2] * coverage);
      rgba[offset + 3] = 255;
    }
  }
  return encodePng(size, size, rgba);
}

const TARGETS = [
  { file: 'icon-192.png', size: 192, options: { paddingRatio: 0.2, strokeRatio: 0.13 } },
  { file: 'icon-512.png', size: 512, options: { paddingRatio: 0.2, strokeRatio: 0.13 } },
  // Maskable: содержимое внутри безопасной зоны 60% (периметр может быть обрезан).
  { file: 'icon-maskable.png', size: 512, options: { paddingRatio: 0.3, strokeRatio: 0.1 } },
  { file: 'apple-touch-icon.png', size: 180, options: { paddingRatio: 0.2, strokeRatio: 0.13 } },
];

mkdirSync(OUT_DIR, { recursive: true });
for (const target of TARGETS) {
  const png = renderIcon(target.size, target.options);
  writeFileSync(join(OUT_DIR, target.file), png);
  console.log(`${target.file}: ${target.size}x${target.size}, ${png.length} bytes`);
}
console.log(`Готово: ${OUT_DIR}`);
