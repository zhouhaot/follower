"""Verify the registered runtime render layers and their source provenance."""
from pathlib import Path
import json, hashlib
from PIL import Image, ImageStat
R=Path(__file__).resolve().parents[1]
A=R/'public/assets/renders'
m=json.loads((A/'hero-exhibit.metadata.json').read_text())
expected=(1200,1400)
checks={}
assets={}
for part in ('base','glass'):
 p=A/f'hero-exhibit-{part}.webp'
 im=Image.open(p);im.load()
 assert im.size==expected,(p,im.size)
 assert im.mode=='RGBA',(p,im.mode)
 assert im.getchannel('A').getextrema()==(0,255),(p,'missing alpha range')
 png=R/f'reports/exhibit/hero-exhibit-{part}.png'
 if png.exists():
  source=Image.open(png)
  assert source.getchannel('A').tobytes()==im.getchannel('A').tobytes(),(p,'alpha changed during encoding')
 assets[p.name]={'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'dimensions_px':list(im.size)}
 if part=='glass':
  center_alpha=ImageStat.Stat(im.getchannel('A').crop((480,560,720,840))).mean[0]
  assert center_alpha<90,('glass center must remain transparent',center_alpha)
  checks['glass_center_mean_alpha_0_255']=round(center_alpha,3)
assert sum(a['bytes'] for a in assets.values())<1572864,'Runtime layers exceed 1.5 MiB'
source=R/m['source_glb']
assert hashlib.sha256(source.read_bytes()).hexdigest()==m['source_glb_sha256'],'Source geometry changed'
assert m['card_geometry_changed'] is False and m['original_front_artwork_changed'] is False
assert m['sampling']==256
assert not list(A.glob('hero-exhibit*.png')),'Only required WebP assets should ship'
checks.update({'registered_dimensions':list(expected),'alpha_preserved':True,'source_geometry_hash_verified':True,'runtime_bytes':sum(a['bytes'] for a in assets.values()),'outputs':assets})
print(json.dumps(checks,indent=2))
