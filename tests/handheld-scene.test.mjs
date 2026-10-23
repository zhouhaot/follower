import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {getHandheldState,clampProgress,getHandCardSupportShift,HAND_CARD_SUPPORT} from '../public/handheld-state.mjs';
import {HERO_HANDHELD_SPEC as spec,getHandheldPose,setHandheldProgress,getHandheldBounds,getHandheldCamera,configureHandheldCamera,projectHandheldPoint,createHandheldEnvironment,applyHandheldMaterials} from '../public/handheld-scene.mjs';
import {createViewer} from '../public/model-viewer.mjs';
const near=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<tolerance,`${a} should equal ${b}`);
const source=new URL('../public/assets/models/lotus-relief.glb',import.meta.url);
const bytes=readFileSync(source),gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
const metadata=JSON.parse(readFileSync(new URL('../public/assets/renders/handheld-card.metadata.json',import.meta.url)));
const accessors=gltf.meshes.flatMap(mesh=>mesh.primitives.map(primitive=>gltf.accessors[primitive.attributes.POSITION]));
const min=[0,1,2].map(axis=>Math.min(...accessors.map(accessor=>accessor.min[axis])));
const max=[0,1,2].map(axis=>Math.max(...accessors.map(accessor=>accessor.max[axis])));
function* vertices(){
 const binaryStart=20+bytes.readUInt32LE(12)+8;
 for(const accessor of accessors){
  const view=gltf.bufferViews[accessor.bufferView],stride=view.byteStride||12;
  assert.equal(accessor.componentType,5126);assert.equal(accessor.type,'VEC3');
  for(let i=0;i<accessor.count;i++)yield [0,1,2].map(axis=>bytes.readFloatLE(binaryStart+(view.byteOffset||0)+(accessor.byteOffset||0)+i*stride+4*axis));
 }
}

test('hand/card support references remain aligned across contain sizing and release reverses exactly',()=>{
 for(const [width,height] of [[849,747],[437,388],[360,300],[960,540]]){
  const containedWidth=Math.min(width,height*.75),shift=getHandCardSupportShift(width,height,0);
  near(HAND_CARD_SUPPORT.cardX*containedWidth+shift,HAND_CARD_SUPPORT.palmX*containedWidth);
  assert.equal(getHandCardSupportShift(width,height,1),0);
  for(const p of [0,.16,.3,.42,.6,.96,.6,.42,.3,.16,0]){
   const center=getHandheldState(p).center;
   near(getHandCardSupportShift(width,height,center),shift*(1-center));
  }
 }
 for(const [w,h] of [[NaN,1],[1,Infinity],[-1,1],[1,0]])assert.equal(getHandCardSupportShift(w,h,.5),0);
});

test('handheld scene retains the original GLB bytes, dimensions, topology and original reverse texture',()=>{
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'4d0b0e912d24dafb5186d62569a58729b34407352f11f871b960c593e4fd9ac3');
 near(max[0]-min[0],spec.card.width);near(max[1]-min[1],spec.card.height);near(min[1],spec.card.bottomY);
 near(min[2],spec.card.minZ);near(max[2],spec.card.maxZ);
 assert.equal(gltf.meshes.length,5);
 assert.ok(gltf.materials.some(material=>material.name==='FRONT · unchanged original illustration'&&material.pbrMetallicRoughness.baseColorTexture));
 assert.equal(metadata.source_geometry_changed,false);assert.equal(metadata.source_front_artwork_changed,false);
});

test('shared state is dependency-free, finite, clamped and reversible for the complete native scroll',()=>{
 const text=readFileSync(new URL('../public/handheld-state.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(text,/\bimport\b|window\.|document\.|localStorage|sessionStorage|setInterval|setTimeout|requestAnimationFrame/);
 const initial=getHandheldState(0),end=getHandheldState(1);
 assert.deepEqual(getHandheldState(-4),initial);assert.deepEqual(getHandheldState(6),end);
 for(const invalid of [NaN,Infinity,-Infinity,undefined,null,'0.5'])assert.deepEqual(getHandheldState(invalid),initial);
 for(const p of [0,.12,.28,.40,.52,.68,.76,.88,.96,1,.76,.40,0]){
  const state=getHandheldState(p);
  for(const value of Object.values(state))assert.ok(Number.isFinite(value)&&value>=0&&value<=1);
  assert.deepEqual(state,getHandheldState(p));
 }
 assert.equal(initial.sceneOpacity,1);assert.equal(initial.copyOpacity,1);assert.equal(initial.turn,0);
 assert.equal(end.sceneOpacity,0);assert.equal(end.turn,1);assert.equal(end.spread,1);
 assert.equal(getHandheldState(.50).release,1);assert.equal(getHandheldState(.42).turn,0);
 assert.equal(getHandheldState(.32).lift,0);assert.equal(getHandheldState(.54).lift,1);
 near(getHandheldState(.60).turn,.5);assert.equal(getHandheldState(.78).turn,1);
 assert.equal(getHandheldState(.76).fan,0);assert.equal(getHandheldState(.94).fan,1);
 assert.equal(getHandheldState(.74).spread,0);assert.equal(getHandheldState(.98).spread,1);
 assert.equal(getHandheldState(0).handOpen,0);assert.equal(getHandheldState(.30).handOpen,1);
 assert.equal(getHandheldState(.30).release,0);assert.ok(getHandheldState(.30).handOpen===1);
 assert.equal(clampProgress(.4),.4);
});

test('only the independent card turns; HTML owns common lift and centering',()=>{
 const card=new THREE.Group(),hand=new THREE.Group(),handStart=hand.matrix.toArray();
 const start=getHandheldPose(0);assert.deepEqual(start.position,[0,0,0]);assert.deepEqual(start.rotation,[0,0,0]);assert.equal(start.scale,1);
 for(const p of [.12,.28,.52,.76,1,.52,0]){
  const pose=setHandheldProgress(card,p);
  assert.deepEqual(card.position.toArray(),[0,0,0]);assert.deepEqual(card.scale.toArray(),[1,1,1]);
  near(card.rotation.y,pose.turn*Math.PI);assert.equal(card.rotation.x,0);assert.equal(card.rotation.z,0);
 }
 assert.deepEqual(card.rotation.toArray(),[0,0,0,'XYZ']);assert.deepEqual(hand.matrix.toArray(),handStart);
 setHandheldProgress(card,1);const end=card.rotation.toArray();
 for(const invalid of [NaN,Infinity,-Infinity,undefined,'1']){setHandheldProgress(card,invalid);assert.deepEqual(card.rotation.toArray(),end);}
 setHandheldProgress(card,10);assert.deepEqual(card.rotation.toArray(),end);
 setHandheldProgress(card,-10);assert.deepEqual(card.rotation.toArray(),[0,0,0,'XYZ']);
});

test('the initial fixed camera and lower-edge contact match the CPU card raster',()=>{
 assert.deepEqual(spec.camera.position,metadata.camera.position);assert.deepEqual(spec.camera.target,metadata.camera.target);
 near(spec.camera.verticalFov,metadata.camera.vertical_fov_degrees);near(spec.camera.referenceAspect,metadata.reference_aspect);
 near(spec.camera.shiftX,metadata.camera.projection_matrix_offsets[0]);near(spec.camera.shiftY,metadata.camera.projection_matrix_offsets[1]);
 const point=projectHandheldPoint(spec.contact.point);
 near(point[0],.5,1e-6);near(point[1],.73,1e-6);
 const camera=configureHandheldCamera(new THREE.PerspectiveCamera(30,1,.001,5),.75),projected=new THREE.Vector3();
 const bound=[Infinity,Infinity,-Infinity,-Infinity];
 for(const vertex of vertices()){
  projected.set(...vertex).project(camera);const x=(projected.x+1)/2,y=(1-projected.y)/2;
  bound[0]=Math.min(bound[0],x);bound[1]=Math.min(bound[1],y);bound[2]=Math.max(bound[2],x);bound[3]=Math.max(bound[3],y);
 }
 bound.forEach((value,index)=>near(value,metadata.card_bounds_normalized[index],1e-5));
 assert.ok(bound[0]>.2&&bound[2]<.81&&bound[1]>.09&&bound[3]<.75);
});

test('responsive lens shift follows object-fit contain with no hand/card registration drift',()=>{
 const point=projectHandheldPoint(spec.contact.point),ref=spec.camera.referenceAspect;
 for(const aspect of [.25,.375,.6,.75,1,1.5,3]){
  const actual=projectHandheldPoint(spec.contact.point,aspect);
  near(actual[0],.5+(point[0]-.5)*Math.min(1,ref/aspect));
  near(actual[1],.5+(point[1]-.5)*Math.min(1,aspect/ref));
  const camera=configureHandheldCamera(new THREE.PerspectiveCamera(30,1,.001,5),aspect);
  const before=camera.projectionMatrix.toArray();configureHandheldCamera(camera,aspect);assert.deepEqual(camera.projectionMatrix.toArray(),before,'Resizing must not accumulate lens shift');
 }
 for(const bad of [NaN,0,-1,Infinity])assert.deepEqual(getHandheldCamera(bad),getHandheldCamera(ref));
});

test('geometry bounds stay finite, centered, unclipped and restore exactly throughout the flip',()=>{
 const initial=getHandheldBounds(min,max,0);
 for(const p of [0,.12,.28,.4,.52,.64,.76,1,.52,0]){
  const bound=getHandheldBounds(min,max,p);
  for(const value of [...bound.min.toArray(),...bound.max.toArray()])assert.ok(Number.isFinite(value));
  const size=bound.getSize(new THREE.Vector3());near(size.y,.091);
  assert.ok(size.x<=.065&&size.z<=.065);assert.deepEqual(bound.min.toArray().map(Math.abs).slice(0,2).map(v=>v<.1),[true,true]);
  for(const vertex of [[min[0],min[1],min[2]],[max[0],max[1],max[2]]]){
   const screen=projectHandheldPoint(vertex,.75,p);assert.ok(screen[0]>0&&screen[0]<1&&screen[1]>0&&screen[1]<1);
  }
 }
 assert.deepEqual(getHandheldBounds(min,max,0),initial);
 const edge=getHandheldBounds(min,max,.60);near(edge.max.x-edge.min.x,spec.card.maxZ-spec.card.minZ);
});

test('display-only PBR calibration matches the raster while original art, geometry and texture remain intact',()=>{
 const root=new THREE.Group(),geometry=new THREE.BoxGeometry(1,1,1),texture=new THREE.Texture();
 const original=new THREE.MeshStandardMaterial({map:texture,color:0xffffff,metalness:0,roughness:.54});original.name='FRONT · unchanged original illustration';root.add(new THREE.Mesh(geometry,original));
 const originalBefore={color:original.color.toArray(),roughness:original.roughness,metalness:original.metalness};
 for(const key of Object.keys(spec.materials)){const material=new THREE.MeshStandardMaterial();material.name=`${key} · material`;root.add(new THREE.Mesh(geometry,material));}
 applyHandheldMaterials(root);
 assert.deepEqual({color:original.color.toArray(),roughness:original.roughness,metalness:original.metalness},originalBefore);assert.equal(original.map,texture);
 for(const mesh of root.children){
  assert.equal(mesh.geometry,geometry);assert.deepEqual(mesh.position.toArray(),[0,0,0]);assert.equal(mesh.material.emissive.getHex(),0);
  const key=mesh.material.name.slice(0,2),expected=metadata.material_spec[key];
  if(expected){assert.deepEqual(mesh.material.color.toArray(),expected.color);assert.equal(mesh.material.roughness,expected.roughness);assert.equal(mesh.material.metalness,expected.metalness);}
 }
 root.children.forEach(mesh=>mesh.material.dispose());geometry.dispose();texture.dispose();
});

test('the offscreen PBR environment has three neutral, broad softboxes matching physical light directions',()=>{
 const environment=createHandheldEnvironment();assert.equal(environment.children.length,3);
 environment.children.forEach((mesh,index)=>{
  assert.equal(mesh.isMesh,true);assert.deepEqual(mesh.position.toArray(),metadata.light_spec[index].position);
  assert.deepEqual(mesh.scale.toArray().slice(0,2),metadata.light_spec[index].size);
  assert.ok(mesh.material.color.r/mesh.material.color.b>.9&&mesh.material.color.r/mesh.material.color.b<1.1);
 });
 let geometries=0,materials=0;environment.children[0].geometry.addEventListener('dispose',()=>geometries++);
 environment.children.forEach(mesh=>mesh.material.addEventListener('dispose',()=>materials++));
 environment.dispose();environment.dispose();assert.equal(geometries,1);assert.equal(materials,3);
});

test('hero WebGL unavailability preserves independent hand and fallback card DOM through repeated disposal',async()=>{
 const classes=new Set(),layers=[{name:'photo hand'},{name:'relief face'},{name:'original face'}];
 const mount={children:[...layers]},container={
  ownerDocument:{defaultView:{}},dataset:{},
  classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)},
  querySelector:selector=>selector==='.handheld-card-media'?mount:null,
 };
 const viewer=await createViewer(container,{hero:true});
 assert.ok(classes.has('fallback-only'));assert.equal(classes.has('model-ready'),false);
 assert.equal(container.dataset.viewerError,'webgl-unavailable');assert.equal(viewer.getView(),'relief');
 for(const p of [0,.3,1,.3,0,NaN])viewer.setProgress(p);
 viewer.setView('front');viewer.dispose();viewer.dispose();viewer.setProgress(.5);
 assert.deepEqual(mount.children,layers);assert.ok(classes.has('fallback-only'));
});

test('hero route is card-only, demand-rendered, transparent and lifecycle guarded',()=>{
 const source=readFileSync(new URL('../public/model-viewer.mjs',import.meta.url),'utf8');
 const hero=source.slice(source.indexOf('async function createHandheldViewer'));
 assert.match(source,/if\(hero\)return createHandheldViewer\(container\)/);
 assert.match(hero,/querySelector\('\.handheld-card-media'\)/);assert.match(hero,/setClearColor\(0x000000,0\)/);
 assert.doesNotMatch(hero,/createExhibit|createBloomFor|ShadowMaterial|PlaneGeometry|OrbitControls|localStorage|sessionStorage|requestAnimationFrame|setAnimationLoop|setInterval/);
 assert.match(hero,/webglcontextlost/);assert.match(hero,/removeEventListener\('webglcontextlost'/);assert.match(hero,/resizeObserver\?\.disconnect/);
 assert.match(hero,/if\(disposed\|\|failed\)\{disposeObject\(loaded\);return api;/);
 assert.match(hero,/if\(!event\.persisted\)dispose\(\)/);
});


test('front-facing reveal retains a solid foreground hand until it clears the card',()=>{
 for(const p of [0,.15,.30,.40,.42,.43])assert.equal(getHandheldState(p).handOpacity,1);
 assert.ok(getHandheldState(.47).handOpacity>0&&getHandheldState(.47).handOpacity<1);
 assert.equal(getHandheldState(.50).handOpacity,0);
 for(const p of [.30,.40,.45,.50,.45,.40,.30])assert.deepEqual(getHandheldState(p),getHandheldState(p));
 const css=readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');
 assert.doesNotMatch(css,/\.handheld-hand\{[^}]*(?:rotate|skew|matrix3d|perspective)\(/,'Composition must not simulate a new 3D wrist or palm orientation');
 assert.match(css,/\.handheld-hand-layer:not\(\.handheld-hand-foreground\)\{visibility:hidden\}/);
 assert.match(css,/\.handheld-hand-foreground\{z-index:4;opacity:var\(--hand-opacity\)\}/);
 assert.doesNotMatch(css,/var\(--hand-release\)\*40/);
});
