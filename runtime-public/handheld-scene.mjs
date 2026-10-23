import * as THREE from 'three';
import {getHandheldState} from './handheld-state.mjs';
export {clampProgress,phaseProgress,getHandheldState} from './handheld-state.mjs';

/** Metres, +Y up, +Z facing the relief. Source GLB geometry is never changed. */
export const HERO_HANDHELD_SPEC=Object.freeze({
 referenceSize:Object.freeze([1200,1600]),
 card:Object.freeze({width:.064,height:.091,minZ:-.0009000033023767173,maxZ:.002218225272372365,bottomY:-.0455}),
 camera:Object.freeze({position:Object.freeze([.070,.032,.340]),target:Object.freeze([0,0,0]),verticalFov:23.385318092504964,referenceAspect:3/4,shiftX:-.003692448139190674,shiftY:-.16352689638733864}),
 contact:Object.freeze({point:Object.freeze([0,-.0455,.001]),screen:Object.freeze([.5,.73])}),
 motion:Object.freeze({releaseStart:.32,releaseEnd:.54,flipStart:.42,flipEnd:.78}),
 exposure:1.02,
 metalEnvironmentIntensity:.82,
 materials:Object.freeze({
  '01':Object.freeze({color:Object.freeze([.2,.203,.198]),metalness:.88,roughness:.32}),
  '02':Object.freeze({color:Object.freeze([.38,.385,.37]),metalness:.86,roughness:.31}),
  '03':Object.freeze({color:Object.freeze([.4,.34,.24]),metalness:.86,roughness:.31}),
  '05':Object.freeze({color:Object.freeze([.43,.435,.42]),metalness:.88,roughness:.29}),
 }),
});

/** Absolute, deterministic pose: reading it does not animate, render, or touch storage. */
export function getHandheldPose(value){
 const {progress,lift,turn}=getHandheldState(value);
 return {
  progress,release:lift,turn,
  // Translation and screen-space lift belong to the shared HTML card-media layer.
  position:[0,0,0],rotation:[0,Math.PI*turn,0],scale:1,
  css:{lift,turnDegrees:180*turn,tiltDegrees:0,scale:1},
 };
}

export function setHandheldProgress(card,value){
 if(!card||!Number.isFinite(value))return;
 const pose=getHandheldPose(value);
 card.position.set(...pose.position);card.rotation.set(...pose.rotation);card.scale.setScalar(pose.scale);
 return pose;
}

/** Contain the complete 3:4 photograph and card identically at every viewport size. */
export function getHandheldCamera(aspect=HERO_HANDHELD_SPEC.camera.referenceAspect){
 const spec=HERO_HANDHELD_SPEC.camera;
 const safeAspect=Number.isFinite(aspect)&&aspect>0?aspect:spec.referenceAspect;
 const verticalFov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(spec.verticalFov)/2)*Math.max(1,spec.referenceAspect/safeAspect)));
 return {...spec,aspect:safeAspect,verticalFov,shiftX:spec.shiftX*Math.min(1,spec.referenceAspect/safeAspect),shiftY:spec.shiftY*Math.min(1,safeAspect/spec.referenceAspect)};
}

export function configureHandheldCamera(camera,aspect){
 const spec=getHandheldCamera(aspect);
 camera.aspect=spec.aspect;camera.fov=spec.verticalFov;
 camera.position.set(...spec.position);camera.lookAt(...spec.target);camera.updateProjectionMatrix();
 // A lens shift translates the optical centre without altering model geometry.
 camera.projectionMatrix.elements[8]+=spec.shiftX;
 camera.projectionMatrix.elements[9]+=spec.shiftY;
 camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();camera.updateMatrixWorld(true);
 return camera;
}

/** Normalized photograph coordinates (top-left 0,0). Used to audit hand registration. */
export function projectHandheldPoint(point,aspect=HERO_HANDHELD_SPEC.camera.referenceAspect,progress=0){
 const camera=configureHandheldCamera(new THREE.PerspectiveCamera(30,1,.001,5),aspect);
 const pose=getHandheldPose(progress),matrix=new THREE.Matrix4().compose(new THREE.Vector3(...pose.position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...pose.rotation)),new THREE.Vector3().setScalar(pose.scale));
 const p=new THREE.Vector3(...point).applyMatrix4(matrix).project(camera);
 return [(p.x+1)/2,(1-p.y)/2,p.z];
}

/** A reusable geometry bound audit, independent of the DOM and WebGL. */
export function getHandheldBounds(min,max,progress=0){
 const pose=getHandheldPose(progress),matrix=new THREE.Matrix4().compose(new THREE.Vector3(...pose.position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...pose.rotation)),new THREE.Vector3().setScalar(pose.scale));
 return new THREE.Box3(new THREE.Vector3(...min),new THREE.Vector3(...max)).applyMatrix4(matrix);
}

/** Display-only lighting calibration matches the CPU still; printed artwork is untouched. */
export function applyHandheldMaterials(root){
 root.traverse(mesh=>{if(mesh.isMesh){
  mesh.castShadow=true;mesh.receiveShadow=true;
  for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
   material.envMapIntensity=HERO_HANDHELD_SPEC.metalEnvironmentIntensity;
   const spec=HERO_HANDHELD_SPEC.materials[material.name?.slice(0,2)];
   if(spec){material.color.setRGB(...spec.color);material.metalness=spec.metalness;material.roughness=spec.roughness;}
  }
 }});
}

/** Large neutral photographic softboxes, never visible geometry or emissive card edges. */
export function createHandheldEnvironment(){
 const scene=new THREE.Scene();scene.name='Handheld photographic reflection environment';
 scene.background=new THREE.Color().setRGB(.028,.029,.029);
 const geometry=new THREE.PlaneGeometry(1,1),materials=[];
 function softbox(name,position,size,color){
  const material=new THREE.MeshBasicMaterial({color:new THREE.Color().setRGB(...color),side:THREE.DoubleSide});materials.push(material);
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.position.set(...position);mesh.scale.set(...size,1);mesh.lookAt(0,0,0);scene.add(mesh);
 }
 softbox('Broad upper-left photographic key',[-.15,.1905,.18],[.17,.22],[3.5,3.4475,3.3775]);
 softbox('Quiet neutral right fill',[.17,.0355,.075],[.085,.19],[.752,.776,.8]);
 softbox('Soft overhead reflection',[-.07,.1305,-.1],[.055,.14],[1.25,1.23125,1.2125]);
 let disposed=false;scene.dispose=()=>{if(disposed)return;disposed=true;geometry.dispose();materials.forEach(material=>material.dispose());};
 return scene;
}
