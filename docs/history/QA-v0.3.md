# Verification status / 验证边界

Version 0.3.0, 2026-10-13 UTC. This is an independent owner-private hosted candidate, not a replacement of zevth.work or a complete Mac migration.

## Passed

- Static build copies the local runtime into `dist/`. Static HTML/module references resolve, and active browser modules pass syntax checks.
- Automated unit/integrity suite: **75/75 passed**. Coverage includes original image hashes, the recovered source baseline, canonical card identity, navigation return paths, unknown-card handling, all five distinct geometric models, camera lifecycle, stable recognition evidence, cancellation/retry, storage failure and cleanup. All twenty cross-card collection key/index combinations are rejected. Injected matcher/renderer integration checks are deterministic software tests, not real recognition tests.
- Source candidate rendered in the supported cloud Chromium at exact CSS viewport sizes **1440 × 900, 390 × 844 and 320 × 844**: **865/865 assertions passed**, over 19 route variants at each size (57 combinations). This covers the home, catalogue, collection, guide and all five work/preview/scan variants.
- The compact runtime was separately opened and exercised in the same browser: **922/922 assertions passed**, over the same 57 combinations. It has no broken image/resource references or stale active PNG references after lossless encoding.
- Browser checks cover the five preview mode controls, the lotus-only metal-card option, exact titles, all 25 selected-card/origin picker combinations, return-card preservation, links, empty collection after preview, no camera autoprompt/video on load, narrow-screen overflow and explicit unknown-card errors. Visible keyboard focus was checked on all 19 source route variants, with a final runtime Enter-to-switch picker test.
- Actual native wheel scrolling was checked again at all three viewport widths: the new glass layer lifts while the solid base stays in place, all five original fronts fan out, and reverse scrolling returns progress/lift/fan to zero and glass opacity to one. Twenty additional native-scroll/caption checks passed. No wheel interception or synthetic scroll library is used.
- The newly rendered hero glass/plinth layers, metal-card fallback and all five distinct flower fallback images were rendered directly from their respective three-dimensional geometry with Blender CPU and visually inspected. The fallback labels explicitly identify static renders.
- All **21 images** encoded for the compact runtime retain exactly equal decoded RGBA bytes and dimensions. No resizing, cropping or color changes were applied to those 21 source PNG conversions. The two newly authored hero scene renders use separate quality-94 WebP output, 1200 × 1400 each and 602,150 bytes combined; they are not lossless source-art conversions. Original PNGs remain byte-identical in the source package. `runtime-assets.json` lists source/runtime hashes, pixel hashes and sizes.
- The first release ZIP remains byte-identical with SHA-256 `633dcdede3ef4614e17435659239cc91906ef494d4d66c0497f260bae04c20dc`.

## Explicit runtime limitations

The supported cloud browser has WebGL disabled. Its fallback UI was rendered and tested, but this cannot prove live WebGL scene appearance, glass rendering, interactive three-dimensional controls, shader performance or successful MindAR matching. An earlier lotus-only original-target fixture reached an explicit unsupported-backend error. Stop left no video/canvas or collection entry. This verifies blocked-startup cleanup only. It does not validate successful recognition or the generalized five-card fixture.

The alternate shell Chromium launch also failed with a socket restriction. It supplied no successful browser evidence. Responsive coverage used ordinary same-origin CSS viewport frames, not physical-device emulation. Native reduced-motion preference emulation was not performed; reduced-motion CSS and finite-progress behavior were inspected, but the browser preference toggle remains unverified.

Selected-key binding and wrong-index rejection are verified software invariants. They cannot establish that the real matcher will never confuse similar printed card images. Actual image matching and all twenty physical wrong-card combinations must be tested separately.

## Remaining acceptance

1. Use a WebGL-enabled browser to validate the live hero GLB/glass scene, each of the five bloom previews, rendering performance and actual target-matcher integration.
2. Repeat the checklist in `AR-STATUS.md` for every original physical card on a real iPhone: camera permission, pose alignment, translation/tilt tracking, target loss/reacquisition, false-positive rejection, collection behavior, thermal performance and repeated stop/start. Android Chrome should follow.
3. Review the newly built flower interpretations against the actual card artwork. They are geometric candidates, not recovered Mac models or artist-approved final assets.
4. Validate a safe production source, backup and rollback path before any separate deployment approval. None has been executed here.

The source package includes the automated test output and this result summary. Raw cloud-browser capture files are kept separately for review and are not included in the deliverable.
