import { describe, expect, it } from 'vitest';
import {
  AccountSchema,
  compareGameVersions,
  migrateAccount,
  privacySafeExport,
} from '@ksro/shared';
import { demoAccount } from '@ksro/game-data';

describe('account schema', () => {
  it('round-trips the v2 fixture', () => {
    const parsed = AccountSchema.parse(JSON.parse(JSON.stringify(demoAccount)));
    expect(parsed.relics).toHaveLength(72);
    expect(AccountSchema.parse(parsed)).toEqual(parsed);
  });

  it('redacts UID and notes from safe exports', () => {
    const account = {
      ...demoAccount,
      metadata: { ...demoAccount.metadata, uid: '123456789', uidRedacted: false },
    };
    const exported = privacySafeExport(account);
    expect(exported.metadata.uid).toBeUndefined();
    expect(exported.metadata.uidRedacted).toBe(true);
  });

  it('blocks exports from a newer game version', () => {
    expect(compareGameVersions('4.6', '4.5').compatible).toBe(false);
  });

  it('accepts evidence-backed Speed precision and rejects inconsistent ranges', () => {
    const relic = demoAccount.relics.find((item) =>
      item.substats.some((stat) => stat.stat === 'spd'),
    )!;
    const valid = {
      ...relic,
      speedPrecision: {
        source: 'roll-inference' as const,
        confidence: 'exact' as const,
        displayed: 5,
        candidates: [5.2],
        minimum: 5.2,
        maximum: 5.2,
      },
    };
    expect(
      AccountSchema.parse({ ...demoAccount, relics: [valid] }).relics[0].speedPrecision,
    ).toBeDefined();
    expect(() =>
      AccountSchema.parse({
        ...demoAccount,
        relics: [{ ...valid, speedPrecision: { ...valid.speedPrecision, maximum: 5.1 } }],
      }),
    ).toThrow(/declared range/);
  });

  it('migrates a common scanner-shaped relic', () => {
    const account = migrateAccount(
      {
        gameVersion: '4.5',
        relics: [
          {
            id: '1',
            setName: 'Fixture',
            slot: 'Head',
            level: 0,
            rarity: 5,
            mainStat: { name: 'HP', value: 100 },
            substats: [],
          },
        ],
      },
      '4.5',
    );
    expect(account.relics[0].slot).toBe('Head');
    expect(account.metadata.schemaVersion).toBe(2);
  });
});
