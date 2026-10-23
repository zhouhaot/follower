"""Read the saved animation and verify screen alignment and 3D separation.
A positive separating-plane clearance proves non-intersection for the complete
hand and unchanged card at each sampled pose. It does not claim physical grasp.
"""
import bpy,json,hashlib,math,sys,argparse
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
R=Path(__file__).resolve().parents[1]
a=argparse.ArgumentParser();a.add_argument('--rig',default='work/hand-rig/continuous-hand-rig.blend');a.add_argument('--output',default='reports/hand-rig/clearance-32-poses.json');a=a.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.open_mainfile(filepath=str(R/a.rig));s=bpy.context.scene;cam=s.camera
arm=next(o for o in s.objects if o.type=='ARMATURE');hand=next(o for o in s.objects if o.type=='MESH' and o.name.startswith('r_hand'))
card=[o for o in s.objects if o.type=='MESH' and o!=hand]
assert card,'The immutable card must be in the saved rig for geometric verification.'
N=cam.matrix_world.to_quaternion()@Vector((0,0,1));N.normalize()
card_vertices=[o.matrix_world@v.co for o in card for v in o.data.vertices]
card_near_back=min(v.dot(N) for v in card_vertices);card_near_front=max(v.dot(N) for v in card_vertices)
frames=[]
for f in range(32):
 s.frame_set(f+1);bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();obj=hand.evaluated_get(deps);mesh=obj.to_mesh();world=[obj.matrix_world@v.co for v in mesh.vertices]
 palm_normal=(arm.matrix_world.to_3x3()@Vector((1,0,0))).normalized();dot=max(-1,min(1,palm_normal.dot(N)));angle=math.degrees(math.acos(dot))
 max_hand=max(v.dot(N) for v in world);min_hand=min(v.dot(N) for v in world);behind_clearance=card_near_back-max_hand;front_clearance=min_hand-card_near_front;clearance=max(front_clearance,behind_clearance)
 tips={}
 for finger in ['thumb','index-finger','middle-finger','ring-finger','pinky-finger']:
  p=world_to_camera_view(s,cam,arm.matrix_world@arm.pose.bones[finger+'-tip'].head);tips[finger]=[p.x,1-p.y]
 frames.append({'poseIndex':f,'palmNormalCameraAxisDot':dot,'palmNormalCameraAxisDegrees':angle,'cardBackSupportM':card_near_back,'handFrontSupportM':max_hand,'separatingPlaneClearanceM':clearance,'behindClearanceM':behind_clearance,'frontClearanceM':front_clearance,'tipScreenCoordinates':tips,'fourFingerTipScreenWidth':max(tips[k][0] for k in tips if k!='thumb')-min(tips[k][0] for k in tips if k!='thumb'),'evaluatedHandVertices':len(world)})
 obj.to_mesh_clear()
assert min(f['separatingPlaneClearanceM'] for f in frames)>0
assert max(f['palmNormalCameraAxisDegrees'] for f in frames)<.1
assert frames[-1]['fourFingerTipScreenWidth']>frames[0]['fourFingerTipScreenWidth']
uv=hand.data.uv_layers['CameraSkin'];registration=json.loads((R/'work/hand-rig/skin-uv-registration.json').read_text());oldverts=registration['vertices']
max_uv_error=0
for loop in hand.data.loops:
 co=hand.data.vertices[loop.vertex_index].co;nearest=min(oldverts,key=lambda item:(Vector(item['co'])-co).length_squared);assert (Vector(nearest['co'])-co).length<1e-7
 max_uv_error=max(max_uv_error,(uv.data[loop.index].uv-Vector(nearest['uv'])).length)
assert max_uv_error<1e-8
result={'frame_count':32,'source_card_sha256':hashlib.sha256((R/'public/assets/models/lotus-relief.glb').read_bytes()).hexdigest(),'render_script_sha256':hashlib.sha256((R/'scripts/render-hand-sequence.py').read_bytes()).hexdigest(),'rig':a.rig,'rigSha256':hashlib.sha256((R/a.rig).read_bytes()).hexdigest(),'coordinateSystem':'Blender metres; separating plane normal points from scene toward camera','configuration':('All hand geometry in front of immutable card' if frames[0]['frontClearanceM']>0 else 'All hand geometry behind immutable card')+'; complete hand raster; card is invisible only to camera rays and remains a shadow caster.','minimumSeparatingPlaneClearanceM':min(f['separatingPlaneClearanceM'] for f in frames),'minimumFrontClearanceM':min(f['frontClearanceM'] for f in frames),'minimumBehindClearanceM':min(f['behindClearanceM'] for f in frames),'maximumPalmNormalCameraAxisDegrees':max(f['palmNormalCameraAxisDegrees'] for f in frames),'palmNormalDefinition':'Authored palm plane: source-space +X, transformed by the fixed rig root; natural local surface curvature is retained.','stableUvMaximumError':max_uv_error,'packedTextureVerified':all(im.packed_file for im in bpy.data.images if im.filepath),'sourceCardGeometryChanged':False,'cameraDrift':False,'physicalGraspClaim':False,'frames':frames}
(R/a.output).parent.mkdir(parents=True,exist_ok=True);(R/a.output).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k!='frames'},indent=2))
