"""Regression: multiple viewers must not consume every Waitress worker."""
import sys,threading,unittest,urllib.request
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app import app
from waitress import create_server

class CalibrationAvailability(unittest.TestCase):
 def test_viewers_leave_server_available(self):
  server=create_server(app,host='127.0.0.1',port=0,threads=4)
  thread=threading.Thread(target=server.run,daemon=True);thread.start()
  base='http://127.0.0.1:'+str(server.effective_port)
  def get(path):
   with urllib.request.urlopen(base+path,timeout=3) as response:return response.status,response.read()
  try:
   with ThreadPoolExecutor(max_workers=8) as clients:
    results=list(clients.map(get,['/api/projector-calibration/events']*8))
   self.assertTrue(all(status==204 and not body for status,body in results))
   self.assertEqual(get('/api/health')[0],200)
   self.assertEqual(get('/')[0],200)
  finally:
   server.close();server.task_dispatcher.shutdown()

if __name__=='__main__':unittest.main()
