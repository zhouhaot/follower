# 花叶生辉: newly rebuilt 3D hibiscus branch

## Source and visual interpretation

`public/leaves-bloom.mjs` is a new procedural reconstruction made after inspecting `public/assets/originals/leaves/target.png` (881 × 1255). The artwork is 芙蓉花图: a hibiscus-like violet/pink blossom on a diagonal lower-right-to-upper-left branch, with a closed upper-left bud and prominently five-lobed mint-green foliage. This model preserves that arrangement rather than substituting lotus leaves or a recoloured lotus blossom.

Twelve broad, scalloped, finite-thickness petals form two staggered tiers, with lilac/violet interiors and soft pink rims. Their curved faces cup toward the viewer. A mint centre, pale-gold ring, and twelve radiating gold filaments/anthers echo the printed flower. Six closed-shell palmate leaves have five pointed lobes, rounded valleys, shaped backs, raised radial veins, and varying size/orientation. The upper-right and lower-left leaves are deliberately larger. The upper-left closed bud has three pink/purple petals and three turquoise sepals.

All stems, flower parts, leaves, and veins are real mesh geometry. No image planes, textures, billboards, relief-card geometry, historical model files, or external assets are used. The pink borders, floating ornaments, and dark card background remain part of the print rather than the plant sculpture.

## API and placement

```js
import { createLeavesBloom, LEAVES_BLOOM_SPEC } from './leaves-bloom.mjs';
const bloom = createLeavesBloom(); // standalone THREE.Group, fully grown
anchor.add(bloom);
bloom.userData.setGrowth(0);
bloom.userData.setGrowth(progress); // caller-controlled 0..1
bloom.userData.setGrowth(1);
anchor.remove(bloom);
bloom.userData.dispose();          // idempotent
```

Only Three.js r160 via `three` is required. The module owns no rendering or animation loop, network request, camera permission, or tracking state. Instances own separate resources, while geometry can be shared within an instance. Growth is allocation-free for geometry/materials, clamps finite values to `[0,1]`, treats non-finite input as zero, and updates matrices immediately. Calls after disposal are harmless.

- Card width is 1; original height/width is `1255/881`.
- Card plane is XY; +Y points to the image top; +Z points outward.
- Printed branch root: `(0.333, -0.594, 0.012)`.
- Flower centre: `(0.066, 0.010, 0.277)`.
- Fully grown bounds: x `[-0.38222, 0.39543]`, y `[-0.59873, 0.56844]`, z `[0.00394, 0.43672]`.

Place the group directly beneath an image anchor normalized to card width. Do not centre the model by its bounds. The stem emerges from the lower-right printed endpoint, followed by staged palmate leaf growth, bud expansion, and petal opening.

## Budget and verification

- 45,776 rendered triangles
- 35 mesh draw objects
- 25 independent geometry resources and 6 physical materials
- 0 textures and 0 external asset requests

Run `node --test tests/leaves-geometry.test.mjs`. Four focused tests cover distinctive geometry signatures against chrysanthemum and lotus, deterministic construction, closed two-manifold petal/leaf shells, finite indexed attributes, card-relative bounds, budget, fixed-root growth, input clamping, exact restoration of the complete pose, resource isolation, and idempotent disposal.

## Transparent fallback

`public/assets/renders/leaves-bloom.png` is rendered directly from the module's fully grown geometry, world transforms, and vertex colours using Blender Cycles CPU at 1000 × 1000, 192 samples, denoising disabled. The background is transparent and no card image or relief geometry is included. Its `.metadata.json` stores source/render SHA-256 hashes and provenance.

This static render is an additional geometry/silhouette inspection, not a live 3D or AR capture. Browser WebGL is disabled in the cloud environment. Mobile GPU performance, live camera recognition, physical-card registration, and browser visual acceptance still require a supported device and printed target.
