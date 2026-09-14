import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image
from krzys_hsr_scanner.capture import GuidedCapture
from krzys_hsr_scanner.model import ScanSession
from krzys_hsr_scanner.ocr import parse_visible_text


class SafetyTests(unittest.TestCase):
    def test_hands_and_negative_flags(self):
        item = parse_visible_text('Fixture Level 15 Hands 5 star ATK 352.8 HP 3.8% Unlocked Discard: No', .95)
        self.assertEqual(item.fields['slot'], 'Hands')
        self.assertFalse(item.fields['locked'])
        self.assertFalse(item.fields['discarded'])
        self.assertEqual(item.fields['substats'][0]['stat'], 'hpPct')

    def test_stop_during_ocr_discards_result(self):
        with tempfile.TemporaryDirectory() as directory:
            session=ScanSession()
            capture=GuidedCapture(None,session,Path(directory)/'state.json',Path(directory)/'debug')
            class StopEngine:
                def recognize(self,image):
                    capture.cancel()
                    return 'Fixture Level 15 Hands 5 star ATK 352.8', .95
            capture.engine=StopEngine()
            with patch.object(capture,'capture_screen',return_value=Image.new('RGB',(1920,1080))):
                capture.capture_once()
            self.assertEqual(session.items,[])
            self.assertEqual(session.current_index,0)

    def test_capture_failure_is_reported_and_preserves_session(self):
        with tempfile.TemporaryDirectory() as directory:
            session=ScanSession()
            capture=GuidedCapture(None,session,Path(directory)/'state.json',Path(directory)/'debug')
            messages=[]
            with patch.object(capture.stop_event,'wait',return_value=False), patch.object(capture,'capture_once',side_effect=RuntimeError('lost focus')):
                capture.run(1,.2,.3,False,False,messages.append)
            self.assertTrue(session.cancelled)
            self.assertTrue(any('lost focus' in message for message in messages))
            self.assertTrue((Path(directory)/'state.json').exists())
