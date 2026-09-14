import { expect, it } from 'vitest';
import {
  AccountSchema,
  compareGameVersions,
  migrateAccount,
  normalizeStat,
  privacySafeExport,
} from '@ksro/shared';
import { demoAccount } from '@ksro/game-data';
it('preserves fractional low percentage rolls from legacy display units', () => {
  expect(normalizeStat({ name: 'CRIT Rate', value: 1.9 }).value).toBeCloseTo(0.019);
  expect(normalizeStat({ stat: 'critRate', value: 0.019 }).value).toBeCloseTo(0.019);
  const elemental = normalizeStat({ name: 'Fire DMG Boost', value: 38.8 });
  expect(elemental).toMatchObject({ stat: 'elementalDmg', element: 'Fire' });
  expect(elemental.value).toBeCloseTo(0.388);
});
it('fails closed for unknown schemas and unrecognized objects', () => {
  expect(() => migrateAccount({ metadata: { schemaVersion: 3 } }, '4.5')).toThrow(
    /Unsupported account schema/,
  );
  expect(() => migrateAccount({ source: 'HSR-Scanner' }, '4.5')).toThrow(/recognized/);
});
it('rejects duplicate IDs and accepts scanner null unequipped fields', () => {
  expect(() =>
    AccountSchema.parse({ ...demoAccount, relics: [demoAccount.relics[0], demoAccount.relics[0]] }),
  ).toThrow(/Duplicate IDs/);
  const account = AccountSchema.parse({
    ...demoAccount,
    relics: [{ ...demoAccount.relics[0], equippedCharacterId: null }],
  });
  expect(account.relics[0].equippedCharacterId).toBeUndefined();
});
it('rejects impossible relic stats and dangling equipment references', () => {
  expect(() =>
    AccountSchema.parse({
      ...demoAccount,
      relics: [
        {
          ...demoAccount.relics[0],
          mainStat: { stat: 'critRate', value: 0.324 },
        },
      ],
    }),
  ).toThrow(/valid Head main stat/);
  expect(() =>
    AccountSchema.parse({
      ...demoAccount,
      lightCones: [{ ...demoAccount.lightCones[0], equippedCharacterId: 'missing-character' }],
    }),
  ).toThrow(/does not exist/);
  expect(() =>
    AccountSchema.parse({ ...demoAccount, reservations: { missing: 'also-missing' } }),
  ).toThrow(/existing relic and character/);
});
it('does not silently replace character base stats with invented defaults', () => {
  expect(() =>
    migrateAccount({ source: 'HSR-Scanner', characters: [{ name: 'Unknown' }] }, '4.5'),
  ).toThrow();
});
it('redacts identifying free text', () => {
  const result = privacySafeExport({
    ...demoAccount,
    characters: demoAccount.characters.map((character) => ({
      ...character,
      nickname: 'private',
      note: 'private',
      tags: ['private'],
    })),
  });
  expect(JSON.stringify(result)).not.toContain('private');
});
it('compares version components and rejects malformed versions', () => {
  expect(compareGameVersions('4.10', '4.9').level).toBe('newer');
  for (const version of ['4', 'x.y', '4.5.1', ''])
    expect(compareGameVersions(version, '4.5').level).toBe('invalid');
});
