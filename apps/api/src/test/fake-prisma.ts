import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

/**
 * In-memory фейк PrismaClient для интеграционных тестов (живая БД не нужна).
 *
 * Покрывает подмножество Prisma API, используемое кодом API:
 *   findUnique/findFirst/findMany, create, update, updateMany,
 *   delete/deleteMany, count, aggregate, groupBy, $transaction.
 * Поддерживает: where-операторы (in/gte/lte/gt/lt/not/contains + AND/OR/NOT),
 * relation-фильтры (some/every/none, is/isNot), include (в т.ч. вложенный),
 * orderBy/skip/take, implicit m2m-связи, onDelete-cascade/setNull.
 */

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;
type Data = Record<string, unknown>;
type Include = Record<string, unknown> | undefined;
type OrderBy = Record<string, 'asc' | 'desc'> | Record<string, 'asc' | 'desc'>[];

/** Имена хранилищ = имена моделей Prisma (мн. число). */
type ModelKey =
  | 'users'
  | 'profiles'
  | 'sessions'
  | 'refreshTokens'
  | 'events'
  | 'partners'
  | 'partnerPhotos'
  | 'eventPhotos'
  | 'positions'
  | 'wishlists'
  | 'groupCalendars'
  | 'groupCalendarMembers'
  | 'moods'
  | 'places'
  | 'accessories'
  | 'periodTrackings'
  | 'periodEntries';

type JoinKey =
  | 'eventPartners'
  | 'eventPositions'
  | 'eventMoods'
  | 'eventPlaces'
  | 'eventAccessories';

interface JoinRow {
  a: string;
  b: string;
}

export interface FakeDb {
  users: Row[];
  profiles: Row[];
  sessions: Row[];
  refreshTokens: Row[];
  events: Row[];
  partners: Row[];
  partnerPhotos: Row[];
  eventPhotos: Row[];
  positions: Row[];
  wishlists: Row[];
  groupCalendars: Row[];
  groupCalendarMembers: Row[];
  moods: Row[];
  places: Row[];
  accessories: Row[];
  periodTrackings: Row[];
  periodEntries: Row[];
  joins: Record<JoinKey, JoinRow[]>;
}

const db: FakeDb = {
  users: [],
  profiles: [],
  sessions: [],
  refreshTokens: [],
  events: [],
  partners: [],
  partnerPhotos: [],
  eventPhotos: [],
  positions: [],
  wishlists: [],
  groupCalendars: [],
  groupCalendarMembers: [],
  moods: [],
  places: [],
  accessories: [],
  periodTrackings: [],
  periodEntries: [],
  joins: {
    eventPartners: [],
    eventPositions: [],
    eventMoods: [],
    eventPlaces: [],
    eventAccessories: [],
  },
};

export function getFakeDb(): FakeDb {
  return db;
}

export function resetFakeDb(): void {
  db.users.length = 0;
  db.profiles.length = 0;
  db.sessions.length = 0;
  db.refreshTokens.length = 0;
  db.events.length = 0;
  db.partners.length = 0;
  db.partnerPhotos.length = 0;
  db.eventPhotos.length = 0;
  db.positions.length = 0;
  db.wishlists.length = 0;
  db.groupCalendars.length = 0;
  db.groupCalendarMembers.length = 0;
  db.moods.length = 0;
  db.places.length = 0;
  db.accessories.length = 0;
  db.periodTrackings.length = 0;
  db.periodEntries.length = 0;
  db.joins.eventPartners.length = 0;
  db.joins.eventPositions.length = 0;
  db.joins.eventMoods.length = 0;
  db.joins.eventPlaces.length = 0;
  db.joins.eventAccessories.length = 0;
}

// ---------------------------------------------------------------------------
// Метаданные моделей
// ---------------------------------------------------------------------------

type Relation =
  | { kind: 'oneToMany'; target: ModelKey; fk: string }
  | { kind: 'oneToOne'; target: ModelKey; fk: string }
  | { kind: 'manyToOne'; target: ModelKey; fk: string }
  | { kind: 'm2m'; target: ModelKey; join: JoinKey; left: ModelKey; right: ModelKey };

interface ModelSpec {
  relations: Record<string, Relation>;
  defaults: (now: Date) => Row;
  updatedAt: boolean;
}

function baseTimestamps(now: Date): Row {
  return { createdAt: now, updatedAt: now };
}

const MODELS: Record<ModelKey, ModelSpec> = {
  users: {
    updatedAt: true,
    relations: {
      profile: { kind: 'oneToOne', target: 'profiles', fk: 'userId' },
      events: { kind: 'oneToMany', target: 'events', fk: 'userId' },
      partners: { kind: 'oneToMany', target: 'partners', fk: 'userId' },
      positions: { kind: 'oneToMany', target: 'positions', fk: 'userId' },
      wishlists: { kind: 'oneToMany', target: 'wishlists', fk: 'userId' },
      groupCalendars: { kind: 'oneToMany', target: 'groupCalendars', fk: 'createdBy' },
      calendarMemberships: { kind: 'oneToMany', target: 'groupCalendarMembers', fk: 'userId' },
      sessions: { kind: 'oneToMany', target: 'sessions', fk: 'userId' },
      refreshTokens: { kind: 'oneToMany', target: 'refreshTokens', fk: 'userId' },
      moods: { kind: 'oneToMany', target: 'moods', fk: 'userId' },
      places: { kind: 'oneToMany', target: 'places', fk: 'userId' },
      accessories: { kind: 'oneToMany', target: 'accessories', fk: 'userId' },
    },
    defaults: (now) => ({
      email: null,
      totpSecret: null,
      lockEnabled: true,
      lockMethod: 'PIN',
      autoLockTimeout: 60,
      ...baseTimestamps(now),
    }),
  },
  profiles: {
    updatedAt: true,
    relations: { user: { kind: 'manyToOne', target: 'users', fk: 'userId' } },
    defaults: (now) => ({
      displayName: null,
      birthDate: null,
      heightCm: null,
      weightKg: null,
      bio: null,
      avatarUrl: null,
      ...baseTimestamps(now),
    }),
  },
  sessions: {
    updatedAt: false,
    relations: { user: { kind: 'manyToOne', target: 'users', fk: 'userId' } },
    defaults: (now) => ({
      userAgent: null,
      ipHash: null,
      lastSeenAt: now,
      createdAt: now,
    }),
  },
  refreshTokens: {
    updatedAt: false,
    relations: { user: { kind: 'manyToOne', target: 'users', fk: 'userId' } },
    defaults: (now) => ({ revokedAt: null, createdAt: now }),
  },
  events: {
    updatedAt: true,
    relations: {
      user: { kind: 'manyToOne', target: 'users', fk: 'userId' },
      groupCalendar: { kind: 'manyToOne', target: 'groupCalendars', fk: 'groupCalendarId' },
      partners: {
        kind: 'm2m',
        target: 'partners',
        join: 'eventPartners',
        left: 'events',
        right: 'partners',
      },
      positions: {
        kind: 'm2m',
        target: 'positions',
        join: 'eventPositions',
        left: 'events',
        right: 'positions',
      },
      moods: { kind: 'm2m', target: 'moods', join: 'eventMoods', left: 'events', right: 'moods' },
      places: {
        kind: 'm2m',
        target: 'places',
        join: 'eventPlaces',
        left: 'events',
        right: 'places',
      },
      accessories: {
        kind: 'm2m',
        target: 'accessories',
        join: 'eventAccessories',
        left: 'events',
        right: 'accessories',
      },
      photos: { kind: 'oneToMany', target: 'eventPhotos', fk: 'eventId' },
    },
    defaults: (now) => ({
      title: null,
      eventType: 'SEX',
      isCustomType: false,
      duration: null,
      rating: null,
      notes: null,
      calories: null,
      heartRate: null,
      initiatedBy: null,
      groupCalendarId: null,
      ...baseTimestamps(now),
    }),
  },
  partners: {
    updatedAt: true,
    relations: {
      user: { kind: 'manyToOne', target: 'users', fk: 'userId' },
      photos: { kind: 'oneToMany', target: 'partnerPhotos', fk: 'partnerId' },
      periodTracking: { kind: 'oneToOne', target: 'periodTrackings', fk: 'partnerId' },
      events: {
        kind: 'm2m',
        target: 'events',
        join: 'eventPartners',
        left: 'events',
        right: 'partners',
      },
    },
    defaults: (now) => ({
      nickname: null,
      gender: null,
      sexualOrientation: null,
      pronouns: null,
      relationshipStatus: null,
      isPrimary: false,
      customFields: null,
      ...baseTimestamps(now),
    }),
  },
  partnerPhotos: {
    updatedAt: false,
    relations: { partner: { kind: 'manyToOne', target: 'partners', fk: 'partnerId' } },
    defaults: (now) => ({ caption: null, sortOrder: 0, createdAt: now }),
  },
  eventPhotos: {
    updatedAt: false,
    relations: { event: { kind: 'manyToOne', target: 'events', fk: 'eventId' } },
    defaults: (now) => ({ caption: null, createdAt: now }),
  },
  positions: {
    updatedAt: false,
    relations: {
      user: { kind: 'manyToOne', target: 'users', fk: 'userId' },
      events: {
        kind: 'm2m',
        target: 'events',
        join: 'eventPositions',
        left: 'events',
        right: 'positions',
      },
      wishlistEntries: { kind: 'oneToMany', target: 'wishlists', fk: 'positionId' },
    },
    defaults: () => ({ category: 'STANDARD', iconName: null, isCustom: false, isSystem: false }),
  },
  wishlists: {
    updatedAt: false,
    relations: {
      user: { kind: 'manyToOne', target: 'users', fk: 'userId' },
      position: { kind: 'manyToOne', target: 'positions', fk: 'positionId' },
    },
    defaults: (now) => ({
      positionId: null,
      customName: null,
      customCategory: null,
      isCompleted: false,
      completedAt: null,
      createdAt: now,
    }),
  },
  groupCalendars: {
    updatedAt: false,
    relations: {
      creator: { kind: 'manyToOne', target: 'users', fk: 'createdBy' },
      members: { kind: 'oneToMany', target: 'groupCalendarMembers', fk: 'groupCalendarId' },
      events: { kind: 'oneToMany', target: 'events', fk: 'groupCalendarId' },
    },
    defaults: (now) => ({ createdAt: now }),
  },
  groupCalendarMembers: {
    updatedAt: false,
    relations: {
      groupCalendar: { kind: 'manyToOne', target: 'groupCalendars', fk: 'groupCalendarId' },
      user: { kind: 'manyToOne', target: 'users', fk: 'userId' },
    },
    defaults: (now) => ({ role: 'MEMBER', joinedAt: now }),
  },
  moods: {
    updatedAt: false,
    relations: {
      user: { kind: 'manyToOne', target: 'users', fk: 'userId' },
      events: {
        kind: 'm2m',
        target: 'events',
        join: 'eventMoods',
        left: 'events',
        right: 'moods',
      },
    },
    defaults: () => ({ userId: null, iconName: null, color: null }),
  },
  places: {
    updatedAt: false,
    relations: {
      user: { kind: 'manyToOne', target: 'users', fk: 'userId' },
      events: {
        kind: 'm2m',
        target: 'events',
        join: 'eventPlaces',
        left: 'events',
        right: 'places',
      },
    },
    defaults: () => ({ userId: null, iconName: null }),
  },
  accessories: {
    updatedAt: false,
    relations: {
      user: { kind: 'manyToOne', target: 'users', fk: 'userId' },
      events: {
        kind: 'm2m',
        target: 'events',
        join: 'eventAccessories',
        left: 'events',
        right: 'accessories',
      },
    },
    defaults: () => ({ userId: null, iconName: null }),
  },
  periodTrackings: {
    updatedAt: true,
    relations: {
      partner: { kind: 'manyToOne', target: 'partners', fk: 'partnerId' },
      entries: { kind: 'oneToMany', target: 'periodEntries', fk: 'periodTrackingId' },
    },
    defaults: (now) => ({
      lastPeriodStart: null,
      averageCycleLength: 28,
      averagePeriodLength: 5,
      notes: null,
      ...baseTimestamps(now),
    }),
  },
  periodEntries: {
    updatedAt: false,
    relations: {
      periodTracking: { kind: 'manyToOne', target: 'periodTrackings', fk: 'periodTrackingId' },
    },
    defaults: (now) => ({ endDate: null, symptoms: null, notes: null, createdAt: now }),
  },
};

/** Имя delegate в PrismaClient → хранилище. */
const DELEGATES: Record<string, ModelKey> = {
  user: 'users',
  profile: 'profiles',
  session: 'sessions',
  refreshToken: 'refreshTokens',
  event: 'events',
  partner: 'partners',
  partnerPhoto: 'partnerPhotos',
  eventPhoto: 'eventPhotos',
  position: 'positions',
  wishlist: 'wishlists',
  groupCalendar: 'groupCalendars',
  groupCalendarMember: 'groupCalendarMembers',
  mood: 'moods',
  place: 'places',
  accessory: 'accessories',
  periodTracking: 'periodTrackings',
  periodEntry: 'periodEntries',
};

/** Правила ссылочной целостности: child.fk → parent (удаление). */
interface RefRule {
  child: ModelKey;
  fk: string;
  parent: ModelKey;
  action: 'cascade' | 'setNull';
}

const REF_RULES: RefRule[] = [
  { child: 'profiles', fk: 'userId', parent: 'users', action: 'cascade' },
  { child: 'sessions', fk: 'userId', parent: 'users', action: 'cascade' },
  { child: 'refreshTokens', fk: 'userId', parent: 'users', action: 'cascade' },
  { child: 'events', fk: 'userId', parent: 'users', action: 'cascade' },
  { child: 'partners', fk: 'userId', parent: 'users', action: 'cascade' },
  { child: 'positions', fk: 'userId', parent: 'users', action: 'cascade' },
  { child: 'wishlists', fk: 'userId', parent: 'users', action: 'cascade' },
  { child: 'groupCalendars', fk: 'createdBy', parent: 'users', action: 'cascade' },
  { child: 'groupCalendarMembers', fk: 'userId', parent: 'users', action: 'cascade' },
  { child: 'moods', fk: 'userId', parent: 'users', action: 'cascade' },
  { child: 'places', fk: 'userId', parent: 'users', action: 'cascade' },
  { child: 'accessories', fk: 'userId', parent: 'users', action: 'cascade' },
  {
    child: 'groupCalendarMembers',
    fk: 'groupCalendarId',
    parent: 'groupCalendars',
    action: 'cascade',
  },
  { child: 'eventPhotos', fk: 'eventId', parent: 'events', action: 'cascade' },
  { child: 'partnerPhotos', fk: 'partnerId', parent: 'partners', action: 'cascade' },
  { child: 'periodTrackings', fk: 'partnerId', parent: 'partners', action: 'cascade' },
  {
    child: 'periodEntries',
    fk: 'periodTrackingId',
    parent: 'periodTrackings',
    action: 'cascade',
  },
  { child: 'events', fk: 'groupCalendarId', parent: 'groupCalendars', action: 'setNull' },
  { child: 'wishlists', fk: 'positionId', parent: 'positions', action: 'setNull' },
];

/** m2m: участие модели в join-таблице (side: 'a' | 'b'). */
const M2M_SIDES: Partial<Record<ModelKey, { join: JoinKey; side: 'a' | 'b' }[]>> = {
  events: [
    { join: 'eventPartners', side: 'a' },
    { join: 'eventPositions', side: 'a' },
    { join: 'eventMoods', side: 'a' },
    { join: 'eventPlaces', side: 'a' },
    { join: 'eventAccessories', side: 'a' },
  ],
  partners: [{ join: 'eventPartners', side: 'b' }],
  positions: [{ join: 'eventPositions', side: 'b' }],
  moods: [{ join: 'eventMoods', side: 'b' }],
  places: [{ join: 'eventPlaces', side: 'b' }],
  accessories: [{ join: 'eventAccessories', side: 'b' }],
};

// ---------------------------------------------------------------------------
// where-матчинг
// ---------------------------------------------------------------------------

const OPERATOR_KEYS = ['in', 'notIn', 'gte', 'lte', 'gt', 'lt', 'not', 'contains', 'startsWith', 'endsWith', 'equals'];

function toComparable(value: unknown): unknown {
  return value instanceof Date ? value.getTime() : value;
}

/** Ожидание вида { gte: Date, ... } — это фильтр-оператор, а не значение Date. */
function isOperatorObject(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || value instanceof Date) {
    return false;
  }
  return Object.keys(value).some((key) => OPERATOR_KEYS.includes(key));
}

function matchScalar(actual: unknown, expected: unknown): boolean {
  if (expected === undefined) return true;
  if (expected === null) return actual === null || actual === undefined;
  if (Array.isArray(expected)) {
    return expected.some((item) => matchScalar(actual, item));
  }
  // Равенство дат; operator-объект ({gte, lte, …}) уходит в ветку операторов ниже,
  // иначе Date-колонка с gte/lte никогда не совпадёт (new Date("[object Object]") → NaN).
  if ((expected instanceof Date || actual instanceof Date) && !isOperatorObject(expected)) {
    const a = actual instanceof Date ? actual.getTime() : new Date(String(actual)).getTime();
    const b = expected instanceof Date ? expected.getTime() : new Date(String(expected)).getTime();
    if (Number.isNaN(a) || Number.isNaN(b)) return false;
    return a === b;
  }
  if (typeof expected === 'object') {
    const ops = expected as Record<string, unknown>;
    const keys = Object.keys(ops);
    if (keys.length === 0) return true;
    if (!keys.some((key) => OPERATOR_KEYS.includes(key))) {
      // Не-операторный объект (например, JSON) — глубокое равенство.
      return JSON.stringify(actual) === JSON.stringify(expected);
    }
    return keys.every((key) => {
      const value = ops[key];
      switch (key) {
        case 'equals':
          return matchScalar(actual, value);
        case 'in':
          return Array.isArray(value) && value.some((item) => matchScalar(actual, item));
        case 'notIn':
          return !(Array.isArray(value) && value.some((item) => matchScalar(actual, item)));
        case 'not':
          if (value === null) return actual !== null && actual !== undefined;
          if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
            return !matchScalar(actual, value);
          }
          return !matchScalar(actual, value);
        case 'gte':
        case 'lte':
        case 'gt':
        case 'lt': {
          const a = toComparable(actual);
          const b = toComparable(value);
          if (typeof a !== 'number' || typeof b !== 'number') return false;
          if (key === 'gte') return a >= b;
          if (key === 'gt') return a > b;
          if (key === 'lte') return a <= b;
          return a <= b;
        }
        case 'contains':
          return typeof actual === 'string' && typeof value === 'string' && actual.includes(value);
        case 'startsWith':
          return typeof actual === 'string' && typeof value === 'string' && actual.startsWith(value);
        case 'endsWith':
          return typeof actual === 'string' && typeof value === 'string' && actual.endsWith(value);
        default:
          return false;
      }
    });
  }
  return actual === expected;
}

function matchWhere(model: ModelKey, row: Row, where: Where | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, value]) => {
    if (value === undefined) return true;
    if (key === 'AND') {
      const list = Array.isArray(value) ? value : [value];
      return list.every((item) => matchWhere(model, row, item as Where));
    }
    if (key === 'OR') {
      const list = Array.isArray(value) ? value : [value];
      return list.some((item) => matchWhere(model, row, item as Where));
    }
    if (key === 'NOT') {
      const list = Array.isArray(value) ? value : [value];
      return !list.some((item) => matchWhere(model, row, item as Where));
    }
    const relation = MODELS[model].relations[key];
    if (relation) return matchRelation(model, row, relation, value as Where);
    return matchScalar(row[key], value);
  });
}

function matchRelation(model: ModelKey, row: Row, relation: Relation, filter: Where): boolean {
  if (relation.kind === 'manyToOne' || relation.kind === 'oneToOne') {
    const related = resolveToOne(model, row, relation);
    const hasIs = 'is' in filter || 'isNot' in filter;
    if (!hasIs) {
      return related !== null && matchWhere(relation.target, related, filter);
    }
    const isResult =
      'is' in filter
        ? filter.is === null
          ? related === null
          : related !== null && matchWhere(relation.target, related, filter.is as Where)
        : true;
    const isNotResult =
      'isNot' in filter
        ? filter.isNot === null
          ? related !== null
          : related !== null && matchWhere(relation.target, related, filter.isNot as Where)
        : false;
    if ('is' in filter && 'isNot' in filter) return isResult && !isNotResult;
    if ('is' in filter) return isResult;
    return !isNotResult;
  }

  const related = resolveToMany(model, row, relation);
  const some = (sub: unknown): boolean =>
    related.some((item) => matchWhere(relation.target, item, sub as Where));
  if ('some' in filter) return some(filter.some);
  if ('every' in filter)
    return related.every((item) => matchWhere(relation.target, item, filter.every as Where));
  if ('none' in filter) return !some(filter.none);
  return some(filter);
}

// ---------------------------------------------------------------------------
// Связи
// ---------------------------------------------------------------------------

function store(model: ModelKey): Row[] {
  return db[model];
}

function findRowById(model: ModelKey, id: string): Row | null {
  return store(model).find((row) => row.id === id) ?? null;
}

type ToOneRelation = Extract<Relation, { kind: 'manyToOne' | 'oneToOne' }>;
type ToManyRelation = Extract<Relation, { kind: 'oneToMany' | 'm2m' }>;

function resolveToOne(model: ModelKey, row: Row, relation: ToOneRelation): Row | null {
  if (relation.kind === 'manyToOne') {
    const fkValue = row[relation.fk];
    if (typeof fkValue !== 'string') return null;
    return findRowById(relation.target, fkValue);
  }
  // oneToOne: fk лежит на target.
  return store(relation.target).find((item) => item[relation.fk] === row.id) ?? null;
}

function resolveToMany(model: ModelKey, row: Row, relation: ToManyRelation): Row[] {
  if (relation.kind === 'oneToMany') {
    return store(relation.target).filter((item) => item[relation.fk] === row.id);
  }
  const table = db.joins[relation.join];
  const isLeft = relation.left === model;
  const ids = table
    .filter((join) => (isLeft ? join.a : join.b) === row.id)
    .map((join) => (isLeft ? join.b : join.a));
  return ids
    .map((id) => findRowById(relation.target, id))
    .filter((item): item is Row => item !== null);
}

function applyInclude(model: ModelKey, row: Row, include: Include): Row {
  if (!include) return { ...row };
  const output: Row = { ...row };
  for (const [field, spec] of Object.entries(include)) {
    if (spec === false || spec === undefined || spec === null) continue;
    const relation = MODELS[model].relations[field];
    if (!relation) continue;

    if (relation.kind === 'manyToOne' || relation.kind === 'oneToOne') {
      const nested = spec as { include?: Include; where?: Where };
      let related = resolveToOne(model, row, relation);
      if (nested.where && related && !matchWhere(relation.target, related, nested.where)) {
        related = null;
      }
      output[field] = related
        ? nested.include
          ? applyInclude(relation.target, related, nested.include)
          : { ...related }
        : null;
      continue;
    }

    const nested = spec as {
      include?: Include;
      where?: Where;
      orderBy?: OrderBy;
      take?: number;
      skip?: number;
    };
    let list = resolveToMany(model, row, relation);
    if (nested.where) {
      list = list.filter((item) => matchWhere(relation.target, item, nested.where));
    }
    if (nested.orderBy) list = sortRows(list, nested.orderBy);
    if (nested.skip !== undefined || nested.take !== undefined) {
      const start = nested.skip ?? 0;
      list = list.slice(start, nested.take !== undefined ? start + nested.take : undefined);
    }
    output[field] = list.map((item) =>
      nested.include ? applyInclude(relation.target, item, nested.include) : { ...item },
    );
  }
  return output;
}

// ---------------------------------------------------------------------------
// orderBy
// ---------------------------------------------------------------------------

function compareValues(a: unknown, b: unknown): number {
  const av = toComparable(a);
  const bv = toComparable(b);
  if (av === bv) return 0;
  if (av === null || av === undefined) return -1;
  if (bv === null || bv === undefined) return 1;
  if (typeof av === 'string' && typeof bv === 'string') return av < bv ? -1 : 1;
  if (typeof av === 'number' && typeof bv === 'number') return av - bv;
  return String(av) < String(bv) ? -1 : 1;
}

function sortRows(rows: Row[], orderBy: OrderBy | undefined): Row[] {
  if (!orderBy) return rows;
  const clauses = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...rows].sort((left, right) => {
    for (const clause of clauses) {
      const [field, direction] = Object.entries(clause)[0] ?? [];
      if (!field) continue;
      const result = compareValues(left[field], right[field]);
      if (result !== 0) return direction === 'desc' ? -result : result;
    }
    return 0;
  });
}

// ---------------------------------------------------------------------------
// Создание / обновление / удаление
// ---------------------------------------------------------------------------

function applyCreateRelation(model: ModelKey, relation: Relation, row: Row, value: unknown): void {
  if (value === null || value === undefined) return;
  if (relation.kind === 'm2m') {
    const input = value as { connect?: { id: string }[] | { id: string } };
    const connect = input.connect;
    if (!connect) return;
    const list = Array.isArray(connect) ? connect : [connect];
    const isLeft = relation.left === model;
    const localId = row.id as string;
    for (const item of list) {
      db.joins[relation.join].push(isLeft ? { a: localId, b: item.id } : { a: item.id, b: localId });
    }
    return;
  }
  const input = value as { connect?: { id: string }; disconnect?: boolean };
  if (input.connect) row[relation.fk] = input.connect.id;
  else if (input.disconnect) row[relation.fk] = null;
}

function applyUpdateRelation(model: ModelKey, relation: Relation, row: Row, value: unknown): void {
  if (value === null || value === undefined) return;
  if (relation.kind === 'm2m') {
    const table = db.joins[relation.join];
    const isLeft = relation.left === model;
    const localId = row.id as string;
    const input = value as {
      set?: { id: string }[];
      connect?: { id: string }[] | { id: string };
      disconnect?: { id: string }[] | { id: string };
    };
    if (input.set) {
      for (let i = table.length - 1; i >= 0; i -= 1) {
        const join = table[i];
        if ((isLeft ? join.a : join.b) === row.id) table.splice(i, 1);
      }
      for (const item of input.set) {
        table.push(isLeft ? { a: localId, b: item.id } : { a: item.id, b: localId });
      }
      return;
    }
    if (input.connect) {
      const list = Array.isArray(input.connect) ? input.connect : [input.connect];
      for (const item of list) {
        const exists = table.some(
          (join) => (isLeft ? join.a : join.b) === row.id && (isLeft ? join.b : join.a) === item.id,
        );
        if (!exists) table.push(isLeft ? { a: localId, b: item.id } : { a: item.id, b: localId });
      }
    }
    if (input.disconnect) {
      const list = Array.isArray(input.disconnect) ? input.disconnect : [input.disconnect];
      for (const item of list) {
        for (let i = table.length - 1; i >= 0; i -= 1) {
          const join = table[i];
          if ((isLeft ? join.a : join.b) === row.id && (isLeft ? join.b : join.a) === item.id) {
            table.splice(i, 1);
          }
        }
      }
    }
    return;
  }
  const input = value as { connect?: { id: string }; disconnect?: boolean };
  if (input.connect) row[relation.fk] = input.connect.id;
  else if (input.disconnect || value === null) row[relation.fk] = null;
}

function applyScalarData(model: ModelKey, row: Row, data: Data): void {
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || key === 'id') continue;
    const relation = MODELS[model].relations[key];
    if (relation) {
      applyUpdateRelation(model, relation, row, value);
      continue;
    }
    row[key] = value;
  }
  if (MODELS[model].updatedAt) row.updatedAt = new Date();
}

function removeRows(model: ModelKey, ids: string[]): void {
  if (ids.length === 0) return;
  const idSet = new Set(ids);

  // 1. Ссылочная целостность: потомки.
  for (const rule of REF_RULES) {
    if (rule.parent !== model) continue;
    const affected = store(rule.child).filter((row) => typeof row[rule.fk] === 'string' && idSet.has(row[rule.fk] as string));
    if (rule.action === 'cascade') {
      removeRows(rule.child, affected.map((row) => row.id as string));
    } else {
      for (const row of affected) row[rule.fk] = null;
    }
  }

  // 2. Implicit m2m: чистим join-таблицы.
  for (const entry of M2M_SIDES[model] ?? []) {
    const table = db.joins[entry.join];
    for (let i = table.length - 1; i >= 0; i -= 1) {
      const join = table[i];
      if (idSet.has(entry.side === 'a' ? join.a : join.b)) table.splice(i, 1);
    }
  }

  // 3. Удаляем сами строки.
  const storage = store(model);
  for (let i = storage.length - 1; i >= 0; i -= 1) {
    if (idSet.has(storage[i].id as string)) storage.splice(i, 1);
  }
}

function selectRows(model: ModelKey, where: Where | undefined): Row[] {
  return store(model).filter((row) => matchWhere(model, row, where));
}

// ---------------------------------------------------------------------------
// aggregate / groupBy
// ---------------------------------------------------------------------------

function numericValues(rows: Row[], field: string): number[] {
  return rows
    .map((row) => row[field])
    .filter((value): value is number => typeof value === 'number')
    .filter((value) => !Number.isNaN(value));
}

function fieldCount(rows: Row[], field: string): number {
  return rows.filter((row) => row[field] !== null && row[field] !== undefined).length;
}

function aggregate(model: ModelKey, args: Record<string, unknown>): Row {
  const rows = selectRows(model, args.where as Where | undefined);
  const result: Row = {};
  const countSpec = args._count;
  if (countSpec !== undefined) {
    if (typeof countSpec === 'object' && countSpec !== null) {
      const counts: Row = {};
      for (const [key, enabled] of Object.entries(countSpec as Record<string, unknown>)) {
        if (!enabled) continue;
        counts[key] = key === '_all' ? rows.length : fieldCount(rows, key);
      }
      result._count = counts;
    } else {
      result._count = rows.length;
    }
  }
  const avgSpec = args._avg as Record<string, unknown> | undefined;
  if (avgSpec) {
    const avg: Row = {};
    for (const [key, enabled] of Object.entries(avgSpec)) {
      if (!enabled) continue;
      const values = numericValues(rows, key);
      avg[key] = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    }
    result._avg = avg;
  }
  const sumSpec = args._sum as Record<string, unknown> | undefined;
  if (sumSpec) {
    const sum: Row = {};
    for (const [key, enabled] of Object.entries(sumSpec)) {
      if (!enabled) continue;
      sum[key] = numericValues(rows, key).reduce((acc, value) => acc + value, 0);
    }
    result._sum = sum;
  }
  for (const kind of ['_min', '_max'] as const) {
    const spec = args[kind] as Record<string, unknown> | undefined;
    if (!spec) continue;
    const bounds: Row = {};
    for (const [key, enabled] of Object.entries(spec)) {
      if (!enabled) continue;
      const comparable = rows
        .map((row) => row[key])
        .filter((value): value is string | number | Date => value !== null && value !== undefined)
        .map((value) => ({ raw: value, cmp: toComparable(value) as number | string }));
      const picked =
        kind === '_min'
          ? comparable.reduce<(typeof comparable)[number] | null>(
              (acc, item) => (acc === null || item.cmp < acc.cmp ? item : acc),
              null,
            )
          : comparable.reduce<(typeof comparable)[number] | null>(
              (acc, item) => (acc === null || item.cmp > acc.cmp ? item : acc),
              null,
            );
      bounds[key] = picked ? picked.raw : null;
    }
    result[kind] = bounds;
  }
  return result;
}

function groupBy(model: ModelKey, args: Record<string, unknown>): Row[] {
  const by = args.by as string[];
  const rows = selectRows(model, args.where as Where | undefined);
  const groups = new Map<string, { key: Row; rows: Row[] }>();
  for (const row of rows) {
    const keyValues = by.map((field) => row[field] ?? null);
    const mapKey = JSON.stringify(keyValues);
    const existing = groups.get(mapKey);
    if (existing) existing.rows.push(row);
    else {
      const key: Row = {};
      by.forEach((field, index) => {
        key[field] = keyValues[index];
      });
      groups.set(mapKey, { key, rows: [row] });
    }
  }

  const results: Row[] = [];
  for (const group of groups.values()) {
    const item: Row = { ...group.key };
    const countSpec = args._count;
    if (countSpec !== undefined) {
      if (typeof countSpec === 'object' && countSpec !== null) {
        const counts: Row = {};
        for (const [key, enabled] of Object.entries(countSpec as Record<string, unknown>)) {
          if (!enabled) continue;
          counts[key] = key === '_all' ? group.rows.length : fieldCount(group.rows, key);
        }
        item._count = counts;
      } else {
        item._count = group.rows.length;
      }
    }
    const avgSpec = args._avg as Record<string, unknown> | undefined;
    if (avgSpec) {
      const avg: Row = {};
      for (const [key, enabled] of Object.entries(avgSpec)) {
        if (!enabled) continue;
        const values = numericValues(group.rows, key);
        avg[key] = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
      }
      item._avg = avg;
    }
    const sumSpec = args._sum as Record<string, unknown> | undefined;
    if (sumSpec) {
      const sum: Row = {};
      for (const [key, enabled] of Object.entries(sumSpec)) {
        if (!enabled) continue;
        sum[key] = numericValues(group.rows, key).reduce((acc, value) => acc + value, 0);
      }
      item._sum = sum;
    }
    results.push(item);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Delegates
// ---------------------------------------------------------------------------

interface FindArgs {
  where?: Where;
  include?: Include;
  orderBy?: OrderBy;
  skip?: number;
  take?: number;
}

function findAll(model: ModelKey, args: FindArgs): Row[] {
  let rows = selectRows(model, args.where);
  rows = sortRows(rows, args.orderBy);
  if (args.skip) rows = rows.slice(args.skip);
  if (args.take !== undefined) rows = rows.slice(0, args.take);
  return rows;
}

function buildDelegate(model: ModelKey) {
  return {
    async findUnique(args: FindArgs): Promise<Row | null> {
      const row = selectRows(model, args.where)[0] ?? null;
      return row ? applyInclude(model, row, args.include) : null;
    },
    async findFirst(args: FindArgs): Promise<Row | null> {
      const rows = findAll(model, args);
      return rows[0] ? applyInclude(model, rows[0], args.include) : null;
    },
    async findMany(args: FindArgs = {}): Promise<Row[]> {
      return findAll(model, args).map((row) => applyInclude(model, row, args.include));
    },
    async create(args: { data: Data; include?: Include }): Promise<Row> {
      const now = new Date();
      const row: Row = { id: randomUUID(), ...MODELS[model].defaults(now) };
      for (const [key, value] of Object.entries(args.data)) {
        if (value === undefined) continue;
        const relation = MODELS[model].relations[key];
        if (relation) applyCreateRelation(model, relation, row, value);
        else row[key] = value;
      }
      store(model).push(row);
      return applyInclude(model, row, args.include);
    },
    async update(args: { where: Where; data: Data; include?: Include }): Promise<Row> {
      const row = selectRows(model, args.where)[0];
      if (!row) throw new Error('Record to update not found.');
      applyScalarData(model, row, args.data);
      return applyInclude(model, row, args.include);
    },
    async updateMany(args: { where: Where; data: Data }): Promise<{ count: number }> {
      const rows = selectRows(model, args.where);
      for (const row of rows) applyScalarData(model, row, args.data);
      return { count: rows.length };
    },
    async delete(args: { where: Where; include?: Include }): Promise<Row> {
      const row = selectRows(model, args.where)[0];
      if (!row) throw new Error('Record to delete not found.');
      const copy = applyInclude(model, row, args.include);
      removeRows(model, [row.id as string]);
      return copy;
    },
    async deleteMany(args: { where?: Where }): Promise<{ count: number }> {
      const rows = selectRows(model, args.where);
      removeRows(
        model,
        rows.map((row) => row.id as string),
      );
      return { count: rows.length };
    },
    async count(args: { where?: Where } = {}): Promise<number> {
      return selectRows(model, args.where).length;
    },
    async aggregate(args: Record<string, unknown>): Promise<Row> {
      return aggregate(model, args);
    },
    async groupBy(args: Record<string, unknown>): Promise<Row[]> {
      return groupBy(model, args);
    },
  };
}

function createFakePrismaInner(): Record<string, unknown> {
  const client: Record<string, unknown> = {
    async $transaction(arg: unknown): Promise<unknown> {
      if (typeof arg === 'function') {
        return (arg as (tx: unknown) => unknown)(client);
      }
      return Promise.all(arg as Promise<unknown>[]);
    },
  };
  for (const [delegate, model] of Object.entries(DELEGATES)) {
    client[delegate] = buildDelegate(model);
  }
  return client;
}

const fake = createFakePrismaInner();

/** Единый инстанс фейка (совместим по поведению с PrismaClient для тестов). */
export function createFakePrisma(): PrismaClient {
  // Мок: структурное соответствие PrismaClient достигается cast'ом (реальная
  // типизация клиента проверяется в проде tsc по @prisma/client).
  return fake as unknown as PrismaClient;
}
