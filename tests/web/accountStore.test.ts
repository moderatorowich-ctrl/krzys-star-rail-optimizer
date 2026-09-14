import { beforeEach, expect, it } from 'vitest';
import { demoAccount } from '@ksro/game-data';
import { loadSnapshots, saveSnapshot } from '../../apps/web/src/lib/accountStore';

beforeEach(() => localStorage.clear());

it('round-trips validated local snapshots', () => {
  const saved = saveSnapshot(demoAccount);
  expect(saved).toHaveLength(1);
  expect(loadSnapshots()[0].account.metadata.schemaVersion).toBe(2);
});

it('drops corrupt snapshot records instead of crashing a view', () => {
  localStorage.setItem(
    'ksro.snapshots.v2',
    JSON.stringify([
      { id: 'bad', timestamp: 'not-a-date', account: {} },
      { id: 'also-bad', timestamp: new Date().toISOString(), account: {} },
    ]),
  );
  expect(loadSnapshots()).toEqual([]);
});
