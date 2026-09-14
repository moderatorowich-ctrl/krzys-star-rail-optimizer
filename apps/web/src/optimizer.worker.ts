/// <reference lib="webworker" />
import type { Account } from '@ksro/shared';
import { optimizeRelics, optimizeMultiTeam, type OptimizerOptions } from '@ksro/optimizer-engine';
import { compareGameVersions } from '@ksro/shared';
import { versionManifest } from '@ksro/game-data';

interface WorkerRequest {
  account: Account;
  characterId: string;
  minSpeed: number;
  objective: 'damage' | 'auto' | 'survival' | 'balanced';
  exact: boolean;
  excludedRelicIds: string[];
  pinnedRelicIds: string[];
  calculation?: Pick<
    OptimizerOptions,
    'mainStats' | 'requiredSets' | 'requiredSubstats' | 'damageConfig' | 'buffs' | 'constraints'
  >;
}

let cancelled = false;

self.onmessage = (
  event: MessageEvent<
    | WorkerRequest
    | { cancel: true }
    | { type: 'teams'; account: Account; selected: string[]; teams: number }
  >,
) => {
  try {
    if ('cancel' in event.data) {
      cancelled = true;
      return;
    }
    cancelled = false;
    if (
      !compareGameVersions(
        event.data.account.metadata.gameVersion,
        versionManifest.supportedGameVersion,
      ).compatible
    )
      throw new Error(
        'This account is from a newer game version. Correct its data in Account data before optimizing.',
      );
    if ('type' in event.data && event.data.type === 'teams') {
      self.postMessage({
        type: 'result',
        result: optimizeMultiTeam(event.data.account, event.data.selected, event.data.teams, {
          noSharedRelics: true,
        }),
      });
      return;
    }
    const { account, characterId, minSpeed, objective, exact, excludedRelicIds, pinnedRelicIds } =
      event.data as WorkerRequest;
    const character = account.characters.find((item) => item.id === characterId);
    if (!character) {
      self.postMessage({ type: 'error', error: 'Character was not found.' });
      return;
    }
    const weights =
      objective === 'survival'
        ? { hpPct: 220, defPct: 200, effectRes: 120, spd: 8 }
        : objective === 'auto'
          ? { atkPct: 140, critRate: 480, critDmg: 160, spd: 14, effectRes: 80 }
          : objective === 'balanced'
            ? { atkPct: 150, critRate: 390, critDmg: 190, spd: 12, hpPct: 35, defPct: 35 }
            : { atkPct: 170, critRate: 410, critDmg: 220, spd: 10, elementalDmg: 190 };
    const result = optimizeRelics({
      ...(event.data as WorkerRequest).calculation,
      character,
      lightCone: account.lightCones.find((cone) => cone.equippedCharacterId === characterId),
      reservations: account.reservations,
      relics: account.relics,
      weights,
      constraints: [
        ...(minSpeed ? [{ stat: 'spd' as const, min: minSpeed }] : []),
        ...((event.data as WorkerRequest).calculation?.constraints ?? []),
      ],
      allowEquipped: true,
      allowLocked: false,
      objective,
      exact,
      excludedRelicIds,
      pinnedRelicIds,
      limit: 20,
      shouldCancel: () => cancelled,
      onProgress: (progress, evaluated) =>
        self.postMessage({ type: 'progress', progress, evaluated }),
    });
    self.postMessage({ type: 'result', result });
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Calculation failed.',
    });
  }
};

export {};
