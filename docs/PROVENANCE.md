# Provenance / 来源与重建范围

Prepared 2026-10-13 UTC. The original glass exhibit is preserved as an owner-private candidate. This separate hand-held comparison is hosted publicly with login-free access. The original zevth.work production site is unchanged.

## Preserved originals

All five exact original full card fronts, target images, source museum photos, five compiled tracking targets, original MindAR runtime and original metadata were fetched from https://zevth.work/ and independently verified. `public/assets/originals/assets.json` records exact source URLs, bytes, dimensions and SHA-256 hashes. This candidate does not invent dates, accession numbers or museum metadata.

| Target index | Card key | Title | Source artwork |
|---|---|---|---|
| 0 | flowers | 花开有声 | 瓶插花卉图 |
| 1 | peony | 牡丹承瑞 | 瓶插牡丹图 |
| 2 | chrysanthemum | 菊影流金 | 摘枝菊花图 |
| 3 | lotus | 清荷入梦 | 荷花图 |
| 4 | leaves | 花叶生辉 | 芙蓉花图 |

Card image files are unchanged, including existing printed QR codes. No recreated front illustration substitutes for an original.

## Preserved metal-card asset, scheme B

`public/assets/models/lotus-relief.glb` is the exact existing Qinghe-Relief-Card-v2-web.glb, copied from the available cloud file. It contains 157,428 triangles, 5 meshes/materials and the original embedded lotus front image. Its dimensions are approximately 64 × 91 mm, Y-up, relief on +Z, original front on -Z. Standard PBR materials use an environment in the candidate viewer. The existing rendered PNGs are preserved. A new transparent static card render was made directly from the available finished Blender geometry, and a separate procedural-lotus render supplies the truthful WebGL fallback. These are scene renders, not replacements for original card artwork.

This asset is used for the hero/card design and metal-card preview. It is not used as a substitute for geometric flowers in scanning.

## One recovered source module

`docs/restored/flow.mjs` is the exact supplied 820-byte module, SHA-256:

83b84ccd3fdd0fafa071e99a890c53b9d9c6104dcf79876f832572d422afb1dd

The active `public/flow.mjs` is a narrow patched copy: returning from scan to preview now retains the selected card query. The source baseline above remains unchanged and is covered by an integrity test.

## Newly rebuilt code

The HTML pages, visual design/CSS, page rendering, scene viewer, lifecycle-safe scan adapter, isolated collection store, procedural lotus geometry, tests and documentation were newly written in the cloud. They are not presented as a recovered full Mac project. Only the first migration archive fragment was available and is not represented as a complete migration.

Scheme A (`public/lotus-bloom.mjs`) uses real procedural petal, leaf and stem geometry for flowers rising above the card. It is a new interpretation based on the actual original lotus art, not the unreceived prior Mac procedural model. Stage 2 adds four separate geometric interpretations: a three-head pink flower spray, a layered peony with two buds, an orange hooked-petal chrysanthemum, and a diagonal lilac hibiscus branch with five-lobed leaves. Each is image-derived and newly rebuilt, rather than a renamed lotus. Geometry availability does not establish physical recognition or mobile rendering readiness.

## Dependencies

- Three.js r160 / 0.160.0: package registry distribution, MIT license; vendored core and selected addons
- Original zevth.work MindAR runtime and target compilation: unchanged recovered public runtime (full URLs and checksums in assets.json)
- Noto Serif SC: subset of the existing local project font for the text actually used by this candidate

No runtime calls to third-party CDNs are required. No production storage schema was assumed or migrated.

## Preserved release boundary

The first 27,831,855-byte ZIP remains unchanged at SHA-256 `633dcdede3ef4614e17435659239cc91906ef494d4d66c0497f260bae04c20dc`. Stage 2 changes the working source to version 0.2.0 and will use a separate delivery artifact. All source front/target image hashes remain unchanged. Physical tracking is explicitly unvalidated for every card.

## Requested documentary material iteration, v0.3.0

The hero now uses an actual measured display case, beveled charcoal stone plinth, contacting supports and neutral gallery lighting. The original supplied GLB bytes and all five source artworks remain unchanged. Hero presentation materials and supporting scene geometry are newly authored. Two registered CPU-rendered 1200 × 1400 WebP layers provide the tested no-WebGL appearance (602,150 bytes combined), while the live Three.js exhibit is separately updated. These images are simulated exhibit renders, not museum photographs. Their glass overlay approximates refraction and omits secondary card reflections to permit clean reversible lifting; see `documentary-exhibit-render.md`. Existing v0.1/v0.2 release ZIPs are preserved.

## Independent hand-held variant (v0.4, 2026-10-13)

This variant was created only after the liked v0.3 exhibit's complete backup was verified and saved. It has a separate source directory and new Site identity. The existing owner-private exhibit and zevth.work are not replaced.

The hand is newly constructed animation work, not recovered Mac code or an actual filmed performance. It uses one official WebXR Input Profiles generic right-hand weighted mesh (MIT, ©2019 Amazon), reconstructed articulated pose chains, an extended wrist, and fixed projected skin detail. Its transparent frames are renders of that same model. Initial generated standalone hand photographs remain development studies; they are not substituted for individual animation poses. Exact source/license, texture prompts/alignment, rig settings and final frame provenance are retained by the hand renderer and asset manifest.

The original supplied metal GLB remains byte-identical. The original five card fronts and their canonical identities remain intact. Newly rendered metal face layers preserve the existing geometry and embedded original front artwork; all material presentation adjustments are documented separately in `HANDHELD-CARD-RENDER.md`.


## Front-facing orientation correction (v0.4.1, 2026-10-14)

The v0.4.0 runtime and full-source release ZIPs were verified unchanged before this correction, and remain separately saved. The same public Site identity is retained; the private glass exhibit and original zevth.work remain untouched.

The hand now maintains a camera-facing palm plane while the fingers spread laterally and the root lowers. The same source rig, weights and prior `CameraSkin` coordinates are reused; a fixed UV-space fade softens the wrist texture boundary. This is a new render of the same synthetic rig, not new independently generated poses. The webpage no longer adds the old scale/vertical registration offset. Its foreground hand stays opaque until withdrawal clears the card, then fades; the hidden redundant base layer prevents a premature layer-switch reveal.

The card and hand remain visibly separated in depth. Numerical clearance does not establish a physical grip. The orientation change does not make the hand photographic or validate live WebGL or device AR.
