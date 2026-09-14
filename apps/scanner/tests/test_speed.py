import unittest

from krzys_hsr_scanner.ocr import parse_visible_text


class SpeedPrecisionTests(unittest.TestCase):
    def test_infers_exact_hidden_speed_decimal_from_roll_constraints(self) -> None:
        item = parse_visible_text(
            "Scholar Lost in Erudition +15 Head 5 star HP 705 "
            "CRIT DMG 11.6% SPD 5 CRIT Rate 5.8% ATK% 7.7%",
            0.98,
            "relic",
        )
        speed = next(stat for stat in item.fields["substats"] if stat["stat"] == "spd")
        self.assertAlmostEqual(speed["value"], 5.2)
        self.assertEqual(item.fields["speedPrecision"]["confidence"], "exact")
        self.assertEqual(item.fields["speedPrecision"]["source"], "roll-inference")

    def test_preserves_visible_decimal_speed(self) -> None:
        item = parse_visible_text(
            "Scholar Lost in Erudition +15 Head 5 star HP 705 "
            "CRIT DMG 11.6% SPD 5.2 CRIT Rate 5.8% ATK% 7.7%",
            0.98,
            "relic",
        )
        self.assertEqual(item.fields["speedPrecision"]["confidence"], "exact")
        self.assertEqual(item.fields["speedPrecision"]["candidates"], [5.2])


if __name__ == "__main__":
    unittest.main()
