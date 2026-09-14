import type {
  Account,
  Character,
  LightCone,
  Relic,
  RelicSlot,
  StatKey,
  StatValue,
} from '@ksro/shared';
import { RELIC_SLOTS } from '@ksro/shared';
import { gameData, relicRolls } from '@ksro/game-data';
import { calculateDamage, type CombatStats, type DamageConfig } from '@ksro/combat-engine';

export type StatWeights = Partial<Record<StatKey, number>>;

export interface StatConstraint {
  stat: StatKey;
  min?: number;
  max?: number;
}

export interface OptimizerOptions {
  character: Character;
  relics: Relic[];
  weights: StatWeights;
  lightCone?: LightCone;
  buffs?: Array<{ name: string; stats: StatValue[]; uptime: number }>;
  mainStats?: Partial<Record<RelicSlot, StatKey[]>>;
  requiredSets?: Array<{ set: string; count: number }>;
  requiredSubstats?: StatKey[];
  reservations?: Record<string, string>;
  objective?: 'weighted' | 'damage' | 'survival' | 'auto' | 'balanced';
  constraints?: StatConstraint[];
  excludedRelicIds?: string[];
  pinnedRelicIds?: string[];
  allowEquipped?: boolean;
  allowLocked?: boolean;
  includeDiscarded?: boolean;
  exact?: boolean;
  candidateCap?: number;
  limit?: number;
  damageConfig?: Partial<DamageConfig>;
  setBonuses?: boolean;
  onProgress?: (progress: number, evaluated: number) => void;
  shouldCancel?: () => boolean;
}

export interface BuildResult {
  id: string;
  characterId: string;
  relics: Relic[];
  stats: CombatStats;
  weightedScore: number;
  damage: number;
  survivability: number;
  autoConsistency: number;
  rotationStability: number;
  skillPointStability: number;
  practicality: number;
  transferCount: number;
  explanation: string[];
}

const emptyStats = (): CombatStats => ({ hp: 0, atk: 0, def: 0, spd: 0, critRate: 0, critDmg: 0 });

export function addStat(stats: CombatStats, stat: StatKey, value: number) {
  stats[stat] = (stats[stat] ?? 0) + value;
}

const setBonuses: Record<string, { count: number; stat: StatKey; value: number }[]> = {
  'Musketeer of Wild Wheat': [{ count: 2, stat: 'atkPct', value: 0.12 }],
  'Messenger Traversing Hackerspace': [{ count: 2, stat: 'spdPct', value: 0.06 }],
  'Scholar Lost in Erudition': [{ count: 2, stat: 'critRate', value: 0.08 }],
  'Prisoner in Deep Confinement': [{ count: 2, stat: 'atkPct', value: 0.12 }],
  'Iron Cavalry Against the Scourge': [{ count: 2, stat: 'breakEffect', value: 0.16 }],
  'Watchmaker, Master of Dream Machinations': [{ count: 2, stat: 'breakEffect', value: 0.16 }],
  'Forge of the Kalpagni Lantern': [{ count: 2, stat: 'spdPct', value: 0.06 }],
  'Broken Keel': [{ count: 2, stat: 'effectRes', value: 0.1 }],
  'Rutilant Arena': [{ count: 2, stat: 'critRate', value: 0.08 }],
  "Sacerdos' Relived Ordeal": [{ count: 2, stat: 'spdPct', value: 0.06 }],
  'Warrior Goddess of Sun and Thunder': [{ count: 2, stat: 'spdPct', value: 0.06 }],
  'Thief of Shooting Meteor': [
    { count: 2, stat: 'breakEffect', value: 0.16 },
    { count: 4, stat: 'breakEffect', value: 0.16 },
  ],
  'Knight of Purity Palace': [{ count: 2, stat: 'defPct', value: 0.15 }],
  'Longevous Disciple': [{ count: 2, stat: 'hpPct', value: 0.12 }],
  'Passerby of Wandering Cloud': [{ count: 2, stat: 'outgoingHealing', value: 0.1 }],
  'Space Sealing Station': [{ count: 2, stat: 'atkPct', value: 0.12 }],
  'Fleet of the Ageless': [{ count: 2, stat: 'hpPct', value: 0.12 }],
  'Pan-Cosmic Commercial Enterprise': [{ count: 2, stat: 'effectHitRate', value: 0.1 }],
  'Belobog of the Architects': [{ count: 2, stat: 'defPct', value: 0.15 }],
  'Celestial Differentiator': [{ count: 2, stat: 'critDmg', value: 0.16 }],
  'Inert Salsotto': [{ count: 2, stat: 'critRate', value: 0.08 }],
  'Talia: Kingdom of Banditry': [{ count: 2, stat: 'breakEffect', value: 0.16 }],
  'Sprightly Vonwacq': [{ count: 2, stat: 'energyRegen', value: 0.05 }],
  'Penacony, Land of the Dreams': [{ count: 2, stat: 'energyRegen', value: 0.05 }],
  'Lushaka, the Sunken Seas': [{ count: 2, stat: 'energyRegen', value: 0.05 }],
  'Firmament Frontline: Glamoth': [{ count: 2, stat: 'atkPct', value: 0.12 }],
  'Izumo Gensei and Takama Divine Realm': [{ count: 2, stat: 'atkPct', value: 0.12 }],
  'The Wind-Soaring Valorous': [
    { count: 2, stat: 'atkPct', value: 0.12 },
    { count: 4, stat: 'critRate', value: 0.06 },
  ],
};

export function calculateBuildStats(
  character: Character,
  relics: Relic[],
  applySets = true,
  lightCone?: LightCone,
  buffs: OptimizerOptions['buffs'] = [],
): CombatStats {
  const additive = emptyStats();
  const addValue = (value: StatValue) => {
    if (!value.element || value.element === character.element)
      addStat(additive, value.stat, value.value);
  };
  for (const value of character.statBonuses ?? []) addValue(value);
  if (lightCone?.path === character.path)
    for (const value of lightCone.statBonuses ?? []) addValue(value);
  for (const buff of buffs) {
    if (!Number.isFinite(buff.uptime) || buff.uptime < 0 || buff.uptime > 1)
      throw new Error('Buff uptime must be between 0 and 1.');
    for (const value of buff.stats) addValue({ ...value, value: value.value * buff.uptime });
  }
  for (const relic of relics) {
    addValue(relic.mainStat);
    for (const substat of relic.substats) addValue(substat);
  }
  if (applySets) {
    const counts = relics.reduce<Record<string, number>>((result, relic) => {
      result[relic.set] = (result[relic.set] ?? 0) + 1;
      return result;
    }, {});
    for (const [set, bonuses] of Object.entries(setBonuses)) {
      for (const bonus of bonuses)
        if ((counts[set] ?? 0) >= bonus.count) addStat(additive, bonus.stat, bonus.value);
    }
    const elementalSets: Record<string, string> = {
      'Champion of Streetwise Boxing': 'Physical',
      'Firesmith of Lava-Forging': 'Fire',
      'Hunter of Glacial Forest': 'Ice',
      'Band of Sizzling Thunder': 'Lightning',
      'Eagle of Twilight Line': 'Wind',
      'Genius of Brilliant Stars': 'Quantum',
      'Wastelander of Banditry Desert': 'Imaginary',
    };
    for (const [set, element] of Object.entries(elementalSets))
      if ((counts[set] ?? 0) >= 2 && character.element === element)
        addStat(additive, 'elementalDmg', 0.1);
    if ((counts['Musketeer of Wild Wheat'] ?? 0) >= 4) addStat(additive, 'spdPct', 0.06);
  }
  const catalogCone =
    lightCone?.level === 80 && lightCone.ascension === 6
      ? gameData.lightCones.find((cone) => cone.name === lightCone.name)
      : undefined;
  const coneStats = lightCone?.baseStats ?? catalogCone?.baseStats;
  const base = {
    hp: character.baseStats.hp + (coneStats?.hp ?? 0),
    atk: character.baseStats.atk + (coneStats?.atk ?? 0),
    def: character.baseStats.def + (coneStats?.def ?? 0),
  };
  const speed = character.baseStats.spd * (1 + (additive.spdPct ?? 0)) + additive.spd;
  if (applySets) {
    const count = (set: string) => relics.filter((relic) => relic.set === set).length;
    if (count('Space Sealing Station') >= 2 && speed >= 120) addStat(additive, 'atkPct', 0.12);
    if (count('Talia: Kingdom of Banditry') >= 2 && speed >= 145)
      addStat(additive, 'breakEffect', 0.2);
    if (count('Belobog of the Architects') >= 2 && (additive.effectHitRate ?? 0) >= 0.5)
      addStat(additive, 'defPct', 0.15);
    if (count('Pan-Cosmic Commercial Enterprise') >= 2)
      addStat(additive, 'atkPct', Math.min(0.25, (additive.effectHitRate ?? 0) * 0.25));
  }
  return {
    ...additive,
    hp: base.hp * (1 + (additive.hpPct ?? 0)) + additive.hp,
    atk: base.atk * (1 + (additive.atkPct ?? 0)) + additive.atk,
    def: base.def * (1 + (additive.defPct ?? 0)) + additive.def,
    spd: speed,
    critRate: character.baseStats.critRate + additive.critRate,
    critDmg: character.baseStats.critDmg + additive.critDmg,
  };
}

function weightedStatScore(stats: CombatStats, weights: StatWeights) {
  return Object.entries(weights).reduce(
    (sum, [key, weight]) => sum + (stats[key as StatKey] ?? 0) * (weight ?? 0),
    0,
  );
}

function relicRawScore(relic: Relic, weights: StatWeights) {
  return [relic.mainStat, ...relic.substats].reduce(
    (sum, item) => sum + item.value * (weights[item.stat] ?? 0),
    0,
  );
}

function constraintsPass(stats: CombatStats, constraints: StatConstraint[] = []) {
  return constraints.every(({ stat, min, max }) => {
    const value = stats[stat] ?? 0;
    return (min === undefined || value >= min) && (max === undefined || value <= max);
  });
}

export function buildResult(options: OptimizerOptions, relics: Relic[]): BuildResult {
  const stats = calculateBuildStats(
    options.character,
    relics,
    options.setBonuses !== false,
    options.lightCone,
    options.buffs,
  );
  const damage = calculateDamage(stats, {
    characterLevel: options.character.level,
    enemyLevel: 95,
    abilityMultiplier: 3,
    targetCount: 1,
    enemyResistance: 0.2,
    ...options.damageConfig,
  }).totalExpected;
  const transferCount = relics.filter(
    (relic) => relic.equippedCharacterId !== options.character.id,
  ).length;
  const critReliability = Math.min(1, Math.max(0, stats.critRate));
  const autoConsistency =
    100 * Math.max(0, Math.min(1, critReliability * 0.65 + Math.min(1, stats.def / 1200) * 0.35));
  const survivability = stats.hp * (1 + stats.def / 1500);
  const rotationStability = 100 * Math.min(1, stats.spd / 160);
  const skillPointStability = 70 + Math.min(20, (stats.energyRegen ?? 0) * 100);
  const objective = options.objective ?? 'weighted';
  const weightedScore =
    objective === 'damage'
      ? damage
      : objective === 'survival'
        ? survivability
        : objective === 'auto'
          ? damage * (0.5 + autoConsistency / 200)
          : objective === 'balanced'
            ? damage / 100 + survivability / 500 + stats.spd
            : weightedStatScore(stats, options.weights);
  return {
    id: relics.map((relic) => relic.id).join('|'),
    characterId: options.character.id,
    relics,
    stats,
    weightedScore,
    damage,
    survivability,
    autoConsistency,
    rotationStability,
    skillPointStability,
    practicality: Math.max(0, 100 - transferCount * 12),
    transferCount,
    explanation: [
      `Generic ${options.damageConfig?.scalingStat ?? 'atk'}-scaling hit: ${Math.round(damage).toLocaleString()}. Character kit, Eidolon and Light Cone conditionals require explicit manual inputs; this is not a full-kit DPS simulation.`,
      ...(options.lightCone && !options.lightCone.baseStats && options.lightCone.level !== 80
        ? [
            'Light Cone base stats unavailable at this level: enter them manually before trusting damage.',
          ]
        : []),
      'AUTO, rotation and SP scores are heuristic indicators, not verified auto-battle behavior.',
      `${stats.spd.toFixed(1)} SPD; ${Math.round(stats.critRate * 100)}% CRIT Rate / ${Math.round(stats.critDmg * 100)}% CRIT DMG.`,
      transferCount
        ? `${transferCount} relic transfer${transferCount === 1 ? '' : 's'} required.`
        : 'No equipment transfer required.',
    ],
  };
}

export function optimizeRelics(options: OptimizerOptions): BuildResult[] {
  if (!Number.isInteger(options.limit ?? 20) || (options.limit ?? 20) < 1)
    throw new Error('Result limit must be positive.');
  if (new Set(options.relics.map((relic) => relic.id)).size !== options.relics.length)
    throw new Error('Duplicate relic IDs.');
  const excluded = new Set(options.excludedRelicIds ?? []);
  const pinned = new Set(options.pinnedRelicIds ?? []);
  for (const id of pinned)
    if (!options.relics.some((relic) => relic.id === id))
      throw new Error(`Pinned relic ${id} is not in the inventory.`);
  const limit = options.limit ?? 20;
  const candidates = new Map<RelicSlot, Relic[]>();
  for (const slot of RELIC_SLOTS) {
    const pinnedForSlot = options.relics.filter(
      (relic) => relic.slot === slot && pinned.has(relic.id),
    );
    if (pinnedForSlot.length > 1) throw new Error(`Only one ${slot} relic can be pinned.`);
    const available = options.relics
      .filter((relic) => relic.slot === slot)
      .filter((relic) => !excluded.has(relic.id))
      .filter((relic) => options.includeDiscarded || !relic.discarded)
      .filter(
        (relic) =>
          options.allowLocked ||
          !relic.locked ||
          relic.equippedCharacterId === options.character.id,
      )
      .filter(
        (relic) =>
          options.allowEquipped ||
          !relic.equippedCharacterId ||
          relic.equippedCharacterId === options.character.id,
      )
      .filter((relic) => !relic.reservedFor || relic.reservedFor === options.character.id)
      .filter(
        (relic) =>
          !options.reservations?.[relic.id] ||
          options.reservations[relic.id] === options.character.id,
      )
      .filter(
        (relic) =>
          !options.mainStats?.[slot]?.length ||
          options.mainStats[slot]!.includes(relic.mainStat.stat),
      )
      .filter(
        (relic) =>
          !options.requiredSubstats?.length ||
          options.requiredSubstats.every((stat) =>
            relic.substats.some((substat) => substat.stat === stat),
          ),
      )
      .sort(
        (a, b) =>
          relicRawScore(b, options.weights) - relicRawScore(a, options.weights) ||
          a.id.localeCompare(b.id),
      );
    if (
      pinnedForSlot.some((pinnedRelic) => !available.some((relic) => relic.id === pinnedRelic.id))
    )
      throw new Error(`Pinned ${slot} relic conflicts with equipment rules or filters.`);
    const selected = pinnedForSlot.length
      ? pinnedForSlot
      : options.exact
        ? available
        : available.slice(0, options.candidateCap ?? 6);
    if (!selected.length) return [];
    candidates.set(slot, selected);
  }
  const total = RELIC_SLOTS.reduce(
    (product, slot) => product * (candidates.get(slot)?.length ?? 0),
    1,
  );
  const results: BuildResult[] = [];
  let evaluated = 0;
  let cancelled = false;
  const visit = (index: number, selected: Relic[]) => {
    if (cancelled || options.shouldCancel?.()) {
      cancelled = true;
      return;
    }
    if (index === RELIC_SLOTS.length) {
      evaluated += 1;
      const result = buildResult(options, selected);
      if (
        constraintsPass(result.stats, options.constraints) &&
        (options.requiredSets ?? []).every(
          ({ set, count }) => selected.filter((relic) => relic.set === set).length >= count,
        )
      ) {
        results.push(result);
        results.sort((a, b) => b.weightedScore - a.weightedScore || a.id.localeCompare(b.id));
        if (results.length > limit) results.length = limit;
      }
      if (evaluated % 250 === 0) options.onProgress?.(Math.min(1, evaluated / total), evaluated);
      return;
    }
    for (const relic of candidates.get(RELIC_SLOTS[index]) ?? [])
      visit(index + 1, [...selected, relic]);
  };
  visit(0, []);
  options.onProgress?.(cancelled ? Math.min(0.99, evaluated / total) : 1, evaluated);
  return results;
}

export function paretoFrontier(builds: BuildResult[]): BuildResult[] {
  return builds.filter(
    (candidate) =>
      !builds.some(
        (other) =>
          other.id !== candidate.id &&
          other.damage >= candidate.damage &&
          other.stats.spd >= candidate.stats.spd &&
          other.survivability >= candidate.survivability &&
          (other.damage > candidate.damage ||
            other.stats.spd > candidate.stats.spd ||
            other.survivability > candidate.survivability),
      ),
  );
}

export interface MultiTeamRules {
  teamSize?: number;
  noSharedRelics?: boolean;
  objective?: 'score' | 'cycles' | 'balanced';
  mandatoryCharacterIds?: string[];
  excludedCharacterIds?: string[];
  noDuplicateLightCones?: boolean;
  shouldCancel?: () => boolean;
}

export interface MultiTeamPlan {
  builds: BuildResult[];
  totalScore: number;
  estimatedCycles: null;
  tradeoffs: string[];
  transfers: Array<{ relicId: string; from: string; to: string }>;
}

export function optimizeMultiTeam(
  account: Account,
  characterIds: string[],
  teams: number,
  rules: MultiTeamRules = {},
): MultiTeamPlan[] {
  const excluded = new Set(rules.excludedCharacterIds ?? []);
  const size = rules.teamSize ?? 4;
  if (!Number.isInteger(teams) || teams < 1 || !Number.isInteger(size) || size < 1 || size > 4)
    throw new Error('Invalid team count or size.');
  const chosen = [...new Set([...(rules.mandatoryCharacterIds ?? []), ...characterIds])]
    .filter((id) => !excluded.has(id))
    .slice(0, teams * size);
  if ((rules.mandatoryCharacterIds ?? []).some((id) => excluded.has(id) || !chosen.includes(id)))
    return [];
  if (
    chosen.length !== teams * size ||
    chosen.some((id) => !account.characters.some((character) => character.id === id))
  )
    return [];
  if (
    rules.noDuplicateLightCones &&
    new Set(
      account.lightCones
        .filter((cone) => chosen.includes(cone.equippedCharacterId ?? ''))
        .map((cone) => cone.name),
    ).size <
      account.lightCones.filter((cone) => chosen.includes(cone.equippedCharacterId ?? '')).length
  )
    return [];
  const multiWeights: StatWeights = {
    atkPct: 160,
    critRate: 420,
    critDmg: 220,
    spd: 12,
    elementalDmg: 180,
  };
  const fallbackByCharacter = new Map<string, Relic[]>(chosen.map((id) => [id, []]));
  for (const slot of RELIC_SLOTS) {
    const matching = new Map<string, string>();
    const eligible = (characterId: string) =>
      account.relics
        .filter((relic) => relic.slot === slot)
        .filter((relic) => !relic.discarded)
        .filter((relic) => !relic.locked || relic.equippedCharacterId === characterId)
        .filter((relic) => !relic.reservedFor || relic.reservedFor === characterId)
        .filter(
          (relic) =>
            !account.reservations[relic.id] || account.reservations[relic.id] === characterId,
        )
        .sort(
          (a, b) =>
            Number(b.equippedCharacterId === characterId) -
              Number(a.equippedCharacterId === characterId) ||
            relicRawScore(b, multiWeights) - relicRawScore(a, multiWeights) ||
            a.id.localeCompare(b.id),
        );
    const assign = (characterId: string, visited: Set<string>): boolean => {
      for (const relic of eligible(characterId)) {
        if (visited.has(relic.id)) continue;
        visited.add(relic.id);
        const previous = matching.get(relic.id);
        if (!previous || assign(previous, visited)) {
          matching.set(relic.id, characterId);
          return true;
        }
      }
      return false;
    };
    if (!chosen.every((id) => assign(id, new Set()))) return [];
    for (const [relicId, characterId] of matching) {
      const relic = account.relics.find((item) => item.id === relicId);
      if (relic) fallbackByCharacter.get(characterId)!.push(relic);
    }
  }
  const candidates = chosen.map((id) => {
    const character = account.characters.find((item) => item.id === id);
    if (!character) return [];
    const options: OptimizerOptions = {
      character,
      relics: account.relics,
      lightCone: account.lightCones.find((cone) => cone.equippedCharacterId === id),
      reservations: account.reservations,
      weights: multiWeights,
      allowEquipped: true,
      allowLocked: false,
      limit: 5,
      candidateCap: 3,
    };
    const optimized = optimizeRelics(options);
    const fallback = fallbackByCharacter.get(id) ?? [];
    if (fallback.length === RELIC_SLOTS.length) {
      const build = buildResult(options, fallback);
      if (!optimized.some((candidate) => candidate.id === build.id)) optimized.push(build);
    }
    const equipped = account.relics
      .filter((relic) => relic.equippedCharacterId === character.id)
      .sort((a, b) => RELIC_SLOTS.indexOf(a.slot) - RELIC_SLOTS.indexOf(b.slot));
    if (
      equipped.length === RELIC_SLOTS.length &&
      new Set(equipped.map((relic) => relic.slot)).size === 6 &&
      equipped.every(
        (relic) =>
          !relic.discarded &&
          (!relic.reservedFor || relic.reservedFor === id) &&
          (!account.reservations[relic.id] || account.reservations[relic.id] === id),
      )
    ) {
      const current = buildResult(options, equipped);
      if (!optimized.some((build) => build.id === current.id)) optimized.push(current);
    }
    return optimized;
  });
  if (candidates.some((items) => items.length === 0)) return [];
  const suffixMax = new Array(candidates.length + 1).fill(0);
  for (let index = candidates.length - 1; index >= 0; index--)
    suffixMax[index] =
      suffixMax[index + 1] + Math.max(...candidates[index].map((build) => build.weightedScore));
  const plans: MultiTeamPlan[] = [];
  const search = (index: number, selected: BuildResult[], usedRelics: Set<string>) => {
    if (rules.shouldCancel?.()) return;
    if (
      plans.length === 8 &&
      selected.reduce((sum, build) => sum + build.weightedScore, 0) + suffixMax[index] <
        plans[7].totalScore
    )
      return;
    if (index === candidates.length) {
      const totalScore = selected.reduce((sum, build) => sum + build.weightedScore, 0);
      const transfers = selected.flatMap((build) =>
        build.relics
          .filter((relic) => relic.equippedCharacterId !== build.characterId)
          .map((relic) => ({
            relicId: relic.id,
            from: relic.equippedCharacterId ?? 'inventory',
            to: build.characterId,
          })),
      );
      plans.push({
        builds: selected,
        totalScore,
        estimatedCycles: null,
        transfers,
        tradeoffs: transfers.length
          ? [
              `Joint assignment avoids duplicate relics at the cost of ${transfers.length} equipment moves.`,
            ]
          : ['All teams keep non-conflicting equipment.'],
      });
      plans.sort((a, b) => b.totalScore - a.totalScore);
      if (plans.length > 8) plans.length = 8;
      return;
    }
    for (const build of candidates[index]) {
      const relicIds = build.relics.map((relic) => relic.id);
      if (rules.noSharedRelics !== false && relicIds.some((id) => usedRelics.has(id))) continue;
      search(index + 1, [...selected, build], new Set([...usedRelics, ...relicIds]));
    }
  };
  search(0, [], new Set());
  return plans;
}

export interface RelicAssessment {
  relicId: string;
  currentScore: number;
  potentialScore: number;
  currentGrade: string;
  potentialGrade: string;
  rollQuality: number;
  accountPercentile: number;
  recommendation: 'lock' | 'level' | 'stop' | 'review' | 'salvage';
  bestCharacters: string[];
  explanation: string;
}

const grade = (score: number) =>
  score >= 90 ? 'S' : score >= 75 ? 'A' : score >= 58 ? 'B' : score >= 42 ? 'C' : 'D';

export function scoreRelics(account: Account, weights: StatWeights): RelicAssessment[] {
  const raw = account.relics.map((relic) => ({ relic, score: relicRawScore(relic, weights) }));
  const sorted = raw.map((item) => item.score).sort((a, b) => a - b);
  return raw.map(({ relic, score }) => {
    const normalized = Math.min(100, Math.max(0, score));
    const remainingRolls = Math.max(0, Math.floor((15 - relic.level) / 3));
    const potential = Math.min(100, normalized + remainingRolls * 7.2);
    const percentile =
      sorted.length === 1
        ? 100
        : (100 * sorted.filter((item) => item <= score).length) / sorted.length;
    const bestCharacters = account.characters
      .map((character) => ({
        character,
        fit:
          relic.substats.reduce(
            (sum, stat) => sum + (stat.stat === 'spd' ? 2 : stat.stat.startsWith('crit') ? 3 : 1),
            0,
          ) + (character.path === 'Harmony' && relic.mainStat.stat === 'spd' ? 5 : 0),
      }))
      .sort((a, b) => b.fit - a.fit || a.character.name.localeCompare(b.character.name))
      .slice(0, 3)
      .map((item) => item.character.name);
    const recommendation: RelicAssessment['recommendation'] =
      normalized >= 82
        ? 'lock'
        : potential >= 75 && relic.level < 15
          ? 'level'
          : normalized >= 58
            ? 'review'
            : relic.level >= 12
              ? 'stop'
              : 'salvage';
    return {
      relicId: relic.id,
      currentScore: normalized,
      potentialScore: potential,
      currentGrade: grade(normalized),
      potentialGrade: grade(potential),
      rollQuality: Math.min(1, (relic.substats.length / 4) * (0.65 + relic.rarity * 0.07)),
      accountPercentile: percentile,
      recommendation,
      bestCharacters,
      explanation: `${grade(normalized)} now; ${remainingRolls} upgrade roll${remainingRolls === 1 ? '' : 's'} remain. It is at the ${Math.round(percentile)}th percentile of this account.`,
    };
  });
}

export interface UpgradeAdvice {
  relicId: string;
  nextStop: number;
  improvementProbability: number;
  bestOutcome: number;
  expectedOutcome: number;
  worstOutcome: number;
  materialCost: number;
  recommendation: 'level' | 'stop' | 'review' | 'salvage';
  viableRolls: StatKey[];
  explanation: string;
}

export function adviseRelicUpgrade(
  relic: Relic,
  weights: StatWeights,
  accountThreshold: number,
): UpgradeAdvice {
  const current = relic.substats.reduce(
    (sum, stat) => sum + stat.value * (weights[stat.stat] ?? 0),
    0,
  );
  const cap = relic.rarity * 3;
  const nextStop = Math.min(cap, Math.ceil((relic.level + 1) / 3) * 3);
  const tiers = relicRolls[String(relic.rarity)] ?? {};
  const occupied = new Set(relic.substats.map((item) => item.stat));
  const useful = Object.entries(weights)
    .filter(([, weight]) => (weight ?? 0) > 0)
    .map(([stat]) => stat as StatKey);
  const possible =
    relic.substats.length === 4
      ? [...occupied]
      : (Object.keys(tiers).filter(
          (stat) => stat !== relic.mainStat.stat && !occupied.has(stat as StatKey),
        ) as StatKey[]);
  const viable = useful.filter((stat) => possible.includes(stat));
  const outcomes =
    relic.level >= cap
      ? [current]
      : possible.flatMap((stat) =>
          (tiers[stat] ?? []).map((roll) => current + roll * (weights[stat] ?? 0)),
        );
  const bestOutcome = outcomes.length ? Math.max(...outcomes) : current;
  const worstOutcome = outcomes.length ? Math.min(...outcomes) : current;
  const expectedOutcome = outcomes.length
    ? outcomes.reduce((sum, value) => sum + value, 0) / outcomes.length
    : current;
  const improvementProbability =
    relic.level >= cap
      ? 0
      : outcomes.filter((value) => value > accountThreshold).length / Math.max(1, outcomes.length);
  const recommendation: UpgradeAdvice['recommendation'] =
    relic.level >= cap
      ? 'stop'
      : relic.locked || relic.reservedFor || relic.equippedCharacterId
        ? 'review'
        : bestOutcome <= accountThreshold
          ? 'salvage'
          : expectedOutcome >= accountThreshold
            ? 'level'
            : improvementProbability >= 0.35
              ? 'review'
              : 'stop';
  return {
    relicId: relic.id,
    nextStop,
    improvementProbability,
    bestOutcome,
    expectedOutcome,
    worstOutcome,
    materialCost: Math.max(0, nextStop - relic.level) * 1500 * relic.rarity,
    recommendation,
    viableRolls: viable,
    explanation: `By +${nextStop}: ${Math.round(improvementProbability * 100)}% chance that weighted substat score exceeds ${accountThreshold}. ${outcomes.length} next-roll outcomes enumerated from versioned roll values. Assumes equally likely tiers${relic.substats.length < 4 ? ' and uniformly selected eligible new substats (experimental; real unlock weights differ)' : ' and existing substats'}. This is not the probability of improving a full build. Main-stat growth excluded; material cost is an unverified planning estimate.`,
  };
}

export interface FarmingTarget {
  id: string;
  name: string;
  beneficiaries: string[];
  guaranteedValue: number;
  rngValue: number;
  powerCost: number;
  reason: string;
}

export function planFarming(account: Account, horizonDays: number): FarmingTarget[] {
  if (!Number.isInteger(horizonDays) || horizonDays < 1 || horizonDays > 365)
    throw new Error('Planning horizon must be 1–365 days.');
  const underLevelled = account.characters.filter(
    (character) =>
      character.level < 80 ||
      character.traces.basic < 6 ||
      ['skill', 'ultimate', 'talent'].some((key) => character.traces[key as 'skill'] < 10),
  );
  const setCounts = account.relics.reduce<Record<string, number>>((result, relic) => {
    result[relic.set] = (result[relic.set] ?? 0) + (relic.level >= 12 ? 1 : 0);
    return result;
  }, {});
  const targets: FarmingTarget[] = underLevelled.slice(0, 4).map((character) => ({
    id: `trace-${character.id}`,
    name: `${character.name} guaranteed upgrades`,
    beneficiaries: [character.name],
    guaranteedValue:
      (80 - character.level) * 0.5 +
      Math.max(0, 6 - character.traces.basic) * 4 +
      (['skill', 'ultimate', 'talent'] as const).reduce(
        (sum, key) => sum + Math.max(0, 10 - character.traces[key]) * 6,
        0,
      ),
    rngValue: 0,
    powerCost: Math.min(horizonDays * 240, 360),
    reason:
      'Upgrade priority score, not a predicted damage gain. Power shown is a budget allocation; material inventory and drop rates are not yet modelled.',
  }));
  for (const set of Object.entries(setCounts)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 4)) {
    targets.push({
      id: `relic-${set[0]}`,
      name: `Improve ${set[0]}`,
      beneficiaries: account.characters
        .filter((character) =>
          account.relics.some(
            (relic) => relic.set === set[0] && relic.equippedCharacterId === character.id,
          ),
        )
        .map((character) => character.name),
      guaranteedValue: 0,
      rngValue: Math.max(5, 55 - set[1] * 4),
      powerCost: Math.min(horizonDays * 120, 480),
      reason: `${set[1]} levelled pieces found. Coverage heuristic only; this does not establish drop probabilities or a below-median build.`,
    });
  }
  const ranked = targets.sort(
    (a, b) =>
      (b.guaranteedValue + b.rngValue * 0.45) / b.powerCost -
      (a.guaranteedValue + a.rngValue * 0.45) / a.powerCost,
  );
  let budget = horizonDays * 240;
  return ranked.flatMap((target) => {
    const allocation = Math.min(budget, target.powerCost);
    budget -= allocation;
    return allocation > 0 ? [{ ...target, powerCost: allocation }] : [];
  });
}

export interface PullPlanInput {
  passes: number;
  pity: number;
  guaranteed: boolean;
  targetCopies: number;
  isLightCone?: boolean;
  accountUpgradePercent: number;
}

export interface PullPlanResult {
  probability: number;
  expectedFiveStars: number;
  accountValue: number;
  assumptions: string[];
}

function fiveStarRate(pity: number, lightCone: boolean) {
  const hard = lightCone ? 80 : 90;
  const soft = lightCone ? 65 : 74;
  if (pity >= hard - 1) return 1;
  const base = lightCone ? 0.008 : 0.006;
  return pity + 1 >= soft ? Math.min(1, base + (pity + 2 - soft) * 0.06) : base;
}

export function simulatePullValue(input: PullPlanInput): PullPlanResult {
  if (
    !Number.isInteger(input.passes) ||
    input.passes < 0 ||
    input.passes > 2000 ||
    !Number.isInteger(input.pity) ||
    input.pity < 0 ||
    input.pity >= (input.isLightCone ? 80 : 90) ||
    !Number.isInteger(input.targetCopies) ||
    input.targetCopies < 1 ||
    input.targetCopies > 7 ||
    !Number.isFinite(input.accountUpgradePercent)
  )
    throw new Error('Invalid pull budget, pity, target copies or account value.');
  type State = {
    pity: number;
    guaranteed: boolean;
    copies: number;
    probability: number;
    fiveStars: number;
  };
  let states: State[] = [
    { pity: input.pity, guaranteed: input.guaranteed, copies: 0, probability: 1, fiveStars: 0 },
  ];
  const featuredRate = input.isLightCone ? 0.75 : 0.5;
  for (let pull = 0; pull < input.passes; pull += 1) {
    const next = new Map<string, State>();
    const add = (state: State) => {
      if (state.probability === 0) return;
      const key = `${state.pity}|${state.guaranteed}|${state.copies}`;
      const previous = next.get(key);
      next.set(
        key,
        previous
          ? {
              ...state,
              probability: previous.probability + state.probability,
              fiveStars: previous.fiveStars + state.fiveStars,
            }
          : state,
      );
    };
    for (const state of states) {
      const rate = fiveStarRate(state.pity, Boolean(input.isLightCone));
      add({
        ...state,
        pity: state.pity + 1,
        probability: state.probability * (1 - rate),
        fiveStars: state.fiveStars * (1 - rate),
      });
      const win = state.guaranteed ? 1 : featuredRate;
      add({
        pity: 0,
        guaranteed: false,
        copies: Math.min(input.targetCopies, state.copies + 1),
        probability: state.probability * rate * win,
        fiveStars: (state.fiveStars + state.probability) * rate * win,
      });
      if (win < 1)
        add({
          pity: 0,
          guaranteed: true,
          copies: state.copies,
          probability: state.probability * rate * (1 - win),
          fiveStars: (state.fiveStars + state.probability) * rate * (1 - win),
        });
    }
    states = [...next.values()];
  }
  const probability = states
    .filter((state) => state.copies >= input.targetCopies)
    .reduce((sum, state) => sum + state.probability, 0);
  const expectedFiveStars = states.reduce((sum, state) => sum + state.fiveStars, 0);
  return {
    probability,
    expectedFiveStars,
    accountValue: input.accountUpgradePercent * probability,
    assumptions: [
      input.isLightCone
        ? 'Uses the Light Cone banner base, soft-pity, hard-pity and 75/25 model.'
        : 'Uses the character banner base, soft-pity, hard-pity and 50/50 model.',
      'Account value is the user-entered performance change weighted by acquisition probability.',
      'Soft-pity ramp is an explicit community-model assumption, not a published official per-pull rate. No current-banner claim is made.',
      'This planner never recommends real-money spending.',
    ],
  };
}

export interface ScanChange {
  type: 'new' | 'removed' | 'changed' | 'moved' | 'warning';
  relicId?: string;
  message: string;
}

export function compareSnapshots(previous: Account, current: Account): ScanChange[] {
  const before = new Map(previous.relics.map((relic) => [relic.id, relic]));
  const after = new Map(current.relics.map((relic) => [relic.id, relic]));
  const changes: ScanChange[] = [];
  for (const [id, relic] of after) {
    const old = before.get(id);
    if (!old)
      changes.push({ type: 'new', relicId: id, message: `New ${relic.slot} from ${relic.set}.` });
    if (old && old.equippedCharacterId !== relic.equippedCharacterId)
      changes.push({
        type: 'moved',
        relicId: id,
        message: `Moved from ${old.equippedCharacterId ?? 'inventory'} to ${relic.equippedCharacterId ?? 'inventory'}.`,
      });
    if (
      old &&
      (old.level !== relic.level ||
        old.set !== relic.set ||
        old.slot !== relic.slot ||
        old.locked !== relic.locked ||
        old.discarded !== relic.discarded ||
        old.reservedFor !== relic.reservedFor ||
        JSON.stringify(old.mainStat) !== JSON.stringify(relic.mainStat) ||
        JSON.stringify(old.substats) !== JSON.stringify(relic.substats))
    )
      changes.push({
        type: 'changed',
        relicId: id,
        message: `Relic data changed (+${old.level} → +${relic.level}); compare stats and equipment flags.`,
      });
    if (old && relic.level < old.level)
      changes.push({
        type: 'warning',
        relicId: id,
        message: 'Relic level decreased; check OCR or item identity before trusting this snapshot.',
      });
    if ((relic.ocrConfidence ?? 1) < 0.78)
      changes.push({
        type: 'warning',
        relicId: id,
        message: `Low OCR confidence (${Math.round((relic.ocrConfidence ?? 0) * 100)}%); verify manually.`,
      });
  }
  for (const [id, relic] of before)
    if (!after.has(id))
      changes.push({
        type: 'removed',
        relicId: id,
        message: `${relic.slot} ${id} is no longer present.`,
      });
  return changes;
}

export interface CommandRecommendation {
  id: string;
  title: string;
  expectedBenefit: number;
  affected: string[];
  resourceCost: number;
  confidence: 'high' | 'medium' | 'low';
  guaranteed: boolean;
  assumptions: string[];
  explanation: string;
  benefitUnit?: 'damagePercent' | 'priorityPoints';
}

export function buildCommandCenter(account: Account): CommandRecommendation[] {
  const recommendations: CommandRecommendation[] = [];
  const farming = planFarming(account, 7).slice(0, 4);
  for (const target of farming)
    recommendations.push({
      id: target.id,
      title: target.name,
      expectedBenefit: target.guaranteedValue + target.rngValue * 0.45,
      benefitUnit: 'priorityPoints',
      affected: target.beneficiaries,
      resourceCost: target.powerCost,
      confidence: 'low',
      guaranteed: target.guaranteedValue > 0,
      assumptions: [
        'Uses current imported levels, traces and relic quality.',
        'No future or leaked unit data is assumed.',
      ],
      explanation: target.reason,
    });
  for (const character of account.characters) {
    const equipped = account.relics.filter((relic) => relic.equippedCharacterId === character.id);
    if (equipped.length !== 6) continue;
    const options: OptimizerOptions = {
      character,
      relics: account.relics,
      lightCone: account.lightCones.find((cone) => cone.equippedCharacterId === character.id),
      reservations: account.reservations,
      weights: { atkPct: 160, critRate: 420, critDmg: 220, spd: 12 },
      objective: 'damage',
      allowEquipped: false,
      allowLocked: false,
      candidateCap: 2,
      limit: 1,
    };
    const before = buildResult(options, equipped);
    const after = optimizeRelics({
      ...options,
      constraints: [{ stat: 'spd', min: before.stats.spd }],
    })[0];
    if (!after || after.damage <= before.damage || before.damage <= 0) continue;
    recommendations.unshift({
      id: `free-${character.id}`,
      title: `${character.name}: compare unused equipment`,
      expectedBenefit: (after.damage / before.damage - 1) * 100,
      benefitUnit: 'damagePercent',
      affected: [character.name],
      resourceCost: 0,
      confidence: 'low',
      guaranteed: false,
      assumptions: [
        'Same generic hit model before and after; no full-kit simulation.',
        'No other character loses equipped gear. Speed does not decrease.',
      ],
      explanation: `Generic benchmark ${Math.round(before.damage)} → ${Math.round(after.damage)} damage. Candidate relic IDs: ${after.relics.map((relic) => relic.id).join(', ')}. Validate character conditionals before applying.`,
    });
  }
  return recommendations.sort((a, b) => {
    if ((a.resourceCost === 0) !== (b.resourceCost === 0)) return a.resourceCost === 0 ? -1 : 1;
    return a.resourceCost === 0
      ? b.expectedBenefit - a.expectedBenefit
      : b.expectedBenefit / b.resourceCost - a.expectedBenefit / a.resourceCost;
  });
}

export interface AssistantAnswer {
  intent: string;
  answer: string;
  evidence: string[];
  confidence: number;
}

export function answerAccountQuestion(question: string, account: Account): AssistantAnswer {
  const query = question.trim().toLowerCase();
  if (/farm|trailblaze power|spend power/.test(query)) {
    const target = planFarming(account, 1)[0];
    return {
      intent: 'farming',
      answer: target
        ? `Farm ${target.name} first.`
        : 'Import more account data before planning farming.',
      evidence: target ? [target.reason, `Estimated cost: ${target.powerCost} Power.`] : [],
      confidence: 0.9,
    };
  }
  if (/weakest|worst built/.test(query)) {
    const scored = account.characters.map((character) => ({
      character,
      relics: account.relics.filter((relic) => relic.equippedCharacterId === character.id),
    }));
    scored.sort(
      (a, b) =>
        a.relics.reduce((sum, item) => sum + item.level, 0) -
        b.relics.reduce((sum, item) => sum + item.level, 0),
    );
    const weakest = scored[0];
    return {
      intent: 'weakest-character',
      answer: weakest
        ? `${weakest.character.name} has the weakest imported equipment coverage.`
        : 'No characters are imported.',
      evidence: weakest
        ? [
            `${weakest.relics.length}/6 relic slots detected.`,
            `Total relic levels: ${weakest.relics.reduce((sum, item) => sum + item.level, 0)}.`,
          ]
        : [],
      confidence: 0.88,
    };
  }
  if (/two teams|strongest teams|without/.test(query)) {
    const excludedName = query.match(/without\s+([\p{L}\p{N} •'-]+)/u)?.[1]?.trim();
    const characters = account.characters.filter(
      (character) => !excludedName || !character.name.toLowerCase().includes(excludedName),
    );
    const plan = optimizeMultiTeam(
      account,
      characters.slice(0, 8).map((character) => character.id),
      2,
      { noSharedRelics: true },
    )[0];
    return {
      intent: 'multi-team',
      answer: plan
        ? `A conflict-free generic assignment for the first eight matching characters scores ${Math.round(plan.totalScore).toLocaleString()} across two sides.`
        : 'There are not enough complete builds for two conflict-free teams.',
      evidence: plan
        ? plan.builds.map(
            (build) =>
              `${account.characters.find((character) => character.id === build.characterId)?.name}: ${Math.round(build.damage).toLocaleString()} expected hit`,
          )
        : [],
      confidence: plan ? 0.82 : 0.55,
    };
  }
  if (/relic|boots|worth level/.test(query)) {
    const relic = account.relics.find((item) => item.level < 15) ?? account.relics[0];
    if (!relic)
      return { intent: 'relic', answer: 'Import relics first.', evidence: [], confidence: 1 };
    const advice = adviseRelicUpgrade(
      relic,
      { critRate: 420, critDmg: 220, spd: 12, atkPct: 160 },
      55,
    );
    return {
      intent: 'relic-upgrade',
      answer: `${relic.slot} ${relic.id}: ${advice.recommendation} to +${advice.nextStop}.`,
      evidence: [advice.explanation, `Material estimate: ${advice.materialCost.toLocaleString()}.`],
      confidence: 0.78,
    };
  }
  const next = buildCommandCenter(account)[0];
  return {
    intent: 'command-center',
    answer: next ? next.title : 'Import an account to receive grounded recommendations.',
    evidence: next
      ? [next.explanation, `Expected relative benefit: ${next.expectedBenefit.toFixed(1)}.`]
      : [],
    confidence: next ? 0.72 : 1,
  };
}
