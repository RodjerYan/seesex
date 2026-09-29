import {
  // STANDARD
  Users,
  Flame,
  ArrowUpDown,
  ArrowRight,
  Mountain,
  Waves,
  Scissors,
  Circle,
  Move,
  ArrowDown,
  Bridge,
  Heart,
  RotateCcw,
  // ORAL
  Droplet,
  Merge,
  Flower2,
  Mouth,
  Layout,
  Sparkles,
  Hand,
  ArrowUp,
  // ANAL
  Feather,
  BrickWall,
  Anchor,
  Clock,
  // KINKY
  Ribbon,
  EyeOff,
  Zap,
  VenetianMask,
  Crown,
  Link,
  Moon,
  // BDSM
  Hand as HandIcon,
  Link as LinkIcon,
  Lock,
  VolumeX,
  Wind,
  // ROLEPLAY
  GlassWater,
  Briefcase,
  HeartPulse,
  BookOpen,
  Shield,
  Home,
  Dumbbell,
  Truck,
  Clapperboard,
  // FANTASY
  Rocket,
  Ghost,
  Cat,
  // EXOTIC
  Bird,
  Thermometer,
  Snowflake,
  Music,
  MirrorRectangular,
  Footprints,
  // Fallback
  Sparkles as DefaultIcon,
  type LucideIcon,
} from 'lucide-react';

/** Базовые имена позиций (без суффиксов вариантов) → иконка */
const BASE_ICON_MAP: Record<string, LucideIcon> = {
  // STANDARD
  'Миссионерская': Users,
  'Ковбошка': Flame,
  'Стоя лицом к лицу': ArrowUpDown,
  'Стоя сзади': ArrowRight,
  'Сзади раком': Mountain,
  'На боку': Waves,
  'Складной нож': Scissors,
  'Лотос': Circle,
  'Ножницы': Scissors,
  'Качели': Move,
  'Собачка': Mountain,
  'Глубокий присед': ArrowDown,
  'Мостик': Bridge,
  'Бабочка': Heart,
  'Перевернутая миссионерская': RotateCcw,

  // ORAL
  'Классический минет': Droplet,
  'Глубокий минет': Droplet,
  'Поза 69': Merge,
  'Куннилингус': Flower2,
  'Обратная 69': RotateCcw,
  'Минет с языком': Mouth,
  'Куннилингус на краю кровати': Layout,
  'Оральная стимуляция': Sparkles,
  'Минет раком': Mountain,
  'Минет двумя руками': Hand,
  'Куннилингус стоя': ArrowUp,
  'Минет с наклоном': ArrowDown,

  // ANAL
  'Классическая анальная': Mountain,
  'Анальная стоя': ArrowUp,
  'Анальная на боку': Waves,
  'Глубокая анальная': ArrowDown,
  'Анальная раком': Mountain,
  'Мягкая анальная': Feather,
  'Анальная мостик': Bridge,
  'Анальная у стены': BrickWall,
  'Перевернутая анальная': RotateCcw,
  'Анальная коленями к груди': Heart,
  'Анальная с упором': Anchor,
  'Анальная медленная': Clock,

  // KINKY
  'Связывание шелком': Ribbon,
  'Завязанные глаза': EyeOff,
  'Руки над головой': ArrowUp,
  'Страпон классический': Zap,
  'Маска и молчание': VenetianMask,
  'Доминирование стоя': Crown,
  'Подчинение раком': Mountain,
  'Медленный контроль': Clock,
  'Приказы и повиновение': Link,
  'Полумрак': Moon,
  'Символический поводок': Link,
  'Испытание стойкости': Mountain,

  // BDSM
  'Наказание ладонью': HandIcon,
  'Узел послушания': LinkIcon,
  'Проверка на стойкость': Mountain,
  'На коленях': Heart,
  'С наручниками': Lock,
  'Ласка с ударом': Zap,
  'Господствующая стойка': Crown,
  'Покорная поза': Heart,
  'Дыхание под контролем': Wind,
  'Тихий контроль': VolumeX,

  // ROLEPLAY
  'Незнакомцы в баре': GlassWater,
  'Секретарша и босс': Briefcase,
  'Медсестра и пациент': HeartPulse,
  'Учитель и ученица': BookOpen,
  'Полицейский и нарушитель': Shield,
  'Горничная и гость': Home,
  'Тренер и спортсменка': Dumbbell,
  'Доставщик пиццы': Truck,
  'Актриса и режиссер': Clapperboard,
  'Соседка сверху': ArrowUp,

  // FANTASY
  'Эльфийка и странник': Sparkles,
  'Вампирша и охотник': Moon,
  'Космонавты': Rocket,
  'Пираты на палубе': Anchor,
  'Рыцарь и леди': Shield,
  'Фея и садовник': Flower2,
  'Ведьма и кот': Cat,
  'Дух дома': Ghost,
  'Сирена и моряк': Waves,
  'Демон и грешник': Flame,

  // EXOTIC
  'Поза голубя': Bird,
  'Температурный контраст': Thermometer,
  'Свечи и лёд': Flame,
  'Массаж с маслами': Droplet,
  'Перо и щекотка': Feather,
  'Восточный танец': Music,
  'Зеркальная поза': MirrorRectangular,
  'Поза на одной ноге': Footprints,
  'Скольжение': ArrowRight,
  'Ароматерапия вдвоем': Flower2,
};

/** Варианты суффиксов, которые добавляются к базовому имени */
const VARIANT_SUFFIXES = [
  ' (лёжа)',
  ' (стоя)',
  ' (сидя)',
  ' (на боку)',
  ' (с опорой)',
] as const;

/**
 * Извлекает базовое имя позиции, убирая суффикс варианта.
 * Пример: "Миссионерская (лёжа)" → "Миссионерская"
 */
function extractBaseName(fullName: string): string {
  for (const suffix of VARIANT_SUFFIXES) {
    if (fullName.endsWith(suffix)) {
      return fullName.slice(0, -suffix.length);
    }
  }
  return fullName;
}

/**
 * Возвращает иконку для позиции по её полному имени.
 * Ищет по базовому имени (без варианта), фоллбэк — DefaultIcon (Sparkles).
 */
export function getPositionIcon(name: string): LucideIcon {
  const base = extractBaseName(name);
  return BASE_ICON_MAP[base] ?? DefaultIcon;
}

/**
 * React-компонент для отображения иконки позиции.
 * @param name — полное имя позиции (как приходит из API)
 * @param className — Tailwind-классы для размера/цвета (по умолчанию `w-5 h-5 text-slate-400`)
 */
export function PositionIcon({
  name,
  className = 'w-5 h-5 text-slate-400',
}: {
  name: string;
  className?: string;
}) {
  const Icon = getPositionIcon(name);
  return <Icon className={className} aria-hidden="true" />;
}

export { BASE_ICON_MAP, extractBaseName };