import type { Character, StatKey } from '@ksro/shared';

export type CombatStats = Partial<Record<StatKey, number>> & {
  hp: number;
  atk: number;
  def: number;
  spd: number;
  critRate: number;
  critDmg: number;
};

export interface DamageConfig {
  characterLevel: number;
  enemyLevel: number;
  abilityMultiplier: number;
  scalingStat?: 'atk' | 'hp' | 'def';
  flatDamage?: number;
  resistancePenetration?: number;
  triggersBreak?: boolean;
  breakLevelBase?: number;
  element?: Character['element'];
  enemyMaxToughness?: number;
  superBreakMultiplier?: number;
  breakEfficiency?: number;
  toughnessDamage?: number;
  targetCount?: number;
  enemyResistance?: number;
  enemyDefenseReduction?: number;
  defenseIgnore?: number;
  vulnerability?: number;
  damageBonus?: number;
  breakEffect?: number;
  weaknessBroken?: boolean;
  dotMultiplier?: number;
  followUpMultiplier?: number;
  summonMultiplier?: number;
  superBreak?: boolean;
}

export interface DamageResult {
  nonCritical: number;
  critical: number;
  average: number;
  breakDamage: number;
  superBreakDamage: number;
  dotDamage: number;
  followUpDamage: number;
  summonDamage: number;
  totalExpected: number;
  breakdown: Array<{ label: string; value: number; formula: string }>;
}

export function calculateDamage(stats: CombatStats, config: DamageConfig): DamageResult {
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'number' && !Number.isFinite(value))
      throw new Error(`Invalid damage parameter: ${key}`);
  }
  if (
    config.characterLevel < 1 ||
    config.characterLevel > 80 ||
    config.enemyLevel < 1 ||
    config.abilityMultiplier < 0
  )
    throw new Error('Invalid level or ability multiplier.');
  if (
    config.targetCount !== undefined &&
    (!Number.isInteger(config.targetCount) || config.targetCount < 1)
  )
    throw new Error('Target count must be a positive integer.');
  const critRate = Math.min(1, Math.max(0, stats.critRate));
  const critDmg = Math.max(0, stats.critDmg);
  const attack = Math.max(0, stats[config.scalingStat ?? 'atk']);
  const damageBonus = Math.max(0, 1 + (stats.elementalDmg ?? 0) + (config.damageBonus ?? 0));
  const defenseBase = config.enemyLevel + 20;
  const attackerBase = config.characterLevel + 20;
  const remainingDefense = Math.max(
    0,
    1 - Math.min(1, (config.enemyDefenseReduction ?? 0) + (config.defenseIgnore ?? 0)),
  );
  const defenseMultiplier = attackerBase / (defenseBase * remainingDefense + attackerBase);
  const resistanceMultiplier =
    1 -
    Math.min(
      0.9,
      Math.max(-1, (config.enemyResistance ?? 0.2) - (config.resistancePenetration ?? 0)),
    );
  const vulnerabilityMultiplier = 1 + Math.max(0, config.vulnerability ?? 0);
  const targets = Math.max(1, config.targetCount ?? 1);
  const raw = attack * config.abilityMultiplier + (config.flatDamage ?? 0);
  const toughnessMultiplier = config.weaknessBroken ? 1 : 0.9;
  const nonCritical =
    raw *
    damageBonus *
    defenseMultiplier *
    resistanceMultiplier *
    vulnerabilityMultiplier *
    toughnessMultiplier *
    targets;
  const critical = nonCritical * (1 + critDmg);
  const average = nonCritical * (1 + critRate * critDmg);
  const breakEffect = Math.max(0, (stats.breakEffect ?? 0) + (config.breakEffect ?? 0));
  if (
    (config.triggersBreak || config.superBreak) &&
    config.characterLevel !== 80 &&
    config.breakLevelBase === undefined
  )
    throw new Error('Break damage below level 80 requires an explicit verified level base.');
  const breakLevelBase = config.breakLevelBase ?? 3767.5533;
  const elementScale: Record<string, number> = {
    Physical: 2,
    Fire: 2,
    Ice: 1,
    Lightning: 1,
    Wind: 1.5,
    Quantum: 0.5,
    Imaginary: 0.5,
  };
  const breakDamage = config.triggersBreak
    ? breakLevelBase *
      (elementScale[config.element ?? 'Physical'] ?? 1) *
      (0.5 + (config.enemyMaxToughness ?? 60) / 120) *
      (1 + breakEffect) *
      defenseMultiplier *
      resistanceMultiplier *
      vulnerabilityMultiplier *
      targets
    : 0;
  const superBreakDamage =
    config.superBreak && config.weaknessBroken
      ? breakLevelBase *
        (1 + breakEffect) *
        ((config.toughnessDamage ?? 10) / 10) *
        (1 + (config.breakEfficiency ?? 0)) *
        (config.superBreakMultiplier ?? 1) *
        defenseMultiplier *
        resistanceMultiplier *
        vulnerabilityMultiplier *
        targets
      : 0;
  const dotDamage = nonCritical * Math.max(0, config.dotMultiplier ?? 0);
  const followUpDamage = average * Math.max(0, config.followUpMultiplier ?? 0);
  const summonDamage = average * Math.max(0, config.summonMultiplier ?? 0);
  const totalExpected =
    average + breakDamage + superBreakDamage + dotDamage + followUpDamage + summonDamage;

  return {
    nonCritical,
    critical,
    average,
    breakDamage,
    superBreakDamage,
    dotDamage,
    followUpDamage,
    summonDamage,
    totalExpected,
    breakdown: [
      {
        label: `${(config.scalingStat ?? 'atk').toUpperCase()} × multiplier + flat`,
        value: raw,
        formula: `${attack.toFixed(1)} × ${config.abilityMultiplier.toFixed(2)}`,
      },
      {
        label: 'Toughness state',
        value: toughnessMultiplier,
        formula: '0.9 while unbroken; 1 after weakness break',
      },
      {
        label: 'DMG bonus',
        value: damageBonus,
        formula: `1 + ${((damageBonus - 1) * 100).toFixed(1)}%`,
      },
      {
        label: 'DEF multiplier',
        value: defenseMultiplier,
        formula: `(Lv + 20) / ((enemy Lv + 20) × remaining DEF + Lv + 20)`,
      },
      {
        label: 'RES multiplier',
        value: resistanceMultiplier,
        formula: `1 − ${((config.enemyResistance ?? 0.2) * 100).toFixed(1)}%`,
      },
      {
        label: 'Expected CRIT',
        value: 1 + critRate * critDmg,
        formula: `1 + CRIT Rate × CRIT DMG`,
      },
    ],
  };
}

export interface RotationActor {
  id: string;
  name: string;
  speed: number;
  maxEnergy: number;
  startEnergy?: number;
  basicDamage: number;
  skillDamage: number;
  ultimateDamage: number;
  skillPointDelta?: number;
  energyPerAction?: number;
  autoPriority?: 'basic' | 'skill';
  initialAdvance?: number;
  initialDelay?: number;
  basicEnergy?: number;
  skillEnergy?: number;
  energyRegen?: number;
  ultimateRefund?: number;
  rotation?: Array<'Basic' | 'Skill'>;
  summon?: { name: string; speed: number; damage: number };
}

export interface TimelineEvent {
  index: number;
  cycle: number;
  actionValue: number;
  actorId: string;
  actor: string;
  action: 'Basic' | 'Skill' | 'Ultimate' | 'Summon';
  skillPoints: number;
  energy: number;
  damage: number;
  note: string;
}

export interface RotationResult {
  events: TimelineEvent[];
  totalDamage: number;
  endingSkillPoints: number;
  speedWarnings: string[];
}

export function simulateRotation(
  actors: RotationActor[],
  cycles = 5,
  startingSkillPoints = 3,
): RotationResult {
  if (!Number.isInteger(cycles) || cycles < 1 || cycles > 100)
    throw new Error('Cycles must be between 1 and 100.');
  if (!Number.isInteger(startingSkillPoints) || startingSkillPoints < 0 || startingSkillPoints > 5)
    throw new Error('Starting Skill Points must be between 0 and 5.');
  if (new Set(actors.map((actor) => actor.id)).size !== actors.length)
    throw new Error('Duplicate rotation actors.');
  for (const actor of actors) {
    if (
      !Number.isFinite(actor.speed) ||
      actor.speed <= 0 ||
      actor.speed > 1000 ||
      !Number.isFinite(actor.maxEnergy) ||
      actor.maxEnergy <= 0
    )
      throw new Error('Actors require positive finite speed and maximum energy.');
    if (
      actor.summon &&
      (!Number.isFinite(actor.summon.speed) || actor.summon.speed <= 0 || actor.summon.speed > 1000)
    )
      throw new Error('Summon speed must be positive and finite.');
  }
  const maxActionValue = 150 + Math.max(0, cycles - 1) * 100;
  const state = actors.map((actor) => ({
    actor,
    nextAction:
      (10000 / actor.speed) *
      Math.max(0, 1 - (actor.initialAdvance ?? 0) + (actor.initialDelay ?? 0)),
    energy: Math.max(0, Math.min(actor.maxEnergy, actor.startEnergy ?? 0)),
    isSummon: false,
    turns: 0,
  }));
  for (const actor of actors) {
    if (actor.summon) {
      state.push({
        actor: {
          id: `${actor.id}-summon`,
          name: actor.summon.name,
          speed: actor.summon.speed,
          maxEnergy: Infinity,
          basicDamage: actor.summon.damage,
          skillDamage: actor.summon.damage,
          ultimateDamage: 0,
          autoPriority: 'basic',
        },
        nextAction: 10000 / actor.summon.speed,
        energy: 0,
        isSummon: true,
        turns: 0,
      });
    }
  }
  let skillPoints = startingSkillPoints;
  const events: TimelineEvent[] = [];
  const emitUltimate = (current: (typeof state)[number], av: number) => {
    if (current.isSummon || current.energy < current.actor.maxEnergy) return;
    current.energy = Math.min(current.actor.maxEnergy, current.actor.ultimateRefund ?? 5);
    events.push({
      index: events.length + 1,
      cycle: av < 150 ? 0 : Math.floor((av - 150) / 100) + 1,
      actionValue: av,
      actorId: current.actor.id,
      actor: current.actor.name,
      action: 'Ultimate',
      skillPoints,
      energy: current.energy,
      damage: current.actor.ultimateDamage,
      note: 'Off-turn ultimate; next normal action is unchanged.',
    });
  };
  for (const current of state) emitUltimate(current, 0);
  while (state.length && Math.min(...state.map((item) => item.nextAction)) <= maxActionValue) {
    state.sort((a, b) => a.nextAction - b.nextAction || a.actor.id.localeCompare(b.actor.id));
    const current = state[0];
    const isSummon = current.isSummon;
    let action: TimelineEvent['action'];
    let damage: number;
    const planned = current.actor.rotation?.length
      ? current.actor.rotation[current.turns % current.actor.rotation.length]
      : current.actor.autoPriority === 'skill'
        ? 'Skill'
        : 'Basic';
    if (!isSummon && planned === 'Skill' && skillPoints > 0) {
      action = 'Skill';
      damage = current.actor.skillDamage;
      skillPoints -= 1;
      current.energy +=
        (current.actor.skillEnergy ?? current.actor.energyPerAction ?? 30) *
        (1 + (current.actor.energyRegen ?? 0));
    } else {
      action = isSummon ? 'Summon' : 'Basic';
      damage = current.actor.basicDamage;
      if (!isSummon) {
        skillPoints = Math.max(0, Math.min(5, skillPoints + (current.actor.skillPointDelta ?? 1)));
        current.energy +=
          (current.actor.basicEnergy ?? current.actor.energyPerAction ?? 20) *
          (1 + (current.actor.energyRegen ?? 0));
      }
    }
    current.energy = Math.min(current.energy, current.actor.maxEnergy);
    current.turns += 1;
    const cycle = current.nextAction < 150 ? 0 : Math.floor((current.nextAction - 150) / 100) + 1;
    events.push({
      index: events.length + 1,
      cycle,
      actionValue: current.nextAction,
      actorId: current.actor.id,
      actor: current.actor.name,
      action,
      skillPoints,
      energy: Math.min(current.energy, current.actor.maxEnergy),
      damage,
      note:
        action === 'Basic'
          ? 'SP positive'
          : action === 'Skill'
            ? 'Consumes 1 SP'
            : 'Independent summon action',
    });
    emitUltimate(current, current.nextAction);
    current.nextAction += 10000 / current.actor.speed;
  }
  const speedWarnings = actors.slice(0, -1).flatMap((actor, index) => {
    const next = actors[index + 1];
    if (Math.abs(actor.speed - next.speed) >= 2) return [];
    return [
      `${actor.name} and ${next.name} are within 2 SPD. Add ${Math.max(0, Math.ceil((actor.speed - next.speed + 0.01) * 100) / 100)} SPD to ${next.name} if ${next.name} must act first.`,
    ];
  });
  return {
    events,
    totalDamage: events.reduce((sum, event) => sum + event.damage, 0),
    endingSkillPoints: skillPoints,
    speedWarnings,
  };
}

export function baseCombatStats(character: Character): CombatStats {
  return {
    hp: character.baseStats.hp,
    atk: character.baseStats.atk,
    def: character.baseStats.def,
    spd: character.baseStats.spd,
    critRate: 0.05,
    critDmg: 0.5,
  };
}
