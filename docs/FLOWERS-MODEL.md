# 花开有声: three five-petal flowers

## Provenance

`public/flowers-bloom.mjs` is a newly built procedural interpretation of the supplied original `public/assets/originals/target.png`, visually inspected at its actual 900 × 1260 dimensions. It is not a recovered historical AR asset, a lotus recolour, an image plane, or a card relief. It depends only on the existing Three.js r160 import map. There are no textures, network requests, renderers, or owned animation loops.

## API

```js
import { createFlowersBloom, FLOWERS_BLOOM_SPEC } from './flowers-bloom.mjs';
const bloom = createFlowersBloom();
imageTargetAnchor.add(bloom);
bloom.userData.setGrowth(0); // hidden seed state
bloom.userData.setGrowth(t); // caller-controlled emergence, 0..1
bloom.userData.setGrowth(1); // full bouquet, also the default
imageTargetAnchor.remove(bloom);
bloom.userData.dispose(); // idempotent, instance-owned resources
```

`userData.spec` contains `FLOWERS_BLOOM_SPEC`; `growth` and `disposed` expose state. Non-finite input, including strings and undefined, becomes zero; finite input clamps to `[0, 1]`. Growth calls after disposal are harmless. Each instance owns distinct resources; disposing one never damages another. `setGrowth` updates matrices immediately without allocating geometry or materials. The caller owns lighting, animation timing, tracking state, and target reacquisition policy.

## Coordinates and registration

- One unit equals card width. The centred card is XY, +Y points toward its top, and +Z emerges from its front.
- The source card aspect is `1260 / 900 = 1.4`.
- Image-derived root: `(0, -0.0833333333, +0.008)`, corresponding to the printed vase-mouth centre at about pixel `(450, 705)`.
- Main blossom centres: top `(0, 0.3444444444, 0.243)`; left `(-0.1511111111, 0.1655555556, 0.207)`; right `(0.15, 0.1533333333, 0.218)`.
- Fully open bounds: x `[-0.374710, +0.374710]`, y `[-0.086436, +0.478973]`, z `[+0.002734, +0.327199]`.

These are visually derived registration estimates, not physical-card measurements. Keep the group’s root aligned to the target’s normalized image plane. Do not centre or normalize the group by its own bounding box. The vase remains in the printed target; the geometry grows from its mouth. A 64 mm preview uses a scalar of `0.064` beside a `0.064 × 0.0896` card.

## Artwork-specific reconstruction

The original is a triangular spray of **three separate blossoms, each with five rounded broad petals**, rather than one layered lotus head. All 15 petals are fully closed, curved shells with real front/back surfaces and thick rims. Their colour gradients carry coral pink, blush highlights, and deeper backs. Each head includes a cream ring, convex mint centre, a mint inner ring, 18 outward-curving cream filaments with round tips, and a small green calyx.

Three continuous curved mint stems converge at the vase mouth. Six pointed mint blades echo the original upright lance foliage and have raised midribs. Two additional rose-coloured sprays, each with three slim closed blades, retain the source’s lateral pink foliage; their supporting branches converge at the same mouth to create a coherent freestanding sculpture. Decorative borders, corner ornaments, and the printed vase are not part of the bouquet geometry.

Growth scales the planted shoot around the fixed vase-mouth root, develops foliage and flower heads in stages, and unfolds each radial petal toward its final front-facing pose. The full-open composition is exactly restorable.

## Budget and tests

- 42,484 rendered triangles
- 50 mesh draw objects
- 36 unique geometry resources
- 5 physical materials
- No textures or external model loads

Run `node --test tests/flowers-geometry.test.mjs`.

All five focused tests pass. They cover the original three-head/five-petal composition, closed two-manifold petal and leaf shells, meaningful depth, absence of image-plane substitutes, finite vertex attributes, index bounds, triangle/draw budgets, fixed-root growth, invalid-input handling, exact pose restoration, deterministic geometry, idempotent disposal, resource isolation, and source/reference/render provenance hashes with an RGBA PNG header.

## Transparent fallback and validation limit

`public/assets/renders/flowers-bloom.png` is a 1000 × 1000 RGBA render of this exact module’s full-grown mesh geometry, world transforms and vertex colours, rendered with Blender Cycles on CPU, 96 samples, denoising disabled. Physical base colour, roughness, metalness, clearcoat and coat roughness are mapped to Blender’s Principled shader; this is not a claim of pixel-identical WebGL shading. It contains no printed card or reference-image compositing. `flowers-bloom.metadata.json` records provenance and SHA-256 hashes. This is an honest static rendering of the newly built sculpture.

The cloud browser has WebGL disabled. Focused numeric tests and CPU-rendered shape inspection do **not** validate browser WebGL appearance, mobile GPU performance, camera recognition, tracking, or physical-card registration. The fallback must be labelled as a rendered preview, never as a successful live AR capture.
