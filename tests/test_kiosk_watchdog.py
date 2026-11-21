import importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('watchdog',Path(__file__).resolve().parents[1]/'raspi/kiosk-watchdog.py')
watchdog=importlib.util.module_from_spec(spec);spec.loader.exec_module(watchdog)

class KioskHeartbeat(unittest.TestCase):
    def test_crashed_tab_with_live_browser(self):
        self.assertTrue(watchdog.stalled(1000,700,850000))
    def test_live_page_and_initial_load_are_left_alone(self):
        self.assertFalse(watchdog.stalled(1000,700,995000))
        self.assertFalse(watchdog.stalled(1000,900,850000))
    def test_missing_or_invalid_diagnostics_do_not_restart_browser(self):
        for reported in [None,False,'850000',0,1100000]:
            self.assertFalse(watchdog.stalled(1000,700,reported))

if __name__=='__main__':unittest.main()
