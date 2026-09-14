"""Real local OCR on anonymous synthetic fixtures, not claimed as game screenshots."""
import os
import unittest
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from krzys_hsr_scanner.ocr import TesseractEngine, parse_visible_text, preprocess


class TesseractIntegrationTests(unittest.TestCase):
    def test_image_to_text_and_schema_fields(self):
        try:
            engine=TesseractEngine(os.getenv('TESSERACT_CMD'))
        except Exception as error:
            if os.getenv('REQUIRE_OCR')=='1':
                self.fail(f'Real OCR is required: {error}')
            self.skipTest(f'Install Tesseract to run real OCR: {error}')
        font_path=next((path for path in [Path('C:/Windows/Fonts/arial.ttf'),Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')] if path.exists()),None)
        self.assertIsNotNone(font_path, 'A test font is required.')
        for scale in [1,1.5,2]:
            with self.subTest(scale=scale):
                image=Image.new('RGB',(int(1100*scale),int(420*scale)),'white')
                draw=ImageDraw.Draw(image)
                font=ImageFont.truetype(str(font_path),int(30*scale))
                for index,line in enumerate(['Scholar Lost in Erudition','Level 15','Body 5 star','CRIT Rate 32.4%','CRIT DMG 11.6%','SPD 5','Unlocked']):
                    draw.text((20*scale,(20+50*index)*scale),line,font=font,fill='black')
                text,confidence=engine.recognize(preprocess(image))
                item=parse_visible_text(text,confidence)
                self.assertEqual(item.fields['slot'],'Body',text)
                self.assertAlmostEqual(item.fields['mainStat']['value'],.324)
                self.assertGreater(confidence,.8)
                self.assertFalse(item.fields['locked'])
