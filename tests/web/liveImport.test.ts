import { expect, it } from 'vitest';
import type { Account } from '@ksro/shared';
import { demoAccount } from '@ksro/game-data';
import {
  isAllowedLiveImportEndpoint,
  liveMergeCount,
  mergeLiveAccount,
  parseLiveBridgeMessage,
} from '../../apps/web/src/lib/liveImport';

function cloneAccount(): Account {
  return structuredClone(demoAccount);
}

it('allows only loopback websocket endpoints', () => {
  expect(isAllowedLiveImportEndpoint('ws://127.0.0.1:23313/ws')).toBe(true);
  expect(isAllowedLiveImportEndpoint('ws://localhost:23313/ws')).toBe(true);
  expect(isAllowedLiveImportEndpoint('wss://example.com/ws')).toBe(false);
  expect(isAllowedLiveImportEndpoint('ws://192.168.1.10:23313/ws')).toBe(false);
  expect(isAllowedLiveImportEndpoint('ws://user:secret@127.0.0.1:23313/ws')).toBe(false);
  expect(isAllowedLiveImportEndpoint('ws://127.0.0.1:23313/other')).toBe(false);
  expect(isAllowedLiveImportEndpoint('ws://127.0.0.1:23313/ws?relay=1')).toBe(false);
});

it('validates live bridge metadata and account payloads', () => {
  const account = cloneAccount();
  const parsed = parseLiveBridgeMessage(
    JSON.stringify({
      type: 'snapshot',
      protocolVersion: 1,
      scannerVersion: '1.1.0',
      gameVersion: '4.5',
      revision: 7,
      capturedAt: '2026-09-14T12:00:00.000Z',
      ready: true,
      pendingReview: 0,
      scannedKinds: ['character', 'lightCone', 'relic', 'warp'],
      account,
    }),
    '4.5',
  );
  expect(parsed.account?.relics).toHaveLength(account.relics.length);
  expect(parsed.revision).toBe(7);
  expect(() =>
    parseLiveBridgeMessage(
      JSON.stringify({
        type: 'snapshot',
        protocolVersion: 1,
        scannerVersion: '1.1.0',
        gameVersion: '4.6',
        revision: 1,
        capturedAt: '2026-09-14T12:00:00.000Z',
        ready: false,
        pendingReview: 0,
        scannedKinds: [],
      }),
      '4.5',
    ),
  ).toThrow(/newer than supported/);
});

it('upserts live inventory while preserving private planning fields and equipment policy', () => {
  const current = cloneAccount();
  const targetIndex = current.relics.findIndex((relic) => relic.level < 15);
  expect(targetIndex).toBeGreaterThanOrEqual(0);
  current.metadata.uid = '123456789';
  current.metadata.uidRedacted = false;
  current.relics[targetIndex].note = 'Keep this plan';
  current.relics[targetIndex].reservedFor = current.characters[0].id;
  const previousOwner = current.relics[targetIndex].equippedCharacterId;

  const incoming = cloneAccount();
  const destinationOwner = incoming.characters[1].id;
  incoming.relics = incoming.relics.map((relic, index) =>
    index !== targetIndex &&
    relic.equippedCharacterId === destinationOwner &&
    relic.slot === incoming.relics[targetIndex].slot
      ? { ...relic, equippedCharacterId: undefined }
      : relic,
  );
  incoming.relics[targetIndex] = {
    ...incoming.relics[targetIndex],
    level: Math.min(15, incoming.relics[targetIndex].level + 3),
    equippedCharacterId: destinationOwner,
  };
  incoming.relics.push({
    ...incoming.relics[1],
    id: 'live-new-relic',
    equippedCharacterId: undefined,
  });
  incoming.resources = {
    stellarJade: 16_000,
    specialPasses: 25,
    characterEventPity: 47,
  };

  const withoutResources = mergeLiveAccount(current, incoming, {
    updateEquippedGear: false,
    importWarpResources: false,
    removeMissingItems: false,
  });
  expect(withoutResources.account.relics[targetIndex].equippedCharacterId).toBe(previousOwner);
  expect(withoutResources.account.relics[targetIndex].note).toBe('Keep this plan');
  expect(withoutResources.account.relics[targetIndex].reservedFor).toBe(current.characters[0].id);
  expect(withoutResources.account.metadata.uid).toBe('123456789');
  expect(withoutResources.account.resources.stellarJade).not.toBe(16_000);
  expect(withoutResources.summary.relicsAdded).toBe(1);
  expect(withoutResources.summary.relicsEnhanced).toBe(1);
  expect(liveMergeCount(withoutResources.summary)).toBeGreaterThanOrEqual(2);

  const withResources = mergeLiveAccount(current, incoming, {
    updateEquippedGear: true,
    importWarpResources: true,
    removeMissingItems: false,
  });
  expect(withResources.account.relics[targetIndex].equippedCharacterId).toBe(destinationOwner);
  expect(withResources.account.resources.stellarJade).toBe(16_000);
  expect(withResources.account.resources.characterEventPity).toBe(47);
});

it('limits destructive reconciliation to categories included in the scan', () => {
  const current = cloneAccount();
  const incoming = cloneAccount();
  incoming.characters = [];
  incoming.lightCones = [];
  incoming.relics = incoming.relics.slice(0, 1);

  const merged = mergeLiveAccount(
    current,
    incoming,
    {
      updateEquippedGear: false,
      importWarpResources: false,
      removeMissingItems: true,
    },
    ['relic'],
  );

  expect(merged.account.characters).toHaveLength(current.characters.length);
  expect(merged.account.lightCones).toHaveLength(current.lightCones.length);
  expect(merged.account.relics).toHaveLength(1);
  expect(merged.summary.relicsRemoved).toBe(current.relics.length - 1);
  expect(merged.summary.charactersRemoved).toBe(0);
  expect(merged.summary.lightConesRemoved).toBe(0);
});

it('clears an old equipped item when a newly scanned id occupies the same slot', () => {
  const current = cloneAccount();
  const equipped = current.relics.find((relic) => relic.equippedCharacterId);
  expect(equipped).toBeDefined();
  const incoming = cloneAccount();
  incoming.relics = [
    {
      ...equipped!,
      id: 'replacement-id',
    },
  ];

  const merged = mergeLiveAccount(
    current,
    incoming,
    {
      updateEquippedGear: true,
      importWarpResources: false,
      removeMissingItems: false,
    },
    ['relic'],
  );

  const sameSlot = merged.account.relics.filter(
    (relic) =>
      relic.equippedCharacterId === equipped!.equippedCharacterId && relic.slot === equipped!.slot,
  );
  expect(sameSlot).toHaveLength(1);
  expect(sameSlot[0].id).toBe('replacement-id');
});
