import unittest

from krzys_hsr_scanner.model import (
    ScanItem,
    ScanSession,
    deserialize_session,
    export_payload,
    serialize_session,
    validate_export,
)


class ExportTests(unittest.TestCase):
    def test_round_trip_shape_and_versions(self) -> None:
        session = ScanSession()
        session.add(
            ScanItem(
                kind="relic",
                name="Scholar Lost in Erudition",
                confidence=0.94,
                source_hash="fixture-a",
                fields={
                    "id": "fixture-relic-1",
                    "set": "Scholar Lost in Erudition",
                    "slot": "Body",
                    "rarity": 5,
                    "level": 15,
                    "mainStat": {"stat": "critRate", "value": 0.324},
                    "substats": [{"stat": "critDmg", "value": 0.116}],
                },
            )
        )
        payload = export_payload(session)
        self.assertEqual(payload["metadata"]["gameVersion"], "4.5")
        self.assertEqual(payload["metadata"]["scannerVersion"], "1.0.0")
        self.assertTrue(payload["metadata"]["uidRedacted"])
        self.assertEqual(validate_export(payload), [])

    def test_duplicate_detection(self) -> None:
        session = ScanSession()
        item = ScanItem(kind="relic", name="Fixture", fields={}, confidence=0.8, source_hash="same")
        self.assertTrue(session.add(item))
        self.assertFalse(session.add(item))
        self.assertEqual(len(session.items), 2)
        self.assertTrue(session.items[-1].fields['possibleDuplicate'])

    def test_session_round_trip_preserves_resume_progress(self) -> None:
        session = ScanSession(
            items=[ScanItem(kind="relic", name="Fixture", fields={}, confidence=0.8)],
            paused=True,
            cancelled=True,
            expected_items=12,
            current_index=5,
        )
        restored = deserialize_session(serialize_session(session))
        self.assertEqual(restored.expected_items, 12)
        self.assertEqual(restored.current_index, 5)
        self.assertTrue(restored.paused)
        self.assertTrue(restored.cancelled)

    def test_export_rejects_impossible_relic_stats(self) -> None:
        session = ScanSession()
        session.add(
            ScanItem(
                kind="relic",
                name="Fixture",
                confidence=0.9,
                source_hash="fixture",
                fields={
                    "set": "Fixture",
                    "slot": "Head",
                    "rarity": 5,
                    "level": 0,
                    "mainStat": {"stat": "critRate", "value": 0.324},
                    "substats": [{"stat": "energyRegen", "value": 0.05}],
                },
            )
        )
        errors = validate_export(export_payload(session))
        self.assertTrue(any("Invalid main stat" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
