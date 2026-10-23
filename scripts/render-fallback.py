import bpy
from mathutils import Vector, Euler
bpy.ops.wm.open_mainfile(filepath='/workspace/shared/zevth-blender-v2/Qinghe-Relief-Card-v2.blend')
scene=bpy.context.scene
for obj in scene.objects:
 if obj.name=='Studio seamless plinth': obj.hide_render=True
scene.render.film_transparent=True
scene.render.image_settings.file_format='PNG'
scene.render.image_settings.color_mode='RGBA'
scene.render.resolution_x=1000
scene.render.resolution_y=1200
scene.render.resolution_percentage=100
scene.render.engine='CYCLES'
scene.cycles.samples=64
scene.cycles.use_denoising=False
scene.render.filepath='/workspace/scratch/82fef5354282/zevth-cloud/public/assets/renders/lotus-transparent.png'
# Keep the supplied finished card, lighting and full frontal camera. Never alter front artwork.
cam=scene.camera
cam.rotation_euler=Euler((0.12,0.28,0),'XYZ')
cam.location=cam.rotation_euler.to_matrix() @ Vector((0,0,20))
cam.data.type='ORTHO';cam.data.ortho_scale=11.8
bpy.ops.render.render(write_still=True)
