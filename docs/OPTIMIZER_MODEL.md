# Optimizer model

## Search

Each relic is normalized into one slot and an aggregate stat vector. Before combination search, the engine indexes by slot and removes excluded/discarded candidates, applies pinned, locked, equipped, reserved, and main-stat constraints, then sorts each slot by a deterministic upper-bound score. Exact mode enumerates the constrained Cartesian product; heuristic mode caps per-slot candidates and labels the result approximate. Both modes use stable ID tie-breaks, so identical input yields identical ranking.

Cancellation is checked inside enumeration, and progress reports combinations evaluated, total estimate, percentage, and elapsed time. The Web Worker isolates search from rendering. Large inventories should narrow main stats, set constraints, or switch to heuristic mode.

## Score and constraints

Candidate totals combine character base stats, available Light Cone base stats, relic main/substats, a verified subset of unconditional set bonuses, manually entered generic buffs/uptime, enemy properties, and target count. Builds failing min/max or Speed constraints are rejected. Character kits, Trace/Eidolon effects, Light Cone passives, teammate kits, and most conditional set effects are not automatically modelled.

The result contains generic metrics, an equipped stat baseline, assumptions, and a transfer checklist. Damage deltas are meaningful only with identical explicit manual inputs. The Pareto frontier retains builds not dominated simultaneously on generic damage, Speed, and survivability.

## Multi-team allocation

The account-wide planner jointly assigns relics to exactly eight selected characters, rejecting duplicate characters and shared relic IDs. It does not discover lineups, enforce sustain/archetype roles, simulate encounters, or estimate cycles. Alternatives list exact transfers.

## Relic and account recommendations

Relic ranking uses configurable generic weights and an account-relative percentile. Upgrade advice enumerates the next substat-roll values to estimate best/expected/worst weighted substat outcomes. Its probability is not the chance of improving a full build, assumes equally likely roll tiers, and uses experimental uniform unlock odds when fewer than four substats exist.

The Command Center lists generic-model free-transfer candidates and level/Trace/relic coverage priorities. Farming benefit and Power cost are explicitly low-confidence planning heuristics; material inventory and drop tables are not modelled.

## Performance expectations

The anonymous fixture has 72 relics and completes typical heuristic searches in well under the browser test timeout. Exact runtime grows multiplicatively with candidates per slot; it is never described as instant. Regression tests cover determinism, constraints, cancellation, Pareto selection, joint no-sharing allocation, and score directionality.
