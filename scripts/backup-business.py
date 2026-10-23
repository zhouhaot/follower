"""Create a source snapshot with per-file hashes; never include browser data/secrets."""
from pathlib import Path
import argparse, hashlib, json, tempfile, zipfile
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('label',choices=['baseline','completed']);args=parser.parse_args()
out=root.parents[2]/'local-deliverables'/f'Zevth-Business-{args.label}-20261014.zip'
assert not out.exists(),f'Refusing to overwrite {out}'
excluded={'.git','.venv','node_modules','dist','runtime-public','__pycache__','.openai','.aws','.codex','.agents'}
files=[]
for p in sorted(root.rglob('*')):
 rel=p.relative_to(root)
 if not p.is_file() or p.is_symlink() or any(part in excluded for part in rel.parts):continue
 if any(part.startswith('.') and part!='.gitignore' for part in rel.parts):continue
 if p.suffix=='.pyc' or p.name.startswith('.env'):continue
 if rel.parts[0]=='reports' and (p.suffix!='.json' or 'qa' in rel.parts):continue
 files.append(p)
manifest={str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
readme='''Zevth local business source snapshot. No production or browser-local user data is included.
Verify FILES.sha256, then use Node 22+: npm ci; npm test; npm run build.
Start loopback preview with npm run dev. Image tooling is optional: python3.11 -m venv .venv and install requirements-tooling.txt.
Source originals, vendor dependencies/licenses, editable work sources and required numeric reports are retained.
node_modules, .venv, generated dist/runtime-public, QA screenshots/logs and credentials are excluded.
Rebuild runtime-public with the existing sync script if needed. Existing snapshots/backups were not changed.
This ZIP is only a local snapshot until a successful Library receipt exists. It is not a software registration submission.
'''
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in files:z.write(p,p.relative_to(root).as_posix())
 z.writestr('RESTORE.txt',readme)
 z.writestr('FILES.sha256',''.join(f'{h}  {name}\n' for name,h in manifest.items()))
 z.writestr('SNAPSHOT.json',json.dumps({'label':args.label,'files':len(files),'scope':'Project source/resources only; no user collections or credentials','thirdPartyExcludedFromOriginalityClaims':True},indent=2))
restore=Path(tempfile.mkdtemp(prefix=f'zevth-business-{args.label}-'))
with zipfile.ZipFile(out) as z:
 assert z.testzip() is None;z.extractall(restore)
for name,h in manifest.items():assert hashlib.sha256((restore/name).read_bytes()).hexdigest()==h,name
report={'label':args.label,'archive':str(out),'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'sourceFiles':len(files),'zipCrc':'passed','restoredFileHashes':'all matched','restoredRoot':str(restore),'libraryFileId':None}
out.with_suffix('.verification.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
