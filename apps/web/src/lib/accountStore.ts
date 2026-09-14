import type { Account } from '@ksro/shared';
import { AccountSchema, migrateAccount, privacySafeExport } from '@ksro/shared';
import { versionManifest } from '@ksro/game-data';

const ACCOUNT_KEY = 'ksro.account.v2';
const SNAPSHOTS_KEY = 'ksro.snapshots.v2';

export interface StoredSnapshot {
  id: string;
  timestamp: string;
  account: Account;
}

export function loadAccount(fallback: Account): Account {
  try {
    const value = localStorage.getItem(ACCOUNT_KEY);
    return value
      ? migrateAccount(JSON.parse(value), versionManifest.supportedGameVersion)
      : fallback;
  } catch {
    return fallback;
  }
}

export function saveAccount(account: Account) {
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
}

export function loadSnapshots(): StoredSnapshot[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(SNAPSHOTS_KEY) ?? '[]');
    if (!Array.isArray(value)) return [];
    return value.flatMap((snapshot) => {
      if (
        !snapshot ||
        typeof snapshot !== 'object' ||
        typeof snapshot.id !== 'string' ||
        typeof snapshot.timestamp !== 'string' ||
        Number.isNaN(Date.parse(snapshot.timestamp))
      )
        return [];
      const account = AccountSchema.safeParse(snapshot.account);
      return account.success
        ? [{ id: snapshot.id, timestamp: snapshot.timestamp, account: account.data }]
        : [];
    });
  } catch {
    return [];
  }
}

export function saveSnapshot(account: Account): StoredSnapshot[] {
  const snapshots = loadSnapshots();
  const next = [
    ...snapshots,
    { id: crypto.randomUUID(), timestamp: new Date().toISOString(), account },
  ].slice(-20);
  localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(next));
  return next;
}

export function clearLocalData() {
  localStorage.removeItem(ACCOUNT_KEY);
  localStorage.removeItem(SNAPSHOTS_KEY);
  localStorage.removeItem('ksro.plans.v1');
  localStorage.removeItem('ksro.live-import.v1');
  sessionStorage.removeItem('ksro.live-import.pairing.v1');
}

export function downloadAccount(account: Account, privateData = false) {
  const payload = privateData ? account : privacySafeExport(account);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `krzys-star-rail-account-hsr-v${versionManifest.supportedGameVersion}-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

export async function importAccountFile(file: File): Promise<Account> {
  if (file.size > 25 * 1024 * 1024)
    throw new Error('The selected file is larger than the 25 MB safety limit.');
  return migrateAccount(JSON.parse(await file.text()), versionManifest.supportedGameVersion);
}
