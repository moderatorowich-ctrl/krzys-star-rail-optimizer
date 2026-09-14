from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any
import math

from . import EXPORT_SCHEMA_VERSION, SCANNER_VERSION, SUPPORTED_GAME_VERSION


@dataclass(slots=True)
class OCRValue:
    value: str
    confidence: float


@dataclass(slots=True)
class ScanItem:
    kind: str
    name: str
    fields: dict[str, Any]
    confidence: float
    captured_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    source_hash: str = ""


@dataclass(slots=True)
class ScanSession:
    items: list[ScanItem] = field(default_factory=list)
    paused: bool = False
    cancelled: bool = False
    expected_items: int = 0
    current_index: int = 0

    def add(self, item: ScanItem) -> bool:
        duplicate = any(
            existing.source_hash == item.source_hash and existing.kind == item.kind
            for existing in self.items
        )
        if duplicate:
            item.fields['possibleDuplicate'] = True
        self.items.append(item)
        return not duplicate

    @property
    def progress(self) -> float:
        if not self.expected_items:
            return 0.0
        return min(1.0, self.current_index / self.expected_items)


def export_payload(session: ScanSession, include_uid: bool = False, uid: str = "") -> dict[str, Any]:
    characters = []
    light_cones = []
    relics = []
    for index, item in enumerate(session.items):
        fields = item.fields
        if item.kind == "relic":
            relics.append(
                {
                    "id": fields.get("id", f"{item.source_hash[:16]}-{index}"),
                    "set": fields.get("set"),
                    "slot": fields.get("slot"),
                    "rarity": fields.get("rarity"),
                    "level": fields.get("level"),
                    "mainStat": fields.get("mainStat"),
                    "substats": fields.get("substats", []),
                    "locked": bool(fields.get("locked", False)),
                    "discarded": bool(fields.get("discarded", False)),
                    "equippedCharacterId": fields.get("equippedCharacterId"),
                    "ocrConfidence": round(item.confidence, 4),
                }
            )
        elif item.kind == "character":
            characters.append(
                {
                    "id": str(fields.get("id", f"scan-character-{index}")),
                    "name": item.name,
                    "path": fields.get("path"),
                    "element": fields.get("element"),
                    "level": fields.get("level"),
                    "ascension": fields.get("ascension"),
                    "eidolon": fields.get("eidolon"),
                    "traces": fields.get(
                        "traces",
                        None,
                    ),
                    "baseStats": fields.get(
                        "baseStats", None
                    ),
                    "tags": [],
                }
            )
        elif item.kind == "light_cone":
            light_cones.append(
                {
                    "id": str(fields.get("id", f"scan-cone-{index}")),
                    "name": item.name,
                    "path": fields.get("path"),
                    "rarity": fields.get("rarity"),
                    "level": fields.get("level"),
                    "ascension": fields.get("ascension"),
                    "superimposition": fields.get("superimposition"),
                    **({'baseStats': fields['baseStats']} if fields.get('baseStats') else {}),
                    "locked": bool(fields.get("locked", False)),
                    "equippedCharacterId": fields.get("equippedCharacterId"),
                }
            )
    metadata: dict[str, Any] = {
        "schemaVersion": EXPORT_SCHEMA_VERSION,
        "gameVersion": SUPPORTED_GAME_VERSION,
        "exportedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source": "scanner",
        "scannerVersion": SCANNER_VERSION,
        "uidRedacted": not include_uid,
    }
    if include_uid and uid:
        metadata["uid"] = uid
    return {
        "metadata": metadata,
        "characters": characters,
        "lightCones": light_cones,
        "relics": relics,
        "resources": {},
        "reservations": {},
    }


def validate_export(payload: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    metadata = payload.get("metadata", {})
    if metadata.get("schemaVersion") != EXPORT_SCHEMA_VERSION:
        errors.append(f"schemaVersion must be {EXPORT_SCHEMA_VERSION}")
    if metadata.get("gameVersion") != SUPPORTED_GAME_VERSION:
        errors.append(f"gameVersion must be {SUPPORTED_GAME_VERSION}")
    if metadata.get("scannerVersion") != SCANNER_VERSION:
        errors.append(f"scannerVersion must be {SCANNER_VERSION}")
    if metadata.get("uid") is not None and (not str(metadata["uid"]).isdigit() or len(str(metadata["uid"])) != 9):
        errors.append("UID must contain exactly 9 digits")
    for collection in ("characters", "lightCones", "relics"):
        if not isinstance(payload.get(collection), list):
            errors.append(f"{collection} must be an array")
    def numeric(value: Any, low: float, high: float, integer: bool = False) -> bool:
        return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and low <= value <= high and (not integer or int(value) == value)
    stat_keys = {'hp', 'atk', 'def', 'spd', 'hpPct', 'atkPct', 'defPct', 'spdPct', 'critRate', 'critDmg', 'breakEffect', 'effectHitRate', 'effectRes', 'energyRegen', 'outgoingHealing', 'elementalDmg'}
    main_stats = {
        'Head': {'hp'},
        'Hands': {'atk'},
        'Body': {'hpPct', 'atkPct', 'defPct', 'critRate', 'critDmg', 'outgoingHealing', 'effectHitRate'},
        'Feet': {'hpPct', 'atkPct', 'defPct', 'spd'},
        'Planar Sphere': {'hpPct', 'atkPct', 'defPct', 'elementalDmg'},
        'Link Rope': {'hpPct', 'atkPct', 'defPct', 'breakEffect', 'energyRegen'},
    }
    substat_keys = {'hp', 'atk', 'def', 'spd', 'hpPct', 'atkPct', 'defPct', 'critRate', 'critDmg', 'breakEffect', 'effectHitRate', 'effectRes'}
    for collection in ("characters", "lightCones"):
        ids: set[str] = set()
        for item in payload.get(collection, []):
            if not item.get('id') or item['id'] in ids:
                errors.append(f"Invalid or duplicate {collection} ID.")
            ids.add(item.get('id', ''))
            for field_name, low, high in [('level', 1, 80), ('ascension', 0, 6), ('eidolon', 0, 6)] if collection == 'characters' else [('level', 1, 80), ('ascension', 0, 6), ('superimposition', 1, 5), ('rarity', 3, 5)]:
                if not numeric(item.get(field_name), low, high, True):
                    errors.append(f"Correct {field_name} for {item.get('name')}.")
            if not item.get('path') or not item.get('name'):
                errors.append('Name and path are required.')
            if collection == 'characters':
                if not item.get('element') or not isinstance(item.get('baseStats'), dict) or not all(numeric(item['baseStats'].get(stat), 0.01, 100000) for stat in ['hp', 'atk', 'def', 'spd']):
                    errors.append(f"Correct element and base stats for {item.get('name')}; unknown values cannot be guessed.")
                traces = item.get('traces') or {}
                for name, limit in [('basic', 7), ('skill', 15), ('ultimate', 15), ('talent', 15)]:
                    if not numeric(traces.get(name), 1, limit, True):
                        errors.append(f"Correct {name} Trace for {item.get('name')}.")
    character_ids = {str(character.get('id')) for character in payload.get('characters', [])}
    equipped_slots: set[tuple[str, str]] = set()
    for collection in ('lightCones', 'relics'):
        for item in payload.get(collection, []):
            character_id = item.get('equippedCharacterId')
            if not character_id:
                continue
            if str(character_id) not in character_ids:
                errors.append(f"Equipped character does not exist for {item.get('id')}.")
            key = (str(character_id), str(item.get('slot', 'cone')))
            if key in equipped_slots:
                errors.append(f"Multiple items occupy {key[1]} for character {character_id}.")
            equipped_slots.add(key)
    seen: set[str] = set()
    for relic in payload.get("relics", []):
        relic_id = str(relic.get("id", ""))
        if not relic_id:
            errors.append("every relic must have an id")
        elif relic_id in seen:
            errors.append(f"duplicate relic id: {relic_id}")
        seen.add(relic_id)
        if relic.get('slot') not in ['Head', 'Hands', 'Body', 'Feet', 'Planar Sphere', 'Link Rope'] or not relic.get('set'):
            errors.append(f"Correct set and slot for relic {relic_id}.")
        if not numeric(relic.get('rarity'), 2, 5, True) or not numeric(relic.get('level'), 0, 3 * relic.get('rarity', 0), True):
            errors.append(f"Invalid level or rarity for relic {relic_id}.")
        stats = [relic.get('mainStat')] + relic.get('substats', [])
        if len(stats) > 5 or any(not isinstance(stat, dict) or stat.get('stat') not in stat_keys or not numeric(stat.get('value'), 0, 100000) for stat in stats):
            errors.append(f"Correct main/substats for relic {relic_id}.")
        elif len({stat['stat'] for stat in stats}) != len(stats):
            errors.append(f"Main/substats must be distinct for relic {relic_id}.")
        elif relic['mainStat']['stat'] not in main_stats.get(relic.get('slot'), set()):
            errors.append(f"Invalid main stat for relic {relic_id}.")
        elif any(stat['stat'] not in substat_keys for stat in relic.get('substats', [])):
            errors.append(f"Invalid substat for relic {relic_id}.")
        confidence = relic.get("ocrConfidence", 1)
        if not isinstance(confidence, (int, float)) or not 0 <= confidence <= 1:
            errors.append(f"invalid OCR confidence for relic {relic_id}")
    return errors


def serialize_session(session: ScanSession) -> dict[str, Any]:
    return asdict(session)


def deserialize_session(raw: dict[str, Any]) -> ScanSession:
    items = [ScanItem(**item) for item in raw.get("items", [])]
    return ScanSession(
        items=items,
        paused=bool(raw.get("paused", False)),
        cancelled=bool(raw.get("cancelled", False)),
        expected_items=int(raw.get("expected_items", 0)),
        current_index=int(raw.get("current_index", 0)),
    )
