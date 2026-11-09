"""Private runtime caches. Nothing here belongs in a source release."""
from pathlib import Path
import gzip
import hashlib
import json
import os
import shutil
import uuid

ROOT=Path(__file__).resolve().parent/'.cache'
KINDS=('terrain','horizons','results')
VERSION=1

def key(value):
    return hashlib.sha256(json.dumps([VERSION,value],sort_keys=True,separators=(',',':')).encode()).hexdigest()

def dem_identity():
    path=os.environ.get('LOCAL_DEM')
    if not path:return None
    p=Path(path).resolve();stat=p.stat()
    return [str(p),stat.st_size,stat.st_mtime_ns]

def read(kind,identity):
    if kind not in ('horizons','results'):raise ValueError('Invalid cache kind')
    path=ROOT/kind/(key(identity)+'.json.gz')
    try:
        with gzip.open(path,'rt',encoding='utf-8') as stream:return json.load(stream)
    except (OSError,ValueError,EOFError):return None

def write(kind,identity,value):
    if kind not in ('horizons','results'):raise ValueError('Invalid cache kind')
    folder=ROOT/kind;folder.mkdir(parents=True,exist_ok=True)
    path=folder/(key(identity)+'.json.gz');temporary=folder/(uuid.uuid4().hex+'.tmp')
    try:
        with gzip.open(temporary,'wt',encoding='utf-8') as stream:json.dump(value,stream,separators=(',',':'),allow_nan=False)
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)

def stats():
    count=size=0
    for kind in KINDS:
        folder=ROOT/kind
        if folder.is_symlink():continue
        if folder.exists():
            for p in folder.rglob('*'):
                if p.is_file() and not p.is_symlink():count+=1;size+=p.stat().st_size
    return dict(files=count,bytes=size)

def clear():
    # Fixed targets only; never accept a path from a browser request.
    root=ROOT.resolve()
    for kind in KINDS:
        folder=ROOT/kind
        if folder.is_symlink() or not folder.resolve().is_relative_to(root):
            raise ValueError('Unsafe cache path')
    for kind in KINDS:
        folder=ROOT/kind
        if folder.exists():shutil.rmtree(folder)
        folder.mkdir(parents=True,exist_ok=True)
