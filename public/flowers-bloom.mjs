/**
 * Newly reconstructed 花开有声: three separate five-petal pink flowers.
 * Card width = 1, centred card XY, +Y top, +Z toward viewer.
 * No image planes, textures, fetches, renderer, or owned animation loop.
 */
import * as THREE from 'three';

export const FLOWERS_BLOOM_SPEC = Object.freeze({
  version: 'procedural-flowers-1',
  provenance: 'New procedural interpretation of the supplied 花开有声 target',
  units: 'card-width', cardAspect: 1260 / 900, cardPlane: 'XY', outwardAxis: '+Z',
  targetSize: Object.freeze([900, 1260]),
  root: Object.freeze([0, -75 / 900, 0.008]),
  flowerCenters: Object.freeze([
    Object.freeze([0, 310 / 900, 0.243]),
    Object.freeze([-136 / 900, 149 / 900, 0.207]),
    Object.freeze([135 / 900, 138 / 900, 0.218]),
  ]),
  blossoms: 3, petalsPerBlossom: 5, petals: 15,
});
const clamp = x => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** Two curved faces with a closed rim. The broad, round-ended petal is
 * deliberately unlike a pointed lotus petal. Vertex colours model its blush. */
function bladeGeometry({ length, width, curl, leaf = false, pink = false }) {
  const rows = leaf ? 15 : 20, columns = leaf ? 8 : 12;
  const stride = columns + 1, layer = (rows + 1) * stride;
  const positions = [], colors = [], indices = [];
  const dark = new THREE.Color(leaf ? (pink ? 0xf64781 : 0x159a91) : 0xf43f7c);
  const light = new THREE.Color(leaf ? (pink ? 0xff9bb8 : 0x72e0c6) : 0xffa7bf);
  const rim = new THREE.Color(leaf ? (pink ? 0xff779e : 0x9af3db) : 0xff6e9d);
  const c = new THREE.Color();
  for (let side = 0; side < 2; side++) for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    const bell = Math.pow(Math.sin(Math.PI * t), leaf ? 1.05 : 0.61);
    const halfWidth = width * bell * (leaf ? (0.65 + 0.35 * t) : (0.78 + 0.22 * t)) + 0.00018;
    for (let col = 0; col <= columns; col++) {
      const u = col / columns * 2 - 1;
      const x = u * halfWidth;
      const y = length * t + (leaf ? 0.002 : 0.009) * u * u * bell;
      const z = curl * (0.4 * Math.sin(Math.PI * t) + 0.8 * t * t)
        - (leaf ? 0.011 : 0.019) * u * u * bell
        + (leaf ? 0.005 : 0.003) * (1 - Math.abs(u)) * bell
        + (side ? -1 : 1) * (0.001 + 0.0014 * bell);
      positions.push(x, y, z);
      const core = Math.max(0, 1 - Math.abs(u) * 1.65);
      c.copy(dark).lerp(light, (0.26 + 0.66 * core) * Math.sin(Math.PI * t * 0.89));
      c.lerp(rim, smooth(0.72, 1, Math.abs(u)) * 0.7);
      if (side) c.multiplyScalar(0.78);
      colors.push(c.r, c.g, c.b);
    }
  }
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const a = row * stride + col, b = a + 1, d = a + stride, e = d + 1;
    indices.push(a, b, e, a, e, d, a + layer, e + layer, b + layer, a + layer, d + layer, e + layer);
  }
  const edge = [];
  for (let col = 0; col <= columns; col++) edge.push(col);
  for (let row = 1; row <= rows; row++) edge.push(row * stride + columns);
  for (let col = columns - 1; col >= 0; col--) edge.push(rows * stride + col);
  for (let row = rows - 1; row > 0; row--) edge.push(row * stride);
  for (let i = 0; i < edge.length; i++) {
    const a = edge[i], b = edge[(i + 1) % edge.length];
    indices.push(a, a + layer, b, b, a + layer, b + layer);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices); g.computeVertexNormals(); return g;
}
function tube(points, radius = 0.005, segments = 22, radial = 7) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), segments, radius, radial, false);
}
function merge(parts) {
  const p = [], n = [], indices = []; let offset = 0;
  for (const g of parts) {
    p.push(...g.attributes.position.array); n.push(...g.attributes.normal.array);
    for (const i of g.index.array) indices.push(offset + i);
    offset += g.attributes.position.count; g.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
  g.setIndex(indices); return g;
}

/** Returns a self-contained THREE.Group, fully grown by default. */
export function createFlowersBloom() {
  const root = new THREE.Group(); root.name = 'FlowersBloom.HuaKaiYouSheng.Procedural';
  const plant = new THREE.Group(); plant.name = 'PlantedShoot';
  plant.position.fromArray(FLOWERS_BLOOM_SPEC.root); root.add(plant);
  const geometries = new Set(), materials = new Set(), leafPivots = [], petalPivots = [], flowerPivots = [];
  let disposed = false;
  function material(options) { const m = new THREE.MeshPhysicalMaterial(options); materials.add(m); return m; }
  const petalMat = material({ vertexColors: true, roughness: 0.38, clearcoat: 0.32, clearcoatRoughness: 0.38 });
  const leafMat = material({ vertexColors: true, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.4 });
  const stemMat = material({ color: 0x36baa5, roughness: 0.4, clearcoat: 0.32 });
  const creamMat = material({ color: 0xffebaf, roughness: 0.4, clearcoat: 0.15 });
  const mintMat = material({ color: 0x42bbaa, roughness: 0.36, clearcoat: 0.35 });
  function mesh(g, mat, name, parent = plant) {
    geometries.add(g); const m = new THREE.Mesh(g, mat); m.name = name;
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  const centers = FLOWERS_BLOOM_SPEC.flowerCenters.map(p => p.map((v, i) => v - FLOWERS_BLOOM_SPEC.root[i]));
  mesh(merge([
    tube([[0,0,0],[0,0.14,0.058],[0.001,0.31,0.15],centers[0]], 0.0057, 32, 8),
    tube([[0,0,0],[-0.035,0.1,0.066],[-0.09,0.204,0.14],centers[1]], 0.0051, 28, 8),
    tube([[0,0,0],[0.04,0.09,0.065],[0.10,0.204,0.145],centers[2]], 0.0051, 28, 8),
  ]), stemMat, 'ThreeCurvedFlowerStems');

  // The mint lance leaves remain clustered on the upright stems, unlike lotus pads.
  const leaves = [
    { at: [0,0.018,0.011], end: [-0.107,0.108,0.053], width: 0.024 },
    { at: [0,0.018,0.011], end: [0.10,0.135,0.066], width: 0.026 },
    { at: [0,0.023,0.022], end: [0.129,0.025,0.055], width: 0.020 },
    { at: [0,0.068,0.037], end: [0.004,0.184,0.07], width: 0.014 },
    { at: [0,0.166,0.077], end: [0.045,0.267,0.121], width: 0.021 },
    { at: [0,0.306,0.148], end: [-0.069,0.37,0.173], width: 0.017 },
  ];
  function addLeaf({ at, end, width, pink = false }, i) {
    const dx = end[0] - at[0], dy = end[1] - at[1], dz = end[2] - at[2];
    const length = Math.hypot(dx, dy), curl = dz / 0.8;
    const g = new THREE.Group(); g.name = `${pink ? 'Rose' : 'Mint'}Leaf.${i}`; g.position.fromArray(at);
    g.rotation.z = -Math.atan2(dx, dy); plant.add(g);
    leafPivots.push({ group: g, delay: pink ? 0.16 : 0.05 + i * 0.026 });
    mesh(bladeGeometry({ length, width, curl, leaf: true, pink }), leafMat, pink ? 'SlenderRoseBlade' : 'PointedMintBlade', g);
    if (!pink) {
      const midrib = [0,0.25,0.5,0.75,0.985].map(t => [0,length * t,curl * (0.4 * Math.sin(Math.PI * t) + 0.8 * t * t) + 0.005 * Math.sin(Math.PI * t) + 0.0025]);
      mesh(tube(midrib, 0.0007, 15, 5), creamMat, 'RaisedLeafMidrib', g);
    }
  }
  leaves.forEach(addLeaf);

  // Two pink sprays echo the separate rose foliage behind the lower blossoms.
  // Their supporting stems converge at the same vase mouth in the 3D arrangement.
  const sprayStems = [];
  for (const side of [-1, 1]) {
    const base = [side * 0.192,0.065,0.063];
    sprayStems.push(tube([[0,0.006,0.002],[side * 0.095,0.035,0.036],base],0.0025,20,6));
    const tips = [
      [side * 0.276,0.419,0.102],
      [side * 0.335,0.26,0.081],
      [side * 0.369,0.137,0.091],
    ];
    tips.forEach((end,i) => addLeaf({at:base,end,width:[0.010,0.017,0.018][i],pink:true},`${side}.${i}`));
  }
  mesh(merge(sprayStems), stemMat, 'TwoSupportingSprayStems');

  const petalGeometry = bladeGeometry({ length: 0.122, width: 0.064, curl: 0.054 });
  const flowerSettings = [
    { scale: 1, turn: 0.15, tilt: [-0.06,-0.10], delay: 0.21 },
    { scale: 0.88, turn: 0.28, tilt: [0.08,-0.15], delay: 0.29 },
    { scale: 0.90, turn: -0.2, tilt: [-0.06,0.14], delay: 0.34 },
  ];
  flowerSettings.forEach((f,index) => {
    const positioner = new THREE.Group(); positioner.position.fromArray(centers[index]); plant.add(positioner);
    positioner.rotation.set(f.tilt[0],f.tilt[1],f.turn);
    const flower = new THREE.Group(); flower.name = `FivePetalFlower.${index}`; positioner.add(flower);
    flowerPivots.push({group:flower,scale:f.scale,delay:f.delay});
    for (let i = 0; i < 5; i++) {
      const radial = new THREE.Group(); radial.rotation.z = i * 2 * Math.PI / 5; flower.add(radial);
      const pivot = new THREE.Group(); radial.add(pivot);
      const petal = mesh(petalGeometry,petalMat,`RoundedPetal.${index}.${i}`,pivot);
      petal.scale.set(1 + 0.032 * Math.sin(i * 2.3 + index),1 + 0.022 * Math.cos(i * 1.9),1);
      petalPivots.push({group:pivot,delay:f.delay + i * 0.014});
    }
    // A convex mint centre nested in a cream-gold ring, as in the printed target.
    const disk = mesh(new THREE.SphereGeometry(0.030,24,14),creamMat,`CreamFlowerHeart.${index}`,flower);
    disk.scale.z = 0.32; disk.position.z = 0.023;
    const core = mesh(new THREE.SphereGeometry(0.0217,24,14),mintMat,`MintFlowerHeart.${index}`,flower);
    core.scale.z = 0.46; core.position.z = 0.030;
    const innerRing = mesh(new THREE.TorusGeometry(0.0161,0.00165,8,32),stemMat,`MintHeartRim.${index}`,flower);
    innerRing.position.z = 0.039;
    const stamens = [];
    for (let i = 0; i < 18; i++) {
      const theta = i * 2 * Math.PI / 18 + 0.08;
      const tipR = 0.075 + 0.007 * Math.sin(i * 1.77);
      const start = [0.023 * Math.sin(theta),0.023 * Math.cos(theta),0.024];
      const tip = [tipR * Math.sin(theta),tipR * Math.cos(theta),0.061 + 0.006 * Math.cos(i * 1.5)];
      stamens.push(tube([start,[0.055 * Math.sin(theta),0.055 * Math.cos(theta),0.052],tip],0.00095,9,5));
      const bulb = new THREE.SphereGeometry(0.0042,10,6); bulb.translate(...tip); stamens.push(bulb);
    }
    mesh(merge(stamens),creamMat,`EighteenRadialStamens.${index}`,flower);
    const calyx = mesh(new THREE.SphereGeometry(0.029,18,10),stemMat,`GreenCalyx.${index}`,flower);
    calyx.position.z = -0.006; calyx.scale.z = 0.36;
  });

  function setGrowth(value) {
    if (disposed) return;
    const t = Number.isFinite(value) ? clamp(value) : 0;
    root.visible = t > 0;
    const rise = smooth(0,0.8,t);
    plant.scale.set(0.03 + 0.97 * rise,0.012 + 0.988 * rise,0.012 + 0.988 * rise);
    for (const leaf of leafPivots) leaf.group.scale.setScalar(0.012 + 0.988 * smooth(leaf.delay,0.82,t));
    for (const flower of flowerPivots) flower.group.scale.setScalar(flower.scale * (0.025 + 0.975 * smooth(flower.delay,0.89,t)));
    for (const petal of petalPivots) petal.group.rotation.x = 1.18 * (1 - smooth(petal.delay,1,t));
    root.userData.growth = t; root.updateMatrixWorld(true);
  }
  function dispose() {
    if (disposed) return; disposed = true;
    for (const g of geometries) g.dispose();
    for (const m of materials) m.dispose();
    root.visible = false; root.userData.disposed = true;
  }
  Object.assign(root.userData,{spec:FLOWERS_BLOOM_SPEC,setGrowth,dispose,disposed:false});
  setGrowth(1); return root;
}
export default createFlowersBloom;
