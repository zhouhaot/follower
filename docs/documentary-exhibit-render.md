# Documentary exhibit hero: rendered, not photographed

This is a physically based visual simulation of a small museum vitrine. It uses the supplied `public/assets/models/lotus-relief.glb` geometry. It is not a photograph of an actual object or exhibit.

## Runtime assets

- `public/assets/renders/hero-exhibit-base.webp`: card, solid plinth, bronze supports, and Cycles floor contact shadow, on alpha.
- `public/assets/renders/hero-exhibit-glass.webp`: only the five-pane glass cover, on alpha.
- `public/assets/renders/hero-exhibit.metadata.json`: source digest, rendering provenance, camera, and dimensions.

The two layers are registered to exactly the same 1200 × 1400 pixel frame (aspect 6:7). Display them in a common, fixed-aspect wrapper with the same bounds. Do not crop or scale one independently. The cover may translate upward and fade during scrolling. No extra CSS glass rectangle, bloom, drop shadow, fog, or light beam is needed. The intended page background is neutral near-black, `#0c0d0d`.

## Reproduce

From the project root, using Blender 4.3 and a Python installation with Pillow:

```sh
blender -b -t 8 --python scripts/render-documentary-exhibit.py
```

This defaults to Cycles CPU, 256 samples, 1200 × 1400, no denoiser. Raw PNGs go to `reports/exhibit/`, while the two required WebP files and metadata go to `public/assets/renders/`. WebP uses quality 94, method 6, retained alpha. The actual GLB is read but never rewritten. The original front image/material is explicitly skipped when adjusting the presentation materials.

For quick checks:

```sh
blender -b -t 8 --python scripts/render-documentary-exhibit.py -- --preview
blender -b -t 8 --python scripts/render-documentary-exhibit.py -- --preview --pass-name complete
```

`--samples` can override final samples, and `--pass-name base`, `glass`, or `complete` renders just that pass. `all` renders the physical comparison plus both layers. Preview/comparison images are reports, not runtime assets.

## Matching scene coordinates

All values are meters in Three.js/glTF convention: +Y up, +Z the metal relief face, +X right. Blender mapping is `(x, -z, y)`.

| Element | Position / dimensions |
| --- | --- |
| Supplied card | Center `(0, .0795, 0)`, original 64 × 91 mm geometry |
| Plinth | Center `(0, .0125, 0)`, size `.105 × .025 × .052`, bevel `.0009` |
| Cover | Outer `.091 × .115 × .040`, bottom Y `.025`, 0.7 mm walls |
| Cover top | Y `.140`; front/back panels end at `.1393` |
| Glass material | IOR 1.46, roughness .003, slight low-iron edge absorption |
| Support X positions | `±.023` |
| Support feet | Center Y `.02585`, size `.009 × .0018 × .013` |
| Uprights | Center `(±.023, .0302, -.0008)`, size `.0032 × .0083 × .0042` |
| Retaining lips | Center `(±.023, .0341, .00135)`, size `.0042 × .0028 × .0012` |
| Floor | Top Y `0` |
| Camera | Position `(.105, .123, .300)`, target `(0, .069, 0)` |
| Lens | Perspective, 80 mm, 36 mm sensor, explicit horizontal fit |
| Vertical FOV | 29.4166078° at 6:7 image aspect |

For a live scene keeping the card at the origin, subtract `.0795` from all Y coordinates: camera becomes `(.105, .0435, .300)`, target `(0, -.0105, 0)`, plinth center `(0, -.067, 0)`, glass bottom `-.0545`, floor `-.0795`.

## Surface and lighting decisions

- Solid honed charcoal stone, with small physical bevels and two scales of procedural mineral/microtexture.
- Satin pewter and subdued bronze accent presentation finishes, keeping the actual relief geometry and source front intact.
- Large elevated gallery key, quiet side bounce, modest overhead reflection, and neutral world illumination.
- Physical bronze support feet and retaining lips meeting the card’s lower edge.
- Five finite-thickness glass panels, without a glow shell or painted highlights.

## Layering approximations

The base is rendered without the cover. The glass pass is rendered in isolation, with the card, plinth, and floor excluded from every ray visibility. This intentionally avoids secondary ghost artwork and duplicated card imagery when the cover is lifted. Therefore the CSS composite approximates full glass refraction and secondary reflections. Thin low-iron panes make the displacement small. Glass shadow rays use straight-through transparency to avoid noisy planar-glass caustics; Fresnel, finite-thickness surface transmission and reflections remain modeled.

The optional `complete` pass is a full physical comparison containing those secondary reflections, and may show subtle reflected color from the supplied card’s original reverse-side artwork. It is not used as the layered runtime hero. No image-generation model, source-image editing, fake photographic provenance, or post-painted reflection was used.
