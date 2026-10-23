"""Record the already-keyed frontal hand rig. No pose-changing postprocess.
The renderer keys location, quaternion and scale for the root and all 25 bones.
"""
import bpy,json,hashlib,shutil
from pathlib import Path
R=Path(__file__).resolve().parents[1]
rig=R/'work/hand-rig/continuous-hand-rig.blend';bpy.ops.wm.open_mainfile(filepath=str(rig));s=bpy.context.scene
state=json.loads((R/'reports/hand-rig/render-state.json').read_text());arm=next(o for o in s.objects if o.type=='ARMATURE')
assert state['poseVariant']=='FRONT';assert s.frame_start==1 and s.frame_end==32
assert arm.animation_data and arm.animation_data.action
channels={c.data_path for c in arm.animation_data.action.fcurves}
assert {'location','rotation_quaternion','scale'}<=channels
assert all(im.packed_file for im in bpy.data.images if im.filepath)
shutil.copyfile(rig,R/'work/hand-rig/continuous-hand.blend')
report={'editableRig':str(rig.relative_to(R)),'frames':32,'poseVariant':'FRONT','packedTexture':True,'rootChannels':['location','rotation_quaternion','scale'],'skeletalChannels':['location','rotation_quaternion','scale'],'rendererUnchanged':state['render_script_sha256'],'postprocessScriptSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'geometryOrAnimationModified':False}
(R/'reports/hand-rig/editable-rig.json').write_text(json.dumps(report,indent=2)+'\n')
