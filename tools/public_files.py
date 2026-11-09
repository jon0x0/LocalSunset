"""Explicit source-release allowlist shared by Git preparation and ZIP packaging."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
TOP=('app.py','cache_store.py','solar.py','terrain.py','geocoding.py','network_access.py','serve.py','run.py','requirements.txt','README.md','.gitignore','.gitattributes','start.bat')
PI=('README.md','install.sh','install-service.sh','kiosk.sh','run.sh')
STATIC=('app.js','cache-controls.js','celestial-sky.js','countdown.js','index.html','keystone.js','scene-effects.js','star-catalog.js','style.css','THIRD-PARTY.md','vendor/astronomy.browser.min.js','vendor/ASTRONOMY-LICENSE.md')
TOOLS=('public_files.py','package_pi.py','audit_public.py','build_browser.py')
def public_files():
    files=[ROOT/p for p in TOP]+[ROOT/'raspi'/p for p in PI]+[ROOT/'static'/p for p in STATIC]+[ROOT/'tools'/p for p in TOOLS]
    files += [p for p in (ROOT/'web').rglob('*') if p.is_file() and p.suffix in ('.js','.md')]
    files += [p for p in (ROOT/'tests').iterdir() if p.is_file() and p.suffix in ('.py','.js','.json')]
    files += [ROOT/'.github/workflows/pages.yml']
    return sorted({p for p in files if p.exists()})
if __name__=='__main__':
    print('\n'.join(p.relative_to(ROOT).as_posix() for p in public_files()))
