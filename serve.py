"""Portable desktop/Pi server; use --help for launch and kiosk options."""
import argparse
import os
import threading
import webbrowser
from pathlib import Path
import json
from urllib.parse import urlsplit


def parser():
    cli=argparse.ArgumentParser(description='Local Sunset desktop / Raspberry Pi server')
    cli.add_argument('--pi',action='store_true',help='Lower-memory terrain defaults and low-power rendering')
    cli.add_argument('--projector',action='store_true',help='Open the projector layout')
    cli.add_argument('--auto',action='store_true',help='Load last saved location and follow its local calendar day')
    cli.add_argument('--network',action='store_true',help='Enable password-protected LAN access on all interfaces')
    cli.add_argument('--no-auth',action='store_true',help='Allow LAN access without an application login')
    cli.add_argument('--display-server',help='Relay HDMI controls to another Local Sunset server, e.g. http://projector.local:5000')
    cli.add_argument('--set-password',action='store_true',help='Interactively set the network admin password')
    cli.add_argument('--no-browser',action='store_true',help='Run headless (for systemd or a kiosk launcher)')
    cli.add_argument('--host',default='127.0.0.1',help='Bind address (loopback by default)')
    cli.add_argument('--port',type=int,default=int(os.environ.get('PORT','5000')))
    return cli


def main():
    args=parser().parse_args()
    if args.display_server:
        target=urlsplit(args.display_server)
        if target.scheme not in ('http','https') or not target.hostname or target.username or target.password or target.path not in ('','/') or target.query or target.fragment:
            raise SystemExit('Display server must be an HTTP(S) origin without credentials or a path.')
        (Path(__file__).parent/'.display-target.json').write_text(json.dumps({'url':args.display_server.rstrip('/')}))
    from network_access import setup_password, configure
    if args.set_password:
        try:
            setup_password()
        except ValueError as exc:
            raise SystemExit(str(exc))
        if not args.network and args.host in ('127.0.0.1','localhost','::1'):
            return
    if args.network:
        args.host='0.0.0.0'
    if args.pi:
        os.environ['LOCAL_SUNSET_PI']='1'
    from app import app
    target_path=Path(__file__).parent/'.display-target.json'
    if target_path.exists():
        app.config['DISPLAY_SERVER_URL']=json.loads(target_path.read_text())['url']
    try:
        configure(app,args.host not in ('127.0.0.1','localhost','::1') and not args.no_auth)
    except (ValueError,KeyError) as exc:
        raise SystemExit(str(exc))
    from waitress import serve
    flags=[]
    if args.projector: flags.append('projector=1')
    if args.pi: flags.append('pi=1')
    if args.auto: flags.append('auto=1')
    url=f'http://127.0.0.1:{args.port}/'+('?'+'&'.join(flags) if flags else '')
    if not args.no_browser:
        threading.Timer(2,lambda:webbrowser.open(url)).start()
    print(f'Local Sunset: {url}',flush=True)
    if args.host not in ('127.0.0.1','localhost','::1'):
        import socket
        access='no application login' if args.no_auth else 'sign in as admin'
        print(f'LAN configuration: http://{socket.gethostname()}.local:{args.port}/ ({access})',flush=True)
    serve(app,host=args.host,port=args.port,threads=4)


if __name__=='__main__':
    main()
