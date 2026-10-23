# 菊影流金: newly rebuilt 3D chrysanthemum

## Source and visual interpretation

`public/chrysanthemum-bloom.mjs` is a new procedural reconstruction made after inspecting `public/assets/originals/chrysanthemum/target.png` (875 × 1228). It is not a migrated historical model, metal relief, or the lotus recoloured.

The original's defining silhouette is preserved as a single asymmetric orange/gold pinwheel with hooked petal tips, a turquoise oval heart, radiating pale-gold stamens, and a sinuous stem rooted at the lower right. Three substantial deeply cut turquoise leaves plus two smaller leaves follow the original branching arrangement. The pink border decorations, floating motifs, and background are intentionally not part of the living plant sculpture.

The blossom uses twelve individually curved, closed-shell petals. Each petal's centreline bends back at its tip; its face cups and rises in depth. Coral/orange faces blend into pale-gold margins through vertex colours. The deeply lobed leaves have real curved surfaces, separate backs, finite-thickness closed rims, and raised veins that follow their surfaces. There are no textures, image planes, billboards, external model loads, or copied lotus geometry.

## API and placement

```js
import { createChrysanthemumBloom, CHRYSANTHEMUM_BLOOM_SPEC } from './chrysanthemum-bloom.mjs';
const bloom = createChrysanthemumBloom(); // standalone THREE.Group, fully grown
anchor.add(bloom);
bloom.userData.setGrowth(0);             // hidden at the printed branch root
bloom.userData.setGrowth(progress);      // caller-controlled 0..1
bloom.userData.setGrowth(1);             // exact full-grown pose
anchor.remove(bloom);
bloom.userData.dispose();               // idempotent
```

The module imports only Three.js r160 through `three`. It owns no renderer, network request, camera access, animation loop, or tracking decision. Instances own independent resources. Growth clamps finite input into `[0,1]`; non-finite input means zero. It immediately updates matrices without allocating new geometry or materials. Calls after disposal are harmless.

- Card width is 1; original height/width is `1228/875`.
- Card plane is XY, +Y is the image top, +Z is outward.
- Printed branch root: `(0.333, -0.624, 0.012)`.
- Flower centre: `(-0.020, 0.264, 0.244)`.
- Full-grown bounds: x `[-0.32947, 0.33777]`, y `[-0.63068, 0.57333]`, z `[0.00472, 0.37380]`.

Attach directly to a card-width-normalized image anchor. Do not recenter by the model's bounding box. Growth takes place around the printed branch endpoint, followed by staggered leaf expansion and hooked-petal unfurling.

## Budget and verification

- 23,656 rendered triangles
- 27 mesh draw objects and 27 owned geometry resources
- 6 physical materials
- 0 textures and 0 external asset requests

Run `node --test tests/chrysanthemum-geometry.test.mjs`. Four focused tests cover distinctive geometry signatures against both lotus and hibiscus, deterministic construction, closed two-manifold petal/leaf shells, finite indexed attributes, card-relative bounds, geometry budgets, the fixed printed root during growth, clamping, exact open-pose restoration, independent instance resources, and idempotent disposal.

## Transparent fallback

`public/assets/renders/chrysanthemum-bloom.png` is rendered from the module's exact fully grown world-space geometry and vertex colours in Blender Cycles on CPU, at 1000 × 1000 with 192 samples and denoising disabled. It contains the new sculpture only, with transparent background. The accompanying `.metadata.json` records source and output SHA-256 hashes, the original used for visual reference, and rendering provenance.

The fallback and automated geometry checks are not browser WebGL, mobile GPU, camera-tracking, or physical-card registration validation. Cloud browser WebGL is disabled; those checks remain for a supported device with the actual printed card.
