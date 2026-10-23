# Continuous opening hand

The opening hand is one skinned mesh from the official immersive-web WebXR Input Profiles generic-hand asset. The public runtime uses 32 transparent render frames of that same articulated mesh. Reversing scroll indexes the same frames backward. It does not use separately generated hands, photographic still transforms, or crossfades as substitutes for finger motion.

Source: https://github.com/immersive-web/webxr-input-profiles/blob/main/packages/assets/profiles/generic-hand/right.glb

Source SHA-256: `291790c14f7f88a7f9bd35330c47392ed8e8d395ae6728f4bb7089f1bc1f2b96`.

The assets package uses the MIT license, copyright 2019 Amazon. The license is retained with the source and included in the public sequence directory. The upstream mesh has 1,360 vertices, 2,314 triangles, one skin, and 25 weighted hand joints. This variant adds a connected forearm extension outside the crop, reflected hand presentation, two levels of subdivision, smoothed welded normals, and dual-quaternion volume-preserving skinning. Finger chains are driven from absolute bind transforms with consistent hierarchical rigid deltas. The same mesh topology, weights, lighting, and camera are used throughout.

## Approved composition

The card source is immutable. The hand's camera copies the card renderer's exact 3:4 projection. It enters from the bottom and stays small compared with the card. Approved variant B starts at 42°/18°/5° finger flexion with modest adduction and an 8° palm tilt. It unfolds to an open palm while the root descends a further 0.008 m (from a −0.005 m initial offset to −0.013 m). This is an offline-rendered 3D hand, not a photograph or live tracked hand.

Projected surface detail is attached to a persistent `CameraSkin` UV layer in the approved open pose, so pores and palmar creases deform with the rig. It does not alter skeletal geometry or produce independent poses.

## Runtime contract

`public/assets/hand-sequence/manifest.json` lists 32 absolute poses at 720×960. Each entry has `src`, `foreground`, and `progress`. Both URLs can use the same render because numerical clearance verification establishes that the complete hand remains in front of the card at all sampled poses. The lower layer remains intact as the upper layer fades before independent card lift, so a baked card-shaped hole cannot be revealed.

`render-hand-sequence.py` renders approved poses. `package-hand-sequence.py` verifies 32 distinct frames, transparent alpha, connected bottom crop, lossless WebP alpha, unchanged dimensions, and nonzero adjacent-frame motion. PNG masters and the editable Blender rig remain outside public assets. The runtime includes only WebP frames, a manifest, and attribution. The final renderer SHA-256 and variant B are recorded in the manifest and independent clearance report. Artificial nail caps were omitted after visual review.

## Reproduce

blender -b -t 6 --python scripts/render-hand-sequence.py -- --no-card --frames 0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31 --samples 96 --texture work/hand-rig/skin-detail-ratio.png

python3 scripts/package-hand-sequence.py

The supplied model at `public/assets/models/lotus-relief.glb` is never modified by this workflow. No changes are made to production zevth.work, the Mac project, or publication permissions.

## Editable rig

`work/hand-rig/continuous-hand-rig.blend` contains the same rig, packed skin-detail texture, fixed camera, lighting, and 32 keyframed poses. Root translation, rotation, and scale are all keyed by `scripts/finalize-editable-hand-rig.py`, preserving the exact offline pose path. The raw source rig, reference render, generated appearance source, alignment parameters, numeric detail map, and PNG masters remain in the project for reproducibility. Runtime visitors receive only the lightweight rendered sequence.

## Presentation registration

The runtime may scale and translate the hand image layers in CSS to refine visible support and adult-hand proportions. Source camera metadata and numerical clearance describe the frozen 3D render scene before those presentation transforms. They are not proof of zero-gap physical grasp, browser-space collision, or user-device performance. The final UI registration and card/hand layer handoff are assessed separately in browser QA.
