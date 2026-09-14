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
    def test_warp_pages_merge_without_losing_previous_resources(self) -> None:
        session = ScanSession()
        session.upsert(ScanItem(kind="warp", name="Warp", confidence=1, fields={"resources": {"stellarJade": 123, "characterEventGuaranteed": 1}}))
        session.upsert(ScanItem(kind="warp", name="Warp", confidence=1, fields={"resources": {"specialPasses": 5, "characterEventGuaranteed": 0}}))
        self.assertEqual(session.items[0].fields["resources"], {"stellarJade": 123, "specialPasses": 5, "characterEventGuaranteed": 0})

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
        self.assertEqual(payload["metadata"]["scannerVersion"], "1.1.1")
        self.assertTrue(payload["metadata"]["uidRedacted"])
        self.assertEqual(validate_export(payload), [])

    def test_duplicate_detection(self) -> None:
        session = ScanSession()
        item = ScanItem(kind="relic", name="Fixture", fields={}, confidence=0.8, source_hash="same")
        self.assertTrue(session.add(item))
        self.assertFalse(session.add(item))
        self.assertEqual(len(session.items), 2)
        self.assertTrue(session.items[-1].fields['possibleDuplicate'])

    def test_enhanced_relic_reuses_stable_id(self) -> None:
        session = ScanSession()
        base = ScanItem(
            kind="relic",
            name="Fixture Set",
            confidence=0.9,
            source_hash="base",
            fields={
                "set": "Fixture Set",
                "slot": "Head",
                "rarity": 5,
                "level": 12,
                "mainStat": {"stat": "hp", "value": 620},
                "substats": [{"stat": "spd", "value": 5.2}],
            },
        )
        self.assertEqual(session.upsert(base), "new")
        stable_id = session.items[0].fields["id"]
        enhanced = ScanItem(
            kind="relic",
            name="Fixture Set",
            confidence=0.95,
            source_hash="enhanced",
            fields={**base.fields, "id": None, "level": 15, "mainStat": {"stat": "hp", "value": 705}},
        )
        self.assertEqual(session.upsert(enhanced), "enhanced")
        self.assertEqual(len(session.items), 1)
        self.assertEqual(session.items[0].fields["id"], stable_id)

    def test_unequipped_duplicate_light_cones_are_not_collapsed(self) -> None:
        session = ScanSession()
        first = ScanItem(
            kind="light_cone",
            name="Fixture Cone",
            confidence=0.9,
            source_hash="cone-a",
            fields={"level": 80},
        )
        second = ScanItem(
            kind="light_cone",
            name="Fixture Cone",
            confidence=0.9,
            source_hash="cone-b",
            fields={"level": 80},
        )
        self.assertEqual(session.upsert(first), "new")
        self.assertEqual(session.upsert(second), "new")
        self.assertEqual(len(session.items), 2)
        self.assertNotEqual(session.items[0].fields["id"], session.items[1].fields["id"])

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
