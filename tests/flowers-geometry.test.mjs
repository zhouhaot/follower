import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createFlowersBloom, FLOWERS_BLOOM_SPEC } from '../public/flowers-bloom.mjs';
const resources = root => {
  const meshes = [], geometries = new Set(), materials = new Set();
  root.traverse(o => { if (o.isMesh) { meshes.push(o); geometries.add(o.geometry); materials.add(o.material); } });
  return { meshes, geometries, materials };
};
const bounds = root => new THREE.Box3().setFromObject(root);
function closedShell(g) {
  const edges = new Map();
  for (let i = 0; i < g.index.count; i += 3) {
    const v = [0,1,2].map(j => g.index.getX(i+j));
    for (let j=0; j<3; j++) {
      const a=v[j], b=v[(j+1)%3], key=`${Math.min(a,b)}:${Math.max(a,b)}`;
      edges.set(key,(edges.get(key)||0)+1);
    }
  }
  assert.ok([...edges.values()].every(n=>n===2),'Each shell edge is shared by exactly two faces');
}

test('flowers retain three five-rounded-petal heads, mint centres and pointed foliage',()=>{
  const root=createFlowersBloom(); const {meshes,materials}=resources(root);
  assert.ok(root.isGroup); assert.equal(root.userData.spec,FLOWERS_BLOOM_SPEC);
  assert.equal(root.userData.growth,1); assert.equal(root.visible,true);
  assert.deepEqual(root.getObjectByName('PlantedShoot').position.toArray(),FLOWERS_BLOOM_SPEC.root);
  assert.equal(meshes.filter(m=>m.name.startsWith('RoundedPetal.')).length,15);
  assert.equal(meshes.filter(m=>m.name.startsWith('MintFlowerHeart.')).length,3);
  assert.equal(meshes.filter(m=>m.name.startsWith('EighteenRadialStamens.')).length,3);
  assert.equal(meshes.filter(m=>m.name==='PointedMintBlade').length,6);
  assert.equal(meshes.filter(m=>m.name==='SlenderRoseBlade').length,6);
  assert.ok(root.getObjectByName('ThreeCurvedFlowerStems'));
  for(const m of meshes) assert.notEqual(m.geometry.type,'PlaneGeometry');
  for(const m of materials) for(const v of Object.values(m)) assert.ok(!v?.isTexture);
  const petals=meshes.filter(m=>m.name.startsWith('RoundedPetal.'));
  for(const g of new Set(petals.map(m=>m.geometry))) {
    closedShell(g); g.computeBoundingBox(); const size=g.boundingBox.getSize(new THREE.Vector3());
    assert.ok(size.x>.10&&size.y>.12&&size.z>.04,'Broad rounded petals have real curvature and depth');
  }
  for(const m of meshes.filter(m=>m.name.endsWith('Blade'))) closedShell(m.geometry);
  const box=bounds(root);
  assert.ok(box.min.x>-.41&&box.max.x<.41);
  assert.ok(box.min.y>-.10&&box.max.y<.52);
  assert.ok(box.min.z>=0&&box.max.z>.30&&box.max.z<.40);
  root.userData.dispose();
});

test('flowers attributes/index bounds are finite within geometry and draw budgets',()=>{
  const root=createFlowersBloom(),{meshes,geometries,materials}=resources(root); let triangles=0;
  for(const g of geometries) {
    assert.ok(g.index&&g.index.count%3===0);
    for(const a of Object.values(g.attributes)) for(const v of a.array) assert.ok(Number.isFinite(v));
    for(const i of g.index.array) assert.ok(i>=0&&i<g.attributes.position.count);
  }
  for(const m of meshes) triangles+=m.geometry.index.count/3*(m.isInstancedMesh?m.count:1);
  assert.ok(triangles<70000,`Triangle count: ${triangles}`);
  assert.ok(meshes.length<=55,`Draw objects: ${meshes.length}`); assert.equal(materials.size,5);
  root.userData.dispose();
});

test('flowers growth remains rooted, clamps input, and restores exact full-open pose',()=>{
  const root=createFlowersBloom(),plant=root.getObjectByName('PlantedShoot'),box=bounds(root);
  const anchor=new THREE.Vector3(...FLOWERS_BLOOM_SPEC.root);
  root.userData.setGrowth(0);assert.equal(root.visible,false);
  for(const t of [.01,.1,.25,.5,.75,1]) {
    root.userData.setGrowth(t); assert.equal(root.userData.growth,t); assert.equal(root.visible,true);
    assert.ok(plant.getWorldPosition(new THREE.Vector3()).distanceTo(anchor)<1e-12);
    root.traverse(o=>{for(const n of o.matrixWorld.elements)assert.ok(Number.isFinite(n));});
  }
  assert.ok(bounds(root).min.distanceTo(box.min)<1e-12);assert.ok(bounds(root).max.distanceTo(box.max)<1e-12);
  root.userData.setGrowth(-1); assert.equal(root.userData.growth,0);
  root.userData.setGrowth(7); assert.equal(root.userData.growth,1);
  for(const value of [NaN,Infinity,undefined,'1']) {root.userData.setGrowth(value);assert.equal(root.userData.growth,0);}
  root.userData.dispose();
});

test('flowers instances are deterministic and disposal is isolated and idempotent',()=>{
  const a=createFlowersBloom(),b=createFlowersBloom(),ar=resources(a),br=resources(b);
  assert.equal(ar.meshes.length,br.meshes.length);
  let geometryDisposals=0,materialDisposals=0;
  for(let i=0;i<ar.meshes.length;i++) {
    assert.deepEqual(ar.meshes[i].geometry.attributes.position.array,br.meshes[i].geometry.attributes.position.array);
    assert.deepEqual(ar.meshes[i].matrixWorld.elements,br.meshes[i].matrixWorld.elements);
  }
  for(const g of ar.geometries){assert.ok(!br.geometries.has(g));g.addEventListener('dispose',()=>geometryDisposals++);}
  for(const m of ar.materials){assert.ok(!br.materials.has(m));m.addEventListener('dispose',()=>materialDisposals++);}
  a.userData.dispose();a.userData.dispose();a.userData.setGrowth(1);
  assert.equal(a.visible,false);assert.equal(a.userData.disposed,true);
  assert.equal(geometryDisposals,ar.geometries.size);assert.equal(materialDisposals,ar.materials.size);
  assert.equal(b.visible,true);assert.equal(b.userData.disposed,false);b.userData.dispose();
});


test('flowers transparent fallback hashes match the final source, reference and render',()=>{
  const read = path => readFileSync(new URL(path,import.meta.url));
  const metadata = JSON.parse(read('../public/assets/renders/flowers-bloom.metadata.json'));
  const digest = bytes => createHash('sha256').update(bytes).digest('hex');
  const png = read('../public/assets/renders/flowers-bloom.png');
  assert.equal(metadata.sourceSHA256,digest(read('../public/flowers-bloom.mjs')));
  assert.equal(metadata.referenceSHA256,digest(read('../public/assets/originals/target.png')));
  assert.equal(metadata.renderSHA256,digest(png));
  assert.deepEqual(Array.from(png.subarray(0,8)),[137,80,78,71,13,10,26,10]);
  assert.equal(png.readUInt32BE(16),1000);assert.equal(png.readUInt32BE(20),1000);
  assert.equal(png[25],6,'PNG uses RGBA colour type');
  assert.equal(metadata.transparent,true);assert.equal(metadata.denoising,false);
  assert.match(metadata.validation,/unverified/);
});
