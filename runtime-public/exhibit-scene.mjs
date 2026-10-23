import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

/** All distances are metres. The supplied 64 × 91 mm card stays at the origin. */
export const HERO_EXHIBIT_SPEC=Object.freeze({
 plinth:Object.freeze({width:.105,height:.025,depth:.052,centerY:-.067,bevel:.0009}),
 glass:Object.freeze({width:.091,height:.115,depth:.040,bottomY:-.0545,thickness:.0007}),
 cardBottomY:-.0455,
 floorY:-.0795,
 camera:Object.freeze({position:Object.freeze([.105,.0435,.300]),target:Object.freeze([0,-.0105,0]),verticalFov:29.41660779936549,referenceAspect:6/7}),
 exposure:1.02,
 metalEnvironmentIntensity:.82,
});

const clamp=value=>Math.max(0,Math.min(1,value));

function grainTexture(){
 const size=128,data=new Uint8Array(size*size*4);let seed=0x4d555345;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  const noise=seed/4294967296,cloud=Math.sin(x*.13+Math.sin(y*.09))*Math.cos(y*.14)*.5;
  const i=(y*size+x)*4;
  // R is fine grain for bump; G is restrained roughness variation.
  data[i]=Math.round(110+noise*36+cloud*10);data[i+1]=Math.round(225+noise*18);data[i+2]=data[i];data[i+3]=255;
 }
 const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
 texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(3,3);
 texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
 texture.generateMipmaps=true;texture.needsUpdate=true;texture.name='Fine honed stone grain';
 return texture;
}

function contactTexture(){
 const size=64,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const dx=(x+.5-size/2)/(size/2),dy=(y+.5-size/2)/(size/2);
  // A low, soft footprint only, supplementing actual light-cast contact shadows.
  const r=Math.pow(Math.abs(dx),4)+Math.pow(Math.abs(dy),4);
  data[(y*size+x)*4+3]=Math.round(255*Math.exp(-r*5)*clamp((1-r)*3));
 }
 const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
 texture.magFilter=texture.minFilter=THREE.LinearFilter;texture.needsUpdate=true;
 texture.name='Soft pedestal contact footprint';return texture;
}

/** A deliberately quiet studio environment, with broad reflections rather than neon edges. */
export function createExhibitEnvironment(){
 const scene=new THREE.Scene();scene.background=new THREE.Color().setRGB(.026,.028,.029);
 const geometry=new THREE.PlaneGeometry(1,1);
 const softbox=(name,position,size,light)=>{
  const material=new THREE.MeshBasicMaterial({color:new THREE.Color().setRGB(...light),side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.position.set(...position);mesh.scale.set(...size,1);mesh.lookAt(0,0,0);scene.add(mesh);
 };
 softbox('Broad neutral key',[-3,4,5],[3.5,4.5],[3.5,3.42,3.30]);
 softbox('Narrow side reflection',[4,1,2],[.8,3],[1.2,1.24,1.28]);
 softbox('Soft upper edge',[0,5,-1],[3,1.5],[1.8,1.8,1.8]);
 scene.dispose=()=>{geometry.dispose();scene.children.forEach(mesh=>mesh.material.dispose());};
 return scene;
}

export function createExhibit(){
 const root=new THREE.Group();root.name='Measured museum exhibit';
 const {plinth:p,glass:g,cardBottomY,floorY}=HERO_EXHIBIT_SPEC;
 const stone=new THREE.MeshStandardMaterial({color:0x41413e,metalness:0,roughness:.94,bumpMap:grainTexture(),bumpScale:.000045,envMapIntensity:.35});
 stone.roughnessMap=stone.bumpMap;stone.name='Neutral honed charcoal stone';
 const pedestal=new THREE.Mesh(new RoundedBoxGeometry(p.width,p.height,p.depth,2,p.bevel),stone);
 pedestal.name='Beveled stone pedestal';pedestal.position.y=p.centerY;pedestal.castShadow=true;pedestal.receiveShadow=true;root.add(pedestal);

 const cover=new THREE.Group();cover.name='Liftable five-panel glass cover';root.add(cover);
 const glass=new THREE.MeshPhysicalMaterial({
  color:0xf8fcfa,metalness:0,roughness:.075,transmission:.985,thickness:g.thickness,
  ior:1.51,attenuationColor:0xdde9e3,attenuationDistance:.18,
  transparent:true,opacity:1,depthWrite:false,side:THREE.FrontSide,envMapIntensity:.7,
 });
 glass.name='Low-iron glass, 0.7 mm thick';
 const panel=(name,w,h,d,x,y,z)=>{
  const mesh=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,1,.0001),glass);
  mesh.name=name;mesh.position.set(x,y,z);mesh.renderOrder=2;cover.add(mesh);
 };
 const midY=g.bottomY+g.height/2;
 panel('Glass front',g.width,g.height-g.thickness,g.thickness,0,midY-g.thickness/2,(g.depth-g.thickness)/2);
 panel('Glass back',g.width,g.height-g.thickness,g.thickness,0,midY-g.thickness/2,-(g.depth-g.thickness)/2);
 for(const sign of [-1,1])panel(`Glass ${sign<0?'left':'right'}`,g.thickness,g.height-g.thickness,g.depth-2*g.thickness,sign*(g.width-g.thickness)/2,midY-g.thickness/2,0);
 panel('Glass top',g.width,g.thickness,g.depth,0,g.bottomY+g.height-g.thickness/2,0);

 const holders=new THREE.Group();holders.name='Two padded metal card supports';root.add(holders);
 const hardware=new THREE.MeshStandardMaterial({color:0x55544f,metalness:.72,roughness:.46,envMapIntensity:.6});
 const padding=new THREE.MeshStandardMaterial({color:0x1c1d1b,metalness:0,roughness:.95});
 const footGeometry=new THREE.CylinderGeometry(.0026,.0029,.0008,16);
 const postGeometry=new THREE.CylinderGeometry(.0009,.0011,.0068,12);
 const seatGeometry=new RoundedBoxGeometry(.0058,.0014,.0046,1,.00035);
 const lipGeometry=new RoundedBoxGeometry(.0058,.0024,.00075,1,.0002);
 const padGeometry=new THREE.BoxGeometry(.0045,.0003,.0028);
 const addPart=(group,name,geometry,material,position)=>{const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.position.set(...position);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh};
 for(const x of [-.023,.023]){
  const holder=new THREE.Group();holder.name=`Card holder ${x<0?'left':'right'}`;holder.position.x=x;holders.add(holder);
  addPart(holder,'Mounting foot',footGeometry,hardware,[0,g.bottomY+.0004,0]);
  addPart(holder,'Support pin',postGeometry,hardware,[0,g.bottomY+.0042,0]);
  addPart(holder,'Card cradle',seatGeometry,hardware,[0,cardBottomY-.001,0]);
  addPart(holder,'Inert protective pad',padGeometry,padding,[0,cardBottomY-.00015,0]);
  for(const sign of [-1,1])addPart(holder,'Retaining lip',lipGeometry,hardware,[0,cardBottomY+.0002,sign*.00195]);
 }
 const contact=new THREE.Mesh(new THREE.PlaneGeometry(.145,.079),new THREE.MeshBasicMaterial({map:contactTexture(),transparent:true,opacity:.24,depthWrite:false,toneMapped:false}));
 contact.name='Soft pedestal contact';contact.rotation.x=-Math.PI/2;contact.position.y=floorY+.00008;contact.renderOrder=0;root.add(contact);
 return {root,cover,pedestal,holders,glass};
}

/** Absolute state, not accumulated deltas: reverse scrolling returns the exact initial pose. */
export function setExhibitProgress(exhibit,display,metal,value){
 if(!Number.isFinite(value))return;
 const p=clamp(value),lift=clamp(p/.42),fade=clamp(p/.55);
 exhibit.cover.position.y=lift*.13;exhibit.glass.opacity=1-fade;exhibit.cover.visible=fade<1;
 display.rotation.y=clamp(p/.6)*.6;
 metal.rotation.y=clamp((p-.14)/.5)*Math.PI;
}
