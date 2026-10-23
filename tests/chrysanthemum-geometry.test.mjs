import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { createChrysanthemumBloom, CHRYSANTHEMUM_BLOOM_SPEC } from '../public/chrysanthemum-bloom.mjs';
import { createLotusBloom } from '../public/lotus-bloom.mjs';
import { createLeavesBloom } from '../public/leaves-bloom.mjs';
const resources=root=>{const geometries=new Set(),materials=new Set(),meshes=[];root.traverse(o=>{if(o.isMesh){meshes.push(o);geometries.add(o.geometry);materials.add(o.material);}});return {geometries,materials,meshes};};
const signature=root=>{const h=createHash('sha256');root.traverse(o=>{if(o.isMesh){h.update(Buffer.from(o.geometry.attributes.position.array.buffer));h.update(Buffer.from(o.geometry.index.array.buffer));}});return h.digest('hex');};
const bounds=root=>new THREE.Box3().setFromObject(root);

test('chrysanthemum has distinct art-specific solid geometry, not a reused lotus',()=>{
 const root=createChrysanthemumBloom(),lotus=createLotusBloom(),other=createLeavesBloom();
 assert.ok(root.isGroup);assert.equal(root.userData.spec,CHRYSANTHEMUM_BLOOM_SPEC);assert.equal(root.userData.growth,1);
 const {meshes,geometries,materials}=resources(root);
 assert.equal(meshes.filter(o=>o.name.startsWith('HookedPetal.')).length,12);
 assert.equal(meshes.filter(o=>o.name==='DeeplyCutLeafBlade').length,5);
 assert.ok(root.getObjectByName('SinuousChrysanthemumStem'));
 assert.notEqual(signature(root),signature(lotus));assert.notEqual(signature(root),signature(other));
 const second=createChrysanthemumBloom();assert.equal(signature(root),signature(second),'deterministic construction');second.userData.dispose();
 for(const m of materials)for(const v of Object.values(m))assert.ok(!v?.isTexture,'no image or texture substitutes');
 for(const o of meshes)assert.notEqual(o.geometry.type,'PlaneGeometry');
 for(const g of geometries)if(g.userData.solidBlade){
  const edges=new Map();
  for(let i=0;i<g.index.count;i+=3){const ids=[g.index.getX(i),g.index.getX(i+1),g.index.getX(i+2)];for(let j=0;j<3;j++){const a=ids[j],b=ids[(j+1)%3],key=`${Math.min(a,b)}:${Math.max(a,b)}`;edges.set(key,(edges.get(key)||0)+1);}}
  assert.ok([...edges.values()].every(n=>n===2),'each petal and leaf is a closed two-manifold shell');
  g.computeBoundingBox();assert.ok(g.boundingBox.getSize(new THREE.Vector3()).z>.005,'real curved depth');
 }
 const b=bounds(root);assert.ok(b.min.x>-.5&&b.max.x<.5);assert.ok(b.min.y>-CHRYSANTHEMUM_BLOOM_SPEC.cardAspect/2&&b.max.y<CHRYSANTHEMUM_BLOOM_SPEC.cardAspect/2);assert.ok(b.min.z>0&&b.max.z>.3&&b.max.z<.6);
 root.userData.dispose();lotus.userData.dispose();other.userData.dispose();
});

test('chrysanthemum attributes are finite and indexed within practical budgets',()=>{
 const root=createChrysanthemumBloom(),{geometries,meshes}=resources(root);let triangles=0;
 for(const g of geometries){assert.ok(g.index&&g.index.count%3===0);const count=g.attributes.position.count;for(const a of Object.values(g.attributes))for(const v of a.array)assert.ok(Number.isFinite(v));for(const i of g.index.array)assert.ok(i>=0&&i<count);}
 for(const m of meshes)triangles+=m.geometry.index.count/3*(m.isInstancedMesh?m.count:1);
 assert.ok(triangles<70000,`triangle budget ${triangles}`);assert.ok(meshes.length<50,`draw-object budget ${meshes.length}`);root.userData.dispose();
});

test('chrysanthemum growth preserves its original printed branch root and open pose',()=>{
 const root=createChrysanthemumBloom(),plant=root.getObjectByName('PlantedShoot'),anchor=new THREE.Vector3(...CHRYSANTHEMUM_BLOOM_SPEC.root),open=bounds(root);
 assert.deepEqual(plant.position.toArray(),CHRYSANTHEMUM_BLOOM_SPEC.root);root.userData.setGrowth(0);assert.equal(root.visible,false);
 for(const t of [.001,.12,.3,.6,.82,1]){root.userData.setGrowth(t);assert.equal(root.visible,true);assert.ok(plant.getWorldPosition(new THREE.Vector3()).distanceTo(anchor)<1e-12);root.traverse(o=>o.matrixWorld.elements.forEach(v=>assert.ok(Number.isFinite(v))));}
 assert.ok(bounds(root).min.distanceTo(open.min)<1e-12);assert.ok(bounds(root).max.distanceTo(open.max)<1e-12);
 root.userData.setGrowth(-8);assert.equal(root.userData.growth,0);root.userData.setGrowth(8);assert.equal(root.userData.growth,1);root.userData.setGrowth(Infinity);assert.equal(root.userData.growth,0);root.userData.setGrowth(NaN);assert.equal(root.userData.growth,0);root.userData.dispose();
});

test('chrysanthemum owns independent resources and disposes idempotently',()=>{
 const a=createChrysanthemumBloom(),b=createChrysanthemumBloom(),ar=resources(a),br=resources(b);let gd=0,md=0;
 for(const g of ar.geometries){assert.ok(!br.geometries.has(g));g.addEventListener('dispose',()=>gd++);}for(const m of ar.materials){assert.ok(!br.materials.has(m));m.addEventListener('dispose',()=>md++);}
 a.userData.dispose();a.userData.dispose();a.userData.setGrowth(1);assert.equal(gd,ar.geometries.size);assert.equal(md,ar.materials.size);assert.equal(a.userData.disposed,true);assert.equal(a.visible,false);assert.equal(b.visible,true);assert.equal(b.userData.disposed,false);b.userData.dispose();
});
