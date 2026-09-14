from __future__ import annotations

import hashlib
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from PIL import Image, ImageEnhance, ImageFilter, ImageOps

from .model import ScanItem


class OCREngine(Protocol):
    def recognize(self, image: Image.Image) -> tuple[str, float]: ...


class TesseractEngine:
    """Adapter for local Tesseract OCR. No image or text leaves the computer."""

    def __init__(self, executable: str | None = None, language: str = "eng") -> None:
        import pytesseract

        command = executable
        if command is None and os.name == "nt":
            conventional = Path(os.environ.get("ProgramFiles", "C:/Program Files")) / "Tesseract-OCR" / "tesseract.exe"
            if conventional.exists():
                command = str(conventional)
        if command:
            pytesseract.pytesseract.tesseract_cmd = command
            adjacent_tessdata = Path(command).resolve().parent / "tessdata"
            if (adjacent_tessdata / f"{language}.traineddata").exists():
                os.environ.setdefault("TESSDATA_PREFIX", str(adjacent_tessdata))
        pytesseract.get_tesseract_version()
        self._tesseract = pytesseract
        self.language = language

    def recognize(self, image: Image.Image) -> tuple[str, float]:
        data = self._tesseract.image_to_data(
            image,
            lang=self.language,
            config="--psm 6",
            output_type=self._tesseract.Output.DICT,
            timeout=15,
        )
        words: list[str] = []
        confidences: list[float] = []
        for text, confidence in zip(data["text"], data["conf"], strict=False):
            value = str(text).strip()
            score = float(confidence)
            if value:
                words.append(value)
                if score >= 0:
                    confidences.append(score / 100)
        return " ".join(words), sum(confidences) / len(confidences) if confidences else 0.0


@dataclass(frozen=True, slots=True)
class CaptureProfile:
    width: int
    height: int
    detail_box: tuple[float, float, float, float]
    name: str


PROFILES = (
    CaptureProfile(1920, 1080, (0.655, 0.105, 0.985, 0.905), "1080p / 100%"),
    CaptureProfile(2560, 1440, (0.655, 0.105, 0.985, 0.905), "1440p / 100%"),
    CaptureProfile(3840, 2160, (0.655, 0.105, 0.985, 0.905), "4K / 100–150%"),
    CaptureProfile(1600, 900, (0.655, 0.105, 0.985, 0.905), "900p / 100%"),
)


def select_profile(width: int, height: int) -> CaptureProfile:
    target_ratio = width / max(1, height)
    if not 1.7 <= target_ratio <= 1.82:
        raise ValueError("Only common 16:9 capture profiles are currently supported.")
    return min(PROFILES, key=lambda profile: abs(profile.width - width) + abs(profile.height - height))


def crop_detail(image: Image.Image, profile: CaptureProfile | None = None) -> Image.Image:
    selected = profile or select_profile(*image.size)
    left, top, right, bottom = selected.detail_box
    return image.crop((int(image.width * left), int(image.height * top), int(image.width * right), int(image.height * bottom)))


def preprocess(image: Image.Image, scale: float = 1.6) -> Image.Image:
    grayscale = ImageOps.grayscale(image)
    contrast = ImageEnhance.Contrast(grayscale).enhance(2.25)
    sharp = contrast.filter(ImageFilter.SHARPEN)
    resized = sharp.resize((int(sharp.width * scale), int(sharp.height * scale)))
    return resized.point(lambda pixel: 255 if pixel > 138 else 0)


STAT_ALIASES = {
    "HP": "hp",
    "HP%": "hpPct",
    "ATK": "atk",
    "ATK%": "atkPct",
    "DEF": "def",
    "DEF%": "defPct",
    "SPD": "spd",
    "CRIT Rate": "critRate",
    "CRIT DMG": "critDmg",
    "Break Effect": "breakEffect",
    "Effect Hit Rate": "effectHitRate",
    "Effect RES": "effectRes",
    "Energy Regeneration Rate": "energyRegen",
    "Outgoing Healing Boost": "outgoingHealing",
}


def parse_number(value: str) -> float:
    cleaned = value.replace(",", "").strip()
    percent = cleaned.endswith("%")
    number = float(cleaned.rstrip("%"))
    return number / 100 if percent else number


def parse_visible_text(text: str, confidence: float) -> ScanItem:
    normalized = " ".join(text.replace("\n", " ").split())
    kind = "relic"
    if re.search(r"Superimposition|Light Cone", normalized, re.I):
        kind = "light_cone"
    elif re.search(r"Eidolon|Traces|Ascension", normalized, re.I):
        kind = "character"
    name_match = re.search(r"(?:Name\s*[:|-]\s*)?([A-Za-z][A-Za-z '•&-]{3,50})(?=\s+(?:Level|Lv\.|\+\d|Rarity|Slot|Path|$))", normalized)
    name = name_match.group(1).strip() if name_match else "Review required"
    level_match = re.search(r"(?:Level|Lv\.?|\+)\s*(\d{1,2})", normalized, re.I)
    rarity_match = re.search(r"(?:Rarity\s*)?([345])\s*(?:★|star)", normalized, re.I)
    fields: dict[str, object] = {
        "level": int(level_match.group(1)) if level_match else 0,
        "rarity": int(rarity_match.group(1)) if rarity_match else 5,
        "locked": bool(re.search(r"\bLocked\b|\bLock:\s*Yes\b", normalized, re.I)) and not bool(re.search(r"\bUnlocked\b|\bLock:\s*No\b", normalized, re.I)),
        "discarded": bool(re.search(r"\bMarked for Discard\b|\bDiscard:\s*Yes\b", normalized, re.I)),
    }
    slot_match = re.search(r"(Head|Hands?|Body|Feet|Planar Sphere|Link Rope)", normalized, re.I)
    if slot_match:
        slot = slot_match.group(1).title()
        if slot == 'Hand':
            slot = 'Hands'
        fields["slot"] = slot
    positioned_stats: list[tuple[int, dict[str, object]]] = []
    for label, key in STAT_ALIASES.items():
        match = re.search(rf"{re.escape(label)}\s*\+?([0-9]+(?:\.[0-9]+)?%?)", normalized, re.I)
        if match:
            actual_key = key + 'Pct' if key in ['hp', 'atk', 'def'] and match.group(1).endswith('%') else key
            positioned_stats.append((match.start(), {"stat": actual_key, "value": parse_number(match.group(1))}))
    for element in ['Physical', 'Fire', 'Ice', 'Lightning', 'Wind', 'Quantum', 'Imaginary']:
        match = re.search(rf'{element}\s+DMG\s+Boost\s*\+?([0-9.]+%)', normalized, re.I)
        if match:
            positioned_stats.append((match.start(), {'stat': 'elementalDmg', 'value': parse_number(match.group(1)), 'element': element}))
    for label, key in [('Eidolon', 'eidolon'), ('Ascension', 'ascension'), ('Superimposition', 'superimposition')]:
        match = re.search(rf'{label}\s*[:|-]?\s*(\d)', normalized, re.I)
        if match:
            fields[key] = int(match.group(1))
    fields['reviewed'] = False
    stats = [stat for _, stat in sorted(positioned_stats, key=lambda item: item[0])]
    if stats:
        fields["mainStat"] = stats[0]
        fields["substats"] = stats[1:5]
    digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
    return ScanItem(kind=kind, name=name, fields=fields, confidence=confidence, source_hash=digest)
