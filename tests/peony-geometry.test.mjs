import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { createPeonyBloom, PEONY_BLOOM_SPEC } from '../public/peony-bloom.mjs';

function inventory(root) {
  const geometries = new Set(), materials = new Set(), meshes = [];
  root.traverse(o => { if (o.isMesh) { meshes.push(o); geometries.add(o.geometry); materials.add(o.material); } });
  return { geometries, materials, meshes };
}
const bounds = o => new THREE.Box3().setFromObject(o);
function closedManifold(g) {
  const edges = new Map();
  for (let i = 0; i < g.index.count; i += 3) for (let k = 0; k < 3; k++) {
    const a = g.index.getX(i + k), b = g.index.getX(i + (k + 1) % 3);
    const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
    const e = edges.get(key) || { count: 0, directed: 0 };
    e.count++; e.directed += a < b ? 1 : -1; edges.set(key, e);
  }
  assert.ok([...edges.values()].every(e => e.count === 2 && e.directed === 0), 'Every shell edge joins exactly two consistently oriented faces');
}

test('peony has its own reference-derived composition and the normalized vase-mouth root', () => {
  const root = createPeonyBloom(), { meshes, materials } = inventory(root);
  const png = fs.readFileSync(new URL('../public/assets/originals/peony/target.png', import.meta.url));
  assert.equal(png.readUInt32BE(16), 877); assert.equal(png.readUInt32BE(20), 1222);
  assert.equal(PEONY_BLOOM_SPEC.cardAspect, 1222 / 877);
  assert.equal(PEONY_BLOOM_SPEC.root[1], (1222 / 2 - PEONY_BLOOM_SPEC.rootPixel[1]) / 877);
  assert.ok(root.isGroup); assert.equal(root.userData.spec, PEONY_BLOOM_SPEC);
  assert.equal(root.userData.growth, 1); assert.equal(root.userData.disposed, false);
  assert.deepEqual(root.getObjectByName('PlantedShoot').position.toArray(), PEONY_BLOOM_SPEC.root);
  assert.equal(meshes.filter(o => o.name.startsWith('MainPetal.')).length, 30);
  assert.equal(meshes.filter(o => o.name.startsWith('BudPetal.')).length, 20);
  assert.equal(meshes.filter(o => o.name === 'PointedLeafBlade').length, 12);
  for (const name of ['CuppedBud.Left', 'CuppedBud.Right', 'OpenScallopedPeony', 'BranchedTurquoiseStems', 'TwentyEightFineStamens', 'TwentyEightPaleAnthers']) assert.ok(root.getObjectByName(name), name);
  for (const m of materials) { assert.ok(m.isMeshPhysicalMaterial); for (const v of Object.values(m)) assert.ok(!v?.isTexture); }
  for (const o of meshes) assert.notEqual(o.geometry.type, 'PlaneGeometry');
  const b = bounds(root);
  assert.ok(b.min.x > -0.5 && b.max.x < 0.5);
  assert.ok(b.min.y > -PEONY_BLOOM_SPEC.cardAspect / 2 && b.max.y < PEONY_BLOOM_SPEC.cardAspect / 2);
  assert.ok(b.min.z > 0 && b.max.z > 0.25 && b.max.z < 0.5);
  root.userData.dispose();
});

test('all peony petals and leaves are closed curved finite-thickness shells', () => {
  const root = createPeonyBloom(), { meshes } = inventory(root);
  const shells = meshes.filter(o => /^(MainPetal|BudPetal)\./.test(o.name) || o.name === 'PointedLeafBlade');
  assert.equal(shells.length, 62);
  for (const g of new Set(shells.map(o => o.geometry))) {
    closedManifold(g); g.computeBoundingBox();
    const s = g.boundingBox.getSize(new THREE.Vector3());
    assert.ok(s.x > 0.02 && s.y > 0.07 && s.z > 0.014, `Curved shell has depth: ${s.toArray()}`);
    const p = g.attributes.position;
    let volume = 0;
    for (let i = 0; i < g.index.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(p, g.index.getX(i));
      const b = new THREE.Vector3().fromBufferAttribute(p, g.index.getX(i + 1));
      const c = new THREE.Vector3().fromBufferAttribute(p, g.index.getX(i + 2));
      volume += a.dot(b.cross(c)) / 6;
    }
    assert.ok(volume > 1e-7, `Shell encloses positive volume: ${volume}`);
  }
  root.userData.dispose();
});

test('geometry has finite indexed data with less than 70k rendered triangles and 90 draw objects', () => {
  const root = createPeonyBloom(), { geometries, materials, meshes } = inventory(root);
  let triangles = 0;
  for (const g of geometries) {
    const count = g.attributes.position.count;
    assert.ok(g.index && g.index.count % 3 === 0);
    assert.equal(g.attributes.normal.count, count);
    if (g.attributes.color) assert.equal(g.attributes.color.count, count);
    for (const a of Object.values(g.attributes)) for (const value of a.array) assert.ok(Number.isFinite(value));
    for (const index of g.index.array) assert.ok(index >= 0 && index < count);
  }
  for (const o of meshes) triangles += o.geometry.index.count / 3 * (o.isInstancedMesh ? o.count : 1);
  assert.ok(triangles < 70000, `${triangles} rendered triangles`);
  assert.ok(meshes.length < 90, `${meshes.length} draw objects`);
  assert.equal(materials.size, 5);
  root.userData.dispose();
});

test('growth remains fixed at the printed root and exactly restores all open transforms', () => {
  const root = createPeonyBloom(), plant = root.getObjectByName('PlantedShoot');
  const initial = []; root.traverse(o => initial.push([...o.matrixWorld.elements]));
  const fullBounds = bounds(root), resourceCount = inventory(root).geometries.size;
  for (const t of [0, 0.001, 0.12, 0.34, 0.6, 0.84, 1]) {
    root.userData.setGrowth(t); assert.equal(root.visible, t > 0);
    assert.ok(plant.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(...PEONY_BLOOM_SPEC.root)) < 1e-12);
    root.traverse(o => { for (const v of o.matrixWorld.elements) assert.ok(Number.isFinite(v)); });
    assert.equal(inventory(root).geometries.size, resourceCount);
  }
  let i = 0; root.traverse(o => assert.deepEqual(o.matrixWorld.elements, initial[i++]));
  assert.ok(bounds(root).min.distanceTo(fullBounds.min) < 1e-12);
  assert.ok(bounds(root).max.distanceTo(fullBounds.max) < 1e-12);
  for (const bad of [NaN, Infinity, -Infinity, undefined, '1']) { root.userData.setGrowth(bad); assert.equal(root.userData.growth, 0); }
  root.userData.setGrowth(-2); assert.equal(root.userData.growth, 0);
  root.userData.setGrowth(2); assert.equal(root.userData.growth, 1);
  root.userData.setGrowth(0.001); assert.ok(bounds(root).getSize(new THREE.Vector3()).length() < 0.03);
  root.userData.dispose();
});

test('deterministic instances own independent resources and dispose exactly once', () => {
  const a = createPeonyBloom(), b = createPeonyBloom(), aa = inventory(a), bb = inventory(b);
  assert.equal(aa.meshes.length, bb.meshes.length);
  for (let i = 0; i < aa.meshes.length; i++) {
    const x = aa.meshes[i], y = bb.meshes[i];
    assert.equal(x.name, y.name); assert.deepEqual(x.matrixWorld.elements, y.matrixWorld.elements);
    assert.deepEqual(x.geometry.attributes.position.array, y.geometry.attributes.position.array);
    assert.deepEqual(x.geometry.index.array, y.geometry.index.array);
  }
  let gd = 0, md = 0;
  for (const g of aa.geometries) { assert.ok(!bb.geometries.has(g)); g.addEventListener('dispose', () => gd++); }
  for (const m of aa.materials) { assert.ok(!bb.materials.has(m)); m.addEventListener('dispose', () => md++); }
  a.userData.dispose(); a.userData.dispose(); a.userData.setGrowth(1);
  assert.equal(gd, aa.geometries.size); assert.equal(md, aa.materials.size);
  assert.equal(a.visible, false); assert.equal(a.userData.disposed, true);
  assert.equal(b.visible, true); assert.equal(b.userData.disposed, false);
  b.userData.setGrowth(0.5); assert.equal(b.userData.growth, 0.5); b.userData.dispose();
});

test('static peony fallback matches its geometry source and declares CPU-only provenance', async () => {
  const { createHash } = await import('node:crypto');
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  const metadata = JSON.parse(fs.readFileSync(new URL('../public/assets/renders/peony-bloom.metadata.json', import.meta.url)));
  const source = fs.readFileSync(new URL('../public/peony-bloom.mjs', import.meta.url));
  const png = fs.readFileSync(new URL('../public/assets/renders/peony-bloom.png', import.meta.url));
  const reference = fs.readFileSync(new URL('../public/assets/originals/peony/target.png', import.meta.url));
  assert.equal(metadata.source_sha256, hash(source)); assert.equal(metadata.image_sha256, hash(png)); assert.equal(metadata.reference_sha256, hash(reference));
  assert.equal(metadata.renderer, 'Blender Cycles CPU'); assert.equal(metadata.denoising, false);
  assert.equal(metadata.transparent, true); assert.equal(metadata.card_plane_included, false);
  assert.equal(metadata.growth, 1); assert.equal(metadata.samples, 128);
  assert.deepEqual(metadata.size, [1000, 1000]);
  assert.equal(png.readUInt32BE(16), 1000); assert.equal(png.readUInt32BE(20), 1000);
  assert.equal(png[25], 6, 'PNG uses RGBA colour type');
});
