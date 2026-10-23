"""Render the immutable supplied card as one independently compositable layer.

blender -b -t 8 --python scripts/render-handheld-card.py -- --preview
blender -b -t 8 --python scripts/render-handheld-card.py
The source GLB is never written; no hand, support, floor, glass, bloom or paint.
"""
import argparse, hashlib, json, math, os, shutil, subprocess, sys
from pathlib import Path
import bpy
from mathutils import Matrix, Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'public/assets/models/lotus-relief.glb'
EXPECTED_HASH = '4d0b0e912d24dafb5186d62569a58729b34407352f11f871b960c593e4fd9ac3'
OUT = ROOT / 'public/assets/renders'
REPORT = ROOT / 'reports/handheld'
REPORT.mkdir(parents=True, exist_ok=True)
p = argparse.ArgumentParser()
p.add_argument('--preview', action='store_true')
p.add_argument('--prepare-only', action='store_true')
p.add_argument('--samples', type=int, default=256)
p.add_argument('--face', choices=['relief', 'original'], default='relief')
a = p.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == EXPECTED_HASH, 'Immutable card source hash changed'
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 32 if a.preview else a.samples
scene.cycles.use_denoising = False
scene.cycles.adaptive_threshold = .035 if a.preview else .008
scene.cycles.max_bounces = 8
scene.cycles.glossy_bounces = 5
scene.cycles.diffuse_bounces = 3
scene.render.resolution_x = 600 if a.preview else 1200
scene.render.resolution_y = 800 if a.preview else 1600
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.image_settings.color_depth = '8'
scene.render.film_transparent = True
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = -.1
scene.world = bpy.data.worlds.new('Quiet neutral gallery ambient')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.29, .30, .31, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .38

def B(v):
    return (v[0], -v[2], v[1])

def point(obj, target):
    obj.rotation_euler = (Vector(B(target)) - obj.location).to_track_quat('-Z', 'Y').to_euler()

bpy.ops.import_scene.gltf(filepath=str(SOURCE))
card = list(scene.objects)
# Material-only presentation adjustments; all vertices, normals and source artwork remain intact.
material_spec = {
    '01': {'color': [.20, .203, .198], 'metalness': .88, 'roughness': .32},
    '02': {'color': [.38, .385, .37], 'metalness': .86, 'roughness': .31},
    '03': {'color': [.40, .34, .24], 'metalness': .86, 'roughness': .31},
    '05': {'color': [.43, .435, .42], 'metalness': .88, 'roughness': .29},
}
for material in bpy.data.materials:
    if material.name.startswith('FRONT') or not material.use_nodes:
        continue
    shader = material.node_tree.nodes.get('Principled BSDF')
    for prefix, spec in material_spec.items():
        if material.name.startswith(prefix):
            shader.inputs['Base Color'].default_value = (*spec['color'], 1)
            shader.inputs['Metallic'].default_value = spec['metalness']
            shader.inputs['Roughness'].default_value = spec['roughness']
    # Restrained physical micron-scale metal grain; no texture alters the illustration.
    nodes, links = material.node_tree.nodes, material.node_tree.links
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 1000
    noise.inputs['Detail'].default_value = 2
    noise.inputs['Roughness'].default_value = .65
    coords = nodes.new('ShaderNodeTexCoord')
    links.new(coords.outputs['Generated'], noise.inputs['Vector'])
    bump = nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = .045
    bump.inputs['Distance'].default_value = .000005
    links.new(noise.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], shader.inputs['Normal'])
    roughness = nodes.new('ShaderNodeMapRange')
    roughness.inputs['To Min'].default_value = shader.inputs['Roughness'].default_value - .02
    roughness.inputs['To Max'].default_value = shader.inputs['Roughness'].default_value + .025
    links.new(noise.outputs['Fac'], roughness.inputs['Value'])
    links.new(roughness.outputs[0], shader.inputs['Roughness'])

lights = [
    {'name': 'Large soft upper-left neutral key', 'position': [-.15, .1905, .18], 'target': [0, 0, 0], 'energy': 4.2, 'size': [.17, .22], 'color': [1, .985, .965]},
    {'name': 'Quiet neutral right bounce', 'position': [.17, .0355, .075], 'target': [0, 0, 0], 'energy': .40, 'size': [.085, .19], 'color': [.94, .97, 1]},
    {'name': 'Narrow ceiling edge reflection', 'position': [-.07, .1305, -.10], 'target': [0, 0, 0], 'energy': .8, 'size': [.055, .14], 'color': [1, .985, .97]},
]
for spec in lights:
    data = bpy.data.lights.new(spec['name'], 'AREA')
    data.energy = spec['energy']; data.shape = 'RECTANGLE'
    data.size, data.size_y = spec['size']; data.color = spec['color']
    obj = bpy.data.objects.new(spec['name'], data); scene.collection.objects.link(obj)
    obj.location = B(spec['position']); point(obj, spec['target'])

camera_position = [.070, .032, .340]
camera_target = [0, 0, 0]
data = bpy.data.cameras.new('Independent handheld card camera')
cam = bpy.data.objects.new(data.name, data); scene.collection.objects.link(cam)
cam.location = B(camera_position); point(cam, camera_target)
data.lens = 100; data.sensor_width = 36; data.sensor_fit = 'HORIZONTAL'
data.clip_start = .001; data.clip_end = 10; data.dof.use_dof = False
scene.camera = cam
bpy.context.view_layer.update()
vertices = [obj.matrix_world @ v.co for obj in card if obj.type == 'MESH' for v in obj.data.vertices]

def uv(point):
    v = world_to_camera_view(scene, cam, point)
    return [v.x, 1 - v.y]

def bounds():
    projected = [uv(v) for v in vertices]
    return [min(v[0] for v in projected), min(v[1] for v in projected), max(v[0] for v in projected), max(v[1] for v in projected)]

# Match a 3:4 hand photograph without changing the card geometry or camera angle.
initial_bounds = bounds()
data.lens *= .64 / (initial_bounds[3] - initial_bounds[1])
bpy.context.view_layer.update()
contact_world = [0, -.0455, .001]
contact = uv(Vector(B(contact_world)))
# Blender camera shifts are expressed in sensor-width units with HORIZONTAL fit.
data.shift_x = contact[0] - .5
data.shift_y = (.73 - contact[1]) / .75
bpy.context.view_layer.update()
projected_bounds = bounds()
contact = uv(Vector(B(contact_world)))
vertical_fov = math.degrees(2 * math.atan(36 / .75 / (2 * data.lens)))
front_quad = [uv(Vector(B(v))) for v in [[-.032, .0455, .001], [.032, .0455, .001], [.032, -.0455, .001], [-.032, -.0455, .001]]]
metadata = {
    'description': 'Independent transparent card render from the exact supplied GLB; no human, pedestal, glass or support is modeled.',
    'source_glb': 'public/assets/models/lotus-relief.glb', 'source_glb_sha256': EXPECTED_HASH,
    'source_geometry_changed': False, 'source_front_artwork_changed': False,
    'source_transform': {'position': [0, 0, 0], 'rotation': [0, 0, 0], 'scale': [1, 1, 1]},
    'coordinate_system': 'Three.js/glTF meters: +Y up, +Z relief face. Blender coordinates: (x,-z,y).',
    'renderer': 'Blender 4.3.2 Cycles CPU', 'samples': scene.cycles.samples, 'denoising': False,
    'dimensions_px': [scene.render.resolution_x, scene.render.resolution_y], 'reference_aspect': .75,
    'transparent': True, 'face': a.face,
    'camera': {'position': camera_position, 'target': camera_target, 'lens_mm': data.lens, 'sensor_width_mm': 36, 'vertical_fov_degrees': vertical_fov, 'shift_x': data.shift_x, 'shift_y': data.shift_y, 'projection_matrix_offsets': [2 * data.shift_x, 2 * data.shift_y * .75]},
    'card_dimensions_m': [.06400000303983688, .09099999815225601, .0031182285747490823],
    'card_bounds_normalized': projected_bounds, 'card_relief_quad_normalized': front_quad,
    'hand_contact': {'card_point_m': contact_world, 'normalized': contact, 'preferred_hand_support_y': .73, 'hand_bounds_y': [.70, 1]},
    'light_spec': lights, 'material_spec': material_spec,
    'composition_notes': 'Layer the entire raster at 0,0 in a 3:4 box, hand photograph below it. The hand is independent and can withdraw. The card remains an independent transformable element.',
    'verified': 'CPU render and projection metadata only; no browser GPU or physical AR claim.',
}
assert abs(contact[0] - .5) < 1e-5 and abs(contact[1] - .73) < 1e-5, contact
metadata_path = OUT / ('handheld-card' + ('-original' if a.face == 'original' else '') + '.metadata.json')
metadata_path.write_text(json.dumps(metadata, indent=2) + '\n')
print('HANDHELD_CAMERA_METADATA', json.dumps(metadata['camera']), flush=True)
print('HANDHELD_BOUNDS_CONTACT', json.dumps(projected_bounds), json.dumps(contact), flush=True)
if a.prepare_only:
    sys.exit(0)
# Optional reverse-face layer uses the exact embedded original texture, not an AI rewrite.
if a.face == 'original':
    for obj in card:
        obj.matrix_world = Matrix.Rotation(math.pi, 4, 'Z') @ obj.matrix_world
    bpy.context.view_layer.update()
    metadata['source_transform']['rotation'] = [0, math.pi, 0]
    vertices = [obj.matrix_world @ v.co for obj in card if obj.type == 'MESH' for v in obj.data.vertices]
    metadata['card_bounds_normalized'] = bounds()
    metadata['composition_notes'] += ' Original-face pass rotates the entire card 180 degrees about glTF Y.'
stem = ('handheld-relief' if a.face == 'relief' else 'handheld-front') + ('-preview' if a.preview else '')
scene.render.filepath = str(REPORT / (stem + '.png'))
bpy.ops.render.render(write_still=True)
if not a.preview:
    destination = OUT / (stem + '.webp')
    subprocess.run([shutil.which('python3') or 'python', '-c', "from PIL import Image;import sys,os;tmp=sys.argv[2]+'.tmp';Image.open(sys.argv[1]).save(tmp,'WEBP',lossless=True,method=6,exact=True);os.replace(tmp,sys.argv[2])", scene.render.filepath, str(destination)], check=True)
    metadata['output_asset'] = {'path': str(destination.relative_to(ROOT)), 'bytes': destination.stat().st_size, 'sha256': hashlib.sha256(destination.read_bytes()).hexdigest()}
    metadata['render_script_sha256'] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    metadata_path = OUT / ('handheld-card' + ('-original' if a.face == 'original' else '') + '.metadata.json')
    metadata_path.write_text(json.dumps(metadata, indent=2) + '\n')
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == EXPECTED_HASH
print('HANDHELD_CARD_RENDER_COMPLETE', stem, flush=True)
