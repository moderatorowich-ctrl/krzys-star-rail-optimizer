from __future__ import annotations

import itertools
import math
from typing import Any

from .game_data import relic_roll_tiers


PERCENT_STATS = {
    "hpPct",
    "atkPct",
    "defPct",
    "critRate",
    "critDmg",
    "breakEffect",
    "effectHitRate",
    "effectRes",
}


def _display_matches(stat: str, actual: float, displayed: float) -> bool:
    if stat in PERCENT_STATS:
        return math.floor(actual * 1000 + 1e-7) == math.floor(displayed * 1000 + 1e-7)
    return math.floor(actual + 1e-7) == math.floor(displayed + 1e-7)


def _roll_candidates(
    rarity: int,
    stat: str,
    displayed: float,
    max_rolls: int,
) -> list[tuple[int, float]]:
    tiers = relic_roll_tiers().get(str(rarity), {}).get(stat)
    if not tiers:
        return []
    candidates: set[tuple[int, float]] = set()
    for count in range(1, max_rolls + 1):
        for rolls in itertools.combinations_with_replacement(tiers, count):
            total = round(sum(rolls), 7)
            if _display_matches(stat, total, displayed):
                candidates.add((count, total))
    return sorted(candidates)


def infer_speed_precision(fields: dict[str, Any], visible_decimal: bool = False) -> None:
    substats = fields.get("substats")
    rarity = fields.get("rarity")
    level = fields.get("level")
    if not isinstance(substats, list) or not isinstance(rarity, int) or not isinstance(level, int):
        return
    speed = next((stat for stat in substats if stat.get("stat") == "spd"), None)
    if not speed or not isinstance(speed.get("value"), (int, float)):
        return
    displayed = float(speed["value"])
    if visible_decimal:
        fields["speedPrecision"] = {
            "source": "visible-decimal",
            "confidence": "exact",
            "displayed": displayed,
            "candidates": [displayed],
            "minimum": displayed,
            "maximum": displayed,
        }
        return

    upgrades = max(0, level // 3)
    maximum_rolls = max(1, 1 + upgrades)
    candidates_by_stat: list[tuple[str, list[tuple[int, float]]]] = []
    for stat in substats:
        key = stat.get("stat")
        value = stat.get("value")
        if not isinstance(key, str) or not isinstance(value, (int, float)):
            return
        candidates = _roll_candidates(rarity, key, float(value), maximum_rolls)
        if not candidates:
            return
        candidates_by_stat.append((key, candidates))

    substat_count = len(substats)
    allowed_totals = {substat_count + upgrades}
    if substat_count == 4 and upgrades >= 1:
        allowed_totals.add(3 + upgrades)

    other_count_sums = {0}
    for key, candidates in candidates_by_stat:
        if key == "spd":
            continue
        other_count_sums = {
            existing + count for existing in other_count_sums for count, _total in candidates
        }

    speed_candidates = next(candidates for key, candidates in candidates_by_stat if key == "spd")
    feasible = sorted(
        {
            total
            for count, total in speed_candidates
            if any(count + other in allowed_totals for other in other_count_sums)
        }
    )
    if not feasible:
        return
    feasible = feasible[:32]
    exact = len(feasible) == 1
    if exact:
        speed["value"] = feasible[0]
    fields["speedPrecision"] = {
        "source": "roll-inference",
        "confidence": "exact" if exact else "ambiguous",
        "displayed": displayed,
        "candidates": feasible,
        "minimum": min(feasible),
        "maximum": max(feasible),
    }
