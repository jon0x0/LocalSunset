"""Explicit source-release allowlist shared by Git preparation and ZIP packaging."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
TOP=('app.py','cache_store.py','solar.py','terrain.py','geocoding.py','network_access.py','serve.py','run.py','requirements.txt','README.md','.gitignore','.gitattributes','start.bat')
PI=('README.md','install.sh','install-service.sh','kiosk.sh','run.sh')
STATIC=('app.js','idle-mode.js','cache-controls.js','celestial-sky.js','countdown.js','index.html','keystone.js','scene-effects.js','star-catalog.js','style.css','THIRD-PARTY.md','vendor/astronomy.browser.min.js','vendor/ASTRONOMY-LICENSE.md')
TOOLS=('public_files.py','package_pi.py','audit_public.py','build_browser.py')
ATMOSPHERE=('satellite-data-worker.js','satellite-refresh.js','test-satellite-refresh.js','cloud-motion.js','test-cloud-motion.js','spectral-sky.js','test-spectral.js','serve_candidate.py','test-atmosphere-worker.js','atmosphere-worker.js','cloud-base.js','test-cloud-base.js','satellite-clouds.js','satellite-ui.js','prepare_satellite.py','requirements-satellite.txt','test-satellite.js','SATELLITE.md','build_candidate.py','candidate-panel.html','candidate-ui.js','candidate-layout.js','candidate.css','model.js','peak-analysis.js','viewport-policy.js','sky-resize.js','chart-markers.js','sky-countdown.js','forecast-refresh.js','terrain-option.js','terrain-80228.json','proxy.js','about.html','test-model.js','test-peak.js','test-sky-countdown.js','test-viewport.js','test-forecast-refresh.js')

def public_files():
    files=[ROOT/p for p in TOP]+[ROOT/'raspi'/p for p in PI]+[ROOT/'static'/p for p in STATIC]+[ROOT/'tools'/p for p in TOOLS]
    files += [p for p in (ROOT/'web').rglob('*') if p.is_file() and p.suffix in ('.js','.md')]
    files += [p for p in (ROOT/'tests').iterdir() if p.is_file() and p.suffix in ('.py','.js','.json')]
    files += [ROOT/'prototypes/atmosphere'/p for p in ATMOSPHERE]
    files += [ROOT/'.github/workflows/pages.yml']
    return sorted({p for p in files if p.exists()})
if __name__=='__main__':
    print('\n'.join(p.relative_to(ROOT).as_posix() for p in public_files()))
