import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLotusBloom, LOTUS_BLOOM_SPEC } from '../public/lotus-bloom.mjs';

const bounds = (root) => new THREE.Box3().setFromObject(root);
const resources = (root) => {
  const geometries = new Set(), materials = new Set(), meshes = [];
  root.traverse(object => {
    if (!object.isMesh) return;
    meshes.push(object); geometries.add(object.geometry); materials.add(object.material);
  });
  return { geometries, materials, meshes };
};

test('SCAN lotus is a planted, volumetric procedural Group with 21 petals', () => {
  const root = createLotusBloom();
  assert.ok(root.isGroup);
  assert.equal(root.userData.spec, LOTUS_BLOOM_SPEC);
  assert.equal(root.userData.growth, 1);
  assert.equal(root.visible, true);
  assert.deepEqual(root.getObjectByName('PlantedShoot').position.toArray(), [0, -0.154, 0.008]);
  const { meshes, materials } = resources(root);
  const petals = meshes.filter(mesh => mesh.name.startsWith('Petal.'));
  assert.equal(petals.length, 21);
  assert.ok(meshes.some(mesh => mesh.name === 'ThreeCurvedStems'));
  assert.equal(meshes.filter(mesh => mesh.name === 'CuppedLeaf').length, 2);
  assert.equal(meshes.filter(mesh => mesh.name === 'SweptLeafBlade').length, 4);
  for (const mesh of meshes) assert.notEqual(mesh.geometry.type, 'PlaneGeometry');
  for (const material of materials) {
    assert.ok(material.isMeshPhysicalMaterial);
    for (const value of Object.values(material)) assert.ok(!value?.isTexture, 'No image or texture substitutes');
  }
  for (const mesh of petals) {
    mesh.geometry.computeBoundingBox();
    const size = mesh.geometry.boundingBox.getSize(new THREE.Vector3());
    assert.ok(size.x > 0.05 && size.y > 0.15 && size.z > 0.05, `Petal has meaningful volume: ${size.toArray()}`);
  }
  for (const geometry of new Set(petals.map(mesh => mesh.geometry))) {
    const edges = new Map();
    for (let t = 0; t < geometry.index.count; t += 3) {
      const ids = [0, 1, 2].map(i => geometry.index.getX(t + i));
      for (let j = 0; j < 3; j++) {
        const a = ids[j], b = ids[(j + 1) % 3];
        const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
        edges.set(key, (edges.get(key) || 0) + 1);
      }
    }
    assert.ok([...edges.values()].every(count => count === 2), 'Every petal is a closed two-manifold shell');
  }
  const b = bounds(root);
  assert.ok(b.min.x > -0.5 && b.max.x < 0.5);
  assert.ok(b.min.y > -LOTUS_BLOOM_SPEC.cardAspect / 2 && b.max.y < LOTUS_BLOOM_SPEC.cardAspect / 2);
  assert.ok(b.min.z >= 0 && b.max.z > 0.5 && b.max.z < 0.7);
  root.userData.dispose();
});

test('all geometry attributes are finite, indexed, and inside a practical budget', () => {
  const root = createLotusBloom();
  const { geometries, materials, meshes } = resources(root);
  let renderedTriangles = 0;
  for (const geometry of geometries) {
    const count = geometry.getAttribute('position').count;
    assert.ok(geometry.index && geometry.index.count % 3 === 0);
    for (const attribute of Object.values(geometry.attributes)) {
      for (const value of attribute.array) assert.ok(Number.isFinite(value), 'Finite coordinates, normals and colours');
    }
    for (const index of geometry.index.array) assert.ok(index >= 0 && index < count);
  }
  for (const mesh of meshes) renderedTriangles += mesh.geometry.index.count / 3 * (mesh.isInstancedMesh ? mesh.count : 1);
  assert.ok(renderedTriangles < 50000, `Triangle budget: ${renderedTriangles}`);
  assert.ok(meshes.length < 50, `Draw-object budget: ${meshes.length}`);
  assert.equal(materials.size, 5);
  root.userData.dispose();
});

test('growth keeps the original root anchored and restores the exact open pose', () => {
  const root = createLotusBloom(), openBounds = bounds(root), plant = root.getObjectByName('PlantedShoot');
  const expectedRoot = new THREE.Vector3(...LOTUS_BLOOM_SPEC.root);
  root.userData.setGrowth(0);
  assert.equal(root.visible, false);
  for (const t of [0.01, 0.15, 0.35, 0.6, 0.8, 1]) {
    root.userData.setGrowth(t);
    assert.equal(root.visible, true);
    assert.ok(plant.getWorldPosition(new THREE.Vector3()).distanceTo(expectedRoot) < 1e-12);
    root.traverse(object => {
      for (const n of object.matrixWorld.elements) assert.ok(Number.isFinite(n));
    });
  }
  assert.ok(bounds(root).min.distanceTo(openBounds.min) < 1e-12);
  assert.ok(bounds(root).max.distanceTo(openBounds.max) < 1e-12);
  root.userData.setGrowth(-5); assert.equal(root.userData.growth, 0);
  root.userData.setGrowth(20); assert.equal(root.userData.growth, 1);
  root.userData.setGrowth(NaN); assert.equal(root.userData.growth, 0);
  root.userData.dispose();
});

test('disposal is idempotent and separate instances own separate resources', () => {
  const a = createLotusBloom(), b = createLotusBloom();
  const aResources = resources(a), bResources = resources(b);
  let geometryDisposals = 0, materialDisposals = 0;
  for (const geometry of aResources.geometries) {
    assert.ok(!bResources.geometries.has(geometry));
    geometry.addEventListener('dispose', () => geometryDisposals++);
  }
  for (const material of aResources.materials) {
    assert.ok(!bResources.materials.has(material));
    material.addEventListener('dispose', () => materialDisposals++);
  }
  a.userData.dispose(); a.userData.dispose(); a.userData.setGrowth(1);
  assert.equal(a.visible, false);
  assert.equal(a.userData.disposed, true);
  assert.equal(geometryDisposals, aResources.geometries.size);
  assert.equal(materialDisposals, aResources.materials.size);
  assert.equal(b.visible, true);
  assert.equal(b.userData.disposed, false);
  b.userData.dispose();
});
