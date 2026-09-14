import unittest

from PIL import Image, ImageDraw

from krzys_hsr_scanner.ocr import crop_detail, parse_visible_text, preprocess, select_profile


class OCRFixtureTests(unittest.TestCase):
    def test_synthetic_1080p_fixture_preprocessing(self) -> None:
        image = Image.new("RGB", (1920, 1080), "#111827")
        draw = ImageDraw.Draw(image)
        draw.rectangle((1260, 110, 1890, 970), fill="#e8edf5")
        draw.text((1320, 170), "Scholar Lost in Erudition Level 15 Body 5 star CRIT Rate 32.4%", fill="#111827")
        profile = select_profile(*image.size)
        cropped = crop_detail(image, profile)
        prepared = preprocess(cropped)
        self.assertGreater(prepared.width, cropped.width)
        self.assertEqual(prepared.mode, "L")

    def test_parser_extracts_fixture_fields(self) -> None:
        text = "Scholar Lost in Erudition Level 15 Body 5 star CRIT Rate 32.4% CRIT DMG 11.6% SPD 5 Locked"
        item = parse_visible_text(text, 0.92)
        self.assertEqual(item.kind, "relic")
        self.assertEqual(item.fields["level"], 15)
        self.assertEqual(item.fields["slot"], "Body")
        self.assertTrue(item.fields["locked"])
        self.assertAlmostEqual(item.fields["mainStat"]["value"], 0.324)

    def test_catalog_enriches_character_and_warp_resources(self) -> None:
        character = parse_visible_text(
            "Acheron Level 80 Ascension 6 Eidolon 1 Basic 6 Skill 10 Ultimate 10 Talent 10",
            0.97,
            "character",
        )
        self.assertEqual(character.name, "Acheron")
        self.assertEqual(character.fields["path"], "Nihility")
        self.assertEqual(character.fields["traces"]["ultimate"], 10)
        warp = parse_visible_text(
            "Stellar Jade 12,345 Star Rail Special Pass 17 Character Pity 42 Character Guaranteed Yes",
            0.96,
            "warp",
        )
        self.assertEqual(warp.fields["resources"]["stellarJade"], 12345)
        self.assertEqual(warp.fields["resources"]["specialPasses"], 17)
        self.assertEqual(warp.fields["resources"]["characterEventPity"], 42)
        self.assertEqual(warp.fields["resources"]["characterEventGuaranteed"], 1)


if __name__ == "__main__":
    unittest.main()
