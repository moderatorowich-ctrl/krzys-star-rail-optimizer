import { describe, expect, it } from 'vitest';
import { demoAccount } from '@ksro/game-data';
import {
  adviseRelicUpgrade,
  compareSnapshots,
  optimizeMultiTeam,
  optimizeRelics,
  paretoFrontier,
  scoreRelics,
  simulatePullValue,
} from '@ksro/optimizer-engine';

describe('optimizer engine', () => {
  it('returns deterministic constrained builds', () => {
    const input = {
      character: demoAccount.characters[0],
      relics: demoAccount.relics,
      weights: { critRate: 420, critDmg: 220, atkPct: 160, spd: 12 },
      constraints: [{ stat: 'spd' as const, min: 120 }],
      allowEquipped: true,
      allowLocked: true,
      limit: 8,
    };
    const first = optimizeRelics(input);
    const second = optimizeRelics(input);
    expect(first.length).toBeGreaterThan(0);
    expect(first.map((item) => item.id)).toEqual(second.map((item) => item.id));
    expect(first.every((item) => item.stats.spd >= 120)).toBe(true);
  });

  it('builds a conflict-free two-team plan', () => {
    const plans = optimizeMultiTeam(
      demoAccount,
      demoAccount.characters.map((item) => item.id),
      2,
      { noSharedRelics: true },
    );
    expect(plans.length).toBeGreaterThan(0);
    const ids = plans[0].builds.flatMap((build) => build.relics.map((relic) => relic.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('scores account-relative relics and future rolls', () => {
    const scored = scoreRelics(demoAccount, { critRate: 420, critDmg: 220, spd: 12 });
    const advice = adviseRelicUpgrade(
      demoAccount.relics.find((relic) => relic.level < 15)!,
      { critRate: 420, critDmg: 220, spd: 12 },
      55,
    );
    expect(scored).toHaveLength(demoAccount.relics.length);
    expect(advice.improvementProbability).toBeGreaterThan(0);
    expect(advice.nextStop % 3).toBe(0);
  });

  it('computes a Pareto frontier', () => {
    const builds = optimizeRelics({
      character: demoAccount.characters[0],
      relics: demoAccount.relics,
      weights: { critRate: 400, spd: 15 },
      allowEquipped: true,
      allowLocked: true,
      limit: 20,
    });
    expect(paretoFrontier(builds).length).toBeGreaterThan(0);
  });

  it('simulates pull probability without exceeding one', () => {
    const result = simulatePullValue({
      passes: 180,
      pity: 0,
      guaranteed: false,
      targetCopies: 1,
      accountUpgradePercent: 15,
    });
    expect(result.probability).toBeGreaterThan(0.5);
    expect(result.probability).toBeLessThanOrEqual(1);
  });

  it('detects scan changes', () => {
    const changed = {
      ...demoAccount,
      relics: demoAccount.relics.map((relic, index) =>
        index === 0 ? { ...relic, level: relic.level - 3 } : relic,
      ),
    };
    expect(compareSnapshots(demoAccount, changed).some((item) => item.type === 'changed')).toBe(
      true,
    );
  });
});
