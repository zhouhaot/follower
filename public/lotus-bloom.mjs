/**
 * New, procedural SCAN-A lotus. This is NOT the supplied relief-card GLB.
 * Units: card width = 1; centered card is XY, +Y up, +Z out of the print.
 * The planted root is (0, -0.154, 0.008), near the original vase opening.
 * No textures, image planes, external requests, renderer or animation loop.
 *
 * const bloom = createLotusBloom(); scene.add(bloom);
 * bloom.userData.setGrowth(0); // invisible seed, still attached at the root
 * bloom.userData.setGrowth(1); // complete sculpture, default on creation
 * bloom.userData.dispose();   // idempotent; caller removes group from scene
 */
import * as THREE from 'three';

export const LOTUS_BLOOM_SPEC = Object.freeze({
  version: 'procedural-lotus-1',
  provenance: 'New procedural interpretation of the supplied original lotus illustration',
  units: 'card-width',
  cardAspect: 1255 / 884,
  cardPlane: 'XY',
  outwardAxis: '+Z',
  root: Object.freeze([0, -0.154, 0.008]),
  flowerCenter: Object.freeze([0, 0.265, 0.33]),
  petals: 21,
});

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const color = (hex) => new THREE.Color(hex);

/** Closed, curved, finite-thickness petal. The blue back and white margins
 * are vertex colours on real geometry, not a picture of a petal. */
function petalGeometry({ height, reach, width, cup = 0.023, thickness = 0.0022, green = false }) {
  const rows = 20, columns = 12, layerSize = (rows + 1) * (columns + 1);
  const positions = [], colors = [], indices = [];
  const base = color(green ? 0x108f86 : 0x4f9be6);
  const middle = color(green ? 0x52d2bb : 0xb5daff);
  const edge = color(green ? 0xc0fbe0 : 0xffffff);
  const c = new THREE.Color();
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i <= rows; i++) {
      const t = i / rows, bell = Math.pow(Math.max(0, Math.sin(Math.PI * t)), 0.72);
      const w = width * bell * (0.72 + 0.28 * t) + 0.00025;
      for (let j = 0; j <= columns; j++) {
        const u = j / columns * 2 - 1;
        const x = w * u;
        const y = height * t + 0.018 * u * u * bell;
        const ridge = Math.pow(1 - Math.abs(u), 2) * bell * 0.006;
        const z = reach * Math.pow(Math.sin(t * Math.PI * 0.52), 1.28)
          - cup * u * u * bell + ridge
          + (side === 0 ? 1 : -1) * thickness * (0.3 + 0.7 * bell) / 2;
        positions.push(x, y, z);
        c.copy(base).lerp(middle, smooth(0.04, 0.86, t));
        c.lerp(edge, Math.max(smooth(0.66, 0.98, Math.abs(u)) * 0.92, smooth(0.83, 1, t) * 0.92));
        if (side === 1) c.multiplyScalar(green ? 0.82 : 0.84);
        colors.push(c.r, c.g, c.b);
      }
    }
  }
  for (let i = 0; i < rows; i++) for (let j = 0; j < columns; j++) {
    const a = i * (columns + 1) + j, b = a + 1, d = a + columns + 1, e = d + 1;
    indices.push(a, b, e, a, e, d);
    indices.push(a + layerSize, e + layerSize, b + layerSize, a + layerSize, d + layerSize, e + layerSize);
  }
  const perimeter = [];
  for (let j = 0; j <= columns; j++) perimeter.push(j);
  for (let i = 1; i <= rows; i++) perimeter.push(i * (columns + 1) + columns);
  for (let j = columns - 1; j >= 0; j--) perimeter.push(rows * (columns + 1) + j);
  for (let i = rows - 1; i > 0; i--) perimeter.push(i * (columns + 1));
  for (let i = 0; i < perimeter.length; i++) {
    const a = perimeter[i], b = perimeter[(i + 1) % perimeter.length];
    indices.push(a, a + layerSize, b, b, a + layerSize, b + layerSize);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Merge same-material tube parts, so decorative veins need one draw call. */
function combine(geometries) {
  const positions = [], normals = [], indices = [];
  let offset = 0;
  for (const geometry of geometries) {
    positions.push(...geometry.attributes.position.array);
    normals.push(...geometry.attributes.normal.array);
    if (geometry.index) for (const value of geometry.index.array) indices.push(value + offset);
    else for (let i = 0; i < geometry.attributes.position.count; i++) indices.push(i + offset);
    offset += geometry.attributes.position.count;
    geometry.dispose();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  return geometry;
}

function tube(points, radius, segments = 24, radial = 7) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), segments, radius, radial, false);
}

function padPoint(r, theta, radius, back = false) {
  const fraction = r / radius;
  const scallop = 1 + 0.018 * Math.sin(9 * theta) * fraction * fraction;
  return [r * Math.cos(theta) * scallop, r * Math.sin(theta) * scallop,
    0.027 * fraction * fraction + 0.004 * Math.sin(theta * 5) * fraction ** 3 - (back ? 0.003 : 0)];
}

function padGeometry(radius) {
  const segments = 56, rings = 9, positions = [], colors = [], indices = [];
  const layerSize = (segments + 1) * (rings + 1);
  const inner = color(0x159f96), outer = color(0x69dfc0), rim = color(0xbdfde2), c = new THREE.Color();
  for (let side = 0; side < 2; side++) {
    for (let r = 0; r <= rings; r++) for (let j = 0; j <= segments; j++) {
      const f = r / rings, theta = j / segments * Math.PI * 2;
      positions.push(...padPoint(Math.max(0.0002, radius * f), theta, radius, side === 1));
      c.copy(inner).lerp(outer, f * 0.7).lerp(rim, smooth(0.86, 1, f) * 0.8);
      if (side) c.multiplyScalar(0.72);
      colors.push(c.r, c.g, c.b);
    }
  }
  for (let r = 0; r < rings; r++) for (let j = 0; j < segments; j++) {
    const a = r * (segments + 1) + j, b = a + 1, d = a + segments + 1, e = d + 1;
    indices.push(a, d, e, a, e, b, a + layerSize, e + layerSize, d + layerSize, a + layerSize, b + layerSize, e + layerSize);
  }
  for (let j = 0; j < segments; j++) {
    const a = rings * (segments + 1) + j, b = a + 1;
    indices.push(a, a + layerSize, b, b, a + layerSize, b + layerSize);
  }
  // Close the tiny central ring as well: this remains a real solid, not a sheet.
  for (let j = 0; j < segments; j++) indices.push(j, j + 1, j + layerSize, j + 1, j + 1 + layerSize, j + layerSize);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

/** Returns a standalone THREE.Group. All resources belong to this instance. */
export function createLotusBloom() {
  const root = new THREE.Group(); root.name = 'LotusBloom.ScanA.Procedural';
  const plant = new THREE.Group(); plant.name = 'PlantedShoot';
  plant.position.fromArray(LOTUS_BLOOM_SPEC.root); root.add(plant);
  const geometries = new Set(), materials = new Set(), petalPivots = [], leafPivots = [];
  let disposed = false;
  const material = (parameters) => {
    const m = new THREE.MeshPhysicalMaterial(parameters); materials.add(m); return m;
  };
  const petals = material({ vertexColors: true, roughness: 0.3, metalness: 0.025, clearcoat: 0.55, clearcoatRoughness: 0.32, side: THREE.DoubleSide });
  const leaves = material({ vertexColors: true, roughness: 0.38, metalness: 0.04, clearcoat: 0.7, clearcoatRoughness: 0.34, side: THREE.DoubleSide });
  const stemMat = material({ color: 0x31c4a3, roughness: 0.4, metalness: 0.03, clearcoat: 0.5 });
  const veinMat = material({ color: 0xbaf5d2, roughness: 0.52, metalness: 0.02 });
  const goldMat = material({ color: 0xf6cd77, roughness: 0.38, metalness: 0.24 });
  function mesh(geometry, mat, name, parent = plant) {
    geometries.add(geometry);
    const m = new THREE.Mesh(geometry, mat); m.name = name; m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  // All coordinates below are relative to the vase-root, not the card centre.
  const center = new THREE.Vector3(0, 0.419, 0.322);
  mesh(combine([
    tube([[0,0,0],[0.006,0.12,0.07],[-0.009,0.29,0.22],center.toArray()], 0.009, 34, 9),
    tube([[-0.009,0.012,0],[-0.074,0.20,0.05],[-0.18,0.35,0.10],[-0.278,0.54,0.175]], 0.0065),
    tube([[0.009,0.014,0],[0.09,0.20,0.052],[0.2,0.38,0.095],[0.276,0.54,0.175]], 0.0065),
  ]), stemMat, 'ThreeCurvedStems');

  // Two floating, sculptural lotus pads echo the original circular foliage.
  const padGeo = padGeometry(0.103);
  for (const side of [-1, 1]) {
    const pad = new THREE.Group(); pad.name = `RoundLeaf.${side < 0 ? 'Left' : 'Right'}`;
    pad.position.set(side * 0.277, 0.54, 0.175);
    pad.rotation.set(-0.21, side * -0.28, side * 0.16);
    plant.add(pad); leafPivots.push({ group: pad, delay: 0.21 });
    mesh(padGeo, leaves, 'CuppedLeaf', pad);
    const veins = [];
    for (let j = 0; j < 9; j++) {
      const angle = j / 9 * Math.PI * 2;
      const points = [0.05, 0.34, 0.65, 0.96].map(f => {
        const p = padPoint(f * 0.103, angle, 0.103); p[2] += 0.0014; return p;
      });
      veins.push(tube(points, 0.00085, 12, 5));
    }
    mesh(combine(veins), veinMat, 'NineRadialVeins', pad);
    const node = mesh(new THREE.SphereGeometry(0.0085, 12, 8), goldMat, 'LeafNode', pad); node.scale.z = 0.48; node.position.z = 0.003;
  }

  // The generous paired upper leaves retain the original sweeping bowl shape.
  const foliage = [
    { side: -1, y: 0.23, z: 0.145, h: 0.27, r: 0.072, w: 0.064, angle: 1.04, turn: -0.22, delay: 0.12 },
    { side: 1, y: 0.23, z: 0.145, h: 0.27, r: 0.072, w: 0.064, angle: 1.04, turn: 0.22, delay: 0.12 },
    { side: -1, y: 0.025, z: 0.035, h: 0.28, r: 0.048, w: 0.038, angle: 0.49, turn: -0.18, delay: 0.02 },
    { side: 1, y: 0.025, z: 0.035, h: 0.29, r: 0.05, w: 0.037, angle: 0.51, turn: 0.18, delay: 0.02 },
  ];
  foliage.forEach((f, i) => {
    const g = new THREE.Group(); g.name = `LanceLeaf.${i}`; g.position.set(f.side * 0.007, f.y, f.z);
    g.rotation.set(0, f.turn, -f.side * f.angle); plant.add(g); leafPivots.push({ group: g, delay: f.delay });
    mesh(petalGeometry({ height: f.h, reach: f.r, width: f.w, cup: 0.018, thickness: 0.0035, green: true }), leaves, 'SweptLeafBlade', g);
    const line = [0, 0.24, 0.5, 0.75, 0.98].map(t => [0, f.h * t, f.r * Math.pow(Math.sin(t * Math.PI * 0.52), 1.28) + Math.sin(Math.PI * t) * 0.006 + 0.0022]);
    mesh(tube(line, 0.0012, 22, 5), veinMat, 'RaisedMidrib', g);
  });

  const flower = new THREE.Group(); flower.name = 'LayeredWhiteBlueLotus'; flower.position.copy(center); plant.add(flower);
  const calyxGeo = petalGeometry({ height: 0.078, reach: 0.047, width: 0.028, cup: 0.009, green: true });
  for (let i = 0; i < 5; i++) {
    const calyx = mesh(calyxGeo, leaves, `Sepal.${i}`, flower); calyx.rotation.y = i / 5 * Math.PI * 2; calyx.position.y = -0.047;
  }

  const rings = [
    { count: 8, height: 0.169, reach: 0.222, width: 0.075, cup: 0.035, y: 0, phase: Math.PI / 8, close: -0.87, delay: 0.25 },
    { count: 7, height: 0.235, reach: 0.144, width: 0.067, cup: 0.030, y: 0.012, phase: 0, close: -0.58, delay: 0.34 },
    { count: 6, height: 0.255, reach: 0.073, width: 0.045, cup: 0.019, y: 0.020, phase: Math.PI / 6, close: -0.26, delay: 0.43 },
  ];
  rings.forEach((ring, ringIndex) => {
    const geometry = petalGeometry(ring);
    for (let i = 0; i < ring.count; i++) {
      const azimuth = new THREE.Group(); azimuth.rotation.y = i / ring.count * Math.PI * 2 + ring.phase;
      azimuth.position.y = ring.y; flower.add(azimuth);
      const pivot = new THREE.Group(); azimuth.add(pivot);
      const petal = mesh(geometry, petals, `Petal.${ringIndex}.${i}`, pivot);
      // Gentle deterministic asymmetry avoids a mechanical stack of identical rings.
      petal.scale.set(1 + 0.032 * Math.sin(i * 2.7), 1 + 0.035 * Math.sin(i * 1.8 + ringIndex), 1);
      petalPivots.push({ group: pivot, close: ring.close, delay: ring.delay + (i % 3) * 0.014 });
    }
  });

  const heart = mesh(new THREE.SphereGeometry(0.037, 20, 12), goldMat, 'GoldenReceptacle', flower);
  heart.position.y = 0.102; heart.scale.y = 0.54;
  const antherGeo = new THREE.SphereGeometry(0.004, 8, 6);
  const filamentGeo = new THREE.CylinderGeometry(0.0011, 0.0016, 1, 5);
  geometries.add(antherGeo); geometries.add(filamentGeo);
  const heads = new THREE.InstancedMesh(antherGeo, goldMat, 24); heads.name = 'GoldenAnthers'; flower.add(heads);
  const filaments = new THREE.InstancedMesh(filamentGeo, goldMat, 24); filaments.name = 'FineFilaments'; flower.add(filaments);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 24; i++) {
    const angle = i / 24 * Math.PI * 2, h = 0.046 + 0.007 * Math.sin(i * 2.1);
    const x = Math.sin(angle) * 0.031, z = Math.cos(angle) * 0.031;
    dummy.position.set(x, 0.082 + h / 2, z); dummy.scale.set(1, h, 1); dummy.updateMatrix(); filaments.setMatrixAt(i, dummy.matrix);
    dummy.position.y = 0.082 + h; dummy.scale.set(1, 1.3, 1); dummy.updateMatrix(); heads.setMatrixAt(i, dummy.matrix);
  }
  heads.instanceMatrix.needsUpdate = true; filaments.instanceMatrix.needsUpdate = true;

  function setGrowth(value) {
    if (disposed) return;
    const t = Number.isFinite(value) ? clamp(value) : 0;
    root.visible = t > 0;
    // Collapse toward the actual printed vase opening; do not scale about origin.
    const lift = smooth(0, 0.77, t);
    plant.scale.set(0.45 + 0.55 * lift, 0.018 + 0.982 * lift, 0.018 + 0.982 * lift);
    for (const item of leafPivots) {
      const progress = smooth(item.delay, 0.8, t); item.group.scale.setScalar(0.008 + 0.992 * progress);
    }
    for (const item of petalPivots) {
      const progress = smooth(item.delay, 1, t);
      item.group.rotation.x = item.close * (1 - progress);
      item.group.scale.setScalar(0.08 + 0.92 * smooth(0.14, 0.7, t));
    }
    root.userData.growth = t;
    root.updateMatrixWorld(true);
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const geometry of geometries) geometry.dispose();
    for (const mat of materials) mat.dispose();
    heads.dispose(); filaments.dispose();
    root.visible = false;
    root.userData.disposed = true;
  }
  root.userData.spec = LOTUS_BLOOM_SPEC;
  root.userData.setGrowth = setGrowth;
  root.userData.dispose = dispose;
  root.userData.disposed = false;
  setGrowth(1);
  return root;
}

export default createLotusBloom;
