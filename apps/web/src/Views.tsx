import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  ChevronRight,
  CircleGauge,
  Clock3,
  Download,
  FileJson,
  FlaskConical,
  Gauge,
  History,
  LockKeyhole,
  Pause,
  Play,
  Printer,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  WandSparkles,
  X,
} from 'lucide-react';
import type { Account, Relic, RelicSlot } from '@ksro/shared';
import { AccountSchema, compareGameVersions } from '@ksro/shared';
import { encounterData, farmingDomains, gameData, versionManifest } from '@ksro/game-data';
import {
  adviseRelicUpgrade,
  answerAccountQuestion,
  buildCommandCenter,
  compareSnapshots,
  optimizeMultiTeam,
  paretoFrontier,
  planFarming,
  scoreRelics,
  simulatePullValue,
  type BuildResult,
  buildResult,
} from '@ksro/optimizer-engine';
import { calculateDamage, simulateRotation } from '@ksro/combat-engine';
import {
  clearLocalData,
  downloadAccount,
  saveSnapshot,
  type StoredSnapshot,
} from './lib/accountStore';

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const number = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });
const IS_STALE = new Date().getTime() > new Date(versionManifest.staleAfter).getTime();

export interface ViewProps {
  account: Account;
  setAccount: (account: Account) => void;
  snapshots: StoredSnapshot[];
  setSnapshots: (snapshots: StoredSnapshot[]) => void;
  notify: (message: string, tone?: 'success' | 'warning') => void;
  openImport: () => void;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <div className="signal-icon cyan">
        <Sparkles size={20} />
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

function Meter({ value, max = 100 }: { value: number; max?: number }) {
  return (
    <div
      className="meter"
      role="progressbar"
      aria-label={`${Math.round(value)} of ${max}`}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(max, Math.max(0, value))}
    >
      <i style={{ width: `${Math.min(100, (100 * value) / max)}%` }} />
    </div>
  );
}

export function DashboardView({ account }: ViewProps) {
  const recommendations = useMemo(() => buildCommandCenter(account), [account]);
  const top = recommendations[0];
  const lowConfidence = account.relics.filter((relic) => (relic.ocrConfidence ?? 1) < 0.78).length;
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Account command center</p>
          <h1>Rank the next account move.</h1>
          <p>
            Transparent heuristics compare imported inventory, fixed upgrade gaps, transfer cost,
            and relic uncertainty.
          </p>
        </div>
        <div className="account-chip">
          <span>{account.metadata.source.toUpperCase()}</span>
          <strong>{account.characters.length} characters</strong>
          <small>{account.relics.length} relics analyzed</small>
        </div>
      </section>
      {top ? (
        <>
          <section className="priority-grid">
            <article className="hero-card">
              <div className="card-topline">
                <span className="rank">01</span>
                <span className="confidence">
                  <i /> {top.confidence} confidence
                </span>
              </div>
              <p className="eyebrow">Highest value now</p>
              <h2>{top.title}</h2>
              <p className="hero-copy">{top.explanation}</p>
              <div className="benefit-row">
                <div>
                  <small>
                    {top.benefitUnit === 'damagePercent'
                      ? 'GENERIC HIT CHANGE'
                      : 'HEURISTIC PRIORITY'}
                  </small>
                  <strong>
                    {top.expectedBenefit.toFixed(1)}
                    {top.benefitUnit === 'damagePercent' ? '%' : ' pts'}
                  </strong>
                </div>
                <div>
                  <small>POWER COST</small>
                  <strong>{top.resourceCost}</strong>
                </div>
                <div>
                  <small>OUTCOME</small>
                  <strong>{top.guaranteed ? 'Guaranteed' : 'RNG'}</strong>
                </div>
              </div>
              <a className="text-button" href="#optimizer">
                Open calculation <ChevronRight size={16} />
              </a>
              <div className="orbit-art" aria-hidden="true">
                <i />
                <i />
                <i />
                <span />
              </div>
            </article>
            <div className="signal-stack">
              <article className="signal-card">
                <div className="signal-icon cyan">
                  <CircleGauge size={20} />
                </div>
                <div>
                  <small>ACCOUNT READINESS</small>
                  <strong>
                    {Math.round(
                      (100 *
                        account.characters.reduce(
                          (sum, character) =>
                            sum +
                            (character.level / 80 +
                              Math.min(1, character.traces.skill / 10) +
                              account.relics.filter(
                                (relic) => relic.equippedCharacterId === character.id,
                              ).length /
                                6) /
                              3,
                          0,
                        )) /
                        Math.max(1, account.characters.length),
                    )}{' '}
                    <em>/ 100</em>
                  </strong>
                  <span>Calculated from level, Trace and equipment coverage.</span>
                </div>
              </article>
              <article className="signal-card">
                <div className="signal-icon violet">
                  <Gauge size={20} />
                </div>
                <div>
                  <small>FREE GAINS FOUND</small>
                  <strong>
                    {recommendations.filter((item) => item.resourceCost === 0).length}
                  </strong>
                  <span>Generic-model candidates with no Power cost.</span>
                </div>
              </article>
              <article className="signal-card">
                <div className="signal-icon gold">
                  <FileJson size={20} />
                </div>
                <div>
                  <small>SCAN REVIEW</small>
                  <strong>{lowConfidence}</strong>
                  <span>Low-confidence OCR item{lowConfidence === 1 ? '' : 's'} to verify.</span>
                </div>
              </article>
            </div>
          </section>
          <section className="queue-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Heuristic improvement plan</p>
                <h2>Free candidates, then resource heuristics</h2>
              </div>
              <button className="secondary-button" onClick={() => window.print()}>
                <Printer size={15} /> Print roadmap
              </button>
            </div>
            <div
              className="queue-table"
              role="table"
              aria-label="Prioritized account improvements"
              tabIndex={0}
            >
              <div className="queue-row queue-header" role="row">
                <span role="columnheader">Priority</span>
                <span role="columnheader">Recommendation</span>
                <span role="columnheader">Type</span>
                <span role="columnheader">Cost</span>
                <span role="columnheader">Confidence</span>
              </div>
              {recommendations.slice(0, 7).map((item, index) => (
                <div className="queue-row" role="row" key={item.id}>
                  <span className="queue-rank" role="cell">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span role="cell">
                    <strong>{item.title}</strong>
                    <small>{item.affected.join(' • ') || 'Account-wide'}</small>
                  </span>
                  <span role="cell">
                    <i className={item.guaranteed ? 'dot guarantee' : 'dot rng'} />
                    {item.guaranteed
                      ? 'Upgrade'
                      : item.resourceCost === 0
                        ? 'Model estimate'
                        : 'Relic RNG'}
                  </span>
                  <span role="cell">
                    {item.resourceCost ? `${item.resourceCost} Power` : 'Free'}
                  </span>
                  <span role="cell">{item.confidence}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <EmptyState
          title="Import an account to begin"
          body="Use a Krzys HSR Scanner export, a compatible scanner JSON file, or manual account data."
        />
      )}
    </>
  );
}

export function OptimizerView({ account, setAccount, notify }: ViewProps) {
  const [characterId, setCharacterId] = useState(account.characters[0]?.id ?? '');
  const [objective, setObjective] = useState<'damage' | 'auto' | 'survival' | 'balanced'>(
    'balanced',
  );
  const [minSpeed, setMinSpeed] = useState(134);
  const [exact, setExact] = useState(false);
  const [progress, setProgress] = useState(0);
  const [evaluated, setEvaluated] = useState(0);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<BuildResult[]>([]);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [pinned, setPinned] = useState<string[]>([]);
  const [calculationText, setCalculationText] = useState(
    JSON.stringify(
      {
        damageConfig: {
          characterLevel: 80,
          enemyLevel: 95,
          abilityMultiplier: 3,
          scalingStat: 'atk',
          enemyResistance: 0.2,
          targetCount: 1,
          weaknessBroken: false,
        },
        mainStats: {},
        requiredSets: [],
        constraints: [],
        buffs: [],
      },
      null,
      2,
    ),
  );
  const workerRef = useRef<Worker | undefined>(undefined);
  const character = account.characters.find((item) => item.id === characterId);
  const current = results[0];
  const frontier = useMemo(() => paretoFrontier(results), [results]);
  useEffect(() => () => workerRef.current?.terminate(), []);
  const equipped = character
    ? buildResult(
        {
          character,
          lightCone: account.lightCones.find((cone) => cone.equippedCharacterId === character.id),
          relics: account.relics,
          weights: {},
        },
        account.relics.filter((relic) => relic.equippedCharacterId === character.id),
      )
    : undefined;

  function run() {
    let calculation;
    try {
      calculation = JSON.parse(calculationText);
    } catch {
      notify('Advanced calculation settings must be valid JSON.', 'warning');
      return;
    }
    workerRef.current?.terminate();
    const worker = new Worker(new URL('./optimizer.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;
    setRunning(true);
    setProgress(0);
    setEvaluated(0);
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') {
        setProgress(data.progress);
        setEvaluated(data.evaluated);
      }
      if (data.type === 'result') {
        setResults(data.result);
        setRunning(false);
        setProgress(1);
        worker.terminate();
      }
      if (data.type === 'error') {
        notify(data.error, 'warning');
        setRunning(false);
      }
    };
    worker.onerror = () => {
      setRunning(false);
      notify('The calculation worker failed. Check the settings and retry.', 'warning');
      worker.terminate();
    };
    worker.postMessage({
      account,
      characterId,
      minSpeed,
      objective,
      exact,
      excludedRelicIds: excluded,
      pinnedRelicIds: pinned,
      calculation,
    });
  }

  function cancel() {
    workerRef.current?.postMessage({ cancel: true });
    workerRef.current?.terminate();
    setRunning(false);
    notify('Optimization cancelled.');
  }
  function toggle(list: string[], setList: (items: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  }
  function reserve(build: BuildResult) {
    const relicIds = new Set(build.relics.map((relic) => relic.id));
    setAccount({
      ...account,
      relics: account.relics.map((relic) =>
        relicIds.has(relic.id) ? { ...relic, reservedFor: build.characterId } : relic,
      ),
    });
    notify('Build reserved inside the account planner.', 'success');
  }

  if (!account.characters.length)
    return (
      <EmptyState
        title="No characters imported"
        body="Import or add account data before running the optimizer."
      />
    );
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Character optimizer</p>
          <h1>Search eligible relic combinations.</h1>
          <p>
            Deterministic ranking runs in a background worker with explicit constraints. Heuristic
            mode caps candidates; exhaustive mode evaluates every eligible combination.
          </p>
        </div>
        <div className="mode-badge">{exact ? 'EXACT' : 'HEURISTIC'} MODE</div>
      </section>
      <div className="workspace-grid">
        <aside className="control-panel panel">
          <label>
            Character
            <select value={characterId} onChange={(event) => setCharacterId(event.target.value)}>
              {account.characters.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name} · E{item.eidolon}
                </option>
              ))}
            </select>
          </label>
          <label>
            Optimization goal
            <select
              value={objective}
              onChange={(event) => setObjective(event.target.value as typeof objective)}
            >
              <option value="balanced">Balanced performance</option>
              <option value="damage">Maximum damage</option>
              <option value="auto">Reliable auto-battle</option>
              <option value="survival">Maximum survivability</option>
            </select>
          </label>
          <label>
            Minimum Speed
            <div className="number-input">
              <input
                type="number"
                min="0"
                max="300"
                value={minSpeed}
                onChange={(event) => setMinSpeed(Number(event.target.value))}
              />
              <span>SPD</span>
            </div>
          </label>
          <label className="switch-row">
            <span>
              <strong>Exhaustive search</strong>
              <small>Evaluates all eligible combinations</small>
            </span>
            <input
              type="checkbox"
              checked={exact}
              onChange={(event) => setExact(event.target.checked)}
            />
          </label>
          <div className="constraint-summary">
            <span>Locked relics respected</span>
            <span>Reservations respected</span>
            <span>
              {excluded.length} excluded · {pinned.length} pinned
            </span>
          </div>
          <details>
            <summary>Enemy, main stats, sets &amp; manual buffs</summary>
            <p className="muted">
              Generic hit model. Use mainStats such as {`{"Feet":["spd"]}`}, requiredSets such as{' '}
              {`[{"set":"Musketeer of Wild Wheat","count":4}]`}, and buffs with name, uptime (0–1),
              and stats. Skill multipliers and all conditional effects must be entered explicitly.
              Stored Trace/Eidolon levels do not automatically model a character kit.
            </p>
            <textarea
              aria-label="Advanced calculation settings"
              rows={18}
              value={calculationText}
              onChange={(event) => setCalculationText(event.target.value)}
            />
          </details>
          {running ? (
            <button className="danger-button wide" onClick={cancel}>
              <X size={17} /> Cancel search
            </button>
          ) : (
            <button className="primary-button wide" onClick={run}>
              <Search size={17} /> Run optimizer
            </button>
          )}
          <div className="progress-block">
            <div>
              <span>Search progress</span>
              <strong>{Math.round(progress * 100)}%</strong>
            </div>
            <Meter value={progress} max={1} />
            <small>
              {evaluated.toLocaleString()} builds evaluated {running ? '· calculating…' : ''}
            </small>
          </div>
        </aside>
        <section className="results-panel">
          {current && character ? (
            <>
              <article className="result-hero panel">
                <div>
                  <p className="eyebrow">Top result</p>
                  <h2>{character.name}</h2>
                  <div className="result-metric">
                    <strong>{compact.format(current.damage)}</strong>
                    <span>expected damage</span>
                  </div>
                </div>
                <div className="stat-cluster">
                  <span>
                    <small>SPD</small>
                    <strong>{current.stats.spd.toFixed(1)}</strong>
                  </span>
                  <span>
                    <small>CRIT</small>
                    <strong>{Math.round(current.stats.critRate * 100)}%</strong>
                  </span>
                  <span>
                    <small>CRIT DMG</small>
                    <strong>{Math.round(current.stats.critDmg * 100)}%</strong>
                  </span>
                  <span>
                    <small>ATK</small>
                    <strong>{number.format(current.stats.atk)}</strong>
                  </span>
                </div>
                <div className="score-radar">
                  <span style={{ '--score': `${current.autoConsistency}%` } as React.CSSProperties}>
                    <b>{Math.round(current.autoConsistency)}</b>
                    <small>AUTO</small>
                  </span>
                  <span
                    style={
                      {
                        '--score': `${Math.min(100, current.rotationStability)}%`,
                      } as React.CSSProperties
                    }
                  >
                    <b>{Math.round(current.rotationStability)}</b>
                    <small>ROTATION</small>
                  </span>
                  <span style={{ '--score': `${current.practicality}%` } as React.CSSProperties}>
                    <b>{Math.round(current.practicality)}</b>
                    <small>EASE</small>
                  </span>
                </div>
              </article>
              <div className="result-actions">
                <button className="primary-button" onClick={() => reserve(current)}>
                  <LockKeyhole size={15} /> Reserve build
                </button>
                <button className="secondary-button" onClick={() => window.print()}>
                  <Printer size={15} /> Transfer checklist
                </button>
                <button
                  className="secondary-button"
                  onClick={() =>
                    navigator.clipboard.writeText(
                      `${location.origin}${location.pathname}#optimizer?character=${character.id}&spd=${minSpeed}`,
                    )
                  }
                >
                  <ArrowRight size={15} /> Copy private-safe link
                </button>
              </div>
              <article className="panel explanation">
                {equipped && (
                  <p>
                    Equipped baseline: {equipped.stats.spd.toFixed(2)} SPD,{' '}
                    {Math.round(equipped.stats.atk)} ATK. Stat comparison uses the same base stats;
                    damage comparisons require identical manual settings.
                  </p>
                )}
                <h3>Why it ranks first</h3>
                {current.explanation.map((line) => (
                  <p key={line}>
                    <Check size={15} />
                    {line}
                  </p>
                ))}
                <p>
                  <Check size={15} />
                  Pareto-efficient among {frontier.length} damage / Speed / survival tradeoffs.
                </p>
              </article>
              <div className="build-list">
                {results.slice(0, 6).map((build, index) => (
                  <article className="build-card panel" key={build.id}>
                    <span className="queue-rank">#{index + 1}</span>
                    <div>
                      <strong>{compact.format(build.damage)} damage</strong>
                      <small>
                        {build.stats.spd.toFixed(1)} SPD · {build.transferCount} transfers · score{' '}
                        {Math.round(build.weightedScore)}
                      </small>
                    </div>
                    <div className="relic-chips">
                      {build.relics.map((relic) => (
                        <button
                          key={relic.id}
                          className={`${pinned.includes(relic.id) ? 'pinned' : ''} ${excluded.includes(relic.id) ? 'excluded' : ''}`}
                          onClick={() => toggle(pinned, setPinned, relic.id)}
                          onContextMenu={(event) => {
                            event.preventDefault();
                            toggle(excluded, setExcluded, relic.id);
                          }}
                          title="Click to pin; right-click to exclude"
                        >
                          {relic.slot.split(' ')[0]} +{relic.level}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              title="Ready to calculate"
              body="Choose a goal and Speed constraint, then run the optimizer. Click relic chips to pin them; right-click to exclude them."
            />
          )}
        </section>
      </div>
    </>
  );
}

export function TeamsView({ account, notify }: ViewProps) {
  const [mode, setMode] = useState('Memory of Chaos');
  const [plans, setPlans] = useState<ReturnType<typeof optimizeMultiTeam>>([]);
  const [selected, setSelected] = useState(account.characters.slice(0, 8).map((item) => item.id));
  const encounter = encounterData.find((item) => item.mode === mode) ?? encounterData[0];
  const [running, setRunning] = useState(false);
  const workerRef = useRef<Worker | undefined>(undefined);
  useEffect(() => () => workerRef.current?.terminate(), []);
  function toggleCharacter(id: string) {
    setSelected(
      selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id].slice(-8),
    );
  }
  function run() {
    if (selected.length !== 8) {
      notify('Select exactly eight distinct characters.', 'warning');
      return;
    }
    workerRef.current?.terminate();
    const worker = new Worker(new URL('./optimizer.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;
    setRunning(true);
    worker.onmessage = ({ data }) => {
      if (data.type === 'result') {
        setPlans(data.result);
        setRunning(false);
        worker.terminate();
        notify(
          data.result.length
            ? 'Joint equipment assignment complete.'
            : 'No conflict-free plan found.',
          data.result.length ? 'success' : 'warning',
        );
      } else if (data.type === 'error') {
        setRunning(false);
        worker.terminate();
        notify(data.error, 'warning');
      }
    };
    worker.onerror = () => {
      setRunning(false);
      worker.terminate();
      notify('Team calculation failed.', 'warning');
    };
    worker.postMessage({ type: 'teams', account, selected, teams: 2 });
  }
  function save() {
    if (!plans[0]) return;
    try {
      localStorage.setItem('ksro.plans.v1', JSON.stringify(plans[0]));
      notify('Plan saved locally.', 'success');
    } catch {
      notify('Storage is full or unavailable; the plan was not saved.', 'warning');
    }
  }
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Account-wide optimizer</p>
          <h1>Plan two fixed sides together.</h1>
          <p>
            Joint assignment prevents duplicate characters and shared relics while exposing every
            cross-team tradeoff.
          </p>
        </div>
        <select
          className="heading-select"
          aria-label="Encounter mode"
          value={mode}
          onChange={(event) => setMode(event.target.value)}
        >
          {[...new Set(encounterData.map((item) => item.mode))].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </section>
      <article className="encounter-strip panel">
        <div>
          <span>HSR {encounter.version}</span>
          <strong>{encounter.name}</strong>
          <small>{encounter.buff}</small>
        </div>
        <div>
          <small>MODEL WARNING</small>
          <p>{encounter.uncertainty}</p>
        </div>
      </article>
      <div className="team-builder panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Select eight characters</p>
            <h2>Two conflict-free teams</h2>
          </div>
          <button
            className="primary-button"
            onClick={
              running
                ? () => {
                    workerRef.current?.terminate();
                    setRunning(false);
                  }
                : run
            }
          >
            <WandSparkles size={16} /> {running ? 'Cancel team search' : 'Optimize both sides'}
          </button>
        </div>
        <div className="character-picker">
          {account.characters.map((character) => (
            <button
              className={selected.includes(character.id) ? 'selected' : ''}
              onClick={() => toggleCharacter(character.id)}
              key={character.id}
            >
              <span>{character.element.slice(0, 2).toUpperCase()}</span>
              <strong>{character.name}</strong>
              <small>
                {character.path} · E{character.eidolon}
              </small>
            </button>
          ))}
        </div>
      </div>
      {plans[0] ? (
        <>
          <div className="dual-teams">
            {[0, 1].map((side) => (
              <article className="team-side panel" key={side}>
                <div className="card-topline">
                  <span className="rank">SIDE {side + 1}</span>
                  <span className="confidence">
                    <i /> Generic model · cycles not simulated
                  </span>
                </div>
                {plans[0].builds.slice(side * 4, side * 4 + 4).map((build) => {
                  const character = account.characters.find(
                    (item) => item.id === build.characterId,
                  )!;
                  return (
                    <div className="team-member" key={build.id}>
                      <span>{character.element.slice(0, 2).toUpperCase()}</span>
                      <div>
                        <strong>{character.name}</strong>
                        <small>
                          {compact.format(build.damage)} expected · {build.stats.spd.toFixed(1)} SPD
                        </small>
                      </div>
                      <b>{Math.round(build.autoConsistency)}</b>
                    </div>
                  );
                })}
              </article>
            ))}
          </div>
          <article className="panel transfer-plan">
            <div>
              <p className="eyebrow">Transfer plan</p>
              <h3>{plans[0].transfers.length} exact equipment moves</h3>
            </div>
            <button className="secondary-button" onClick={save}>
              Save plan
            </button>
            <button className="secondary-button" onClick={() => window.print()}>
              Print all transfers
            </button>
            {plans[0].transfers.map((move) => (
              <p key={`${move.relicId}-${move.to}`}>
                <ArrowRight size={14} />
                <code>{move.relicId}</code>{' '}
                {account.characters.find((item) => item.id === move.from)?.name ?? 'Inventory'} →{' '}
                {account.characters.find((item) => item.id === move.to)?.name}
              </p>
            ))}
          </article>
        </>
      ) : (
        <EmptyState
          title="No joint plan yet"
          body="Select exactly eight characters and optimize. Alternative assignments appear after the first solution."
        />
      )}
    </>
  );
}

export function RelicsView({ account, setAccount, notify }: ViewProps) {
  const [filter, setFilter] = useState('review');
  const assessments = useMemo(
    () =>
      scoreRelics(account, {
        critRate: 420,
        critDmg: 220,
        spd: 12,
        atkPct: 160,
        breakEffect: 145,
        effectRes: 60,
      }),
    [account],
  );
  const joined = assessments.map((assessment) => ({
    assessment,
    relic: account.relics.find((item) => item.id === assessment.relicId)!,
  }));
  const visible = joined.filter(
    ({ assessment, relic }) =>
      filter === 'all' ||
      filter === assessment.recommendation ||
      (filter === 'unlevelled' && relic.level < 15),
  );
  const selected = visible[0] ?? joined[0];
  const upgrade = selected
    ? adviseRelicUpgrade(
        selected.relic,
        { critRate: 420, critDmg: 220, spd: 12, atkPct: 160, breakEffect: 145 },
        58,
      )
    : undefined;
  function updateRelic(relic: Relic, patch: Partial<Relic>) {
    setAccount({
      ...account,
      relics: account.relics.map((item) => (item.id === relic.id ? { ...item, ...patch } : item)),
    });
    notify('Relic state updated.', 'success');
  }
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Relic laboratory</p>
          <h1>Know what is worth keeping.</h1>
          <p>
            Account-relative scoring combines weighted current stats with a versioned next-roll
            model. It does not simulate every character build.
          </p>
        </div>
        <div className="grade-orb">
          <span>
            {Math.round(
              assessments.reduce((sum, item) => sum + item.currentScore, 0) /
                Math.max(1, assessments.length),
            )}
          </span>
          <small>ACCOUNT MEDIAN</small>
        </div>
      </section>
      <div className="filter-bar">
        {['review', 'level', 'lock', 'salvage', 'unlevelled', 'all'].map((item) => (
          <button
            className={filter === item ? 'active' : ''}
            onClick={() => setFilter(item)}
            key={item}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="relic-layout">
        <div className="relic-table panel">
          <div className="relic-row relic-header">
            <span>Relic</span>
            <span>Now</span>
            <span>Potential</span>
            <span>Account</span>
            <span>Action</span>
          </div>
          {visible.slice(0, 18).map(({ relic, assessment }) => (
            <button
              className="relic-row"
              key={relic.id}
              onClick={() => setFilter(assessment.recommendation)}
            >
              <span>
                <b>{relic.slot}</b>
                <small>
                  {relic.set} · +{relic.level}
                </small>
              </span>
              <span className={`grade grade-${assessment.currentGrade}`}>
                {assessment.currentGrade}
              </span>
              <span>
                {assessment.potentialGrade} · {Math.round(assessment.potentialScore)}
              </span>
              <span>{Math.round(assessment.accountPercentile)}th %ile</span>
              <span className="recommendation">{assessment.recommendation}</span>
            </button>
          ))}
        </div>
        {selected && upgrade ? (
          <aside className="relic-detail panel">
            <div className="card-topline">
              <span className={`grade large grade-${selected.assessment.currentGrade}`}>
                {selected.assessment.currentGrade}
              </span>
              <span className="confidence">
                {Math.round((selected.relic.ocrConfidence ?? 1) * 100)}% OCR
              </span>
            </div>
            <p className="eyebrow">
              {selected.relic.slot} · +{selected.relic.level}
            </p>
            <h2>{selected.relic.set}</h2>
            <div className="substat-list">
              {[selected.relic.mainStat, ...selected.relic.substats].map((stat, index) => (
                <div key={`${stat.stat}-${index}`}>
                  <span>{stat.stat}</span>
                  <strong>
                    {stat.value < 1 ? `${(stat.value * 100).toFixed(1)}%` : stat.value}
                  </strong>
                </div>
              ))}
            </div>
            <div className="probability-block">
              <small>CHANCE NEXT WEIGHTED SCORE CLEARS +{upgrade.nextStop}</small>
              <strong>{Math.round(upgrade.improvementProbability * 100)}%</strong>
              <Meter value={upgrade.improvementProbability} max={1} />
              <p>{upgrade.explanation}</p>
            </div>
            <div className="button-grid">
              <button
                className="primary-button"
                onClick={() => updateRelic(selected.relic, { locked: true })}
              >
                <LockKeyhole size={15} /> Lock
              </button>
              <button
                className="secondary-button"
                onClick={() =>
                  updateRelic(selected.relic, { reservedFor: account.characters[0]?.id })
                }
              >
                Reserve
              </button>
              <button
                className="secondary-button"
                onClick={() => updateRelic(selected.relic, { discarded: true })}
              >
                Mark salvage
              </button>
            </div>
          </aside>
        ) : null}
      </div>
    </>
  );
}

export function PlannerView({ account }: ViewProps) {
  const [days, setDays] = useState(7);
  const [passes, setPasses] = useState(120);
  const [pity, setPity] = useState(20);
  const [guaranteed, setGuaranteed] = useState(false);
  const [isCone, setIsCone] = useState(false);
  const farms = useMemo(() => planFarming(account, days), [account, days]);
  const pull = useMemo(
    () =>
      simulatePullValue({
        passes,
        pity,
        guaranteed,
        targetCopies: 1,
        isLightCone: isCone,
        accountUpgradePercent: isCone ? 8 : 18,
      }),
    [passes, pity, guaranteed, isCone],
  );
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Resource observatory</p>
          <h1>Spend Power and pulls with evidence.</h1>
          <p>
            Guaranteed upgrades are separated from RNG. Pull value is account-relative and never
            recommends spending money.
          </p>
        </div>
      </section>
      <div className="planner-grid">
        <section className="panel planner-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Farming efficiency</p>
              <h2>Next {days} days</h2>
            </div>
            <label className="range-label">
              <input
                type="range"
                min="1"
                max="30"
                value={days}
                onChange={(event) => setDays(Number(event.target.value))}
              />
              <span>{days}d</span>
            </label>
          </div>
          <div className="domain-list">
            {farms.slice(0, 6).map((farm, index) => (
              <article key={farm.id}>
                <span className="queue-rank">{index + 1}</span>
                <div>
                  <strong>{farm.name}</strong>
                  <small>{farm.reason}</small>
                  <em>{farm.beneficiaries.join(' · ')}</em>
                </div>
                <div>
                  <b>{farm.powerCost}</b>
                  <small>POWER</small>
                </div>
              </article>
            ))}
          </div>
          <div className="domain-note">
            <FlaskConical size={17} />
            <p>
              Domain pairing is considered: {farmingDomains[0].sets.join(' + ')} can benefit
              multiple builds per drop.
            </p>
          </div>
        </section>
        <section className="panel planner-panel">
          <p className="eyebrow">Pull-value simulator</p>
          <div className="segmented">
            <button className={!isCone ? 'active' : ''} onClick={() => setIsCone(false)}>
              New character
            </button>
            <button className={isCone ? 'active' : ''} onClick={() => setIsCone(true)}>
              Signature Light Cone
            </button>
          </div>
          <div className="input-pair">
            <label>
              Passes
              <input
                type="number"
                min="0"
                max="1000"
                value={passes}
                onChange={(event) => setPasses(Number(event.target.value))}
              />
            </label>
            <label>
              Current pity
              <input
                type="number"
                min="0"
                max="89"
                value={pity}
                onChange={(event) => setPity(Number(event.target.value))}
              />
            </label>
          </div>
          <label className="switch-row">
            <span>
              <strong>Next 5-star guaranteed</strong>
              <small>Uses your current banner guarantee</small>
            </span>
            <input
              type="checkbox"
              checked={guaranteed}
              onChange={(event) => setGuaranteed(event.target.checked)}
            />
          </label>
          <div className="pull-probability">
            <div>
              <small>OBTAIN TARGET</small>
              <strong>{(pull.probability * 100).toFixed(1)}%</strong>
            </div>
            <div>
              <small>EXPECTED 5★</small>
              <strong>{pull.expectedFiveStars.toFixed(2)}</strong>
            </div>
            <div>
              <small>ACCOUNT-WIDE VALUE</small>
              <strong>+{pull.accountValue.toFixed(1)}%</strong>
            </div>
          </div>
          <Meter value={pull.probability} max={1} />
          <ul className="assumption-list">
            {pull.assumptions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

export function TimelineView({ account }: ViewProps) {
  const actors = useMemo(
    () =>
      account.characters.slice(0, 4).map((character, index) => ({
        id: character.id,
        name: character.name,
        speed: character.baseStats.spd + 30 - index * 2,
        maxEnergy: 120 + index * 10,
        startEnergy: index * 15,
        basicDamage: 12000 + index * 1500,
        skillDamage: 27000 + index * 3500,
        ultimateDamage: 52000 + index * 6000,
        autoPriority: index === 2 ? ('basic' as const) : ('skill' as const),
        summon:
          character.path === 'Remembrance'
            ? { name: `${character.name} memo`, speed: 110, damage: 16000 }
            : undefined,
      })),
    [account],
  );
  const [cycles, setCycles] = useState(3);
  const [paused, setPaused] = useState(false);
  const timeline = useMemo(() => simulateRotation(actors, cycles), [actors, cycles]);
  const sampleStats = {
    hp: 3200,
    atk: 2800,
    def: 1100,
    spd: 134,
    critRate: 0.72,
    critDmg: 1.65,
    breakEffect: 0.55,
  };
  const damage = calculateDamage(sampleStats, {
    characterLevel: 80,
    enemyLevel: 95,
    abilityMultiplier: 3.2,
    targetCount: 1,
    enemyResistance: 0.2,
    weaknessBroken: true,
    toughnessDamage: 60,
    superBreak: true,
    dotMultiplier: 0.2,
    followUpMultiplier: 0.35,
  });
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Rotation simulator</p>
          <h1>Inspect a generic action timeline.</h1>
          <p>
            The selected account characters use placeholder attacks and rotations. Action value,
            Speed, Energy, and Skill Points follow the documented generic model.
          </p>
        </div>
        <div className="timeline-controls">
          <button
            className="icon-button"
            aria-label={paused ? 'Show full timeline' : 'Show shortened timeline'}
            onClick={() => setPaused(!paused)}
          >
            {paused ? <Play size={17} /> : <Pause size={17} />}
          </button>
          <select
            aria-label="Timeline cycles"
            value={cycles}
            onChange={(event) => setCycles(Number(event.target.value))}
          >
            <option value="1">1 cycle</option>
            <option value="3">3 cycles</option>
            <option value="5">5 cycles</option>
          </select>
        </div>
      </section>
      <div className="timeline-summary">
        <article className="panel">
          <small>TOTAL EXPECTED</small>
          <strong>{compact.format(timeline.totalDamage)}</strong>
          <span>{timeline.events.length} actions</span>
        </article>
        <article className="panel">
          <small>ENDING SP</small>
          <strong>{timeline.endingSkillPoints}</strong>
          <span>Auto rotation</span>
        </article>
        <article className="panel">
          <small>AVERAGE HIT</small>
          <strong>{compact.format(damage.average)}</strong>
          <span>{compact.format(damage.superBreakDamage)} Super Break</span>
        </article>
      </div>
      {timeline.speedWarnings.map((warning) => (
        <div className="warning-banner compact" key={warning}>
          <AlertTriangle size={17} />
          <span>{warning}</span>
        </div>
      ))}
      <div className="timeline-table panel" role="region" aria-label="Action timeline" tabIndex={0}>
        <div className="timeline-row timeline-header">
          <span>AV</span>
          <span>Cycle</span>
          <span>Actor</span>
          <span>Action</span>
          <span>SP</span>
          <span>Energy</span>
          <span>Damage</span>
        </div>
        {timeline.events.slice(0, paused ? 8 : 24).map((event) => (
          <div className="timeline-row" key={event.index}>
            <span>{event.actionValue.toFixed(1)}</span>
            <span>C{event.cycle}</span>
            <span>
              <i style={{ background: `hsl(${(event.index * 47) % 280} 75% 64%)` }} />
              {event.actor}
            </span>
            <span>{event.action}</span>
            <span>{event.skillPoints}</span>
            <span>{Math.round(event.energy)}</span>
            <strong>{compact.format(event.damage)}</strong>
          </div>
        ))}
      </div>
      <article className="panel formula-panel">
        <p className="eyebrow">Transparent formula</p>
        <h3>Expected damage breakdown</h3>
        {damage.breakdown.map((item) => (
          <div key={item.label}>
            <span>
              {item.label}
              <small>{item.formula}</small>
            </span>
            <strong>{item.value.toFixed(3)}</strong>
          </div>
        ))}
      </article>
    </>
  );
}

export function AssistantView({ account }: ViewProps) {
  const [question, setQuestion] = useState('What should I farm today?');
  const [answer, setAnswer] = useState(() => answerAccountQuestion(question, account));
  const suggestions = [
    'Plan my first eight characters without Sunday.',
    'What is my weakest built character?',
    'Is this relic worth levelling to +9?',
    'How can I improve without pulling?',
  ];
  function ask(value = question) {
    setQuestion(value);
    setAnswer(answerAccountQuestion(value, account));
  }
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Local account assistant</p>
          <h1>Ask your inventory, not the internet.</h1>
          <p>
            Every answer invokes deterministic account calculations and cites the evidence it used.
          </p>
        </div>
        <div className="local-badge">
          <ShieldCheck size={15} /> LOCAL · NO KEY REQUIRED
        </div>
      </section>
      <div className="assistant-layout">
        <section className="assistant-chat panel">
          <div className="assistant-answer">
            <div className="assistant-avatar">
              <Bot size={22} />
            </div>
            <div>
              <span>
                RULE-BASED ANSWER · {Math.round(answer.confidence * 100)}% HEURISTIC CONFIDENCE
              </span>
              <h2>{answer.answer}</h2>
              {answer.evidence.map((line) => (
                <p key={line}>
                  <Check size={15} />
                  {line}
                </p>
              ))}
            </div>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              ask();
            }}
          >
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              aria-label="Ask about your account"
            />
            <button className="primary-button" type="submit" aria-label="Ask account assistant">
              <ArrowRight size={18} />
            </button>
          </form>
        </section>
        <aside className="panel suggestion-panel">
          <p className="eyebrow">Try a grounded query</p>
          {suggestions.map((item) => (
            <button key={item} onClick={() => ask(item)}>
              {item}
              <ChevronRight size={15} />
            </button>
          ))}
          <div className="privacy-card">
            <ShieldCheck size={18} />
            <div>
              <strong>Evidence boundary</strong>
              <span>
                The assistant can only use imported account data, labeled placeholder encounters,
                and local calculation functions.
              </span>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

export function HistoryView({ account, snapshots, setAccount, notify }: ViewProps) {
  const changes = snapshots.length ? compareSnapshots(snapshots.at(-1)!.account, account) : [];
  function rollback(snapshot: StoredSnapshot) {
    setAccount(snapshot.account);
    notify(`Rolled back to ${new Date(snapshot.timestamp).toLocaleString()}.`, 'success');
  }
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Scan history</p>
          <h1>Track every inventory change.</h1>
          <p>
            Snapshots stay on this device and can be compared or restored without touching the game.
          </p>
        </div>
        <div className="history-count">
          <History size={18} /> {snapshots.length} snapshots
        </div>
      </section>
      <div className="history-grid">
        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Latest comparison</p>
              <h2>{changes.length} changes detected</h2>
            </div>
          </div>
          {changes.length ? (
            <div className="change-list">
              {changes.slice(0, 14).map((change, index) => (
                <article key={`${change.relicId}-${index}`} className={change.type}>
                  <span>{change.type}</span>
                  <p>{change.message}</p>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No changes to compare"
              body="Import a second scanner snapshot to see new, moved, upgraded, or missing relics."
            />
          )}
        </section>
        <aside className="panel snapshot-list">
          <p className="eyebrow">Stored locally</p>
          {snapshots
            .slice()
            .reverse()
            .map((snapshot) => (
              <article key={snapshot.id}>
                <div>
                  <strong>{new Date(snapshot.timestamp).toLocaleString()}</strong>
                  <small>
                    {snapshot.account.relics.length} relics · HSR{' '}
                    {snapshot.account.metadata.gameVersion}
                  </small>
                </div>
                <button
                  className="icon-button"
                  onClick={() => rollback(snapshot)}
                  aria-label="Restore this snapshot"
                >
                  <RotateCcw size={15} />
                </button>
              </article>
            ))}
        </aside>
      </div>
    </>
  );
}

const showcaseSlots = ['Head', 'Hands', 'Body', 'Feet', 'Planar Sphere', 'Link Rope'] as const;

function showcaseSlot(type: unknown): RelicSlot {
  const index = Number(type) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= showcaseSlots.length)
    throw new Error(`Unsupported showcase relic slot: ${String(type)}. No import was applied.`);
  return showcaseSlots[index];
}

function showcaseStat(field: string, name: string, percent = false): Relic['mainStat']['stat'] {
  const aliases: Record<string, Relic['mainStat']['stat']> = {
    hp: 'hp',
    atk: 'atk',
    def: 'def',
    spd: 'spd',
    crit_rate: 'critRate',
    crit_dmg: 'critDmg',
    break_dmg: 'breakEffect',
    effect_hit: 'effectHitRate',
    effect_res: 'effectRes',
    sp_rate: 'energyRegen',
    heal_rate: 'outgoingHealing',
  };
  if (['hp', 'atk', 'def'].includes(field) && percent)
    return `${field}Pct` as 'hpPct' | 'atkPct' | 'defPct';
  const result = aliases[field] ?? (/damage|dmg/i.test(name) ? 'elementalDmg' : undefined);
  if (!result)
    throw new Error(`Unsupported showcase stat: ${field} (${name}). No import was applied.`);
  return result;
}

function accountFromShowcase(data: any): Account {
  if (!Array.isArray(data?.characters) || data.characters.length === 0) {
    throw new Error('This public showcase does not expose any characters.');
  }
  const characters = data.characters.map((character: any) => {
    const attributes = Object.fromEntries(
      (character.attributes ?? []).map((attribute: any) => [
        attribute.field,
        Number(attribute.value),
      ]),
    );
    const traceLevel = (label: string, fallback = 1) =>
      Number(
        character.skills?.find((skill: any) =>
          String(skill.type_text ?? skill.type)
            .toLowerCase()
            .includes(label),
        )?.level ?? fallback,
      );
    return {
      id: String(character.id),
      name: String(character.name),
      path: String(character.path?.name ?? character.path?.id ?? 'Unknown'),
      element: String(character.element?.name ?? character.element?.id ?? 'Unknown'),
      level: Number(character.level ?? 80),
      ascension: Number(character.promotion ?? 6),
      eidolon: Number(character.rank ?? 0),
      traces: {
        basic: traceLevel('basic'),
        skill: traceLevel('skill'),
        ultimate: traceLevel('ultimate'),
        talent: traceLevel('talent'),
        memospriteSkill: traceLevel('memosprite skill', 0),
        memospriteTalent: traceLevel('memosprite talent', 0),
        unlockedNodes: (character.skill_trees ?? [])
          .filter((node: any) => Number(node.level) > 0)
          .map((node: any) => String(node.id)),
      },
      baseStats: {
        hp:
          Number(attributes.hp) -
          Number(
            character.light_cone?.attributes?.find((attribute: any) => attribute.field === 'hp')
              ?.value ?? 0,
          ),
        atk:
          Number(attributes.atk) -
          Number(
            character.light_cone?.attributes?.find((attribute: any) => attribute.field === 'atk')
              ?.value ?? 0,
          ),
        def:
          Number(attributes.def) -
          Number(
            character.light_cone?.attributes?.find((attribute: any) => attribute.field === 'def')
              ?.value ?? 0,
          ),
        spd: Number(attributes.spd),
      },
      tags: ['Public showcase'],
    };
  });
  const lightCones = data.characters.flatMap((character: any) => {
    const cone = character.light_cone;
    if (!cone) return [];
    return [
      {
        id: `${character.id}-${cone.id}`,
        name: String(cone.name),
        path: String(cone.path?.name ?? cone.path?.id ?? 'Unknown'),
        rarity: Number(cone.rarity ?? 5),
        level: Number(cone.level ?? 80),
        ascension: Number(cone.promotion ?? 6),
        superimposition: Number(cone.rank ?? 1),
        baseStats: Object.fromEntries(
          ['hp', 'atk', 'def'].map((stat) => [
            stat,
            Number(cone.attributes?.find((attribute: any) => attribute.field === stat)?.value ?? 0),
          ]),
        ),
        locked: false,
        equippedCharacterId: String(character.id),
      },
    ];
  });
  const relics = data.characters.flatMap((character: any) =>
    (character.relics ?? []).map((relic: any, index: number) => ({
      id: `${character.id}-${relic.id}-${index}`,
      set: String(relic.set_name ?? relic.name ?? 'Unknown Set'),
      slot: showcaseSlot(relic.type),
      rarity: Number(relic.rarity ?? 5),
      level: Number(relic.level ?? 0),
      mainStat: {
        stat: showcaseStat(
          String(relic.main_affix?.field ?? ''),
          String(relic.main_affix?.name ?? ''),
          Boolean(relic.main_affix?.percent),
        ),
        value: Number(relic.main_affix?.value ?? 0),
        element: String(relic.main_affix?.name ?? '').match(
          /^(Physical|Fire|Ice|Lightning|Wind|Quantum|Imaginary)\s/i,
        )?.[1],
      },
      substats: (relic.sub_affix ?? []).slice(0, 4).map((affix: any) => ({
        stat: showcaseStat(
          String(affix.field ?? ''),
          String(affix.name ?? ''),
          Boolean(affix.percent),
        ),
        value: Number(affix.value ?? 0),
      })),
      locked: false,
      discarded: false,
      equippedCharacterId: String(character.id),
    })),
  );
  return AccountSchema.parse({
    metadata: {
      schemaVersion: 2,
      gameVersion: versionManifest.supportedGameVersion,
      exportedAt: new Date().toISOString(),
      source: 'showcase',
      uidRedacted: true,
    },
    characters,
    lightCones,
    relics,
    resources: {},
    reservations: {},
  });
}

export function DataView({ account, setAccount, setSnapshots, openImport, notify }: ViewProps) {
  const [uid, setUid] = useState('');
  const [loading, setLoading] = useState(false);
  const [manualJson, setManualJson] = useState('');
  const [editCharacterId, setEditCharacterId] = useState(account.characters[0]?.id ?? '');
  const editedCharacter = account.characters.find((character) => character.id === editCharacterId);
  const compatibility = compareGameVersions(
    account.metadata.gameVersion,
    versionManifest.supportedGameVersion,
  );
  async function showcase() {
    if (!/^\d{9}$/.test(uid)) return notify('Enter a 9-digit public UID.', 'warning');
    setLoading(true);
    try {
      const response = await fetch(`https://api.mihomo.me/sr_info_parsed/${uid}?lang=en`);
      if (!response.ok)
        throw new Error(`Public showcase request returned HTTP ${response.status}.`);
      const data = await response.json();
      const imported = accountFromShowcase(data);
      setSnapshots(saveSnapshot(account));
      setAccount(imported);
      setEditCharacterId(imported.characters[0]?.id ?? '');
      notify(
        `Imported ${imported.characters.length} public showcase characters for ${data.player?.nickname ?? 'Trailblazer'}; UID was not stored.`,
        'success',
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Showcase import failed.', 'warning');
    } finally {
      setLoading(false);
    }
  }
  function reset() {
    if (window.confirm('Delete the imported account and all edits from this browser?')) {
      clearLocalData();
      location.reload();
    }
  }
  function updateCharacter(update: Partial<Account['characters'][number]>) {
    if (!editedCharacter) return;
    setAccount({
      ...account,
      metadata: { ...account.metadata, source: 'manual', exportedAt: new Date().toISOString() },
      characters: account.characters.map((character) =>
        character.id === editedCharacter.id ? { ...character, ...update } : character,
      ),
    });
  }
  function updateTrace(trace: keyof Account['characters'][number]['traces'], value: number) {
    if (!editedCharacter || trace === 'unlockedNodes') return;
    updateCharacter({ traces: { ...editedCharacter.traces, [trace]: value } });
  }
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Account data</p>
          <h1>Your inventory stays yours.</h1>
          <p>
            Import, validate, edit and back up versioned account data without sharing credentials or
            uploading it.
          </p>
        </div>
      </section>
      {compatibility.level !== 'exact' && (
        <div className="warning-banner">
          <AlertTriangle size={18} />
          <div>
            <strong>
              {compatibility.level === 'newer' ? 'Unsupported newer data' : 'Version notice'}
            </strong>
            <span>{compatibility.message}</span>
          </div>
        </div>
      )}
      <div className="data-cards">
        <article className="panel action-card">
          <Upload size={23} />
          <h2>Import scanner JSON</h2>
          <p>
            Krzys HSR Scanner and common scanner exports are migrated into schema v2, then validated
            before use.
          </p>
          <button className="primary-button" onClick={openImport}>
            Choose JSON file
          </button>
        </article>
        <article className="panel action-card">
          <Download size={23} />
          <h2>Private-safe backup</h2>
          <p>UID, private notes and identifying fields are excluded by default.</p>
          <button className="secondary-button" onClick={() => downloadAccount(account)}>
            Export redacted JSON
          </button>
        </article>
        <article className="panel action-card">
          <RotateCcw size={23} />
          <h2>Reset local data</h2>
          <p>Deletes the working account from this browser. The game account is never changed.</p>
          <button className="danger-button" onClick={reset}>
            Reset account
          </button>
        </article>
      </div>
      <section className="panel showcase-panel">
        <div>
          <p className="eyebrow">Public showcase</p>
          <h2>Import visible profile data only</h2>
          <p>
            This requests the public Mihomo showcase endpoint. No HoYoverse login, cookie or
            password is requested.
          </p>
        </div>
        <div className="showcase-input">
          <input
            inputMode="numeric"
            maxLength={9}
            placeholder="9-digit UID"
            value={uid}
            onChange={(event) => setUid(event.target.value.replace(/\D/g, ''))}
          />
          <button className="secondary-button" onClick={showcase} disabled={loading}>
            {loading ? 'Importing…' : 'Import public showcase'}
          </button>
        </div>
      </section>
      <section className="panel manual-editor">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Manual correction</p>
            <h2>Edit character progression</h2>
          </div>
          <span className="tag">Saved locally</span>
        </div>
        {editedCharacter ? (
          <div className="manual-editor-grid">
            <label>
              Character
              <select
                value={editCharacterId}
                onChange={(event) => setEditCharacterId(event.target.value)}
              >
                {account.characters.map((character) => (
                  <option value={character.id} key={character.id}>
                    {character.nickname || character.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nickname
              <input
                value={editedCharacter.nickname ?? ''}
                maxLength={40}
                onChange={(event) => updateCharacter({ nickname: event.target.value || undefined })}
              />
            </label>
            <label>
              Level
              <input
                type="number"
                min="1"
                max="80"
                value={editedCharacter.level}
                onChange={(event) => updateCharacter({ level: Number(event.target.value) })}
              />
            </label>
            <label>
              Ascension
              <input
                type="number"
                min="0"
                max="6"
                value={editedCharacter.ascension}
                onChange={(event) => updateCharacter({ ascension: Number(event.target.value) })}
              />
            </label>
            <label>
              Eidolon
              <input
                type="number"
                min="0"
                max="6"
                value={editedCharacter.eidolon}
                onChange={(event) => updateCharacter({ eidolon: Number(event.target.value) })}
              />
            </label>
            {(['basic', 'skill', 'ultimate', 'talent'] as const).map((trace) => (
              <label key={trace}>
                {trace[0].toUpperCase() + trace.slice(1)} Trace
                <input
                  type="number"
                  min="1"
                  max={trace === 'basic' ? 7 : 15}
                  value={editedCharacter.traces[trace]}
                  onChange={(event) => updateTrace(trace, Number(event.target.value))}
                />
              </label>
            ))}
          </div>
        ) : (
          <p className="muted">Import a character before editing progression.</p>
        )}
      </section>
      <section className="account-inventory panel">
        <details>
          <summary>
            Full account editor · relics, Light Cones, resources and future characters
          </summary>
          <p>
            Load the current JSON, edit any field, then validate and apply atomically. Base
            HP/ATK/DEF must exclude the Light Cone. Percentage stats use fractions (0.12 = 12%).
            Manual future characters require explicit base stats and remain unverified. Back up
            first.
          </p>
          <button
            className="secondary-button"
            onClick={() => setManualJson(JSON.stringify(account, null, 2))}
          >
            Load current JSON
          </button>
          <textarea
            aria-label="Full account JSON"
            rows={20}
            value={manualJson}
            onChange={(event) => setManualJson(event.target.value)}
          />
          <button
            className="primary-button"
            onClick={() => {
              try {
                const next = AccountSchema.parse(JSON.parse(manualJson));
                setSnapshots(saveSnapshot(account));
                setAccount(next);
              } catch (error) {
                notify(error instanceof Error ? error.message : 'Invalid account JSON.', 'warning');
              }
            }}
          >
            Validate and apply account
          </button>
        </details>
        <div className="inventory-stat">
          <strong>{account.characters.length}</strong>
          <span>Characters</span>
        </div>
        <div className="inventory-stat">
          <strong>{account.lightCones.length}</strong>
          <span>Light Cones</span>
        </div>
        <div className="inventory-stat">
          <strong>{account.relics.length}</strong>
          <span>Relics</span>
        </div>
        <div className="inventory-stat">
          <strong>{gameData.characters.length}</strong>
          <span>Supported roster entries</span>
        </div>
        <div className="inventory-stat">
          <strong>v{account.metadata.schemaVersion}</strong>
          <span>Account schema</span>
        </div>
      </section>
    </>
  );
}

export function SettingsView() {
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Settings & about</p>
          <h1>Versioned, inspectable, private.</h1>
          <p>
            Krzys Star Rail Optimizer performs its calculations and storage locally in your browser.
          </p>
        </div>
      </section>
      {IS_STALE && (
        <div className="warning-banner">
          <AlertTriangle size={18} />
          <div>
            <strong>Verified data is now stale</strong>
            <span>
              The last verified dataset remains usable, but this build does not claim support beyond
              HSR v{versionManifest.supportedGameVersion}.
            </span>
          </div>
        </div>
      )}
      <div className="settings-grid">
        <article className="panel version-card">
          <p className="eyebrow">Version manifest</p>
          <dl>
            <div>
              <dt>Supported game</dt>
              <dd>Honkai: Star Rail v{versionManifest.supportedGameVersion}</dd>
            </div>
            <div>
              <dt>Optimizer</dt>
              <dd>v{versionManifest.optimizerVersion}</dd>
            </div>
            <div>
              <dt>Scanner</dt>
              <dd>v{versionManifest.scannerVersion}</dd>
            </div>
            <div>
              <dt>Data revision</dt>
              <dd>{versionManifest.gameDataRevision}</dd>
            </div>
            <div>
              <dt>Source commit</dt>
              <dd>
                <code>{versionManifest.dataSourceRevision.slice(0, 12)}</code>
              </dd>
            </div>
            <div>
              <dt>Scanner schemas</dt>
              <dd>
                v{versionManifest.minScannerSchema}–v{versionManifest.maxScannerSchema}
              </dd>
            </div>
          </dl>
        </article>
        <article className="panel safety-card">
          <ShieldCheck size={28} />
          <h2>Privacy and scanner safety</h2>
          <p>
            No analytics, ads, telemetry, account upload or credential collection. The scanner uses
            visible screen capture and OCR only—never process memory, network interception,
            injection, or game-file modification.
          </p>
          <a
            className="text-button"
            href={versionManifest.officialVersionSource}
            target="_blank"
            rel="noreferrer"
          >
            Official v{versionManifest.supportedGameVersion} source <ArrowRight size={15} />
          </a>
        </article>
        <article className="panel safety-card">
          <Clock3 size={28} />
          <h2>Data lifecycle</h2>
          <p>
            Data was generated {new Date(versionManifest.generatedAt).toLocaleDateString()}.
            Automated checks validate upstream schemas and keep the last known-good bundle when an
            update fails.
          </p>
          <p className="unofficial">
            Unofficial fan project. Not affiliated with or endorsed by HoYoverse.
          </p>
        </article>
      </div>
    </>
  );
}
