import { z } from 'zod';

export const ACCOUNT_SCHEMA_VERSION = 2 as const;
export const RELIC_SLOTS = ['Head', 'Hands', 'Body', 'Feet', 'Planar Sphere', 'Link Rope'] as const;
export const STAT_KEYS = [
  'hp',
  'hpPct',
  'atk',
  'atkPct',
  'def',
  'defPct',
  'spd',
  'spdPct',
  'critRate',
  'critDmg',
  'breakEffect',
  'effectHitRate',
  'effectRes',
  'energyRegen',
  'outgoingHealing',
  'elementalDmg',
] as const;

export type RelicSlot = (typeof RELIC_SLOTS)[number];
export type StatKey = (typeof STAT_KEYS)[number];

const RELIC_MAIN_STATS: Record<RelicSlot, readonly StatKey[]> = {
  Head: ['hp'],
  Hands: ['atk'],
  Body: ['hpPct', 'atkPct', 'defPct', 'critRate', 'critDmg', 'outgoingHealing', 'effectHitRate'],
  Feet: ['hpPct', 'atkPct', 'defPct', 'spd'],
  'Planar Sphere': ['hpPct', 'atkPct', 'defPct', 'elementalDmg'],
  'Link Rope': ['hpPct', 'atkPct', 'defPct', 'breakEffect', 'energyRegen'],
};
const RELIC_SUBSTATS = new Set<StatKey>([
  'hp',
  'atk',
  'def',
  'hpPct',
  'atkPct',
  'defPct',
  'spd',
  'critRate',
  'critDmg',
  'breakEffect',
  'effectHitRate',
  'effectRes',
]);

export const StatValueSchema = z.object({
  stat: z.enum(STAT_KEYS),
  value: z.number().finite().nonnegative(),
  element: z
    .enum(['Physical', 'Fire', 'Ice', 'Lightning', 'Wind', 'Quantum', 'Imaginary'])
    .optional(),
});

export const RelicSchema = z
  .object({
    id: z.string().min(1),
    set: z.string().min(1),
    slot: z.enum(RELIC_SLOTS),
    rarity: z.number().int().min(2).max(5),
    level: z.number().int().min(0).max(15),
    mainStat: StatValueSchema,
    substats: z.array(StatValueSchema).max(4),
    locked: z.boolean().default(false),
    discarded: z.boolean().default(false),
    equippedCharacterId: z
      .string()
      .nullish()
      .transform((value) => value || undefined),
    reservedFor: z.string().optional(),
    ocrConfidence: z.number().min(0).max(1).optional(),
    note: z.string().max(500).optional(),
    tags: z.array(z.string().max(32)).max(12).optional(),
  })
  .superRefine((relic, ctx) => {
    if (relic.level > relic.rarity * 3)
      ctx.addIssue({
        code: 'custom',
        path: ['level'],
        message: 'Relic level exceeds its rarity cap.',
      });
    if (!RELIC_MAIN_STATS[relic.slot].includes(relic.mainStat.stat))
      ctx.addIssue({
        code: 'custom',
        path: ['mainStat'],
        message: `${relic.mainStat.stat} is not a valid ${relic.slot} main stat.`,
      });
    if (relic.substats.some((stat) => !RELIC_SUBSTATS.has(stat.stat)))
      ctx.addIssue({
        code: 'custom',
        path: ['substats'],
        message: 'Relic substats contain a main-stat-only or unsupported stat.',
      });
    const keys = relic.substats.map((stat) => stat.stat);
    if (new Set(keys).size !== keys.length || keys.includes(relic.mainStat.stat))
      ctx.addIssue({
        code: 'custom',
        path: ['substats'],
        message: 'Main and substats must have distinct stat types.',
      });
  });

export const TraceSchema = z.object({
  basic: z.number().int().min(1).max(7),
  skill: z.number().int().min(1).max(15),
  ultimate: z.number().int().min(1).max(15),
  talent: z.number().int().min(1).max(15),
  memospriteSkill: z.number().int().min(0).max(10).optional(),
  memospriteTalent: z.number().int().min(0).max(10).optional(),
  unlockedNodes: z.array(z.string()).default([]),
});

export const CharacterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  nickname: z.string().optional(),
  path: z.string().min(1),
  element: z.string().min(1),
  level: z.number().int().min(1).max(80),
  ascension: z.number().int().min(0).max(6),
  eidolon: z.number().int().min(0).max(6),
  traces: TraceSchema,
  baseStats: z.object({
    hp: z.number().positive(),
    atk: z.number().positive(),
    def: z.number().positive(),
    spd: z.number().positive(),
    critRate: z.number().min(0).max(1).default(0.05),
    critDmg: z.number().min(0).max(10).default(0.5),
  }),
  statBonuses: z.array(StatValueSchema).optional(),
  tags: z.array(z.string()).default([]),
  note: z.string().max(1000).optional(),
});

export const LightConeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  path: z.string().min(1),
  rarity: z.number().int().min(3).max(5),
  level: z.number().int().min(1).max(80),
  ascension: z.number().int().min(0).max(6),
  superimposition: z.number().int().min(1).max(5),
  baseStats: z
    .object({
      hp: z.number().nonnegative(),
      atk: z.number().nonnegative(),
      def: z.number().nonnegative(),
    })
    .optional(),
  statBonuses: z.array(StatValueSchema).optional(),
  locked: z.boolean().default(false),
  equippedCharacterId: z
    .string()
    .nullish()
    .transform((value) => value || undefined),
});

export const AccountSchema = z
  .object({
    metadata: z.object({
      schemaVersion: z.literal(ACCOUNT_SCHEMA_VERSION),
      gameVersion: z.string().regex(/^\d+\.\d+$/),
      exportedAt: z.string().datetime(),
      source: z.enum(['scanner', 'manual', 'showcase', 'demo', 'backup']),
      scannerVersion: z.string().optional(),
      uid: z
        .string()
        .regex(/^\d{9}$/)
        .optional(),
      uidRedacted: z.boolean().default(true),
    }),
    characters: z.array(CharacterSchema),
    lightCones: z.array(LightConeSchema),
    relics: z.array(RelicSchema),
    resources: z.record(z.string(), z.number().nonnegative()).default({}),
    reservations: z.record(z.string(), z.string()).default({}),
  })
  .superRefine((account, ctx) => {
    const characterIds = new Set(account.characters.map((character) => character.id));
    const relicIds = new Set(account.relics.map((relic) => relic.id));
    for (const collection of ['characters', 'lightCones', 'relics'] as const) {
      const ids = account[collection].map((item) => item.id);
      if (new Set(ids).size !== ids.length)
        ctx.addIssue({
          code: 'custom',
          path: [collection],
          message: `Duplicate IDs in ${collection}.`,
        });
    }
    for (const collection of ['lightCones', 'relics'] as const) {
      const equipped = new Set<string>();
      account[collection].forEach((item, index) => {
        if (!item.equippedCharacterId) return;
        if (!characterIds.has(item.equippedCharacterId))
          ctx.addIssue({
            code: 'custom',
            path: [collection, index, 'equippedCharacterId'],
            message: 'Equipped character does not exist in this account.',
          });
        const key = `${item.equippedCharacterId}:${'slot' in item ? item.slot : 'cone'}`;
        if (equipped.has(key))
          ctx.addIssue({
            code: 'custom',
            path: [collection, index],
            message: 'Multiple items equipped in the same slot.',
          });
        equipped.add(key);
      });
    }
    for (const [relicId, characterId] of Object.entries(account.reservations)) {
      if (!relicIds.has(relicId) || !characterIds.has(characterId))
        ctx.addIssue({
          code: 'custom',
          path: ['reservations', relicId],
          message: 'Reservation must reference an existing relic and character.',
        });
    }
  });

export type StatValue = z.infer<typeof StatValueSchema>;
export type Relic = z.infer<typeof RelicSchema>;
export type Character = z.infer<typeof CharacterSchema>;
export type LightCone = z.infer<typeof LightConeSchema>;
export type Account = z.infer<typeof AccountSchema>;

export interface VersionManifest {
  supportedGameVersion: string;
  gameDataRevision: string;
  optimizerVersion: string;
  scannerVersion: string;
  generatedAt: string;
  dataSource: string;
  dataSourceRevision: string;
  minScannerSchema: number;
  maxScannerSchema: number;
  staleAfter: string;
  officialVersionSource: string;
}

export interface CompatibilityResult {
  compatible: boolean;
  level: 'exact' | 'older' | 'newer' | 'invalid';
  message: string;
}

export function compareGameVersions(imported: string, supported: string): CompatibilityResult {
  if (![imported, supported].every((value) => /^\d+\.\d+$/.test(value)))
    return {
      compatible: false,
      level: 'invalid',
      message: 'The export has an invalid game version.',
    };
  const parse = (value: string) => value.split('.').map(Number);
  const [iMajor, iMinor] = parse(imported);
  const [sMajor, sMinor] = parse(supported);
  if ([iMajor, iMinor, sMajor, sMinor].some(Number.isNaN)) {
    return {
      compatible: false,
      level: 'invalid',
      message: 'The export has an invalid game version.',
    };
  }
  const delta = iMajor === sMajor ? iMinor - sMinor : iMajor - sMajor;
  if (delta === 0) return { compatible: true, level: 'exact', message: 'Versions match.' };
  if (delta < 0) {
    return {
      compatible: true,
      level: 'older',
      message: `This v${imported} snapshot can be imported, but newer game data is unavailable in it.`,
    };
  }
  return {
    compatible: false,
    level: 'newer',
    message: `This snapshot is from HSR v${imported}, newer than supported v${supported}. Stats for new or changed content may be inaccurate. Review unknown items manually before optimizing.`,
  };
}

const statAliases: Record<string, StatKey> = {
  hp: 'hp',
  'hp%': 'hpPct',
  atk: 'atk',
  'atk%': 'atkPct',
  def: 'def',
  'def%': 'defPct',
  spd: 'spd',
  'spd%': 'spdPct',
  'crit rate': 'critRate',
  'crit dmg': 'critDmg',
  'break effect': 'breakEffect',
  'effect hit rate': 'effectHitRate',
  'effect res': 'effectRes',
  'energy regeneration rate': 'energyRegen',
  'outgoing healing boost': 'outgoingHealing',
  'physical dmg boost': 'elementalDmg',
  'fire dmg boost': 'elementalDmg',
  'ice dmg boost': 'elementalDmg',
  'lightning dmg boost': 'elementalDmg',
  'wind dmg boost': 'elementalDmg',
  'quantum dmg boost': 'elementalDmg',
  'imaginary dmg boost': 'elementalDmg',
};

export function normalizeStat(raw: any): StatValue {
  if (!raw || typeof raw !== 'object')
    throw new Error('Stat must include a name and numeric value.');
  const original = String(raw.stat ?? raw.name ?? raw.key ?? '');
  const name = original.toLowerCase();
  const canonical = STAT_KEYS.find((key) => key.toLowerCase() === name);
  const stat = canonical ?? statAliases[name];
  if (!stat) throw new Error(`Unknown stat: ${name || '(empty)'}`);
  let value = Number(String(raw.value ?? '').replace('%', ''));
  // Canonical schema values are fractions; scanner display aliases are percentage points.
  // Never guess the unit from magnitude (a 1.9% roll is not 190%).
  if (!canonical && !['hp', 'atk', 'def', 'spd'].includes(stat)) value /= 100;
  const element =
    raw.element ??
    (/^(physical|fire|ice|lightning|wind|quantum|imaginary) dmg/.test(name)
      ? name.split(' ')[0].replace(/^./, (c) => c.toUpperCase())
      : undefined);
  return StatValueSchema.parse({ stat, value, element });
}

function normalizeSlot(value: string): RelicSlot {
  const slots: Record<string, RelicSlot> = {
    head: 'Head',
    hands: 'Hands',
    hand: 'Hands',
    body: 'Body',
    feet: 'Feet',
    foot: 'Feet',
    sphere: 'Planar Sphere',
    planarsphere: 'Planar Sphere',
    'planar sphere': 'Planar Sphere',
    rope: 'Link Rope',
    linkrope: 'Link Rope',
    'link rope': 'Link Rope',
  };
  const slot = slots[value.toLowerCase().replace(/[_-]/g, ' ')];
  if (!slot) throw new Error(`Unknown relic slot: ${value}`);
  return slot;
}

export function migrateAccount(input: unknown, supportedGameVersion: string): Account {
  if (typeof input !== 'object' || input === null)
    throw new Error('Account export must be an object.');
  const raw = input as any;
  if (raw.metadata?.schemaVersion > ACCOUNT_SCHEMA_VERSION)
    throw new Error(
      `Unsupported account schema ${raw.metadata.schemaVersion}. Update the application before importing; no data was changed.`,
    );
  if (raw.metadata?.schemaVersion === ACCOUNT_SCHEMA_VERSION) return AccountSchema.parse(raw);

  const source = raw.source && typeof raw.source === 'object' ? raw.source : raw;
  if (
    !['characters', 'relics', 'lightCones', 'light_cones'].some((key) => Array.isArray(source[key]))
  )
    throw new Error('This file does not contain a recognized account inventory.');
  const characters = (source.characters ?? []).map((character: any, index: number) => ({
    id: String(character.id ?? character.key ?? `character-${index}`),
    name: String(character.name ?? `Character ${index + 1}`),
    path: String(character.path ?? 'Unknown'),
    element: String(character.element ?? 'Unknown'),
    level: Number(character.level ?? 80),
    ascension: Number(character.ascension ?? 6),
    eidolon: Number(character.eidolon ?? character.eidola ?? 0),
    traces: {
      basic: Number(character.traces?.basic ?? character.skills?.basic ?? 1),
      skill: Number(character.traces?.skill ?? character.skills?.skill ?? 1),
      ultimate: Number(character.traces?.ultimate ?? character.skills?.ult ?? 1),
      talent: Number(character.traces?.talent ?? character.skills?.talent ?? 1),
      unlockedNodes: character.traces?.unlockedNodes ?? [],
    },
    baseStats: character.baseStats,
    statBonuses: character.statBonuses ?? [],
    tags: character.tags ?? [],
  }));

  const relics = (source.relics ?? []).map((relic: any, index: number) => ({
    id: String(relic.id ?? relic.key ?? `relic-${index}`),
    set: String(relic.set ?? relic.setName ?? relic.name ?? 'Unknown Set'),
    slot: normalizeSlot(String(relic.slot ?? relic.type ?? '')),
    rarity: Number(relic.rarity ?? 5),
    level: Number(relic.level ?? 0),
    mainStat: normalizeStat(
      relic.mainStat ?? { stat: relic.mainstat ?? 'HP', value: relic.mainstatValue ?? 0 },
    ),
    substats: (relic.substats ?? []).map(normalizeStat),
    locked: Boolean(relic.locked),
    discarded: Boolean(relic.discarded ?? relic.discard),
    equippedCharacterId: relic.equippedCharacterId ?? relic.location,
    ocrConfidence: relic.ocrConfidence,
  }));

  const lightCones = (source.lightCones ?? source.light_cones ?? []).map(
    (cone: any, index: number) => ({
      id: String(cone.id ?? cone.key ?? `cone-${index}`),
      name: String(cone.name ?? `Light Cone ${index + 1}`),
      path: String(cone.path ?? 'Unknown'),
      rarity: Number(cone.rarity ?? 5),
      level: Number(cone.level ?? 80),
      ascension: Number(cone.ascension ?? 6),
      superimposition: Number(cone.superimposition ?? cone.superimpose ?? 1),
      baseStats: cone.baseStats,
      statBonuses: cone.statBonuses ?? [],
      locked: Boolean(cone.locked),
      equippedCharacterId: cone.equippedCharacterId ?? cone.location,
    }),
  );

  return AccountSchema.parse({
    metadata: {
      schemaVersion: ACCOUNT_SCHEMA_VERSION,
      gameVersion: String(raw.metadata?.gameVersion ?? raw.gameVersion ?? supportedGameVersion),
      exportedAt: raw.metadata?.exportedAt ?? new Date().toISOString(),
      source: raw.metadata?.source ?? 'scanner',
      scannerVersion: raw.metadata?.scannerVersion ?? raw.build,
      uidRedacted: raw.metadata?.uidRedacted ?? true,
    },
    characters,
    lightCones,
    relics,
    resources: raw.resources ?? {},
    reservations: raw.reservations ?? {},
  });
}

export function privacySafeExport(account: Account): Account {
  return {
    ...account,
    metadata: {
      ...account.metadata,
      uid: undefined,
      uidRedacted: true,
      exportedAt: new Date().toISOString(),
    },
    characters: account.characters.map(({ note: _note, nickname: _nickname, ...character }) => ({
      ...character,
      tags: [],
    })),
    relics: account.relics.map(({ note: _note, ...relic }) => ({ ...relic, tags: [] })),
  };
}
