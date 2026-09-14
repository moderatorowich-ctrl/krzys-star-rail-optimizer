import { describe, expect, it } from 'vitest';
import { calculateDamage, simulateRotation } from '@ksro/combat-engine';

describe('combat engine', () => {
  it('matches a hand-calculated no-crit fixture within tolerance', () => {
    const result = calculateDamage(
      { hp: 3000, atk: 2000, def: 1000, spd: 100, critRate: 0, critDmg: 1 },
      {
        characterLevel: 80,
        enemyLevel: 80,
        abilityMultiplier: 2,
        enemyResistance: 0,
        damageBonus: 0,
        weaknessBroken: true,
      },
    );
    expect(result.nonCritical).toBeCloseTo(2000, 6);
    expect(result.average).toBeCloseTo(result.nonCritical, 6);
  });

  it('includes break, super break, DoT and follow-up contributions', () => {
    const result = calculateDamage(
      { hp: 3000, atk: 2500, def: 1000, spd: 134, critRate: 0.7, critDmg: 1.5, breakEffect: 1 },
      {
        characterLevel: 80,
        enemyLevel: 95,
        abilityMultiplier: 3,
        weaknessBroken: true,
        superBreak: true,
        dotMultiplier: 0.5,
        followUpMultiplier: 0.3,
      },
    );
    expect(result.totalExpected).toBeGreaterThan(result.average);
    expect(result.breakdown.length).toBeGreaterThan(3);
  });

  it('produces deterministic SP and energy timeline events', () => {
    const actors = [
      {
        id: 'a',
        name: 'DPS',
        speed: 134,
        maxEnergy: 120,
        basicDamage: 10,
        skillDamage: 20,
        ultimateDamage: 50,
        autoPriority: 'skill' as const,
      },
      {
        id: 'b',
        name: 'Support',
        speed: 136,
        maxEnergy: 110,
        basicDamage: 4,
        skillDamage: 8,
        ultimateDamage: 12,
        autoPriority: 'basic' as const,
      },
    ];
    const first = simulateRotation(actors, 3);
    expect(first).toEqual(simulateRotation(actors, 3));
    expect(first.events.length).toBeGreaterThan(4);
  });
});
