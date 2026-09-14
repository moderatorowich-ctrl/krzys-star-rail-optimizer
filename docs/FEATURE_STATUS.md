# Feature status

This file is the release truth source for version 1.0.0. A polished screen is not evidence that its model matches Honkai: Star Rail or another optimizer.

## Verified in version 1.0.0

- Local versioned account import/export with strict schema checks, privacy-safe export, snapshots, rollback, and full JSON correction.
- Public showcase import for data exposed by Mihomo, with the UID omitted from saved account data.
- Deterministic six-slot relic search, exhaustive and capped modes, min/max stats, Speed constraint, main-stat filters, set filters, required substats, pins, exclusions, locks, reservations, progress, cancellation, alternatives, and a three-metric Pareto frontier.
- Light Cone base-stat contribution when supplied or when a level-80 catalog match is available.
- Joint conflict-free relic assignment for exactly two fixed teams of four selected characters. Character lineup discovery, sustain/archetype constraints, and encounter scoring are not implemented.
- Generic direct-damage, Break, Super Break, DoT, follow-up, and summon calculations with explicit inputs and formula output.
- Generic action-value timeline with Skill Points, energy, off-turn Ultimates, fixed advances/delays, manual basic/skill templates, and independent summons.
- Account-relative relic ranking and a versioned next-roll enumerator. The displayed probability is the chance that the next weighted substat score clears a threshold, not the chance that the relic improves a complete character build.
- Local deterministic assistant intents for farming, weakest equipment coverage, and fixed two-team allocation.
- Scan comparison for new, removed, moved, changed, low-confidence, and suspiciously decreased relic records.
- Windows scanner safety gates: visible foreground HSR window capture, optional navigation off, foreground re-check before input, global F8 stop, mandatory review of every item, atomic session save, and strict export validation.

## Experimental or manual-input models

- Damage ranking uses a generic scaling hit. Character kits, Trace multipliers, Eidolons, Light Cone passives, teammate kits, per-action conditionals, and buff timing must be entered as generic manual stats/multipliers where supported.
- Static unconditional set bonuses are covered for a subset of sets. Conditional four-piece and ornament effects are not assumed unless explicitly modelled.
- Auto consistency, survivability, rotation stability, farming priority, resource cost, and pull account-value scores are labelled heuristics.
- Pull probability uses an explicit community soft-pity approximation. It does not identify or recommend current banners and never recommends spending money.
- Encounter cards are placeholders for user-entered enemy configuration. They are not current encounter definitions or clear predictions.
- Scanner OCR tests use anonymous synthetic images at several scales. No copyrighted game screenshot fixture is included, and accuracy on every game layout is not claimed.

## Not implemented in version 1.0.0

- Full Fribbels character/Light Cone/conditional formula coverage or numerical parity.
- GPU optimizer, character lineup discovery, content-specific endgame simulation, verified cycle estimates, or auto-battle emulation.
- Exact relic-upgrade improvement probability against every build, material inventory/drop tables, synthesis modelling, or a verified daily farming route.
- Native structured forms for every relic, Light Cone, character, placeholder, resource, and advanced conditional field; the strict full-account JSON editor is the complete fallback.
- Scanner recognition for every character, Trace, Light Cone, relic set, localization, resolution, and UI revision.

Accordingly, version 1.0.0 must not be described as feature-parity with, universally superior to, or a drop-in numerical replacement for Fribbels. Its stronger areas are privacy controls, strict fail-closed imports, scan-history safety, explicit assumptions, and account-wide planning surfaces.
