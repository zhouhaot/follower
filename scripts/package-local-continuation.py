"""Create and restore-check local continuation snapshots; never publish them."""
from pathlib import Path
import hashlib
import json
import tempfile
import zipfile

root = Path(__file__).resolve().parents[1]
out = root.parents[2] / 'local-deliverables'
out.mkdir(exist_ok=True)
excluded = {'.venv', 'node_modules', 'dist', 'runtime-public', '__pycache__', '.git'}
source = [p for p in sorted(root.rglob('*')) if p.is_file() and not p.is_symlink()
          and not any(part in excluded for part in p.relative_to(root).parts)
          and p.suffix != '.pyc']
runtime = [p for p in sorted((root/'runtime-public').rglob('*')) if p.is_file()]
results = []
for name, base, files, prefix in [
    ('Zevth-Mac-v0.4.1-Local-Source.zip', root, source, 'zevth-v041-local'),
    ('Zevth-Mac-v0.4.1-Local-Runtime.zip', root/'runtime-public', runtime, ''),
]:
    path = out / name
    if path.exists():
        raise FileExistsError(f'Refusing to overwrite snapshot: {path}')
    records = {}
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for p in files:
            relative = p.relative_to(base).as_posix()
            if p.name.startswith('.env'):
                raise ValueError(f'Unexpected environment input: {relative}')
            data = p.read_bytes()
            records[relative] = hashlib.sha256(data).hexdigest()
            archive.writestr(f'{prefix}/{relative}' if prefix else relative, data)
        manifest = ''.join(f'{digest}  {relative}\n' for relative, digest in records.items())
        archive.writestr(f'{prefix}/LOCAL-FILES.sha256' if prefix else 'LOCAL-FILES.sha256', manifest)
    restored = Path(tempfile.mkdtemp(prefix='zevth-v041-restore-'))
    with zipfile.ZipFile(path) as archive:
        assert archive.testzip() is None
        archive.extractall(restored)
    restored_root = restored / prefix if prefix else restored
    for relative, digest in records.items():
        assert hashlib.sha256((restored_root/relative).read_bytes()).hexdigest() == digest, relative
    results.append({'archive': str(path), 'bytes': path.stat().st_size,
                    'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                    'restoredFiles': len(records), 'restorationHashesMatch': True,
                    'restoredRoot': str(restored_root), 'published': False})
(out/'local-package-verification.json').write_text(json.dumps(results, indent=2)+'\n')
print(json.dumps(results, indent=2))
