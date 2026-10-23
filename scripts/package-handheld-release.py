"""Package the already verified source/runtime without rebuilding or re-encoding.
Never overwrites any earlier exhibit or cloud candidate release.
"""
from pathlib import Path
import hashlib,json,zipfile
R=Path(__file__).resolve().parents[1]
version=json.loads((R/'package.json').read_text())['version']
exclude={'node_modules','dist','runtime-public','reports','__pycache__','.git','.openai'}
# Rig tests consume numeric render evidence; include those JSON files, never browser screenshots.
required_evidence_prefix=('reports','hand-rig')
archives=[]
for kind,base in [('Runtime',R/'runtime-public'),('Source',R)]:
 name=R.parent/f'Zevth-Handheld-{kind}-v{version}.zip'
 files=[]
 for p in sorted(base.rglob('*')):
  if not p.is_file() or p.is_symlink():continue
  rel=p.relative_to(base)
  evidence=tuple(rel.parts[:2])==required_evidence_prefix and p.suffix=='.json'
  if kind=='Source' and not evidence and (any(part in exclude for part in rel.parts) or p.suffix in ['.pyc','.blend1']):continue
  files.append(p)
 with zipfile.ZipFile(name,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
  for p in files:z.write(p,'zevth-'+kind.lower()+'/'+p.relative_to(base).as_posix())
 with zipfile.ZipFile(name) as z:
  assert z.testzip() is None
  for p in files:
   assert hashlib.sha256(z.read('zevth-'+kind.lower()+'/'+p.relative_to(base).as_posix())).digest()==hashlib.sha256(p.read_bytes()).digest()
 archives.append({'kind':kind,'path':str(name),'files':len(files),'bytes':name.stat().st_size,'sha256':hashlib.sha256(name.read_bytes()).hexdigest(),'zip_and_every_member_verified':True})
report=R/'reports/handheld/release.json';report.parent.mkdir(parents=True,exist_ok=True);report.write_text(json.dumps(archives,indent=2)+'\n')
print(json.dumps(archives,indent=2))
