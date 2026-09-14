import { describe, expect, it } from 'vitest';
import { calculateDamage, simulateRotation } from '@ksro/combat-engine';
const stats = { hp: 4000, atk: 2000, def: 1000, spd: 100, critRate: 0.5, critDmg: 1 };
const config = { characterLevel: 80, enemyLevel: 80, abilityMultiplier: 2, enemyResistance: 0 };
describe('verified generic combat invariants', () => {
  it('applies the 0.9 unbroken toughness multiplier', () => {
    expect(calculateDamage(stats, config).nonCritical).toBeCloseTo(1800, 8);
    expect(calculateDamage(stats, { ...config, weaknessBroken: true }).nonCritical).toBeCloseTo(
      2000,
      8,
    );
  });
  it('uses the selected HP scaling stat', () => {
    expect(calculateDamage(stats, { ...config, scalingStat: 'hp' }).nonCritical).toBeCloseTo(
      3600,
      8,
    );
  });
  it('does not apply Break damage on every hit against a broken target', () => {
    expect(calculateDamage(stats, { ...config, weaknessBroken: true }).breakDamage).toBe(0);
  });
  it('gates Super Break on broken state and includes RES and vulnerability', () => {
    expect(calculateDamage(stats, { ...config, superBreak: true }).superBreakDamage).toBe(0);
    expect(
      calculateDamage(stats, {
        ...config,
        superBreak: true,
        weaknessBroken: true,
        toughnessDamage: 10,
        enemyResistance: 0.2,
        vulnerability: 0.25,
      }).superBreakDamage,
    ).toBeCloseTo(3767.5533 * 0.5 * 0.8 * 1.25, 6);
  });
  it('rejects unsupported Break level constants and invalid actor speeds', () => {
    expect(() =>
      calculateDamage(stats, { ...config, characterLevel: 70, superBreak: true }),
    ).toThrow(/verified level/);
    expect(() =>
      simulateRotation([
        {
          id: 'a',
          name: 'A',
          speed: 0,
          maxEnergy: 100,
          basicDamage: 1,
          skillDamage: 2,
          ultimateDamage: 3,
        },
      ]),
    ).toThrow(/speed/);
  });
  it('uses ready ultimates at AV zero without delaying normal turns', () => {
    const result = simulateRotation(
      [
        {
          id: 'a',
          name: 'A',
          speed: 100,
          maxEnergy: 100,
          startEnergy: 100,
          basicDamage: 1,
          skillDamage: 2,
          ultimateDamage: 3,
        },
      ],
      2,
    );
    expect(result.events.map((event) => [event.action, event.actionValue])).toEqual([
      ['Ultimate', 0],
      ['Basic', 100],
      ['Basic', 200],
    ]);
  });
  it('uses a newly ready ultimate after an action at the same AV', () => {
    const result = simulateRotation(
      [
        {
          id: 'a',
          name: 'A',
          speed: 100,
          maxEnergy: 100,
          startEnergy: 80,
          basicDamage: 1,
          skillDamage: 2,
          ultimateDamage: 3,
        },
      ],
      1,
    );
    expect(result.events.map((event) => [event.action, event.actionValue])).toEqual([
      ['Basic', 100],
      ['Ultimate', 100],
    ]);
  });
});
