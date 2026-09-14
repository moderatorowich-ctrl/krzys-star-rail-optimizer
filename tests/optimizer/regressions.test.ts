import { expect, it } from 'vitest';
import { demoAccount } from '@ksro/game-data';
import {
  answerAccountQuestion,
  adviseRelicUpgrade,
  buildCommandCenter,
  calculateBuildStats,
  optimizeRelics,
  optimizeMultiTeam,
  compareSnapshots,
  planFarming,
  simulatePullValue,
} from '@ksro/optimizer-engine';
const character = demoAccount.characters[0];
const relics = demoAccount.relics.filter((relic) => relic.equippedCharacterId === character.id);
const options = {
  character,
  relics: demoAccount.relics,
  weights: { spd: 1 },
  exact: false,
  allowEquipped: true,
};
it('adds Light Cone base before percentage stats, regardless of path matching', () => {
  const cone = {
    ...demoAccount.lightCones[0],
    path: 'Other',
    baseStats: { hp: 100, atk: 200, def: 300 },
  };
  const base = calculateBuildStats(character, [], false, cone);
  expect(base.atk).toBe(character.baseStats.atk + 200);
  const boosted = calculateBuildStats(
    character,
    [{ ...relics[0], mainStat: { stat: 'atkPct', value: 0.5 }, substats: [] }],
    false,
    cone,
  );
  expect(boosted.atk).toBeCloseTo((character.baseStats.atk + 200) * 1.5);
});
it('uses imported base critical stats and counts inventory equips as transfers', () => {
  const custom = {
    ...character,
    baseStats: { ...character.baseStats, critRate: 0.12, critDmg: 0.72 },
  };
  const stats = calculateBuildStats(custom, []);
  expect(stats.critRate).toBe(0.12);
  expect(stats.critDmg).toBe(0.72);
  const inventoryRelic = { ...relics[0], equippedCharacterId: undefined };
  const result = optimizeRelics({
    ...options,
    character: custom,
    relics: [
      inventoryRelic,
      ...demoAccount.relics.filter(
        (item) => item.slot !== inventoryRelic.slot && item.equippedCharacterId === custom.id,
      ),
    ],
    exact: true,
  })[0];
  expect(result.transferCount).toBe(1);
});
it('speed sets scale character base speed and elemental spheres respect damage type', () => {
  const pieces = relics.slice(0, 2).map((relic) => ({
    ...relic,
    set: 'Messenger Traversing Hackerspace',
    mainStat: { stat: 'hp' as const, value: 0 },
    substats: [],
  }));
  expect(
    calculateBuildStats({ ...character, baseStats: { ...character.baseStats, spd: 110 } }, pieces)
      .spd,
  ).toBeCloseTo(116.6);
  const sphere = {
    ...relics[4],
    mainStat: { stat: 'elementalDmg' as const, value: 0.388, element: 'Fire' as const },
    substats: [],
  };
  expect(
    calculateBuildStats({ ...character, element: 'Ice' }, [sphere], false).elementalDmg ?? 0,
  ).toBe(0);
});
it('pins never bypass exclusions, reservations or multiple pins per slot', () => {
  const relic = demoAccount.relics[0];
  expect(() =>
    optimizeRelics({ ...options, pinnedRelicIds: [relic.id], excludedRelicIds: [relic.id] }),
  ).toThrow(/conflicts/);
  expect(() =>
    optimizeRelics({
      ...options,
      pinnedRelicIds: [relic.id],
      reservations: { [relic.id]: 'other' },
    }),
  ).toThrow(/conflicts/);
  expect(() =>
    optimizeRelics({
      ...options,
      pinnedRelicIds: demoAccount.relics
        .filter((item) => item.slot === relic.slot)
        .slice(0, 2)
        .map((item) => item.id),
    }),
  ).toThrow(/Only one/);
});
it('respects main-stat/set filters and completes cancellation promptly', () => {
  const builds = optimizeRelics({
    ...options,
    allowLocked: true,
    mainStats: { Feet: ['spd'] },
    requiredSets: [{ set: 'does not exist', count: 2 }],
  });
  expect(builds).toEqual([]);
  expect(optimizeRelics({ ...options, shouldCancel: () => true })).toEqual([]);
});
it('requires enough unique characters and preserves locked equipment', () => {
  expect(optimizeMultiTeam(demoAccount, [character.id, character.id], 2)).toEqual([]);
  const plan = optimizeMultiTeam(
    demoAccount,
    demoAccount.characters.map((item) => item.id),
    2,
  )[0];
  expect(plan).toBeDefined();
  expect(
    plan.builds.every((build) =>
      build.relics.every(
        (relic) => !relic.locked || relic.equippedCharacterId === build.characterId,
      ),
    ),
  ).toBe(true);
  const inventoryAccount = {
    ...demoAccount,
    reservations: {},
    relics: demoAccount.relics.map((relic) => ({
      ...relic,
      equippedCharacterId: undefined,
      reservedFor: undefined,
      locked: false,
      discarded: false,
    })),
  };
  const inventoryPlan = optimizeMultiTeam(
    inventoryAccount,
    inventoryAccount.characters.map((item) => item.id),
    2,
  )[0];
  expect(inventoryPlan).toBeDefined();
  expect(inventoryPlan.transfers.every((transfer) => transfer.from === 'inventory')).toBe(true);
});
it('records equipment and stat changes in the same scan and flags decreases', () => {
  const current = {
    ...demoAccount,
    relics: demoAccount.relics.map((relic, index) =>
      index ? relic : { ...relic, level: 0, equippedCharacterId: undefined },
    ),
  };
  expect(compareSnapshots(demoAccount, current).map((change) => change.type)).toEqual(
    expect.arrayContaining(['changed', 'moved', 'warning']),
  );
});
it('does not allocate more Power than the selected horizon', () => {
  expect(
    planFarming(demoAccount, 1).reduce((sum, target) => sum + target.powerCost, 0),
  ).toBeLessThanOrEqual(240);
});
it('scores every fixed progression gap and keeps free recommendations in their own tier', () => {
  const account = {
    ...demoAccount,
    characters: demoAccount.characters.map((item, index) =>
      index === 0
        ? {
            ...item,
            traces: { ...item.traces, basic: 1, skill: 10, ultimate: 1, talent: 1 },
          }
        : item,
    ),
  };
  const farm = planFarming(account, 7).find(
    (target) => target.id === `trace-${account.characters[0].id}`,
  );
  expect(farm?.guaranteedValue).toBeGreaterThan(100);
  const recommendations = buildCommandCenter(demoAccount);
  const firstCostly = recommendations.findIndex((item) => item.resourceCost > 0);
  expect(firstCostly).toBeGreaterThanOrEqual(0);
  expect(recommendations.slice(firstCostly).every((item) => item.resourceCost > 0)).toBe(true);
});
it('excludes a named character in assistant fixed-team queries', () => {
  const answer = answerAccountQuestion('Plan two teams without Sunday.', demoAccount);
  expect(answer.intent).toBe('multi-team');
  expect(answer.answer).toMatch(/not enough/i);
  expect(answer.evidence.every((line) => !line.includes('Sunday'))).toBe(true);
  expect(answer.answer).not.toMatch(/strongest/i);
});
it('max-level relics have no upgrade chance and cap by rarity', () => {
  expect(
    adviseRelicUpgrade({ ...relics[0], level: 15 }, { critRate: 400 }, 0).improvementProbability,
  ).toBe(0);
  expect(
    adviseRelicUpgrade({ ...relics[0], rarity: 4, level: 12 }, { critRate: 400 }, 0).nextStop,
  ).toBe(12);
});
it('honors hard pity and zero budget exactly', () => {
  expect(
    simulatePullValue({
      passes: 1,
      pity: 89,
      guaranteed: true,
      targetCopies: 1,
      accountUpgradePercent: 10,
    }).probability,
  ).toBe(1);
  expect(
    simulatePullValue({
      passes: 0,
      pity: 0,
      guaranteed: false,
      targetCopies: 1,
      accountUpgradePercent: 10,
    }).probability,
  ).toBe(0);
  expect(() =>
    simulatePullValue({
      passes: -1,
      pity: 0,
      guaranteed: false,
      targetCopies: 1,
      accountUpgradePercent: 10,
    }),
  ).toThrow();
});
