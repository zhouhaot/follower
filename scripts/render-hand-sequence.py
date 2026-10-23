"""Continuously articulated 25-joint hand, rendered as transparent absolute poses.
Source: official immersive-web WebXR Input Profiles generic right hand (MIT).
The same weighted mesh, rig, camera, light and procedural skin are used in every frame.
"""
import bpy,bmesh,json,math,sys,argparse,hashlib,subprocess
from pathlib import Path
from mathutils import Matrix,Vector
from bpy_extras.object_utils import world_to_camera_view
R=Path(__file__).resolve().parents[1]
a=argparse.ArgumentParser();a.add_argument('--preview',action='store_true');a.add_argument('--frames',default='0,16,31');a.add_argument('--samples',type=int,default=64);a.add_argument('--no-card',action='store_true');a.add_argument('--shadow-card',action='store_true');a.add_argument('--placement',choices=['behind','front'],default='front');a.add_argument('--output');a.add_argument('--texture');a.add_argument('--variant-compare',action='store_true');a.add_argument('--state-output');a=a.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=20 if a.preview else a.samples;s.cycles.use_denoising=False;s.cycles.adaptive_threshold=.045 if a.preview else .018;s.cycles.max_bounces=6;s.cycles.diffuse_bounces=3;s.cycles.glossy_bounces=3
s.render.resolution_x=360 if a.preview else 720;s.render.resolution_y=480 if a.preview else 960;s.render.resolution_percentage=100;s.render.film_transparent=True;s.render.use_persistent_data=True;s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA';s.view_settings.view_transform='AgX';s.view_settings.look='AgX - Medium High Contrast';s.view_settings.exposure=-.1
s.world=bpy.data.worlds.new('Quiet neutral gallery');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.29,.30,.31,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.38
B=lambda v:Vector((v[0],-v[2],v[1]))
meta=json.loads((R/'public/assets/renders/handheld-card.metadata.json').read_text())
for spec in meta['light_spec']:
 d=bpy.data.lights.new(spec['name'],'AREA');d.energy=spec['energy'];d.shape='RECTANGLE';d.size,d.size_y=spec['size'];d.color=spec['color'];o=bpy.data.objects.new(d.name,d);s.collection.objects.link(o);o.location=B(spec['position']);o.rotation_euler=(B(spec['target'])-o.location).to_track_quat('-Z','Y').to_euler()
c=meta['camera'];d=bpy.data.cameras.new('Registered card camera');cam=bpy.data.objects.new(d.name,d);s.collection.objects.link(cam);cam.location=B(c['position']);cam.rotation_euler=(B(c['target'])-cam.location).to_track_quat('-Z','Y').to_euler();d.lens=c['lens_mm'];d.sensor_width=c['sensor_width_mm'];d.sensor_fit='HORIZONTAL';d.shift_x=c['shift_x'];d.shift_y=c['shift_y'];d.clip_start=.001;s.camera=cam
if not a.no_card or a.shadow_card:
 bpy.ops.import_scene.gltf(filepath=str(R/'public/assets/models/lotus-relief.glb'))
 for o in s.objects:
  if o.type=='MESH':
   o.is_holdout=not a.shadow_card
   if a.shadow_card:o.visible_camera=False
before=set(s.objects)
bpy.ops.import_scene.gltf(filepath=str(R/'work/hand-rig/source/generic-hand-right.glb'))
arm=next(o for o in s.objects if o not in before and o.type=='ARMATURE');hand=next(o for o in s.objects if o not in before and o.type=='MESH' and o.name.startswith('r_hand'))
for o in list(s.objects):
 if o not in before and o.type=='MESH' and o!=hand:bpy.data.objects.remove(o,do_unlink=True)
for modifier in hand.modifiers:
 if modifier.type=='ARMATURE':modifier.use_deform_preserve_volume=True
# Extend the existing open wrist boundary as a connected forearm, outside crop.
bm=bmesh.new();bm.from_mesh(hand.data);boundary=[e for e in bm.edges if e.is_boundary and min(v.co.z for v in e.verts)>.055]
if boundary:
 for length,width in [(.055,1.04),(.075,1.06)]:
  out=bmesh.ops.extrude_edge_only(bm,edges=boundary);vs=[x for x in out['geom'] if isinstance(x,bmesh.types.BMVert)];cent=sum((v.co for v in vs),Vector())/len(vs)
  for v in vs:v.co.x=cent.x+(v.co.x-cent.x)*width;v.co.y=cent.y+(v.co.y-cent.y)*width;v.co.z+=length
  boundary=[e for e in out['geom'] if isinstance(e,bmesh.types.BMEdge) and e.is_boundary]
 bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7)
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
 bm.to_mesh(hand.data)
bm.free()
bpy.context.view_layer.objects.active=hand
try:bpy.ops.mesh.customdata_custom_splitnormals_clear()
except RuntimeError:pass
for p in hand.data.polygons:p.use_smooth=True
sub=hand.modifiers.new('Smooth anatomical surface','SUBSURF');sub.levels=2;sub.render_levels=2
# Physically modest multi-scale skin; pore bump is measured in fractions of a millimeter.
mat=bpy.data.materials.new('Warm living skin');mat.use_nodes=True;n=mat.node_tree.nodes;l=mat.node_tree.links;bs=n.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.48,.245,.135,1);bs.inputs['Roughness'].default_value=.49;bs.inputs['IOR'].default_value=1.43;bs.inputs['Subsurface Weight'].default_value=.16;bs.inputs['Subsurface Radius'].default_value=(1,.46,.24);bs.inputs['Subsurface Scale'].default_value=.0026
coord=n.new('ShaderNodeTexCoord');noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=125;noise.inputs['Detail'].default_value=3;l.new(coord.outputs['Object'],noise.inputs['Vector']);ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.12;ramp.color_ramp.elements[0].color=(.36,.145,.075,1);ramp.color_ramp.elements[1].position=.88;ramp.color_ramp.elements[1].color=(.53,.28,.17,1);l.new(noise.outputs['Fac'],ramp.inputs[0]);l.new(ramp.outputs['Color'],bs.inputs['Base Color'])
pores=n.new('ShaderNodeTexNoise');pores.inputs['Scale'].default_value=2200;pores.inputs['Detail'].default_value=2.5;pores.inputs['Roughness'].default_value=.75;l.new(coord.outputs['Object'],pores.inputs['Vector']);bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.21;bump.inputs['Distance'].default_value=.000055;l.new(pores.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs['Normal'],bs.inputs['Normal']);rough=n.new('ShaderNodeMapRange');rough.inputs['To Min'].default_value=.42;rough.inputs['To Max'].default_value=.56;l.new(pores.outputs['Fac'],rough.inputs['Value']);l.new(rough.outputs[0],bs.inputs['Roughness']);hand.data.materials.clear();hand.data.materials.append(mat)
# Stable rest-space surface attributes keep pores and creases attached during deformation.
attr=hand.data.attributes.new(name='skin_rest',type='FLOAT_VECTOR',domain='POINT')
for v,datum in zip(hand.data.vertices,attr.data):datum.vector=v.co
resttex=n.new('ShaderNodeAttribute');resttex.attribute_name='skin_rest'
l.new(resttex.outputs['Vector'],noise.inputs['Vector']);l.new(resttex.outputs['Vector'],pores.inputs['Vector'])
sep=n.new('ShaderNodeSeparateXYZ');l.new(resttex.outputs['Vector'],sep.inputs[0]);yz=n.new('ShaderNodeCombineXYZ');l.new(sep.outputs['Y'],yz.inputs['Y']);l.new(sep.outputs['Z'],yz.inputs['Z'])
def vec(op,a,b=None):
 q=n.new('ShaderNodeVectorMath');q.operation=op
 if hasattr(a,'bl_idname'):l.new(a,q.inputs[0])
 else:q.inputs[0].default_value=a
 if b is not None:
  if hasattr(b,'bl_idname'):l.new(b,q.inputs[1])
  else:q.inputs[1].default_value=b
 return q.outputs['Value'] if op in ['DOT_PRODUCT','DISTANCE','LENGTH'] else q.outputs['Vector']
def mathn(op,a,b):
 q=n.new('ShaderNodeMath');q.operation=op
 for v,inp in zip([a,b],q.inputs):
  if hasattr(v,'bl_idname'):l.new(v,inp)
  else:inp.default_value=v
 return q.outputs[0]
def line_distance(p,a,b):
 av=Vector((0,*a));bv=Vector((0,*b));dv=bv-av;delta=vec('SUBTRACT',p,av);t=mathn('DIVIDE',vec('DOT_PRODUCT',delta,dv),dv.length_squared);t=mathn('MINIMUM',mathn('MAXIMUM',t,0),1)
 scale=n.new('ShaderNodeVectorMath');scale.operation='SCALE';scale.inputs[0].default_value=dv;l.new(t,scale.inputs[3]);near=vec('ADD',scale.outputs[0],av);return vec('DISTANCE',p,near)
paths=[[(.025,-.027),(.010,-.010),(.010,.010),(-.001,.036)],[(-.035,-.025),(-.012,-.019),(.010,-.027),(.025,-.037)],[(-.044,-.038),(-.022,-.042),(.001,-.040),(.018,-.037)],[(-.028,.044),(-.010,.049),(.008,.046)]]
# Small transverse flexion folds across each finger at anatomical joints.
for b in arm.data.bones:
 if ('intermediate' in b.name or 'distal' in b.name) and 'thumb' not in b.name:
  q=b.head_local;paths.append([(q.y-.004,q.z+.001),(q.y+.004,q.z-.0006)])
distance=None
for path in paths:
 for pa,pb in zip(path[:-1],path[1:]):
  dseg=line_distance(yz.outputs[0],pa,pb);distance=dseg if distance is None else mathn('MINIMUM',distance,dseg)
line=n.new('ShaderNodeMapRange');line.clamp=True;line.inputs['From Min'].default_value=.00008;line.inputs['From Max'].default_value=.00065;line.inputs['To Min'].default_value=1;line.inputs['To Max'].default_value=0;l.new(distance,line.inputs['Value'])
palm=n.new('ShaderNodeMapRange');palm.clamp=True;palm.inputs['From Min'].default_value=.027;palm.inputs['From Max'].default_value=.044;l.new(sep.outputs['X'],palm.inputs['Value']);crease=mathn('MULTIPLY',line.outputs[0],palm.outputs[0]);crease=mathn('MULTIPLY',crease,.55)
wrinkle=n.new('ShaderNodeBump');wrinkle.invert=True;wrinkle.inputs['Strength'].default_value=.42;wrinkle.inputs['Distance'].default_value=.00018;l.new(crease,wrinkle.inputs['Height']);l.new(bump.outputs[0],wrinkle.inputs['Normal']);l.new(wrinkle.outputs[0],bs.inputs['Normal'])
mix=n.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[2].default_value=(.70,.61,.58,1);l.new(crease,mix.inputs[0]);l.new(ramp.outputs[0],mix.inputs[1]);l.new(mix.outputs[0],bs.inputs['Base Color'])

# Source space: +X is the palm normal. The palm is exactly parallel to the
# camera sensor. Finger spread happens about that normal, in the screen plane.
N=(cam.location-B(c['target'])).normalized()
U=cam.rotation_euler.to_quaternion()@Vector((0,1,0))
H=cam.rotation_euler.to_quaternion()@Vector((1,0,0))
D=(U*.998-H*.06).normalized();Y=D.cross(N).normalized()
rot=Matrix((N,Y,-D)).transposed().to_4x4();scale=.62 if a.placement=='behind' else .45
anchor=Vector((.036,-.008,.014));target=(-N*.038-U*.044) if a.placement=='behind' else (N*.058-U*.045)
root_drop=0 if a.placement=='behind' else .017
transform=Matrix.Translation(target)@rot@Matrix.Scale(scale,4)@Matrix.Translation(-anchor);arm.matrix_world=transform
# Flat WebXR bone transforms are driven by hierarchical rigid deltas without changing weights/bind matrices.
rest={b.name:b.matrix_local.copy() for b in arm.data.bones};head={b.name:b.head_local.copy() for b in arm.data.bones}
chains=[]
for finger in ['thumb','index-finger','middle-finger','ring-finger','pinky-finger']:
 names=[finger+'-metacarpal',finger+'-phalanx-proximal']
 if finger!='thumb':names += [finger+'-phalanx-intermediate']
 names += [finger+'-phalanx-distal',finger+'-tip'];chains.append((finger,names))
# Anatomical dorsal nail plates follow the same distal skeletal transforms.
from mathutils.bvhtree import BVHTree
bvh=BVHTree.FromPolygons([v.co.copy() for v in hand.data.vertices],[list(p.vertices) for p in hand.data.polygons],all_triangles=False)
nailmat=bpy.data.materials.new('Subtle translucent nail plates');nailmat.use_nodes=True;nbs=nailmat.node_tree.nodes.get('Principled BSDF');nbs.inputs['Base Color'].default_value=(.49,.305,.235,1);nbs.inputs['Roughness'].default_value=.32;nbs.inputs['IOR'].default_value=1.47;nbs.inputs['Subsurface Weight'].default_value=.08;nbs.inputs['Subsurface Scale'].default_value=.0007
for finger,names in []: # Dorsal nail plates intentionally omitted; no artificial caps.
 distal=names[-2];tip=names[-1];a0=head[distal];b0=head[tip];center=a0.lerp(b0,.58);length=(b0-a0).length*.8;width=.009 if finger=='thumb' else (.0058 if finger=='pinky-finger' else .0074)
 along=(b0-a0).normalized();across=Vector((0,-along.z,along.y)).normalized();vertices=[];faces=[];nu,nv=10,14
 for j in range(nv+1):
  v=j/nv*2-1
  for k in range(nu+1):
   u=k/nu*2-1;wid=width*.5*(.80+.20*math.sqrt(max(0,1-v*v)));q=center+along*(length*.5*v)+across*(wid*u);hit=bvh.ray_cast(Vector((-.15,q.y,q.z)),Vector((1,0,0)))
   q.x=(hit[0].x if hit[0] else q.x-.006)-.00013-.00023*(1-u*u)*(1-v*v);vertices.append(q)
 for j in range(nv):
  for k in range(nu):
   i=j*(nu+1)+k;faces.append((i,i+1,i+nu+2,i+nu+1))
 mesh=bpy.data.meshes.new(finger+' nail surface');mesh.from_pydata(vertices,[],faces);mesh.materials.append(nailmat);ob=bpy.data.objects.new(finger+' nail plate',mesh);s.collection.objects.link(ob);ob.parent=arm;vg=ob.vertex_groups.new(name=distal);vg.add(list(range(len(vertices))),1,'REPLACE');mod=ob.modifiers.new('Continuous nail articulation','ARMATURE');mod.object=arm
 for face in mesh.polygons:face.use_smooth=True
 subn=ob.modifiers.new('Rounded nail edge','SUBSURF');subn.levels=1;subn.render_levels=1

PRESETS={'FRONT':{'angles':[12,6,2],'anglesEnd':[0,0,0],
 'adduction':[-12,-3,7,16],'adductionEnd':[5,0,-6,-13],
 'thumb':-16,'thumbEnd':8,'tilt':0,'lower':0}}
current_preset='FRONT'
def pose(p):
 spec=PRESETS[current_preset]
 # No wrist pitch: fingers fan in the sensor plane while root optionally lowers.
 arm.matrix_world=Matrix.Translation(-U*(root_drop*p))@transform
 for b in arm.pose.bones:b.matrix=rest[b.name]
 for fi,(finger,names) in enumerate(chains):
  cumulative=Matrix.Identity(4)
  for k,name in enumerate(names):
   ang=0
   if finger=='thumb':ang=([3,7,4,0][k])*(1-p)
   elif k in [1,2,3]:ang=spec['angles'][k-1]*(1-p)
   if (finger=='thumb' and k==0) or (finger!='thumb' and k==1):
    start=spec['thumb'] if finger=='thumb' else spec['adduction'][fi-1]
    end=spec['thumbEnd'] if finger=='thumb' else spec['adductionEnd'][fi-1]
    spread=start*(1-p)+end*p
    cumulative=cumulative@Matrix.Translation(head[name])@Matrix.Rotation(math.radians(spread),4,'X')@Matrix.Translation(-head[name])
   if ang:
    axis=Vector((0,1,0)) if finger!='thumb' else Vector((0,.6,.8)).normalized()
    cumulative=cumulative@Matrix.Translation(head[name])@Matrix.Rotation(-math.radians(ang),4,axis)@Matrix.Translation(-head[name])
   arm.pose.bones[name].matrix=cumulative@rest[name]
 bpy.context.view_layer.update()
# Project an approved shape-preserving open-palm appearance onto persistent UVs.
# Only albedo detail is sampled. All subsequent images are renders of this same rig.
if a.texture:
 # UVs are copied bit-for-bit from the accepted prior topology. Reprojecting
 # against this new camera orientation would stretch or move the baked creases.
 registration=json.loads((R/'work/hand-rig/skin-uv-registration.json').read_text())
 assert len(hand.data.vertices)==registration['vertexCount']
 # BMesh seam welding may reorder indices between runs. Match rest positions,
 # not transient indices; projected UVs are identical across incident loops.
 oldverts=registration['vertices'];mapped=[]
 for vertex in hand.data.vertices:
  nearest=min(oldverts,key=lambda item:(Vector(item['co'])-vertex.co).length_squared)
  assert (Vector(nearest['co'])-vertex.co).length<1e-7
  mapped.append(nearest['uv'])
 uv=hand.data.uv_layers.get('CameraSkin') or hand.data.uv_layers.new(name='CameraSkin')
 for loop in hand.data.loops:uv.data[loop.index].uv=mapped[loop.vertex_index]
 tex=n.new('ShaderNodeTexImage');tex.name='Stable generated skin surface detail';tex.image=bpy.data.images.load(str(R/a.texture));tex.image.colorspace_settings.name='Non-Color';tex.extension='CLIP';uvnode=n.new('ShaderNodeUVMap');uvnode.uv_map='CameraSkin';l.new(uvnode.outputs[0],tex.inputs[0])
 decode=n.new('ShaderNodeVectorMath');decode.operation='SCALE';decode.inputs[3].default_value=4;l.new(tex.outputs['Color'],decode.inputs[0]);tint=n.new('ShaderNodeMixRGB');tint.blend_type='MULTIPLY';l.new(tex.outputs['Alpha'],tint.inputs[0]);l.new(mix.outputs[0],tint.inputs[1]);l.new(decode.outputs[0],tint.inputs[2]);l.new(tint.outputs[0],bs.inputs['Base Color'])
 # The old projection ended at the lower image edge. Blend its albedo into
 # procedural skin in rest UV space so the expanded framing has no wrist band.
 uvsep=n.new('ShaderNodeSeparateXYZ');l.new(uvnode.outputs[0],uvsep.inputs[0])
 uvfade=n.new('ShaderNodeMapRange');uvfade.clamp=True;uvfade.inputs['From Min'].default_value=0;uvfade.inputs['From Max'].default_value=.10;l.new(uvsep.outputs['Y'],uvfade.inputs['Value'])
 skin_detail_weight=mathn('MULTIPLY',tex.outputs['Alpha'],uvfade.outputs[0]);l.new(skin_detail_weight,tint.inputs[0])
 # Texture-derived skin furrows supplement tiny physical pore relief.
 texture_bump=n.new('ShaderNodeBump');texture_bump.inputs['Strength'].default_value=.18;l.new(mathn('MULTIPLY',skin_detail_weight,.18),texture_bump.inputs['Strength']);texture_bump.inputs['Distance'].default_value=.00022;l.new(tex.outputs['Color'],texture_bump.inputs['Height']);l.new(wrinkle.outputs[0],texture_bump.inputs['Normal']);l.new(texture_bump.outputs[0],bs.inputs['Normal'])
 bpy.context.view_layer.update()

# Retain the same continuous skeletal animation in the editable Blender deliverable.
s.frame_start=1;s.frame_end=32;s.render.fps=30
arm.rotation_mode='QUATERNION'
for pb in arm.pose.bones:pb.rotation_mode='QUATERNION'
for frame_index in range(32):
 s.frame_set(frame_index+1);pose(frame_index/31)
 for channel in ['location','rotation_quaternion','scale']:arm.keyframe_insert(data_path=channel,frame=frame_index+1)
 for pb in arm.pose.bones:
  pb.keyframe_insert(data_path='location',frame=frame_index+1);pb.keyframe_insert(data_path='rotation_quaternion',frame=frame_index+1);pb.keyframe_insert(data_path='scale',frame=frame_index+1)
if arm.animation_data and arm.animation_data.action:
 for curve in arm.animation_data.action.fcurves:
  for point in curve.keyframe_points:point.interpolation='LINEAR'

out=R/a.output if a.output else R/('reports/hand-rig/preview' if a.preview else 'work/hand-rig/frames');out.mkdir(parents=True,exist_ok=True)
if a.variant_compare:
 for variant in PRESETS:
  current_preset=variant;s.frame_set(1);pose(0);s.render.filepath=str(out/f'closed-{variant}.png');bpy.ops.render.render(write_still=True);print('CLOSED_VARIANT_DONE',variant,flush=True)
 sys.exit(0)
for i in [int(v) for v in a.frames.split(',')]:
 s.frame_set(i+1);pose(i/31);s.render.filepath=str(out/f'hand-{i:03}.png');bpy.ops.render.render(write_still=True);print('HAND_POSE_DONE',i,flush=True)
 if i==0:
  bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(out/'front-facing-preview.blend' if a.preview else R/'work/hand-rig/continuous-hand-rig.blend'))

(R/a.state_output if a.state_output else out/'render-state.json' if a.preview else R/'reports/hand-rig/render-state.json').write_text(json.dumps({'samples':s.cycles.samples,'resolution':[s.render.resolution_x,s.render.resolution_y],'texture':a.texture,'derivedMeshVertices':len(hand.data.vertices),'poseVariant':current_preset,'poseSpecification':PRESETS[current_preset],'preserveVolume':True,'clearedCustomNormals':True,'nailPlateCount':0,'render_script_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'weightedBones':len(arm.data.bones),'rootMatrix':list(map(list,transform)),'rootDisplacement':list(-U*root_drop),'placement':a.placement,'rootDropMeters':root_drop,'palmNormal':list(N),'cameraFacingNormal':list((cam.location-B(c['target'])).normalized()),'palmNormalCameraAxisDot':float(N.dot((cam.location-B(c['target'])).normalized())),'palmAngleDegrees':0.0,'stableUvSource':'work/hand-rig/skin-uv-registration.json','stableUvSourceSha256':hashlib.sha256((R/'work/hand-rig/skin-uv-registration.json').read_bytes()).hexdigest(),'fingerAnglesStart':PRESETS[current_preset]['angles'],'fingerAnglesEnd':[0,0,0],'renderSeed':s.cycles.seed,'persistentCamera':True},indent=2)+'\n')
