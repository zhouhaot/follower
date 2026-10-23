"""Build a compact, standalone runtime without modifying any source artwork.
PNG-to-WebP encoding is lossless and decoded RGBA bytes must be identical.
"""
from pathlib import Path
from PIL import Image
import hashlib,json,shutil,re,zipfile
root=Path(__file__).resolve().parents[1]
version='.'.join(json.loads((root/'package.json').read_text())['version'].split('.')[:2])
source=root/'public'; output=root/'runtime-public'
if output.exists():shutil.rmtree(output)
shutil.copytree(source,output)
# Preserved but unused historical scene renders/reference code are not runtime inputs.
unused=['assets/renders/hero-exhibit-base.webp','assets/renders/hero-exhibit-glass.webp','assets/renders/hero-hand.webp','assets/renders/hero-hand.metadata.json','assets/renders/lotus-relief.png','assets/renders/lotus-quarter.png','assets/originals/_source/vendor/three.module.js','assets/originals/_source/vendor/CSS3DRenderer.js']
for rel in unused:
 p=output/rel
 if p.exists():p.unlink()
manifest=[]; replacements={}
for path in sorted(output.rglob('*.png')):
 rel=path.relative_to(output).as_posix()
 # Even retained reference images are encoded without changing pixels.
 src=Image.open(path).convert('RGBA')
 dest=path.with_suffix('.webp')
 src.save(dest,format='WEBP',lossless=True,quality=100,method=6,exact=True)
 decoded=Image.open(dest).convert('RGBA')
 if decoded.size!=src.size or decoded.tobytes()!=src.tobytes():
  raise RuntimeError('Lossless pixel verification failed: '+rel)
 source_bytes=path.read_bytes();runtime_bytes=dest.read_bytes()
 manifest.append({'source':rel,'runtime':dest.relative_to(output).as_posix(),'dimensions':list(src.size),'source_sha256':hashlib.sha256(source_bytes).hexdigest(),'runtime_sha256':hashlib.sha256(runtime_bytes).hexdigest(),'decoded_rgba_sha256':hashlib.sha256(src.tobytes()).hexdigest(),'decoded_pixels_identical':True,'source_bytes':len(source_bytes),'runtime_bytes':len(runtime_bytes)})
 replacements[rel]=dest.relative_to(output).as_posix()
 path.unlink()
for path in list(output.glob('*.mjs'))+list(output.glob('*.html'))+list(output.glob('*.css')):
 text=path.read_text()
 for old,new in replacements.items():text=text.replace(old,new)
 text=text.replace('-bloom.png','-bloom.webp')
 path.write_text(text)
# Source provenance is retained verbatim; the additional manifest maps those inputs.
(output/'runtime-assets.json').write_text(json.dumps({'conversion':'Lossless PNG-to-WebP encoding only; dimensions and decoded RGBA bytes unchanged','source_artwork_modified':False,'assets':manifest},ensure_ascii=False,indent=2))
(output/'README.txt').write_text(f'花开有声 v{version} · 轻量运行版\n\n在此目录运行 python3 -m http.server 4173，然后浏览器打开 http://localhost:4173。不要用 file:// 直接打开。\n\n原作正面和目标图片采用无损 WebP 编码，逐文件解码后的 RGBA 像素与原 PNG 完全一致，没有缩放、裁剪或颜色改动。runtime-assets.json 记录校验结果。原 PNG、完整源代码、测试和第一版发布包另行保留。\n\n五款花卉都是新建三维候选；浏览器需要 WebGL。实体卡识别、iPhone 对齐与性能尚待实测。无 WebGL 时明确展示静态效果图，预览不计收藏。未部署至 zevth.work。\n')
archive=root.parent/f'Zevth-Handheld-Runtime-v{version}.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for path in sorted(output.rglob('*')):
  if path.is_file():z.write(path,'zevth-runtime/'+path.relative_to(output).as_posix())
with zipfile.ZipFile(archive) as z:assert z.testzip() is None
print(json.dumps({'path':str(archive),'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'converted_images':len(manifest),'all_decoded_pixels_identical':True,'image_bytes_before':sum(x['source_bytes'] for x in manifest),'image_bytes_after':sum(x['runtime_bytes'] for x in manifest)},indent=2))
