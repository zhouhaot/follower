"""Create a bounded, alpha-masked albedo-detail map for persistent mesh UV projection.
This is a numeric reflectance/detail map, not a replacement hand image or geometry.
"""
from pathlib import Path
import argparse,json
from PIL import Image,ImageFilter
import numpy as np
p=argparse.ArgumentParser();p.add_argument('enhanced');p.add_argument('--dy',type=float,default=-31);p.add_argument('--dx',type=float,default=0);p.add_argument('--affine',action='store_true');a=p.parse_args()
R=Path(__file__).resolve().parents[1];ref=Image.open(R/'reports/hand-rig/approved-skin-reference/hand-031.png').convert('RGBA');photo=Image.open(a.enhanced).convert('RGBA').resize(ref.size,Image.Resampling.LANCZOS)
# Sample texture photo coordinates in the open-pose reference projection.
affine=(1.0139925944,-.00474797223,-1.4806370835,-.00193445232,.9773282387,-11.1565491043) if a.affine else (1,0,a.dx,0,1,a.dy)
photo=photo.transform(ref.size,Image.Transform.AFFINE,affine,resample=Image.Resampling.BICUBIC)
x=np.asarray(photo).astype(float)/255;y=np.asarray(ref.filter(ImageFilter.GaussianBlur(1.4))).astype(float)/255
linear=lambda a:np.where(a<=.04045,a/12.92,((a+.055)/1.055)**2.4)
ratio=np.clip(linear(x[:,:,:3])/np.maximum(linear(y[:,:,:3]),.025),.40,2.8)
# Do not stretch a photograph into unseen skin beyond the bottom of its crop.
photo_alpha=np.asarray(photo.getchannel('A').filter(ImageFilter.MinFilter(5)))/255
alpha=np.minimum(photo_alpha,np.asarray(ref)[:,:,3]/255);h,w=alpha.shape;fade=np.clip((h-1-np.arange(h))/(h*.042),0,1);alpha*=fade[:,None]
ratio[y[:,:,3]<.1]=1
encoded=np.concatenate((ratio/4,alpha[:,:,None]),axis=2);dest=R/'work/hand-rig/skin-detail-ratio.png';Image.fromarray(np.uint8(np.clip(encoded,0,1)*255),'RGBA').save(dest)
(R/'work/hand-rig/skin-detail-projection.json').write_text(json.dumps({'appearanceSource':str(a.enhanced),'reference':'reports/hand-rig/approved-skin-reference/hand-031.png','samplingAffineAt720':list(affine),'silhouetteAlignmentIoU':.95431 if a.affine else .93955,'normalizedBy':'softened original linear-light render','detailGainClamp':[.40,2.8],'geometryChanged':False,'stableUv':'CameraSkin','unseenSurface':'procedural skin fallback','map':str(dest.relative_to(R))},indent=2)+'\n')
print(dest)
