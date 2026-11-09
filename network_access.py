"""LAN access control; the local HDMI kiosk remains usable without a login."""
from datetime import timedelta
import getpass
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import secrets
from urllib.parse import urlsplit
from flask import request, session, jsonify, Response
from werkzeug.security import generate_password_hash, check_password_hash

AUTH_PATH=Path(__file__).parent/'.network-auth.json'


def setup_password(path=AUTH_PATH):
    password=getpass.getpass('New network admin password (at least 12 characters): ')
    if len(password)<12:
        raise ValueError('Use at least 12 characters.')
    if password!=getpass.getpass('Repeat network admin password: '):
        raise ValueError('Passwords do not match.')
    data=dict(username='admin',password_hash=generate_password_hash(password),secret_key=secrets.token_hex(32))
    temporary=path.with_name(path.name+'.'+secrets.token_hex(8)+'.tmp')
    fd=os.open(temporary,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'w',encoding='utf-8') as output:
        json.dump(data,output)
    temporary.replace(path)
    print('Network password saved. Username: admin. The password is not stored in plaintext.')


def configure(app,required,path=AUTH_PATH):
    app.config['NETWORK_AUTH_REQUIRED']=required
    if not required:
        return
    if not path.exists():
        raise ValueError('Set a network password first: python serve.py --set-password')
    data=json.loads(path.read_text(encoding='utf-8'))
    app.config.update(NETWORK_USERNAME=data['username'],NETWORK_PASSWORD_HASH=data['password_hash'],
                      SECRET_KEY=data['secret_key'],SESSION_COOKIE_HTTPONLY=True,SESSION_COOKIE_SAMESITE='Strict',
                      PERMANENT_SESSION_LIFETIME=timedelta(hours=12))


def trusted_local_request():
    try:
        peer=ipaddress.ip_address(request.remote_addr)
        hostname=urlsplit(request.host_url).hostname
        return peer.is_loopback and hostname in ('127.0.0.1','localhost','::1')
    except ValueError:
        return False


def protect(app):
    # JSON mutations plus strict origin checks protect both the local kiosk and
    # authenticated remote browser from cross-site configuration requests.
    if request.method in ('POST','PUT','PATCH','DELETE'):
        origin=request.headers.get('Origin')
        if origin and origin.rstrip('/')!=request.host_url.rstrip('/'):
            return jsonify(error='Cross-origin changes are not allowed.'),403
    if not app.config.get('NETWORK_AUTH_REQUIRED') or request.path=='/api/health' or trusted_local_request():
        return None
    password_hash=app.config['NETWORK_PASSWORD_HASH']
    epoch=hashlib.sha256(password_hash.encode()).hexdigest()
    if session.get('network_auth')==epoch:
        return None
    auth=request.authorization
    if auth and auth.type.lower()=='basic' and auth.username==app.config['NETWORK_USERNAME'] and check_password_hash(password_hash,auth.password or ''):
        session.permanent=True
        session['network_auth']=epoch
        return None
    return Response('Network configuration requires sign-in. Username: admin.',401,
                    {'WWW-Authenticate':'Basic realm="Local Sunset", charset="UTF-8"'})
