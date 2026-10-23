# SCAN A: procedural growing lotus

## Provenance and scope

This is a **new procedural reconstruction/interpretation**, built for the cloud candidate from visual inspection of the supplied original blue-white lotus illustration. It is not a recovered historical AR asset and it is not the supplied metal relief GLB. The relief belongs to the separate hero/card presentation.

`public/lotus-bloom.mjs` has one dependency, Three.js r160 via the existing `three` import map. The model makes no fetches, requests no camera permissions, and owns no animation frame loop. There are no image planes, textures, billboards or flat relief plate in the model.

## API

```js
import { createLotusBloom, LOTUS_BLOOM_SPEC } from './lotus-bloom.mjs';

const bloom = createLotusBloom(); // THREE.Group, fully grown by default
anchor.add(bloom);
bloom.userData.setGrowth(0);     // hides the seed state
bloom.userData.setGrowth(t);     // caller-driven 0..1 emergence/opening
bloom.userData.setGrowth(1);     // complete bloom

// When removing or replacing this instance:
anchor.remove(bloom);
bloom.userData.dispose();       // idempotent; releases its owned resources
```

`setGrowth` clamps finite input into `[0, 1]`; non-finite input becomes zero. It updates matrices immediately and performs no per-frame geometry/material allocation. `userData.growth` stores the applied value. After disposal, growth calls are harmless and the group remains invisible. Distinct instances have distinct resources; disposing one does not invalidate another.

## Coordinate contract

- One unit equals the physical card width.
- Card origin is its centre. Card plane is XY, +Y points to the top of the print, and +Z points away from the card toward its front.
- Original aspect ratio is `1255 / 884` (height/width, approximately 1.419683).
- Root: `(0, -0.154, 0.008)`, aligned near the printed vase opening.
- Main blossom base/centre: `(0, 0.265, 0.330)`.
- Fully open bounds: x `[-0.39194, +0.39194]`, y `[-0.15852, +0.54812]`, z `[+0.00031, +0.56200]`.
- A 64 mm card preview uses `bloom.scale.setScalar(0.064)` alongside a card approximately `0.064 × 0.09086` units.

Attach this group directly to an image-target anchor whose normalized target width is 1. Do not re-normalize its bounds, centre it around its bounding box, or add the relief-card GLB. Those operations would move the stem off its printed root. The caller owns target-pose placement, lighting, renderer setup and the growth duration.

The growth is rooted at the vase opening. Stems rise away from that point, leaves grow in staggered stages, and individual petal pivots unfold by tier. The caller may reset growth after a genuine target reacquisition. This module does not decide whether tracking is valid.

## Geometry and art direction

- 21 curved, finite-thickness petals in three staggered radial layers: 8 outer, 7 middle, 6 inner.
- Vertex-colour gradients retain blue interiors, pale-blue faces and luminous white margins/tips; each petal has a separate back surface and closed perimeter.
- Five turquoise sepals support the bloom.
- Three curved stems, two cupped round leaves with raised radial veins, and four swept lance/bowl leaves echo the original composition.
- A small gold receptacle, 24 filaments and 24 anthers provide a restrained botanical centre.
- Five physical materials provide shaded volume and soft highlights without requiring an environment-map asset.
- Deterministic, slight petal asymmetry avoids mechanical repetition.

Geometry budget, fully grown:

| Metric | Count |
| --- | ---: |
| Mesh / instanced-mesh draw objects | 44 |
| Rendered triangles, including instances | 44,620 |
| Unique geometry resources | 21 |
| Unique materials | 5 |
| Textures / external model loads | 0 |

The default material uses real lighting. A hemisphere fill plus white directional key and soft cool fill are sufficient. Neutral lighting preserves the artwork's blue/white/turquoise palette better than a strong yellow metal-card lighting preset.

## Verification

Run `node --test tests/lotus-geometry.test.mjs` from the project root.

Four focused tests verify the Group/API, complete 3D content and absence of textures/image planes, closed two-manifold petal shells, finite indexed attributes, card-relative bounds, triangle/draw-object budgets, fixed root throughout growth, clamping, exact restoration of the open pose, and idempotent disposal/resource isolation. All four pass.

Cloud browser WebGL was reported disabled during this session. These tests do not prove actual camera tracking, mobile GPU performance, physical-card registration or browser-rendered visual fidelity. Those need a WebGL-enabled browser and the real printed card. A temporary CPU-rendered geometry inspection is an additional shape check only, not an AR/browser acceptance test.

## Static fallback

`public/assets/renders/lotus-bloom.png` is a 1000 × 1000 transparent RGBA fallback rendered from this module's exact full-grown mesh geometry, world transforms and vertex colours in Blender Cycles on CPU (96 samples). Its upright silhouette, layered flower, foliage and transparent framing were visually inspected. No original-card image or relief card is present in the render. This is a rendered view of the newly built 3D model, not an AR camera capture.

`public/assets/renders/lotus-bloom.metadata.json` records provenance and SHA-256 checksums of the source module and render. This fallback supports browsers without WebGL, but must not be described as live 3D or successful target recognition.
