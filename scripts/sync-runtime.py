"""Synchronize runtime modules and new images, reusing pixel-identical lossless copies.
Never modifies source originals. The original v0.2 release archive is untouched.
"""
from pathlib import Path
from PIL import Image
import hashlib,json,shutil
root=Path(__file__).resolve().parents[1]; source=root/'public'; dest=root/'runtime-public'
old=json.loads((dest/'runtime-assets.json').read_text()) if (dest/'runtime-assets.json').exists() else {'assets':[]}
previous={i['source']:i for i in old['assets']}
ignore={'assets/renders/hero-exhibit-base.webp','assets/renders/hero-exhibit-glass.webp','assets/renders/hero-hand.webp','assets/renders/hero-hand.metadata.json','assets/renders/lotus-relief.png','assets/renders/lotus-quarter.png','assets/originals/_source/vendor/three.module.js','assets/originals/_source/vendor/CSS3DRenderer.js'}
manifest=[]; active=set(); converted=0
for p in sorted(source.rglob('*')):
 if not p.is_file():continue
 rel=p.relative_to(source).as_posix()
 if rel in ignore:continue
 data=p.read_bytes();sha=hashlib.sha256(data).hexdigest()
 if p.suffix=='.png':
  out=dest/Path(rel).with_suffix('.webp');out.parent.mkdir(parents=True,exist_ok=True)
  prior=previous.get(rel)
  if not(prior and prior['source_sha256']==sha and out.exists() and hashlib.sha256(out.read_bytes()).hexdigest()==prior['runtime_sha256']):
   a=Image.open(p).convert('RGBA');a.save(out,format='WEBP',lossless=True,quality=100,method=6,exact=True);b=Image.open(out).convert('RGBA');assert a.size==b.size and a.tobytes()==b.tobytes(),rel
   prior={'source':rel,'runtime':out.relative_to(dest).as_posix(),'dimensions':list(a.size),'source_sha256':sha,'runtime_sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'decoded_rgba_sha256':hashlib.sha256(a.tobytes()).hexdigest(),'decoded_pixels_identical':True,'source_bytes':len(data),'runtime_bytes':out.stat().st_size};converted+=1
  manifest.append(prior);active.add(out.relative_to(dest).as_posix())
 else:
  out=dest/rel;out.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,out);active.add(rel)
for p in list(dest.glob('*.mjs'))+list(dest.glob('*.css'))+list(dest.glob('*.html')):
 text=p.read_text()
 for item in manifest:text=text.replace(item['source'],item['runtime'])
 text=text.replace('-bloom.png','-bloom.webp');p.write_text(text)
# Keep only source-backed runtime files and its two explanatory records.
for p in dest.rglob('*'):
 if p.is_file() and p.relative_to(dest).as_posix() not in active|{'runtime-assets.json','README.txt'}:p.unlink()
(dest/'runtime-assets.json').write_text(json.dumps({'conversion':'Lossless PNG-to-WebP encoding only; dimensions and decoded RGBA bytes unchanged','source_artwork_modified':False,'assets':manifest},ensure_ascii=False,indent=2))
print(json.dumps({'source_files':len(active),'lossless_images':len(manifest),'newly_converted':converted}))
