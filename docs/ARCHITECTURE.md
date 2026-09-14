# Architecture

Krzys Star Rail Optimizer is a local-first monorepo with no required application backend.

## Runtime boundaries

`apps/web` is the React/Vite static application. `accountStore.ts` owns schema-validated browser persistence, snapshot history, undo/redo, import migration, export redaction, and reset. Hash navigation avoids server rewrites beneath the GitHub Pages project path. A service worker caches only the version-compatible static build.

`packages/optimizer-engine` is a pure deterministic calculation library. It indexes relics by slot, applies state and stat filters before enumeration, scores builds with explicit weights, emits progress, supports cancellation, ranks near-optimal alternatives, computes a Pareto frontier, and jointly allocates multiple teams without shared relics.

`packages/combat-engine` contains stat and damage functions plus a deterministic action timeline. Every result returns formula inputs or event evidence so the UI can explain it.

`packages/game-data` contains the version manifest, normalized generated data, encounter definitions, farming domains, and the demonstration account. `packages/shared` owns the versioned account schema and compatibility migrations.

`apps/scanner` is a separate Python/GPL package. Capture, OCR, validation/model code, session persistence, and UI are deliberately separated. It shares the JSON contract, not runtime code, with the website.

## Data flow

1. An account comes from the anonymous demo, manual local changes, a public showcase, or an imported scanner file.
2. Zod validates and migrates input before state replacement. A newer unsupported game version produces a compatibility warning.
3. The store records a timestamped snapshot and generates a scan diff.
4. Views call pure engine functions. Expensive single-character searches cross the Web Worker boundary; progress and cancellation messages return independently of rendering.
5. Only version-compatible derived state is reused. Exports are explicit downloads and redact identifying fields by default.

## Security and privacy boundaries

There are no project-controlled servers, secrets, analytics SDKs, ad trackers, eval calls, or background uploads. Browser storage is origin-local. The public UID action is an explicit browser-to-public-profile request. The service worker caches application assets, not imported account JSON. Scanner debug screenshots are opt-in and locally deletable.
