# Front-facing palm sequence

This candidate implements the requested correction: the palm faces the viewer and its authored plane stays parallel to the camera sensor while the fingers unfold laterally. It replaces the older upward-cupped pose only in this separate candidate directory. The original exhibition and prior hand-held release are preserved elsewhere.

## Geometry and animation

- One licensed WebXR generic right-hand mesh, one weighted 25-joint skeleton, five fingers and one continuous 32-pose action.
- The source hand GLB is unchanged. Its connected forearm extension, seam-welded surface, smooth subdivision and preserve-volume skinning are retained.
- The source-space +X palm normal maps directly to the camera-facing axis. The authored palm plane does not pitch during the opening; natural palm curvature remains.
- Starting finger flexion is only 12°, 6° and 2° across the three finger segments. The visible action is lateral spread around the palm normal, from grouped fingers to a fan.
- Root translation lowers the hand by 17 mm along camera-down. There is no wrist rotation or camera drift. The final card release/rotation belongs to the separate webpage animation.
- The complete hand remains geometrically in front of the exact supplied card. The minimum camera-axis separating-plane clearance over all 32 poses is recorded in `reports/hand-rig/clearance-32-poses.json`. This positive separation proves no hand/card intersection in the frozen render scene; it is not a physical zero-gap grasp or a browser-space collision guarantee.

## Texture continuity

The accepted prior `CameraSkin` UV registration is preserved exactly by matching source rest-space vertex positions. It is never reprojected from the new camera alignment. The generated texture is one fixed appearance map on one mesh, not an independent generated hand for each pose.

The old projection ended at its lower image edge. A fixed rest-UV blend over v=0..0.10 fades the texture contribution into the existing procedural skin to remove the horizontal wrist band. It does not depend on animation time and cannot slide over the skin. The UV audit records zero registration error.

The rendered skin is synthetic CGI with generated surface detail. It is not documentary photography of a real hand.

## Compositing

Every runtime frame is a complete RGBA hand. The foreground and background URLs deliberately reference the same image because the whole hand is in front of the card during the opening. Do not use a card-shaped alpha hole. Keep the foreground layer until the hand has withdrawn from the card's screen area.

The card remains its own unchanged model/raster. It is retained in the Blender scene but hidden from camera rays only; it still participates in shadowing. No card geometry or original artwork is replaced by generated imagery.

The hand frames contain the authored framing and root descent. Native registration is the source baseline; the authorized local composition revision below applies a shared hand/card frame transform and a measured lower-edge support correction.

## Reproduction

1. Run Blender on `scripts/render-hand-sequence.py` with `--frames 0,1,...,31 --samples 96 --placement front --no-card --shadow-card --texture work/hand-rig/skin-detail-ratio.png`.
2. Run Blender on `scripts/verify-front-facing-hand.py` for independent 32-pose geometry, palm alignment, fingertip spread and exact UV checks.
3. Run Blender on `scripts/finalize-editable-hand-rig.py` to record the fully keyed, packed editable rig.
4. Run `python scripts/package-hand-sequence.py` for 32 WebP frames, lossless alpha verification, manifest and continuity report.
5. Run `npm test`.

Low-cost review samples are in `reports/hand-rig/front-facing-front-preview/`. The final rig is `work/hand-rig/continuous-hand-rig.blend`; full-resolution masters are in `work/hand-rig/frames/`; runtime assets are in `public/assets/hand-sequence/`.

## Local shared hand/card composition, 2026-10-14

The current local revision uses one frame transform for both hand and card: 1.14× desktop / 1.12× portrait, 5% downshift and a continuous extra 1.5% shared downshift while opening. The frame-normalized palm reference is (0.50, 0.73). A reference near the lower card edge at (0.59, 0.73) aligns to it using the actual object-fit-contain dimensions; this small horizontal correction tapers continuously as the card centers. Existing open/release/lift/turn phases remain absolute and reversible. Reduced motion preserves the initial static support correction.

This is a composition revision, not a new skeletal pose or physical-contact proof. The initial finger flexion remains 12°/6°/2°, with no wrist tilt or image perspective deformation. A true half-grasp/wrist inclination still needs Blender. Rig, source card model, all 32 PNG masters and the sequence manifest match the pre-change snapshot hashes.

121 unit tests and 481 source browser checks passed, including start/middle/open desktop and 390/320px samples, support-reference alignment, five fingertips in view, card turn, five-card catalogue, reverse state, reduced motion and failure paths. Source/dist files match; runtime application code matches after its documented lossless WebP path substitution. Build and source/runtime static checks passed. Evidence: `reports/qa/local-composition/`; three-frame sheets and restore snapshot live in the task's `local-deliverables/composition-20261014/` and `composition-before-20261014/`. Existing release ZIPs were preserved. No deployment, Library retry or real-camera test occurred.
