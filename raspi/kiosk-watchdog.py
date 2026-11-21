"""Recover a kiosk renderer crash while Chromium's main process stays alive.

The optional local render-health endpoint is supplied by the atmosphere server.
Servers without that endpoint retain normal process-exit supervision.
"""
import argparse,json,os,signal,time,urllib.request

def stalled(now,started,reported,grace=180,timeout=120):
    return (isinstance(reported,(int,float)) and not isinstance(reported,bool)
            and 0<reported<=now*1000 and now-started>=grace
            and now-reported/1000>=timeout)

def monitor(pid,port):
    started=time.time()
    while True:
        time.sleep(10)
        try:os.kill(pid,0)
        except ProcessLookupError:return
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{port}/api/sky-render-status',timeout=5) as response:
                state=json.load(response)
        except (OSError,ValueError):continue
        if not isinstance(state,dict):continue
        if stalled(time.time(),started,state.get('reportedAt')):
            print(time.strftime('%Y-%m-%dT%H:%M:%S%z'),
                  'Kiosk renderer heartbeat stale; restarting supervised browser',pid,flush=True)
            try:os.kill(pid,signal.SIGTERM)
            except ProcessLookupError:pass
            return

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('pid',type=int);parser.add_argument('port',type=int)
    args=parser.parse_args();monitor(args.pid,args.port)
