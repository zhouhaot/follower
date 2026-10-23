/**
 * New procedural 牡丹承瑞 reconstruction, interpreted from the original artwork.
 * Card width = 1; card plane XY; +Y top; +Z outward. No image planes or textures.
 * This model is independent of the metal relief and of the procedural lotus.
 */
import * as THREE from 'three';

export const PEONY_BLOOM_SPEC = Object.freeze({
  version: 'procedural-peony-1',
  provenance: 'New procedural reconstruction from visual inspection of the supplied peony target',
  units: 'card-width', cardAspect: 1222 / 877, cardPlane: 'XY', outwardAxis: '+Z',
  root: Object.freeze([0, -81 / 877, 0.012]),
  rootPixel: Object.freeze([438.5, 692]),
  flowerCenter: Object.freeze([0, 0.316, 0.23]),
  mainPetals: 30, buds: 2, budPetals: 10, leaves: 12,
});
const clamp = x => Math.min(1, Math.max(0, x));
const ease = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** Build front, back and a stitched perimeter, retaining real finite thickness. */
function closedSurface(point, shade, rows = 14, columns = 12) {
  const positions = [], colors = [], indices = [], layer = (rows + 1) * (columns + 1);
  for (let side = 0; side < 2; side++) for (let row = 0; row <= rows; row++) for (let col = 0; col <= columns; col++) {
    const t = row / rows, u = col / columns * 2 - 1;
    positions.push(...point(t, u, side));
    const c = shade(t, u, side); colors.push(c.r, c.g, c.b);
  }
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const a = row * (columns + 1) + col, b = a + 1, d = a + columns + 1, e = d + 1;
    indices.push(a, b, e, a, e, d, a + layer, e + layer, b + layer, a + layer, d + layer, e + layer);
  }
  const edge = [];
  for (let col = 0; col <= columns; col++) edge.push(col);
  for (let row = 1; row <= rows; row++) edge.push(row * (columns + 1) + columns);
  for (let col = columns - 1; col >= 0; col--) edge.push(rows * (columns + 1) + col);
  for (let row = rows - 1; row > 0; row--) edge.push(row * (columns + 1));
  for (let i = 0; i < edge.length; i++) {
    const a = edge[i], b = edge[(i + 1) % edge.length];
    indices.push(a, a + layer, b, b, a + layer, b + layer);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices); g.computeVertexNormals(); return g;
}

/** Broad fan-shaped petals with a lobed crown, rolled edges and shallow flutes. */
function peonyPetal({ length, width, reach, cup = 0.018, pale = false, phase = 0, bud = false }) {
  const dark = new THREE.Color(pale ? 0xee487f : 0xc91452);
  const face = new THREE.Color(pale ? 0xff91b3 : 0xff4c85);
  const edge = new THREE.Color(0xffc0d5);
  return closedSurface((t, u, side) => {
    const spread = bud ? 0.006 + Math.pow(Math.sin(Math.PI * t), 0.48) : 0.007 + Math.pow(Math.sin(t * Math.PI * 0.77), 0.66);
    const crown = (0.022 * Math.sqrt(Math.max(0, 1 - u * u)) - 0.009 * Math.exp(-u * u * 35)
      + 0.0017 * Math.cos(3 * Math.PI * u + phase)) * Math.pow(t, 4) * (bud ? 0.6 : 1);
    const x = width * spread * u;
    const y = length * t + crown;
    const z = (bud ? 0.007 + (0.033 + reach * 0.35) * Math.sin(t * Math.PI * 0.85) - 0.012 * u * u * Math.sin(Math.PI * t) : reach * t * t + cup * u * u * Math.sin(Math.PI * t * 0.85))
      + 0.0025 * Math.cos(3 * Math.PI * u + phase) * Math.pow(t, 3)
      + (side ? -1 : 1) * (0.0013 + 0.0009 * Math.sin(Math.PI * t));
    return [x, y, z];
  }, (t, u, side) => {
    const c = dark.clone().lerp(face, 0.3 + 0.7 * ease(0.08, 1, t));
    c.lerp(edge, Math.max(ease(0.88, 1, t) * 0.68, ease(0.9, 1, Math.abs(u)) * 0.38));
    if (side) c.multiplyScalar(0.86); return c;
  }, bud ? 11 : 14, 16);
}

function leafBlade(length, width, rise) {
  const dark = new THREE.Color(0x109d94), face = new THREE.Color(0x43d2bd), edge = new THREE.Color(0x9ff1db);
  return closedSurface((t, u, side) => {
    const bell = Math.pow(Math.sin(Math.PI * t), 0.85);
    const w = width * bell * (1.2 - 0.4 * t) + 0.00013;
    return [u * w, length * t, rise * Math.sin(t * Math.PI * 0.7) + 0.009 * (1 - u * u) * bell
      - 0.013 * u * u * bell + (side ? -1 : 1) * 0.0014];
  }, (t, u, side) => {
    const c = dark.clone().lerp(face, 0.35 + 0.4 * t + 0.15 * u).lerp(edge, ease(0.91, 1, Math.abs(u)) * 0.5);
    if (side) c.multiplyScalar(0.8); return c;
  }, 14, 8);
}

function tube(points, radius, segments = 20, sides = 7) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), segments, radius, sides, false);
}
function merge(parts) {
  const p = [], n = [], ix = []; let offset = 0;
  for (const g of parts) {
    p.push(...g.attributes.position.array); n.push(...g.attributes.normal.array);
    for (const i of g.index.array) ix.push(i + offset);
    offset += g.attributes.position.count; g.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
  g.setIndex(ix); return g;
}

export function createPeonyBloom() {
  const root = new THREE.Group(); root.name = 'PeonyBloom.Procedural';
  const plant = new THREE.Group(); plant.name = 'PlantedShoot'; plant.position.fromArray(PEONY_BLOOM_SPEC.root); root.add(plant);
  const geometries = new Set(), materials = new Set(), petals = [], leaves = [], budGroups = [];
  let disposed = false;
  function material(p) { const m = new THREE.MeshPhysicalMaterial(p); materials.add(m); return m; }
  const pink = material({ vertexColors: true, roughness: 0.4, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.4 });
  const teal = material({ vertexColors: true, roughness: 0.4, metalness: 0.015, clearcoat: 0.42 });
  const stem = material({ color: 0x2bc2ab, roughness: 0.4, clearcoat: 0.3 });
  const vein = material({ color: 0xb4f5dc, roughness: 0.5 });
  const yellow = material({ color: 0xffe79a, roughness: 0.45, metalness: 0.035 });
  function mesh(g, m, name, parent = plant) {
    geometries.add(g); const o = new THREE.Mesh(g, m); o.name = name; o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
  }
  const localY = y => y - PEONY_BLOOM_SPEC.root[1];
  const mainBase = [0, localY(0.316), 0.218];
  const budCenters = [[-0.18, localY(0.045), 0.145], [0.19, localY(0.04), 0.15]];
  mesh(merge([
    tube([[0, 0, 0], [0.012, 0.15, 0.042], [-0.006, 0.285, 0.14], mainBase], 0.007, 32, 8),
    tube([[0, 0.008, 0], [-0.075, 0.083, 0.07], [-0.138, 0.12, 0.12], budCenters[0]], 0.0055),
    tube([[0, 0.014, 0], [0.068, 0.081, 0.071], [0.14, 0.125, 0.125], budCenters[1]], 0.0055),
    tube([[-0.004, 0.185, 0.072], [-0.053, 0.279, 0.10], [-0.103, 0.339, 0.112]], 0.004),
    tube([[0.004, 0.175, 0.07], [0.06, 0.287, 0.11], [0.132, 0.34, 0.12]], 0.004),
  ]), stem, 'BranchedTurquoiseStems');

  const foliage = [
    [-0.075, 0.35, 0.11, 0.224, 0.045, 0.61, 0.026],
    [0.116, 0.255, 0.115, 0.228, 0.05, -1.03, 0.025],
    [-0.055, 0.255, 0.095, 0.264, 0.05, 1.36, 0.045],
    [0.114, 0.237, 0.10, 0.237, 0.04, -2.10, 0.035],
    [-0.11, 0.225, 0.103, 0.2, 0.033, 1.93, 0.024],
    [-0.025, -0.055, 0.041, 0.229, 0.050, 2.06, 0.044],
    [0.025, -0.045, 0.046, 0.232, 0.052, -2.28, 0.044],
    [-0.003, -0.055, 0.046, 0.145, 0.021, 0.47, 0.02],
    [0.003, -0.04, 0.05, 0.143, 0.022, -0.34, 0.022],
    [-0.17, 0.025, 0.137, 0.142, 0.026, 2.12, 0.022],
    [0.18, 0.025, 0.143, 0.145, 0.026, -2.58, 0.026],
    [0.172, 0.015, 0.13, 0.125, 0.020, 0.7, 0.03],
  ];
  foliage.forEach(([x, y, z, length, width, angle, rise], i) => {
    const pivot = new THREE.Group(); pivot.name = `OvateLeaf.${i}`;
    pivot.position.set(x, localY(y), z); pivot.rotation.z = angle;
    pivot.rotation.y = i % 2 ? -0.12 : 0.12; plant.add(pivot);
    mesh(leafBlade(length, width, rise), teal, 'PointedLeafBlade', pivot);
    const points = [0, 0.22, 0.5, 0.76, 0.99].map(t => [0, length * t, rise * Math.sin(t * Math.PI * 0.7) + 0.009 * Math.sin(Math.PI * t) ** 0.85 + 0.0018]);
    mesh(tube(points, 0.0009, 14, 5), vein, 'LeafMidrib', pivot);
    leaves.push({ pivot, delay: 0.07 + i % 4 * 0.035 });
  });

  const petioles = foliage.map(([x, y, z], i) => {
    const start = i >= 9 ? budCenters[i === 9 ? 0 : 1] : i >= 5 ? [0, 0.022, 0.02] : [0, localY(y - 0.07), 0.10];
    const end = [x, localY(y), z];
    return tube([start, start.map((v, j) => (v + end[j]) / 2 + (j === 2 ? 0.004 : 0)), end], 0.0028, 12, 6);
  });
  mesh(merge(petioles), stem, 'TwelveLeafPetioles');

  const flower = new THREE.Group(); flower.name = 'OpenScallopedPeony'; flower.position.fromArray(mainBase); plant.add(flower);
  flower.rotation.x = -0.13; flower.scale.y = 0.86;
  const rings = [
    { count: 12, length: 0.173, width: 0.074, reach: 0.008, cup: 0.024, z: -0.009, radius: 0.021, phase: 0.07, pale: false },
    { count: 10, length: 0.134, width: 0.062, reach: 0.042, cup: 0.026, z: 0.014, radius: 0.022, phase: 0.31, pale: false },
    { count: 8, length: 0.086, width: 0.040, reach: 0.059, cup: 0.016, z: 0.025, radius: 0.038, phase: 0.18, pale: true },
  ];
  rings.forEach((r, tier) => {
    const g = peonyPetal(r);
    for (let i = 0; i < r.count; i++) {
      const angle = i * Math.PI * 2 / r.count + r.phase;
      const axis = new THREE.Group(); axis.rotation.z = angle; flower.add(axis);
      const pivot = new THREE.Group(); pivot.position.set(0, r.radius, r.z); axis.add(pivot);
      const m = mesh(g, pink, `MainPetal.${tier}.${i}`, pivot);
      m.scale.set(1 + 0.055 * Math.sin(i * 2.8 + tier), 1 + 0.045 * Math.cos(i * 1.7 + tier), 1);
      petals.push({ pivot, delay: 0.29 + tier * 0.085, fold: 0.92 - tier * 0.17 });
    }
  });
  const receptacle = mesh(new THREE.SphereGeometry(0.035, 18, 10), yellow, 'PaleGoldenHeart', flower);
  receptacle.position.z = 0.057; receptacle.scale.z = 0.58;
  const filaments = [], anthers = [];
  for (let i = 0; i < 28; i++) {
    const a = i * Math.PI * 2 / 28, r = 0.037 + 0.005 * Math.sin(i * 2.4), h = 0.091 + 0.006 * Math.sin(i * 1.8);
    filaments.push(tube([[Math.cos(a) * 0.012, Math.sin(a) * 0.012, 0.052], [Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7, 0.077], [Math.cos(a) * r, Math.sin(a) * r, h]], 0.00125, 8, 5));
    const ball = new THREE.SphereGeometry(0.0043, 8, 6); ball.scale(1, 1.15, 0.82); ball.translate(Math.cos(a) * r, Math.sin(a) * r, h); anthers.push(ball);
  }
  mesh(merge(filaments), yellow, 'TwentyEightFineStamens', flower);
  mesh(merge(anthers), yellow, 'TwentyEightPaleAnthers', flower);

  // Smaller cup-shaped buds open upward and toward the viewer, below the head.
  budCenters.forEach((center, side) => {
    const bud = new THREE.Group(); bud.name = side ? 'CuppedBud.Right' : 'CuppedBud.Left'; bud.position.fromArray(center);
    bud.rotation.set(-0.20, side ? 0.12 : -0.12, side ? -0.18 : 0.20); plant.add(bud); budGroups.push(bud);
    const budBase = mesh(new THREE.SphereGeometry(0.032, 14, 9), stem, 'BudCalyx', bud); budBase.scale.set(1, 0.42, 0.7);
    for (let tier = 0; tier < 2; tier++) {
      const g = peonyPetal({ length: tier ? 0.079 : 0.087, width: tier ? 0.028 : 0.035, reach: tier ? 0.004 : 0.025, cup: 0.012, pale: !!tier, bud: true });
      for (let i = 0; i < 5; i++) {
        const axis = new THREE.Group(); axis.rotation.y = i * Math.PI * 2 / 5 + (tier ? 0.48 : 0); bud.add(axis);
        const pivot = new THREE.Group(); pivot.position.y = tier ? 0.013 : 0; pivot.rotation.x = 0; axis.add(pivot);
        const m = mesh(g, pink, `BudPetal.${side}.${tier}.${i}`, pivot); m.scale.y = 1 + 0.055 * Math.sin(i * 2.3);
        petals.push({ pivot, delay: 0.20 + tier * 0.065, fold: tier ? -0.1 : -0.3 });
      }
    }
  });

  function setGrowth(value) {
    if (disposed) return;
    const t = Number.isFinite(value) ? clamp(value) : 0;
    root.visible = t > 0;
    const stemGrowth = ease(0, 0.76, t);
    plant.scale.setScalar(0.014 + 0.986 * stemGrowth);
    for (const item of leaves) item.pivot.scale.setScalar(0.01 + 0.99 * ease(item.delay, 0.8, t));
    for (const item of petals) {
      const open = ease(item.delay, 1, t);
      item.pivot.rotation.x = item.fold * (1 - open);
      item.pivot.scale.setScalar(0.04 + 0.96 * ease(0.17, 0.82, t));
    }
    for (const bud of budGroups) bud.scale.setScalar(1.16 * (0.04 + 0.96 * ease(0.15, 0.86, t)));
    root.userData.growth = t; root.updateMatrixWorld(true);
  }
  function dispose() {
    if (disposed) return; disposed = true;
    for (const g of geometries) g.dispose();
    for (const m of materials) m.dispose();
    root.visible = false; root.userData.disposed = true;
  }
  root.userData.spec = PEONY_BLOOM_SPEC; root.userData.setGrowth = setGrowth; root.userData.dispose = dispose;
  root.userData.disposed = false; setGrowth(1); return root;
}
export default createPeonyBloom;
