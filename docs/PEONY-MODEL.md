# 牡丹承瑞: procedural peony reconstruction

## Provenance and scope

`public/peony-bloom.mjs` is a **new procedural 3D reconstruction**, based on visual inspection of `public/assets/originals/peony/target.png` (877 × 1222). It is not a recovered historical AR model, a metal-card relief, a textured image plane, or a recoloured lotus. The lotus module was used only as an API/coordinate-contract reference.

The peony has its own broad, scalloped petal construction and composition: one large layered pink open head, a pale-yellow stamen centre, two smaller cupped buds below it, and turquoise pointed ovate foliage. The original frame, symbols, printed vase, and loose decorative petals are deliberately not geometry in the botanical model; the vase remains on the physical card.

## Integration API

```js
import { createPeonyBloom, PEONY_BLOOM_SPEC } from './peony-bloom.mjs';
const bloom = createPeonyBloom(); // new THREE.Group, fully grown
imageTargetAnchor.add(bloom);
bloom.userData.setGrowth(0); // hidden seed state
bloom.userData.setGrowth(t); // caller-driven growth, 0..1
bloom.userData.setGrowth(1); // restores the complete open pose
imageTargetAnchor.remove(bloom);
bloom.userData.dispose(); // safe to call repeatedly
```

The only dependency is the project's pinned Three.js r160 (`three`). There is no renderer, animation loop, camera permission request, network fetch, texture, image plane, or external model load. The caller owns lighting, rendering, image-target placement, tracking state and animation timing.

`setGrowth` clamps finite numbers to `[0, 1]`; other input becomes zero. It updates world matrices immediately and allocates no new geometry or materials. `userData.growth`, `userData.disposed` and `userData.spec` expose state. Disposed instances stay invisible and ignore subsequent growth calls. Every created instance owns independent GPU resources.

## Coordinate and growth contract

- Card width is 1; the card origin is its centre, card plane XY, +Y toward its printed top and +Z outward.
- Card aspect is `1222 / 877`, approximately 1.39338655.
- The visually estimated centre of the printed vase's top opening is pixel `(438.5, 692)`.
- Planted root: `(0, -81 / 877, 0.012)`, approximately `(0, -0.09236032, 0.012)`.
- Main flower centre: `(0, 0.316, 0.230)`.
- Full-grown bounding box: x `[-0.321950, +0.337523]`, y `[-0.235907, +0.559625]`, z `[+0.005259, +0.336802]`.

The child `PlantedShoot` remains at the vase mouth throughout growth. Stem emergence scales around that local origin, then foliage, buds and individually hinged petals unfurl in staggered stages. Lower leaves may extend below the mouth, as they do in the source artwork. The group should be attached directly to a normalized image-target anchor; do not recenter its bounding box or normalize it again. Exact physical-card registration still requires a real-card test.

## Geometry and materials

- 30 broad main petals in staggered tiers of 12, 10 and 8. Each has a scalloped crown, shallow flutes, a curved face and back, and a stitched finite-thickness perimeter.
- Two lower cup-shaped buds, each with 10 petals and a small turquoise calyx.
- 12 pointed ovate leaves, each a closed curved shell, with raised central veins and connecting petioles.
- Curved tube branches tied to the same planted root.
- A pale-yellow receptacle, 28 fine tubular filaments and 28 rounded anthers.
- Five physical materials: pink vertex-coloured petals, turquoise vertex-coloured foliage, stems, pale veins and pale-yellow centres.
- Deterministic variation in petal size and placement; no random-number state or shared instance resources.

Full-growth budget:

| Metric | Count |
| --- | ---: |
| Rendered triangles | 63,444 |
| Mesh/draw objects | 81 |
| Unique geometry resources | 38 |
| Unique materials | 5 |
| Textures | 0 |

## Verification

`node --test tests/peony-geometry.test.mjs` verifies:

1. Exact reference dimensions, card/root relationship, API and peony-specific composition.
2. All 62 petal and leaf shells have closed, consistently oriented two-manifold topology and positive enclosed volume.
3. Finite coordinates, normals and colours; valid indices; less than 70,000 rendered triangles and 90 draw objects.
4. Fixed root throughout growth, clamping and invalid inputs, tiny emergence state, and exact full-pose restoration.
5. Deterministic geometry/transforms, independent instance resources and exactly-once idempotent disposal.
6. The shipped static fallback's source and image checksums, PNG dimensions, and transparent RGBA format.

This is geometry/runtime-contract verification. The cloud browser reports WebGL disabled. No mobile GPU, camera tracking, physical-card recognition, browser-rendered shading or device performance pass is claimed.

## Honest static fallback

`public/assets/renders/peony-bloom.png` is a transparent 1000 × 1000 PNG rendered from this module's exact full-growth positions, indices, world transforms and vertex colours using Blender 4.3.2 Cycles on CPU, 128 samples, with denoising disabled. It contains no card/image plane. Standard colour management and neutral studio lighting preserve the artwork's rich pink and turquoise palette; this is not a pixel-identical Three.js shader preview.

The image was inspected for the large layered pink head, visible pale-yellow centre, two smaller cupped buds, pointed turquoise leaves, transparent background and unclipped framing. The accompanying `peony-bloom.metadata.json` records module, reference and image SHA-256 hashes, geometry budget and render settings. This PNG is a static geometry fallback, not live 3D, camera footage or successful AR tracking.
