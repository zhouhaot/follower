"""Physically based exhibition render from the supplied, unmodified card GLB.
Run: blender -b -t 8 --python scripts/render-documentary-exhibit.py -- --preview
Final: blender -b -t 8 --python scripts/render-documentary-exhibit.py
No photographic source, image generation, artwork repainting or bloom is used.
"""
import bpy, math, os, sys, json, hashlib, argparse, subprocess, shutil
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--preview',action='store_true');p.add_argument('--pass-name',default='layers',choices=['layers','all','complete','base','glass']);p.add_argument('--samples',type=int,default=256)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
OUT=ROOT/'public/assets/renders';OUT.mkdir(exist_ok=True)
RENDERS=ROOT/'reports/exhibit';RENDERS.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=48 if a.preview else a.samples
scene.cycles.use_denoising=False;scene.cycles.adaptive_threshold=.025 if a.preview else .008
scene.cycles.max_bounces=12;scene.cycles.transmission_bounces=10;scene.cycles.transparent_max_bounces=12
scene.cycles.glossy_bounces=5;scene.cycles.diffuse_bounces=4
scene.render.resolution_x=600 if a.preview else 1200;scene.render.resolution_y=700 if a.preview else 1400
scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.image_settings.color_depth='8'
scene.render.film_transparent=True;scene.cycles.film_transparent_glass=True;scene.cycles.film_transparent_roughness=.10
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=-.1
scene.world=bpy.data.worlds.new('Neutral gallery ambient');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.29,.30,.31,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.38
# All design dimensions below are Three.js / glTF meters: +Y up, +Z relief.
def B(v):return (v[0],-v[2],v[1])
def point(o,v):o.rotation_euler=(Vector(B(v))-o.location).to_track_quat('-Z','Y').to_euler()
def principled(name,color,metallic=0,rough=.5):
 m=bpy.data.materials.new(name);m.use_nodes=True;q=m.node_tree.nodes.get('Principled BSDF');q.inputs['Base Color'].default_value=(*color,1);q.inputs['Metallic'].default_value=metallic;q.inputs['Roughness'].default_value=rough;return m

def cuboid(name,loc,size,mat,bevel=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=B(loc));o=bpy.context.object;o.name=name;o.dimensions=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat)
 if bevel:
  m=o.modifiers.new('Real machined edge radius','BEVEL');m.width=bevel;m.segments=4
  m=o.modifiers.new('Weighted surface normals','WEIGHTED_NORMAL');m.keep_sharp=True
 return o

def texture_metal(m):
 q=m.node_tree.nodes.get('Principled BSDF');n=m.node_tree.nodes;l=m.node_tree.links
 tex=n.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=1000;tex.inputs['Detail'].default_value=2;tex.inputs['Roughness'].default_value=.65
 tc=n.new('ShaderNodeTexCoord');l.new(tc.outputs['Generated'],tex.inputs['Vector'])
 bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.07;bump.inputs['Distance'].default_value=.000008;l.new(tex.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs['Normal'],q.inputs['Normal'])
 ramp=n.new('ShaderNodeMapRange');ramp.inputs['From Min'].default_value=0;ramp.inputs['From Max'].default_value=1;rough=q.inputs['Roughness'].default_value;ramp.inputs['To Min'].default_value=rough-.025;ramp.inputs['To Max'].default_value=rough+.035;l.new(tex.outputs['Fac'],ramp.inputs['Value']);l.new(ramp.outputs[0],q.inputs['Roughness'])

source=ROOT/'public/assets/models/lotus-relief.glb'
bpy.ops.import_scene.gltf(filepath=str(source));card=list(scene.objects)
for o in card:o.location.z+=.0795
for m in bpy.data.materials:
 if m.name.startswith('FRONT'):continue # Original front image and its material are preserved.
 if not m.use_nodes:continue
 q=m.node_tree.nodes.get('Principled BSDF')
 if m.name.startswith('01'):
  q.inputs['Base Color'].default_value=(.20,.203,.198,1);q.inputs['Metallic'].default_value=.88;q.inputs['Roughness'].default_value=.32
 elif m.name.startswith('02'):
  q.inputs['Base Color'].default_value=(.38,.385,.37,1);q.inputs['Metallic'].default_value=.86;q.inputs['Roughness'].default_value=.31
 elif m.name.startswith('05'):
  q.inputs['Base Color'].default_value=(.43,.435,.42,1);q.inputs['Metallic'].default_value=.88;q.inputs['Roughness'].default_value=.29
 elif m.name.startswith('03'):
  q.inputs['Base Color'].default_value=(.40,.34,.24,1);q.inputs['Metallic'].default_value=.86;q.inputs['Roughness'].default_value=.31
 texture_metal(m)
# Honed basalt-like stone: volumetric texture at two physical scales, real bevel.
stone=principled('Honed charcoal stone · physical microtexture',(.026,.028,.029),0,.55)
n=stone.node_tree.nodes;l=stone.node_tree.links;q=n.get('Principled BSDF');tc=n.new('ShaderNodeTexCoord')
noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=380;noise.inputs['Detail'].default_value=5;noise.inputs['Roughness'].default_value=.73;l.new(tc.outputs['Object'],noise.inputs['Vector'])
col=n.new('ShaderNodeValToRGB');col.color_ramp.elements[0].position=.18;col.color_ramp.elements[0].color=(.007,.008,.009,1);col.color_ramp.elements[1].position=.82;col.color_ramp.elements[1].color=(.023,.025,.026,1);l.new(noise.outputs['Fac'],col.inputs[0]);l.new(col.outputs['Color'],q.inputs['Base Color'])
fine=n.new('ShaderNodeTexNoise');fine.inputs['Scale'].default_value=12000;fine.inputs['Detail'].default_value=2;l.new(tc.outputs['Object'],fine.inputs['Vector'])
bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.23;bump.inputs['Distance'].default_value=.000065;l.new(fine.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs['Normal'],q.inputs['Normal'])
plinth=cuboid('Solid honed stone plinth',(0,.0125,0),(.105,.025,.052),stone,.0009)
# A fine physical shadow gap and seating insert place the cover on the stone.
seatmat=principled('Black vitrine seating gasket',(.006,.0065,.007),.05,.75)
seat=cuboid('Glass seating gasket',(0,.02504,0),(.092,.00025,.041),seatmat,.00025)
seat.data.materials.clear();seat.data.materials.append(stone)
bronze=principled('Dark satin bronze mounting hardware',(.055,.045,.029),.83,.31)
supports=[]
for x in [-.023,.023]:
 supports.append(cuboid('Low museum mount foot',(x,.02585,0),(.009,.0018,.013),bronze,.00045))
 supports.append(cuboid('Card mounting upright',(x,.0302,-.0008),(.0032,.0083,.0042),bronze,.0004))
 supports.append(cuboid('Small retaining lip',(x,.0341,.00135),(.0042,.0028,.0012),bronze,.00025))
# Five solid panels, no duplicate overlaid card plane or painted glass shine.
glass=principled('Low-iron museum glass · 0.7 mm',(.97,.985,.98),0,.003)
gp=glass.node_tree.nodes.get('Principled BSDF');gp.inputs['Transmission Weight'].default_value=1;gp.inputs['IOR'].default_value=1.46
# Straight-line transparent shadow rays avoid planar-glass caustic noise.
# Surface transmission/reflection and pane thickness remain physically modeled.
gn=glass.node_tree.nodes;gl=glass.node_tree.links;lp=gn.new('ShaderNodeLightPath');tr=gn.new('ShaderNodeBsdfTransparent');mx=gn.new('ShaderNodeMixShader');gl.new(lp.outputs['Is Shadow Ray'],mx.inputs[0]);gl.new(gp.outputs['BSDF'],mx.inputs[1]);gl.new(tr.outputs['BSDF'],mx.inputs[2]);gl.new(mx.outputs[0],gn.get('Material Output').inputs['Surface'])
absorb=glass.node_tree.nodes.new('ShaderNodeVolumeAbsorption');absorb.inputs['Color'].default_value=(.66,.80,.72,1);absorb.inputs['Density'].default_value=3;glass.node_tree.links.new(absorb.outputs['Volume'],glass.node_tree.nodes.get('Material Output').inputs['Volume'])
cover=[]
for z in [-.01965,.01965]:cover.append(cuboid('Glass front/back panel',(0,.08215,z),(.091,.1143,.0007),glass,.00010))
for x in [-.04515,.04515]:cover.append(cuboid('Glass side panel',(x,.08215,0),(.0007,.1143,.0386),glass,.00010))
cover.append(cuboid('Glass top panel',(0,.13965,0),(.091,.0007,.040),glass,.00010))
# Dark floor gives a real shadow receiving plane; transparent version uses Cycles shadow catcher.
floormat=principled('Matte gallery floor',(.006,.007,.008),0,.87)
floor=cuboid('Gallery floor contact shadow',(0,-.001,0),(.9,.002,.9),floormat,0);floor.is_shadow_catcher=True
# Large naturalistic softbox key, modest side bounce, overhead accent.
def area(name,pos,target,energy,size,size_y,color):
 d=bpy.data.lights.new(name,'AREA');d.energy=energy;d.shape='RECTANGLE';d.size=size;d.size_y=size_y;d.color=color;o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=B(pos);point(o,target);return o
area('Large soft gallery key',(-.15,.27,.18),(0,.075,0),4.2,.17,.22,(1,.956,.895))
area('Quiet neutral bounce',(.17,.115,.075),(0,.073,0),.40,.085,.19,(.87,.93,1.0))
area('Narrow ceiling reflection',(-.07,.21,-.10),(0,.075,0),.8,.055,.14,(1,.97,.92))
# High focal length, subtle right-hand viewpoint. Physical perspective, no distortion.
camdata=bpy.data.cameras.new('Documentary exhibit camera');cam=bpy.data.objects.new('Documentary exhibit camera',camdata);scene.collection.objects.link(cam)
cam.location=B((.105,.123,.300));point(cam,(0,.069,0));camdata.lens=80;camdata.sensor_width=36;camdata.sensor_fit='HORIZONTAL';camdata.clip_start=.001;camdata.clip_end=10
scene.camera=cam;camdata.dof.use_dof=False
baseobjects=card+[plinth,seat,floor]+supports
# Provenance records the immutable source and the presentation-only scene.
metadata={'description':'Simulated gallery exhibit, CPU path-traced from actual supplied card geometry. This is not a museum photograph.','source_glb':'public/assets/models/lotus-relief.glb','source_glb_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'renderer':'Blender 4.3 Cycles CPU','sampling':scene.cycles.samples,'denoising':False,'planar_glass_shadow_approximation':'Clear shadow rays; surface reflection, transmission, 0.7mm wall thickness and Fresnel remain modeled','dimensions_px':[scene.render.resolution_x,scene.render.resolution_y],'coordinate_system':'Three.js / glTF: meters, +Y up, +Z relief face. Blender mapping: (x,-z,y).','card_center':[0,.0795,0],'card_geometry_changed':False,'original_front_artwork_changed':False,'camera':{'position':[.105,.123,.300],'target':[0,.069,0],'focal_length_mm':80,'sensor_width_mm':36,'vertical_fov_degrees':math.degrees(2*math.atan(36/(scene.render.resolution_x/scene.render.resolution_y)/(2*80)))},'plinth':{'size':[.105,.025,.052],'center':[0,.0125,0],'bevel':.0009},'glass':{'outer_size':[.091,.115,.040],'bottom_y':.025,'wall_thickness':.0007,'ior':1.46,'roughness':.003},'layer_notes':'Base excludes cover. Glass layer is physically rendered cover in isolation with no card, plinth or floor in any ray visibility. This removes secondary ghost artwork/reflections, enabling a clean removable overlay. Both images use exactly the same camera, crop and color transform. Glass refraction displacement is approximated in the CSS composite, with thin low-iron panes minimizing mismatch. Complete still is a reference full physical render. No glow, fog, bloom, painted reflections, or AI image edits.'}
passes=['base','glass'] if a.pass_name=='layers' else (['complete','base','glass'] if a.pass_name=='all' else [a.pass_name])
for mode in passes:
 for o in cover:o.hide_render=mode=='base'
 for o in baseobjects:
  o.visible_camera=mode!='glass';o.visible_transmission=mode!='glass';o.hide_render=mode=='glass'
 # Full composite still uses a continuous actual gallery floor; separated assets keep alpha.
 floor.is_shadow_catcher=mode!='complete'
 scene.render.film_transparent=mode!='complete'
 # Keep the same neutral indirect illumination in every pass.
 scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.29,.30,.31,1)
 stem='hero-exhibit-'+mode+('-preview' if a.preview else '')
 scene.render.filepath=str(RENDERS/(stem+'.png'));bpy.ops.render.render(write_still=True)
 if not a.preview and mode in ['base','glass']:
  subprocess.run([shutil.which('python') or 'python3','-c',"from PIL import Image;import sys,os;tmp=sys.argv[2]+'.tmp';Image.open(sys.argv[1]).save(tmp, 'WEBP', quality=94, method=6, exact=True);os.replace(tmp,sys.argv[2])",scene.render.filepath,str(OUT/(stem+'.webp'))],check=True)
if not a.preview:
 metadata['output_assets']={}
 for part in ['base','glass']:
  asset=OUT/('hero-exhibit-'+part+'.webp')
  if asset.exists():metadata['output_assets'][asset.name]={'bytes':asset.stat().st_size,'sha256':hashlib.sha256(asset.read_bytes()).hexdigest(),'dimensions_px':[scene.render.resolution_x,scene.render.resolution_y]}
 metadata['render_script_sha256']=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
 destination=OUT/'hero-exhibit.metadata.json';temporary=destination.with_suffix('.json.tmp');temporary.write_text(json.dumps(metadata,indent=2)+'\n');temporary.replace(destination)
print('EXHIBIT_RENDER_COMPLETE',passes)
