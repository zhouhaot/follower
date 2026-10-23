import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {HERO_EXHIBIT_SPEC as spec,createExhibit,createExhibitEnvironment,setExhibitProgress} from '../public/exhibit-scene.mjs';
const near=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<tolerance,`${a} should equal ${b}`);
const bounds=object=>new THREE.Box3().setFromObject(object);
function resources(root){
 const meshes=[],geometries=new Set(),materials=new Set(),textures=new Set();
 root.traverse(object=>{if(object.isMesh)meshes.push(object);if(object.geometry)geometries.add(object.geometry);if(object.material){materials.add(object.material);Object.values(object.material).forEach(value=>{if(value?.isTexture)textures.add(value);});}});
 return {meshes,geometries,materials,textures};
}
function dispose(root){const r=resources(root);for(const kind of ['textures','materials','geometries'])r[kind].forEach(item=>item.dispose());}

test('hero preserves the immutable 64 × 91 mm supplied metal GLB',()=>{
 const bytes=readFileSync(new URL('../public/assets/models/lotus-relief.glb',import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'4d0b0e912d24dafb5186d62569a58729b34407352f11f871b960c593e4fd9ac3');
 const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
 const positions=gltf.meshes.flatMap(mesh=>mesh.primitives.map(p=>gltf.accessors[p.attributes.POSITION]));
 const min=[0,1,2].map(axis=>Math.min(...positions.map(a=>a.min[axis])));
 const max=[0,1,2].map(axis=>Math.max(...positions.map(a=>a.max[axis])));
 near(max[0]-min[0],.064);near(max[1]-min[1],.091);near(min[1],spec.cardBottomY);
 assert.ok(gltf.materials.some(m=>m.name==='FRONT · unchanged original illustration'&&m.pbrMetallicRoughness.baseColorTexture));
});

test('five thick transmitting glass panels rest on the stone and clear the card',()=>{
 const exhibit=createExhibit(),{cover,glass}=exhibit,g=spec.glass;
 assert.equal(cover.children.length,5);assert.equal(resources(cover).materials.size,1);
 assert.equal(cover.children.some(child=>child.isLineSegments),false,'No wireframe illusion');
 assert.equal(glass.isMeshPhysicalMaterial,true);assert.ok(glass.transmission>.97);assert.equal(glass.opacity,1);
 assert.equal(glass.metalness,0);near(glass.ior,1.51);near(glass.thickness,g.thickness);assert.ok(glass.roughness>.03&&glass.roughness<.15);
 const box=bounds(cover),size=box.getSize(new THREE.Vector3());
 near(size.x,g.width);near(size.y,g.height);near(size.z,g.depth);near(box.min.y,g.bottomY);
 for(const panel of cover.children){const size=bounds(panel).getSize(new THREE.Vector3());near(Math.min(size.x,size.y,size.z),g.thickness);assert.equal(panel.castShadow,false,'Glass must not cast an opaque rectangular shadow');}
 assert.ok(box.min.x<-.032&&box.max.x>.032&&box.max.y>.0455);
 near(box.min.y,bounds(exhibit.pedestal).max.y);dispose(exhibit.root);
});

test('the pedestal is a thick beveled non-metallic stone object with bounded microtexture',()=>{
 const exhibit=createExhibit(),{pedestal}=exhibit,p=spec.plinth,box=bounds(pedestal),size=box.getSize(new THREE.Vector3()),material=pedestal.material;
 near(size.x,p.width);near(size.y,p.height);near(size.z,p.depth);near(box.min.y,spec.floorY);
 assert.ok(p.height/p.width>.2,'Substantial stone volume, not a thin decorative ruler');
 assert.equal(material.metalness,0);assert.ok(material.roughness>.8);assert.ok(material.bumpScale>0&&material.bumpScale<.0001);
 assert.equal(material.bumpMap.isDataTexture,true);assert.equal(material.roughnessMap,material.bumpMap);
 assert.equal(material.bumpMap.image.width,128);assert.equal(material.bumpMap.image.height,128);
 assert.equal(pedestal.castShadow,true);assert.equal(pedestal.receiveShadow,true);
 const normals=pedestal.geometry.attributes.normal.array;assert.ok([...normals].some(n=>Math.abs(n)>.1&&Math.abs(n)<.9),'Bevels have actual sloping normals');
 const second=createExhibit();assert.notEqual(material.bumpMap,second.pedestal.material.bumpMap);assert.deepEqual(material.bumpMap.image.data,second.pedestal.material.bumpMap.image.data);dispose(exhibit.root);dispose(second.root);
});

test('two complete padded holders physically meet the unmodified card bottom',()=>{
 const exhibit=createExhibit();assert.equal(exhibit.holders.children.length,2);
 for(const holder of exhibit.holders.children){
  near(Math.abs(holder.position.x),.023);assert.equal(holder.children.length,6);
  const foot=bounds(holder.getObjectByName('Mounting foot'));near(foot.min.y,spec.glass.bottomY);
  const pad=bounds(holder.getObjectByName('Inert protective pad'));near(pad.max.y,spec.cardBottomY);
  const seat=bounds(holder.getObjectByName('Card cradle'));near(seat.max.y,pad.min.y);
  const lip=holder.children.filter(child=>child.name==='Retaining lip');assert.equal(lip.length,2);assert.ok(lip.every(child=>bounds(child).max.y>spec.cardBottomY));
 }
 dispose(exhibit.root);
});

test('cover lift, fade and card turn are finite, clamped, and exactly reversible',()=>{
 const exhibit=createExhibit(),display=new THREE.Group(),metal=new THREE.Group();display.add(exhibit.root,metal);
 const pose=()=>[exhibit.cover.position.y,exhibit.glass.opacity,exhibit.cover.visible,display.rotation.y,metal.rotation.y];
 const start=pose();for(const p of [.12,.3,.6,1,.6,.3,0])setExhibitProgress(exhibit,display,metal,p);
 assert.deepEqual(pose(),start);setExhibitProgress(exhibit,display,metal,.275);near(exhibit.glass.opacity,.5);setExhibitProgress(exhibit,display,metal,1);const end=pose();
 near(end[0],.13);near(end[1],0);assert.equal(end[2],false);near(end[3],.6);near(end[4],Math.PI);
 setExhibitProgress(exhibit,display,metal,100);assert.deepEqual(pose(),end);
 for(const bad of [NaN,Infinity,-Infinity,undefined,'1']){setExhibitProgress(exhibit,display,metal,bad);assert.deepEqual(pose(),end);}
 setExhibitProgress(exhibit,display,metal,-2);assert.deepEqual(pose(),start);dispose(exhibit.root);
});

test('hero additions stay finite and inside modest mesh/triangle/material budgets',()=>{
 const exhibit=createExhibit(),r=resources(exhibit.root);let triangles=0;
 for(const geometry of r.geometries)for(const attribute of Object.values(geometry.attributes))for(const value of attribute.array)assert.ok(Number.isFinite(value));
 for(const mesh of r.meshes)triangles+=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3;
 assert.equal(r.meshes.length,19);assert.ok(triangles<5000,`Hero-only triangles: ${triangles}`);assert.equal(r.materials.size,5);assert.equal(r.textures.size,2);
 const viewer=readFileSync(new URL('../public/model-viewer.mjs',import.meta.url),'utf8');assert.equal(viewer.includes('requestAnimationFrame'),false);assert.equal(viewer.includes('setAnimationLoop'),false);
 dispose(exhibit.root);
});

test('camera matches the CPU still’s 80 mm horizontal-fit portrait lens',()=>{
 const fov=2*Math.atan(.036*(1400/1200)/(2*.080))*180/Math.PI;
 near(spec.camera.verticalFov,fov);near(spec.camera.referenceAspect,1200/1400);
 assert.deepEqual(spec.camera.position,[.105,.0435,.300]);assert.deepEqual(spec.camera.target,[0,-.0105,0]);
 assert.ok(spec.exposure<=1.1);assert.ok(spec.metalEnvironmentIntensity<1);
});

test('the reflection environment uses just three broad, neutral softboxes',()=>{
 const environment=createExhibitEnvironment(),r=resources(environment);assert.equal(r.meshes.length,3);assert.equal(r.geometries.size,1);
 for(const {material} of r.meshes){assert.equal(material.isMeshBasicMaterial,true);assert.ok(material.color.r/material.color.b>.9&&material.color.r/material.color.b<1.1);}
 let geometriesDisposed=0,materialsDisposed=0;r.geometries.forEach(g=>g.addEventListener('dispose',()=>geometriesDisposed++));r.materials.forEach(m=>m.addEventListener('dispose',()=>materialsDisposed++));
 environment.dispose();assert.equal(geometriesDisposed,1);assert.equal(materialsDisposed,3);
});
