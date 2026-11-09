"""Build a source-only release from the audited public allowlist."""
from pathlib import Path
from zipfile import ZipFile,ZipInfo,ZIP_DEFLATED
from public_files import ROOT,public_files
from audit_public import audit
files=public_files();audit(files)
output=ROOT/'dist'/'localsunset-raspberry-pi.zip';output.parent.mkdir(exist_ok=True)
with ZipFile(output,'w',compression=ZIP_DEFLATED) as bundle:
    for path in files:
        info=ZipInfo('LocalSunset/'+path.relative_to(ROOT).as_posix());info.create_system=3
        info.external_attr=(0o100755 if path.suffix=='.sh' else 0o100644)<<16;info.compress_type=ZIP_DEFLATED
        bundle.writestr(info,path.read_bytes().replace(b'\r\n',b'\n'))
print(output);print(str(len(files))+' audited source files. Local state, photos, deployment records and caches excluded.')
