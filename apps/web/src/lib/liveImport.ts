import type { Account, Character, LightCone, Relic } from '@ksro/shared';
import { AccountSchema, compareGameVersions, migrateAccount } from '@ksro/shared';

export const DEFAULT_LIVE_IMPORT_URL = 'ws://127.0.0.1:23313/ws';

export interface LiveImportSettings {
  enabled: boolean;
  endpoint: string;
  pairingCode: string;
  updateEquippedGear: boolean;
  importWarpResources: boolean;
  removeMissingItems: boolean;
}

export interface LiveImportStatus {
  state: 'disabled' | 'pairing' | 'connecting' | 'connected' | 'waiting' | 'error';
  message: string;
  revision?: number;
  lastSync?: string;
  pendingReview?: number;
}

export interface LiveImportController {
  settings: LiveImportSettings;
  status: LiveImportStatus;
  updateSettings: (update: Partial<LiveImportSettings>) => void;
}

export interface LiveMergeSummary {
  relicsAdded: number;
  relicsEnhanced: number;
  relicsUpdated: number;
  relicsRemoved: number;
  charactersAdded: number;
  charactersUpdated: number;
  charactersRemoved: number;
  lightConesAdded: number;
  lightConesUpdated: number;
  lightConesRemoved: number;
  resourcesUpdated: number;
}

export type LiveScanKind = 'character' | 'lightCone' | 'relic' | 'warp';

export interface LiveBridgeSnapshot {
  type: 'snapshot';
  protocolVersion: 1;
  scannerVersion: string;
  gameVersion: string;
  revision: number;
  capturedAt: string;
  ready: boolean;
  pendingReview: number;
  scannedKinds: LiveScanKind[];
  account?: Account;
}

const WARP_RESOURCE_KEYS = new Set([
  'stellarJade',
  'specialPasses',
  'standardPasses',
  'undyingStarlight',
  'characterEventPity',
  'lightConeEventPity',
  'standardPity',
  'characterEventGuaranteed',
  'lightConeEventGuaranteed',
]);

export const DEFAULT_LIVE_IMPORT_SETTINGS: LiveImportSettings = {
  enabled: false,
  endpoint: DEFAULT_LIVE_IMPORT_URL,
  pairingCode: '',
  updateEquippedGear: false,
  importWarpResources: false,
  removeMissingItems: false,
};

const LIVE_SETTINGS_KEY = 'ksro.live-import.v1';
const LIVE_PAIRING_KEY = 'ksro.live-import.pairing.v1';

export function loadLiveImportSettings(): LiveImportSettings {
  try {
    const saved = JSON.parse(
      localStorage.getItem(LIVE_SETTINGS_KEY) ?? '{}',
    ) as Partial<LiveImportSettings>;
    return {
      enabled: saved.enabled === true,
      endpoint: typeof saved.endpoint === 'string' ? saved.endpoint : DEFAULT_LIVE_IMPORT_URL,
      pairingCode: sessionStorage.getItem(LIVE_PAIRING_KEY) ?? '',
      updateEquippedGear: saved.updateEquippedGear === true,
      importWarpResources: saved.importWarpResources === true,
      removeMissingItems: saved.removeMissingItems === true,
    };
  } catch {
    return { ...DEFAULT_LIVE_IMPORT_SETTINGS };
  }
}

export function saveLiveImportSettings(settings: LiveImportSettings): void {
  localStorage.setItem(
    LIVE_SETTINGS_KEY,
    JSON.stringify({
      enabled: settings.enabled,
      endpoint: settings.endpoint,
      updateEquippedGear: settings.updateEquippedGear,
      importWarpResources: settings.importWarpResources,
      removeMissingItems: settings.removeMissingItems,
    }),
  );
  if (settings.pairingCode) sessionStorage.setItem(LIVE_PAIRING_KEY, settings.pairingCode);
  else sessionStorage.removeItem(LIVE_PAIRING_KEY);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isAllowedLiveImportEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    const host = url.hostname.replace(/^\[|\]$/g, '');
    return (
      url.protocol === 'ws:' &&
      ['127.0.0.1', 'localhost', '::1'].includes(host) &&
      !url.username &&
      !url.password &&
      url.pathname === '/ws' &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

export function parseLiveBridgeMessage(
  raw: string,
  supportedGameVersion: string,
): LiveBridgeSnapshot {
  if (raw.length > 30 * 1024 * 1024) throw new Error('Live snapshot exceeded the 30 MB limit.');
  const message: unknown = JSON.parse(raw);
  if (!isObject(message) || message.type !== 'snapshot' || message.protocolVersion !== 1)
    throw new Error('The scanner returned an unsupported live-import message.');
  if (
    typeof message.scannerVersion !== 'string' ||
    typeof message.gameVersion !== 'string' ||
    typeof message.revision !== 'number' ||
    !Number.isSafeInteger(message.revision) ||
    message.revision < 0 ||
    typeof message.capturedAt !== 'string' ||
    Number.isNaN(Date.parse(message.capturedAt)) ||
    typeof message.ready !== 'boolean' ||
    typeof message.pendingReview !== 'number' ||
    !Number.isSafeInteger(message.pendingReview) ||
    message.pendingReview < 0 ||
    !Array.isArray(message.scannedKinds) ||
    message.scannedKinds.some(
      (kind) => !['character', 'lightCone', 'relic', 'warp'].includes(String(kind)),
    ) ||
    (message.ready && (message.pendingReview !== 0 || message.account === undefined))
  )
    throw new Error('The scanner returned incomplete live-import metadata.');

  const compatibility = compareGameVersions(message.gameVersion, supportedGameVersion);
  if (!compatibility.compatible) throw new Error(compatibility.message);
  const account = message.ready ? migrateAccount(message.account, supportedGameVersion) : undefined;
  return {
    type: 'snapshot',
    protocolVersion: 1,
    scannerVersion: message.scannerVersion,
    gameVersion: message.gameVersion,
    revision: message.revision,
    capturedAt: message.capturedAt,
    ready: message.ready,
    pendingReview: message.pendingReview,
    scannedKinds: [...new Set(message.scannedKinds)] as LiveScanKind[],
    account,
  };
}

function withoutEquipped<T extends Relic | LightCone>(item: T): T {
  return { ...item, equippedCharacterId: undefined };
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function relicWasEnhanced(previous: Relic, next: Relic): boolean {
  if (next.level > previous.level) return true;
  const before = new Map(previous.substats.map((stat) => [stat.stat, stat.value]));
  return next.substats.some(
    (stat) => stat.value > (before.get(stat.stat) ?? Number.POSITIVE_INFINITY),
  );
}

function mergeCharacter(previous: Character | undefined, incoming: Character): Character {
  if (!previous) return incoming;
  return {
    ...previous,
    ...incoming,
    nickname: previous.nickname,
    note: previous.note,
    tags: previous.tags,
  };
}

function mergeRelic(
  previous: Relic | undefined,
  incoming: Relic,
  updateEquippedGear: boolean,
): Relic {
  const scanned = updateEquippedGear ? incoming : withoutEquipped(incoming);
  if (!previous) return scanned;
  return {
    ...previous,
    ...scanned,
    equippedCharacterId: updateEquippedGear
      ? incoming.equippedCharacterId
      : previous.equippedCharacterId,
    reservedFor: previous.reservedFor,
    note: previous.note,
    tags: previous.tags,
  };
}

function mergeLightCone(
  previous: LightCone | undefined,
  incoming: LightCone,
  updateEquippedGear: boolean,
): LightCone {
  const scanned = updateEquippedGear ? incoming : withoutEquipped(incoming);
  if (!previous) return scanned;
  return {
    ...previous,
    ...scanned,
    equippedCharacterId: updateEquippedGear
      ? incoming.equippedCharacterId
      : previous.equippedCharacterId,
  };
}

export function mergeLiveAccount(
  current: Account,
  incoming: Account,
  settings: Pick<
    LiveImportSettings,
    'updateEquippedGear' | 'importWarpResources' | 'removeMissingItems'
  >,
  scannedKinds: readonly LiveScanKind[] = ['character', 'lightCone', 'relic', 'warp'],
): { account: Account; summary: LiveMergeSummary } {
  const summary: LiveMergeSummary = {
    relicsAdded: 0,
    relicsEnhanced: 0,
    relicsUpdated: 0,
    relicsRemoved: 0,
    charactersAdded: 0,
    charactersUpdated: 0,
    charactersRemoved: 0,
    lightConesAdded: 0,
    lightConesUpdated: 0,
    lightConesRemoved: 0,
    resourcesUpdated: 0,
  };

  const scanned = new Set(scannedKinds);

  const currentCharacters = new Map(current.characters.map((item) => [item.id, item]));
  const currentRelics = new Map(current.relics.map((item) => [item.id, item]));
  const currentLightCones = new Map(current.lightCones.map((item) => [item.id, item]));

  const characters = (scanned.has('character') ? incoming.characters : current.characters).map(
    (item) => {
      const previous = currentCharacters.get(item.id);
      const merged = mergeCharacter(previous, item);
      if (scanned.has('character')) {
        if (!previous) summary.charactersAdded += 1;
        else if (!sameValue(previous, merged)) summary.charactersUpdated += 1;
      }
      currentCharacters.delete(item.id);
      return merged;
    },
  );
  if (scanned.has('character') && settings.removeMissingItems)
    summary.charactersRemoved = currentCharacters.size;
  else characters.push(...currentCharacters.values());

  const relics = (scanned.has('relic') ? incoming.relics : current.relics).map((item) => {
    const previous = currentRelics.get(item.id);
    const merged = mergeRelic(previous, item, settings.updateEquippedGear);
    if (scanned.has('relic')) {
      if (!previous) summary.relicsAdded += 1;
      else if (!sameValue(previous, merged)) {
        if (relicWasEnhanced(previous, merged)) summary.relicsEnhanced += 1;
        else summary.relicsUpdated += 1;
      }
    }
    currentRelics.delete(item.id);
    return merged;
  });
  if (scanned.has('relic') && settings.removeMissingItems) {
    summary.relicsRemoved = currentRelics.size;
  } else {
    const occupiedSlots = new Set(
      relics.flatMap((item) =>
        item.equippedCharacterId ? [`${item.equippedCharacterId}|${item.slot}`] : [],
      ),
    );
    relics.push(
      ...[...currentRelics.values()].map((item) => {
        const conflict =
          scanned.has('relic') &&
          settings.updateEquippedGear &&
          item.equippedCharacterId &&
          occupiedSlots.has(`${item.equippedCharacterId}|${item.slot}`);
        if (conflict) {
          summary.relicsUpdated += 1;
          return { ...item, equippedCharacterId: undefined };
        }
        return item;
      }),
    );
  }

  const lightCones = (scanned.has('lightCone') ? incoming.lightCones : current.lightCones).map(
    (item) => {
      const previous = currentLightCones.get(item.id);
      const merged = mergeLightCone(previous, item, settings.updateEquippedGear);
      if (scanned.has('lightCone')) {
        if (!previous) summary.lightConesAdded += 1;
        else if (!sameValue(previous, merged)) summary.lightConesUpdated += 1;
      }
      currentLightCones.delete(item.id);
      return merged;
    },
  );
  if (scanned.has('lightCone') && settings.removeMissingItems) {
    summary.lightConesRemoved = currentLightCones.size;
  } else {
    const occupiedCharacters = new Set(
      lightCones.flatMap((item) => (item.equippedCharacterId ? [item.equippedCharacterId] : [])),
    );
    lightCones.push(
      ...[...currentLightCones.values()].map((item) => {
        const conflict =
          scanned.has('lightCone') &&
          settings.updateEquippedGear &&
          item.equippedCharacterId &&
          occupiedCharacters.has(item.equippedCharacterId);
        if (conflict) {
          summary.lightConesUpdated += 1;
          return { ...item, equippedCharacterId: undefined };
        }
        return item;
      }),
    );
  }

  const resources = { ...current.resources };
  if (settings.importWarpResources && scanned.has('warp')) {
    for (const [key, value] of Object.entries(incoming.resources)) {
      if (!WARP_RESOURCE_KEYS.has(key) || resources[key] === value) continue;
      resources[key] = value;
      summary.resourcesUpdated += 1;
    }
  }

  return {
    account: AccountSchema.parse({
      ...current,
      metadata: {
        ...incoming.metadata,
        uid: current.metadata.uid,
        uidRedacted: current.metadata.uidRedacted,
        exportedAt: new Date().toISOString(),
        source: 'scanner',
      },
      characters,
      lightCones,
      relics,
      resources,
      reservations: current.reservations,
    }),
    summary,
  };
}

export function liveMergeCount(summary: LiveMergeSummary): number {
  return Object.values(summary).reduce((total, value) => total + value, 0);
}

export function liveMergeDescription(summary: LiveMergeSummary): string {
  const parts = [
    summary.relicsAdded && `${summary.relicsAdded} new relics`,
    summary.relicsEnhanced && `${summary.relicsEnhanced} enhanced relics`,
    summary.relicsUpdated && `${summary.relicsUpdated} updated relics`,
    summary.relicsRemoved && `${summary.relicsRemoved} removed relics`,
    summary.charactersAdded && `${summary.charactersAdded} new characters`,
    summary.charactersUpdated && `${summary.charactersUpdated} updated characters`,
    summary.charactersRemoved && `${summary.charactersRemoved} removed characters`,
    summary.lightConesAdded && `${summary.lightConesAdded} new Light Cones`,
    summary.lightConesUpdated && `${summary.lightConesUpdated} updated Light Cones`,
    summary.lightConesRemoved && `${summary.lightConesRemoved} removed Light Cones`,
    summary.resourcesUpdated && `${summary.resourcesUpdated} warp resources`,
  ].filter(Boolean);
  return parts.join(', ') || 'No account changes';
}
