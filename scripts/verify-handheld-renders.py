"""Read-only verification for the registered, independently layerable card assets."""
import hashlib
import json
import math
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
expected = '4d0b0e912d24dafb5186d62569a58729b34407352f11f871b960c593e4fd9ac3'
source = ROOT / 'public/assets/models/lotus-relief.glb'
assert hashlib.sha256(source.read_bytes()).hexdigest() == expected
report = {'source_glb_sha256': expected, 'assets': {}, 'gpu_verified': False}
for face, stem, meta_name in [('relief', 'handheld-relief', 'handheld-card'), ('original', 'handheld-front', 'handheld-card-original')]:
    metadata_path = ROOT / f'public/assets/renders/{meta_name}.metadata.json'
    metadata = json.loads(metadata_path.read_text())
    destination = ROOT / f'public/assets/renders/{stem}.webp'
    master = ROOT / f'reports/handheld/{stem}.png'
    image = Image.open(destination).convert('RGBA')
    png = Image.open(master).convert('RGBA')
    assert image.size == (1200, 1600)
    assert image.size == png.size
    assert image.tobytes() == png.tobytes(), f'{stem}: WebP must preserve every source PNG pixel'
    alpha = image.getchannel('A')
    assert alpha.getextrema() == (0, 255), f'{stem}: actual transparency required'
    bounds = alpha.point(lambda x: 255 if x > 8 else 0).getbbox()
    assert bounds and bounds[0] > 200 and bounds[1] > 130 and bounds[2] < 1000 and bounds[3] < 1220
    assert metadata['source_glb_sha256'] == expected
    assert metadata['source_geometry_changed'] is False
    assert metadata['source_front_artwork_changed'] is False
    assert metadata['face'] == face
    if face == 'original':
        assert abs(metadata['source_transform']['rotation'][1] - math.pi) < 1e-10
    assert hashlib.sha256(destination.read_bytes()).hexdigest() == metadata['output_asset']['sha256']
    report['assets'][stem] = {'dimensions': list(image.size), 'alpha_bounds': list(bounds), 'transparent': True, 'rgba_pixels_sha256': hashlib.sha256(image.tobytes()).hexdigest(), 'lossless_rgba_match': True, 'bytes': destination.stat().st_size}
assert report['assets']['handheld-relief']['rgba_pixels_sha256'] != report['assets']['handheld-front']['rgba_pixels_sha256'], 'Opposite faces must be independently rendered, not duplicated'
report['checks_passed'] = True
report_path = ROOT / 'reports/handheld/asset-verification.json'
report_path.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
