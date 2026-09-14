# Fribbels capability comparison

This is an evidence-based release checklist, not a marketing claim. It compares Krzys Star Rail Optimizer v1.1.0 with the public Fribbels website and its English guides as reviewed on 2026-09-14. Fribbels can change independently.

| Capability                                       | Krzys v1.1.0 status            | Notes                                                                                                                                                                 |
| ------------------------------------------------ | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account import/save and public showcase          | Available                      | Strict versioned JSON migration, browser-local persistence, snapshots, rollback, redacted export, full JSON correction, and opt-in Mihomo public-showcase import.     |
| Scanner full-account categories                  | Available with review          | Characters, Light Cones, relics, and Warp resources; visible-screen OCR only. Every item is review-gated.                                                             |
| Local live import                                | Available                      | Rotating pairing code, loopback-only transport, reviewed snapshot gate, equipped-gear and Warp-resource options, stable upserts, reconnect, undo, and no cloud relay. |
| Precise relic Speed                              | Available with evidence labels | Visible decimals are exact. Hidden decimals use legal roll-tier inference and remain marked ambiguous when more than one value fits.                                  |
| Relic organizer and scoring                      | Available                      | Filtering, account-relative score/potential, next-roll analysis, lock/discard/review/reserve actions, and unused-quality alerts.                                      |
| Single-character relic optimizer                 | Available, generic model       | Deterministic six-slot search, exact/capped modes, constraints, pins/exclusions, alternatives, progress/cancel, Pareto metrics, and worker execution.                 |
| Multi-team conflict-free equipment               | Available                      | Joint assignment for two fixed teams and explicit transfer instructions; no shared relics.                                                                            |
| Calculators and rotations                        | Available, generic model       | Direct/critical/Break/Super Break/DoT/follow-up/summon calculations, pull probability, action-value timeline, SP, energy, Ultimates, and summons.                     |
| Farming and Warp planning                        | Available, heuristic           | Account-resource-aware probability and priority models with stated assumptions.                                                                                       |
| Local account assistant and scan history         | Available                      | Deterministic intents, scan comparison, suspicious-change reporting, snapshots, and rollback.                                                                         |
| Character-specific kit formulas and conditionals | Partial                        | Manual generic inputs are supported; the complete per-character/per-Light-Cone formula and conditional library is not implemented.                                    |
| Benchmarks and verified cycle estimates          | Partial                        | Generic damage/coverage indicators are shown; current encounter-specific verified benchmark and cycle parity is not implemented.                                      |
| Advanced per-action rotations                    | Partial                        | The timeline supports manual actor rotations and combat events but not Fribbels' full character-script catalog.                                                       |
| GPU-scale optimizer                              | Not implemented                | Search uses deterministic CPU/Web Worker execution; there is no GPU billion-combination mode.                                                                         |
| Community leaderboards and shared build service  | Not implemented                | The project has no account backend by design. Shareable local optimizer links and privacy-safe file export are available instead.                                     |

The current release should be judged on the rows marked available, not on the unfinished parity rows. Security and privacy differences are intentional: the scanner does not inspect process memory or network traffic, and the live bridge does not expose a LAN or cloud endpoint.

## Audited references

- [Fribbels HSR Optimizer](https://fribbels.github.io/hsr-optimizer/)
- [Optimizer guide](https://github.com/fribbels/hsr-optimizer/blob/main/docs/guides/en/optimizer.md)
- [Relics guide](https://github.com/fribbels/hsr-optimizer/blob/main/docs/guides/en/relics-tab.md)
- [Benchmarks guide](https://github.com/fribbels/hsr-optimizer/blob/main/docs/guides/en/benchmarks.md)
- [Score customization guide](https://github.com/fribbels/hsr-optimizer/blob/main/docs/guides/en/score-customization.md)
- [Reliquary Archiver scanner documentation](https://github.com/IceDynamix/reliquary-archiver/blob/main/README.md)
