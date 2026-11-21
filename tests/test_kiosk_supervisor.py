"""A second kiosk launcher must exit before touching browser or display state."""
import os,shutil,subprocess,tempfile,unittest
from pathlib import Path
@unittest.skipUnless(os.name=='posix','Linux kiosk guard')
class KioskSingleton(unittest.TestCase):
 def test_existing_supervisor_blocks_second_launch(self):
  import fcntl
  source=Path(os.environ.get('KIOSK_SCRIPT',str(Path(__file__).resolve().parents[1]/'raspi/kiosk.sh')))
  with tempfile.TemporaryDirectory() as folder:
   root=Path(folder);(root/'raspi').mkdir();(root/'.cache').mkdir();script=root/'raspi/kiosk.sh';shutil.copyfile(source,script)
   with (root/'.cache/kiosk-supervisor.lock').open('w') as lock:
    fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    response=subprocess.run(['bash',str(script)],capture_output=True,text=True,timeout=3)
    self.assertEqual(response.returncode,0,response.stderr)
    self.assertIn('already supervised',response.stdout)
if __name__=='__main__':unittest.main()
