# Hand-held card layers

The supplied `public/assets/models/lotus-relief.glb` is used unchanged. Its SHA-256 remains `4d0b0e912d24dafb5186d62569a58729b34407352f11f871b960c593e4fd9ac3`. The scene contains the exact source card and presentation lights only. No hand geometry, substitute card, pedestal, glass, floor, supports, painted highlights, or bloom is introduced.

## Assets

- `public/assets/renders/handheld-relief.webp`: transparent, independently layerable relief side
- `public/assets/renders/handheld-front.webp`: the same complete source card rotated 180° about glTF Y, showing its exact embedded original illustration
- `public/assets/renders/handheld-card.metadata.json`: relief-side source, camera, lighting, material, and projection provenance
- `public/assets/renders/handheld-card-original.metadata.json`: corresponding original-side provenance

Both final layers use a 1200 × 1600 transparent frame. The surrounding empty pixels are registration space, not padding to crop away. Place each complete image in the same 3:4 composition box as the independent hand photograph. The card is above the hand in stacking order; do not bake the hand into either card asset.

The hand photograph may be scaled or translated separately to put its support line against the card’s bottom-center contact. The V3 hand preview aligned approximately with a bottom-center scale of 0.8, but its final placement should be checked in the combined page at desktop and phone widths.

## Camera and contact

The coordinate system is glTF/Three.js: metres, +Y up, and +Z toward the metal relief face. The unchanged card is centred at the origin.

- Camera position: `[0.07, 0.032, 0.34]`
- Camera target: `[0, 0, 0]`
- Vertical field of view: `23.385318092504964` degrees
- Reference aspect: `0.75`
- Projection-matrix elements 8 and 9: `[-0.003692448139190674, -0.16352689638733864]`
- Complete relief-side screen bounds: x `0.212528–0.801032`, y `0.098586–0.738586`
- Bottom contact in world space: `[0, -0.0455, 0.001]`
- Bottom contact in top-left-origin screen coordinates: `[0.5, 0.73]`

Apply projection offsets after updating the camera’s projection matrix. Update its inverse afterward. The matching tests project every source vertex with Three.js and compare it against the Blender render bounds. Other viewport aspects need the same contain-box conversion for the raster, hand, and live camera.

The bottom edge slopes slightly because this is a real perspective view. The contact is the middle of that edge, rather than its lowest right-hand corner.

## Rendering and material

`blender -b -t 8 --python scripts/render-handheld-card.py`

`blender -b -t 8 --python scripts/render-handheld-card.py -- --face original --samples 128`

Use `--preview` for a 600 × 800, 32-sample registration preview, or `--prepare-only` to calculate provenance without rendering. The relief master uses 256 Cycles CPU samples with adaptive sampling and no denoising. WebP encoding is lossless and retains exact alpha. PNG masters stay under `reports/handheld/`.

Only display materials on the four metal mesh groups receive restrained PBR overrides; the `FRONT` illustration material is skipped. The source GLB is never exported or written. A broad neutral upper-left key, quiet right bounce, and narrow overhead reflection reveal the actual relief. The metallic surface has micron-scale bump rather than a new sculpted texture.

## Verification boundary

`node --test tests/handheld-card-render.test.mjs` checks the source hash, untouched original material, finite camera configuration, actual source-vertex bounds, bottom-edge hand contact, and absence of added prop geometry in the renderer. CPU rendering, image inspection, and projection agreement are separate from browser GPU/WebGL or physical AR acceptance; this work does not establish either of those.
