"""Start the authorized loopback preview independently of an expiring tool session."""
from pathlib import Path
import json, subprocess, sys, time, urllib.request
root=Path(__file__).resolve().parents[1]
logs=root/'reports/qa';logs.mkdir(parents=True,exist_ok=True)
with (logs/'local-user-preview.log').open('ab') as log:
    process=subprocess.Popen([sys.executable,str(root/'scripts/serve-local.py'),'public','4173'],cwd=root,stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
for attempt in range(30):
    if process.poll() is not None:
        raise SystemExit('Preview could not start; inspect reports/qa/local-user-preview.log. Existing services were not stopped.')
    try:
        with urllib.request.urlopen('http://127.0.0.1:4173/guide.html',timeout=.5) as response:
            if response.status==200:
                result={'pid':process.pid,'url':'http://127.0.0.1:4173/','httpStatus':200,'scope':'Loopback only; started at user request; no system service/security settings changed.'}
                (logs/'local-preview-process.json').write_text(json.dumps(result,indent=2));print(json.dumps(result));break
    except Exception:
        time.sleep(.1)
else:
    raise SystemExit('Readiness was not confirmed; the process was left available for diagnosis.')
