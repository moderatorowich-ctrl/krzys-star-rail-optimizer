from __future__ import annotations

import json
import re
import sys
from functools import lru_cache
from pathlib import Path
from typing import Any


def _data_path(filename: str) -> Path:
    bundled_root = getattr(sys, "_MEIPASS", None)
    if bundled_root:
        return Path(bundled_root) / "krzys_hsr_scanner" / "data" / filename
    repository_root = Path(__file__).resolve().parents[3]
    return repository_root / "packages" / "game-data" / "src" / filename


@lru_cache(maxsize=1)
def game_catalog() -> dict[str, Any]:
    return json.loads(_data_path("game-data.generated.json").read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def relic_roll_tiers() -> dict[str, dict[str, list[float]]]:
    data = json.loads(_data_path("relic-rolls.generated.json").read_text(encoding="utf-8"))
    return data["tiers"]


def normalized_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.casefold()).strip()


def match_catalog_entry(text: str, collection: str) -> dict[str, Any] | None:
    normalized_text = f" {normalized_name(text)} "
    matches = [
        item
        for item in game_catalog().get(collection, [])
        if not item.get("unreleased")
        and f" {normalized_name(str(item.get('name', '')))} " in normalized_text
    ]
    return max(matches, key=lambda item: len(normalized_name(str(item["name"])))) if matches else None
