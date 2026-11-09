"""Audit public sources against private local location data, without printing it."""
import json
import re
from pathlib import Path
from public_files import ROOT,public_files

def audit(files):
    private=set()
    local=ROOT/'locations.json'
    if local.exists():
        for place in json.loads(local.read_text(encoding='utf-8')):
            name=str(place.get('name','')).strip()
            if name:private.add(name.lower())
            for coordinate in ('lat','lon'):
                if coordinate in place:
                    value=float(place[coordinate]);private.add(str(value))
                    for precision in range(5,13):private.add(format(value,'.'+str(precision)+'f'))
    target=ROOT/'.display-target.json'
    if target.exists():
        from urllib.parse import urlsplit
        host=urlsplit(json.loads(target.read_text())['url']).hostname
        if host and host not in ('localhost','127.0.0.1'):private.add(host.lower())
    failures=[]
    for path in files:
        name=path.relative_to(ROOT).as_posix()
        if path.suffix.lower() in ('.jpg','.jpeg','.png','.webp','.zip','.pem','.key','.npz','.tif','.tiff','.db') or any(x in name for x in ('.cache/','.local-private/','.codex','deployment-backup/')) or path.name in ('locations.json','.env','.network-auth.json','.network-admin-password','.display-target.json'):
            failures.append(name+': private/binary asset');continue
        text=path.read_text(encoding='utf-8-sig').lower()
        if any(value in text for value in private):failures.append(name+': local location/host fingerprint')
        if re.search(r'\b(?:d:|c:)[/\\](?:users|t7_recover)',text):failures.append(name+': workstation path')
        if re.search(r'-----begin (?:rsa |ec |openssh )?private key-----|\b(?:ghp_|github_pat_)[a-z0-9_]{20,}|\bAKIA[A-Z0-9]{16}\b',text,re.I):failures.append(name+': credential-like value')
        if re.search(r'(?:ssid|psk|wifi_password)\s*[=:]\s*[\"\'][^\"\']{3,}[\"\']',text):failures.append(name+': Wi-Fi configuration')
    if failures:raise SystemExit('Public source audit failed:\n'+'\n'.join(failures))
    return len(files)
if __name__=='__main__':print('PASS: '+str(audit(public_files()))+' public files contain no detected private local location fingerprints or photos.')
