import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock
from PIL import Image
from krzys_hsr_scanner.capture import GuidedCapture
from krzys_hsr_scanner.model import ScanSession
from krzys_hsr_scanner.ocr import parse_visible_text


class SafetyTests(unittest.TestCase):
    def test_fast_capture_does_not_navigate_after_stop(self):
        with tempfile.TemporaryDirectory() as directory:
            capture = GuidedCapture(None, ScanSession(), Path(directory)/'state.json', Path(directory)/'debug')
            navigation = MagicMock()
            capture.engine = MagicMock()
            capture.target_window = None
            with patch.object(capture, '_prepare_capture', return_value=Image.new('RGB', (10, 10))), patch.object(capture.engine, 'recognize', return_value=('Fixture', .95)), patch('krzys_hsr_scanner.capture.game_window', return_value=(None, 'Fixture')), patch.dict('sys.modules', {'pyautogui': navigation}):
                capture._run_pipelined(2, .01, False, None, False, lambda message: capture.cancel())
            navigation.press.assert_not_called()
            self.assertEqual(capture.session.items, [])

    def test_pause_retains_completed_ocr_until_resume(self):
        with tempfile.TemporaryDirectory() as directory:
            capture = GuidedCapture(None, ScanSession(), Path(directory)/'state.json', Path(directory)/'debug')
            capture.pause()
            with patch.object(capture.stop_event, 'wait', side_effect=lambda delay: capture.resume()):
                capture._accept_ocr_result('Fixture Level 15 Hands ATK 352', .95, 'relic', False)
            self.assertEqual(len(capture.session.items), 1)

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
