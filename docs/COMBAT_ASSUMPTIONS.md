# Combat assumptions

The combat engine is a transparent planning approximation, not a complete reimplementation of the game client.

Direct damage applies ability multiplier, scaling stat, additive damage bonus, defense multiplier, resistance multiplier, vulnerability, toughness/broken modifiers, target count, and configured buff uptime. Critical output is reported as non-critical, critical, and expected average using clamped critical rate. Break and Super Break use level/break-effect/toughness inputs; DoT bypasses critical expectation unless explicitly configured by a future mechanic. Follow-up, summon, companion, and memosprite actions share the same evidence-producing action interface but can use separate multipliers and schedules.

The rotation simulator orders actors by action value derived from Speed, applies fixed initial advances/delays, and tracks Skill Points, energy, off-turn Ultimate use, per-action damage, and independent summon events. Deterministic manual templates choose Basic or Skill. Temporary Speed changes, buff/debuff expiry, break-state transitions, targeting, and wave transitions are not implemented.

Enemy level, resistance, weakness-broken state, target count, and generic buffs are explicit calculation inputs. The encounter cards are placeholder configurations, not verified current encounter definitions. No clear or cycle estimate is produced.

Auto-battle consistency is an approximation based on Skill Point margin, targeting sensitivity, survivability, rotation variance, and conditional uptime. RNG resistance and ease-of-use are planning scores, not recorded gameplay telemetry.

Formula tests use independently hand-calculated fixtures and floating-point tolerances. Adding a character-specific mechanic requires a cited data source, an explicit assumption entry, and a regression case.
