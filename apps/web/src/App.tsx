import { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Boxes,
  ChevronDown,
  CircleGauge,
  Database,
  FlaskConical,
  Gauge,
  GitCompareArrows,
  History,
  Moon,
  Orbit,
  Redo2,
  ScanLine,
  Settings,
  Sun,
  Undo2,
} from 'lucide-react';
import type { Account } from '@ksro/shared';
import { AccountSchema, compareGameVersions } from '@ksro/shared';
import { demoAccount, versionManifest } from '@ksro/game-data';
import {
  AssistantView,
  DashboardView,
  DataView,
  HistoryView,
  OptimizerView,
  PlannerView,
  RelicsView,
  SettingsView,
  TeamsView,
  TimelineView,
  type ViewProps,
} from './Views';
import {
  importAccountFile,
  loadAccount,
  loadSnapshots,
  saveAccount,
  saveSnapshot,
  type StoredSnapshot,
} from './lib/accountStore';

type ViewId =
  | 'dashboard'
  | 'optimizer'
  | 'teams'
  | 'relics'
  | 'planner'
  | 'timeline'
  | 'assistant'
  | 'history'
  | 'data'
  | 'settings';

const views: Array<{ id: ViewId; label: string; icon: typeof Orbit }> = [
  { id: 'dashboard', label: 'Command center', icon: Orbit },
  { id: 'optimizer', label: 'Optimizer', icon: Gauge },
  { id: 'teams', label: 'Multi-team plans', icon: Boxes },
  { id: 'relics', label: 'Relic laboratory', icon: GitCompareArrows },
  { id: 'planner', label: 'Farming & pulls', icon: FlaskConical },
  { id: 'timeline', label: 'Combat timeline', icon: CircleGauge },
  { id: 'assistant', label: 'Account assistant', icon: Bot },
  { id: 'history', label: 'Scan history', icon: History },
  { id: 'data', label: 'Account data', icon: Database },
  { id: 'settings', label: 'Settings & about', icon: Settings },
];

const viewComponents: Record<ViewId, (props: ViewProps) => React.ReactNode> = {
  dashboard: DashboardView,
  optimizer: OptimizerView,
  teams: TeamsView,
  relics: RelicsView,
  planner: PlannerView,
  timeline: TimelineView,
  assistant: AssistantView,
  history: HistoryView,
  data: DataView,
  settings: SettingsView,
};

const IS_STALE = new Date().getTime() > new Date(versionManifest.staleAfter).getTime();

export function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return localStorage.getItem('ksro.theme') === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });
  const [view, setView] = useState<ViewId>(() => {
    const hash = location.hash.slice(1).split('?')[0] as ViewId;
    return views.some((item) => item.id === hash) ? hash : 'dashboard';
  });
  const [account, setAccountState] = useState<Account>(() => loadAccount(demoAccount));
  const [snapshots, setSnapshots] = useState<StoredSnapshot[]>(loadSnapshots);
  const [undoStack, setUndoStack] = useState<Account[]>([]);
  const [redoStack, setRedoStack] = useState<Account[]>([]);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'warning' }>();
  const [pendingImport, setPendingImport] = useState<Account>();
  const importRef = useRef<HTMLInputElement>(null);
  const ActiveView = viewComponents[view];

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('ksro.theme', theme);
    } catch {
      /* Theme still works for this session. */
    }
  }, [theme]);

  useEffect(() => {
    const onHash = () => {
      const next = location.hash.slice(1).split('?')[0] as ViewId;
      if (views.some((item) => item.id === next)) setView(next);
    };
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(undefined), 4200);
    return () => clearTimeout(timeout);
  }, [toast]);

  function notify(message: string, tone: 'success' | 'warning' = 'success') {
    setToast({ message, tone });
  }

  function updateAccount(next: Account) {
    try {
      next = AccountSchema.parse(next);
      saveAccount(next);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Account could not be saved.', 'warning');
      return;
    }
    setUndoStack((items) => [...items.slice(-19), account]);
    setRedoStack([]);
    setAccountState(next);
  }

  function undo() {
    const previous = undoStack.at(-1);
    if (!previous) return;
    try {
      saveAccount(previous);
    } catch {
      notify('Cannot save undo: storage is unavailable.', 'warning');
      return;
    }
    setRedoStack((items) => [...items, account]);
    setUndoStack((items) => items.slice(0, -1));
    setAccountState(previous);
  }

  function redo() {
    const next = redoStack.at(-1);
    if (!next) return;
    try {
      saveAccount(next);
    } catch {
      notify('Cannot save redo: storage is unavailable.', 'warning');
      return;
    }
    setUndoStack((items) => [...items, account]);
    setRedoStack((items) => items.slice(0, -1));
    setAccountState(next);
  }

  async function onImport(file?: File) {
    if (!file) return;
    try {
      const imported = await importAccountFile(file);
      const compatibility = compareGameVersions(
        imported.metadata.gameVersion,
        versionManifest.supportedGameVersion,
      );
      if (!compatibility.compatible) {
        setPendingImport(imported);
        return;
      }
      const nextSnapshots = saveSnapshot(account);
      setSnapshots(nextSnapshots);
      updateAccount(imported);
      setView('dashboard');
      location.hash = 'dashboard';
      notify(
        `Imported ${imported.relics.length} relics and preserved the previous snapshot.`,
        'success',
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : 'The file could not be imported.', 'warning');
    } finally {
      if (importRef.current) importRef.current.value = '';
    }
  }

  const props: ViewProps = {
    account,
    setAccount: updateAccount,
    snapshots,
    setSnapshots,
    notify,
    openImport: () => importRef.current?.click(),
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#dashboard" aria-label="Krzys Star Rail Optimizer dashboard">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
          </span>
          <span>
            <strong>Krzys</strong>
            <small>Star Rail Optimizer</small>
          </span>
        </a>
        <div className="version-pill">
          <span />
          Supports Honkai: Star Rail v{versionManifest.supportedGameVersion}
          <b>•</b> Data updated {versionManifest.generatedAt.slice(0, 10)}
        </div>
        <div className="header-actions">
          <div className="undo-actions">
            <button
              className="icon-button"
              onClick={undo}
              disabled={!undoStack.length}
              aria-label="Undo account edit"
            >
              <Undo2 size={16} />
            </button>
            <button
              className="icon-button"
              onClick={redo}
              disabled={!redoStack.length}
              aria-label="Redo account edit"
            >
              <Redo2 size={16} />
            </button>
          </div>
          <button
            className="icon-button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="primary-button" onClick={() => importRef.current?.click()}>
            <ScanLine size={17} /> Import scan
          </button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => onImport(event.target.files?.[0])}
          />
        </div>
      </header>
      <aside className="sidebar" aria-label="Primary navigation">
        <nav>
          {views.map(({ id, label, icon: Icon }) => (
            <a className={view === id ? 'active' : ''} href={`#${id}`} key={id}>
              <Icon size={18} /> {label}
            </a>
          ))}
        </nav>
        <div className="privacy-card">
          <ShieldIcon />
          <div>
            <strong>Local by design</strong>
            <span>Your account stays in this browser.</span>
          </div>
        </div>
      </aside>
      <main className="main-content" id={view}>
        <div className="stale-bar" role="note">
          Experimental v1 calculation model: generic build search, not character-kit parity. Review
          manual assumptions before moving equipment.
        </div>
        {pendingImport && (
          <section className="panel" role="alert">
            <h2>Newer game version: manual review required</h2>
            <p>
              {
                compareGameVersions(
                  pendingImport.metadata.gameVersion,
                  versionManifest.supportedGameVersion,
                ).message
              }
            </p>
            <p>
              Your current account is unchanged. You can load the snapshot for correction;
              optimization stays blocked until its version is compatible.
            </p>
            <button
              className="secondary-button"
              onClick={() => {
                try {
                  setSnapshots(saveSnapshot(account));
                  updateAccount(pendingImport);
                  setPendingImport(undefined);
                  location.hash = 'data';
                } catch {
                  notify('Cannot preserve the previous snapshot; import stopped.', 'warning');
                }
              }}
            >
              Load for manual correction
            </button>
            <button className="secondary-button" onClick={() => setPendingImport(undefined)}>
              Cancel import
            </button>
          </section>
        )}
        {!compareGameVersions(account.metadata.gameVersion, versionManifest.supportedGameVersion)
          .compatible && (
          <div className="warning-banner" role="alert">
            Account v{account.metadata.gameVersion} is newer than supported data. Optimization is
            blocked. Correct unknown items in Account data; do not just relabel an unverified
            snapshot.
          </div>
        )}
        {IS_STALE && (
          <div className="stale-bar">
            <span />
            Verified for HSR v{versionManifest.supportedGameVersion}; newer game versions are not
            claimed. <a href="#settings">Review version support</a>
          </div>
        )}
        <ActiveView {...props} />
      </main>
      <div className="mobile-view-label">
        <span>{views.find((item) => item.id === view)?.label}</span>
        <ChevronDown size={15} />
      </div>
      {toast && (
        <div className={`toast ${toast.tone}`} role="status">
          <span>{toast.tone === 'success' ? '✓' : '!'}</span>
          {toast.message}
        </div>
      )}
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3v8Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
