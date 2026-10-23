# Mac local integration verification

2026-10-14 UTC · v0.4.1 local continuation. Nothing was published.

The Library handoff ZIP was downloaded through the supported materialization flow after a normal network permission request. Its 67,066,922 bytes and SHA-256 `0063e730069858e5473f4121284ea71551ffe94f32e270160b031c3c9db73fee` match the handoff. All 311 ZIP members passed CRC and the supplied per-file checksums passed before editing. The previous Mac project, its ZIP, the exhibit, and production were preserved.

## Asset integration

All 32 final 720 × 960 RGBA masters decode. Start/middle/open compositions and the 32-frame contact sheet were visually inspected. The existing masters were packaged without rerendering. The new runtime sequence is 1,595,184 bytes and reports `poseVariant: FRONT`. All 32 WebP alpha channels match their PNG masters exactly; adjacent frames are distinct and continuous. Hand RGB uses the existing packager's quality-94 WebP encoding, not a lossless-RGB claim.

The hand keeps its frontal plane, starts with grouped fingers and spreads laterally. Complete foreground skin remains over the card until withdrawal. Narrow-screen fan spacing was corrected so all five cards fit. All five original source artworks and the supplied card GLB remain intact. `runtime-public/` was rebuilt: its 21 PNG conversions decode to exactly the original RGBA pixels.

## Local checks

- Node 22.23.1; Chrome 155.0.8059.41, macOS arm64; isolated Pillow 11.3.0 / NumPy 2.4.6 tooling.
- `npm test`: 120/120 passed. `npm run build`: passed.
- Source and runtime static HTML/module references: passed, 28 reachable modules each.
- `reports/qa/local-public/ui-audit.json`: 475/475 passed.
- `reports/qa/local-runtime/ui-audit.json`: 475/475 passed.
- Nineteen routes at 1440×900, 390×844 and 320×844; card navigation and return routes; unknown-card states; keyboard focus; no overflow/broken assets/JS errors or automatic camera requests; previews never collect.
- Native forward/reverse wheel input, slow/fast scripted scroll, interruptions at nine absolute progress samples, identical reverse hand/card state, fully opened hand before withdrawal, card turn, all five final cards inside each viewport, live WebGL hero, intentional fallback, reduced motion, manifest/decode failure.
- Reverse screenshots use a disclosed raster tolerance: mean absolute channel delta ≤0.10 and maximum ≤16 on the 0–255 scale. This allows tiny raster differences while state equality remains exact.
- rAF timing measurements belong to automated desktop Chrome only; they are not phone FPS or camera performance measurements.
- Initial audit failures and screenshots remain in `reports/qa/local-public-first-pass/`. The fan timing assertion was updated to the current animation phases, the raster comparator records numeric differences, and a loopback preview server with a larger connection backlog replaced the default server after transient local asset resets. The final confirmation has zero failures.
- Mechanical design scan reports one inherited Arial usage warning. The established typography was retained.

## Local addresses and reproduction

`npm run dev` serves source at http://127.0.0.1:4173/ . `npm run dev:runtime` serves the synchronized runtime at http://127.0.0.1:4175/ . Both bind only the local loopback interface. HTTP and browser checks passed for these addresses. Audit servers are stopped during task teardown; rerun these commands to reopen them.

After `npm ci`, set `AUDIT_CHROMIUM` to an installed Chromium-family executable and run `npm run test:ui`. `AUDIT_URL` and `AUDIT_OUTPUT` select the runtime and its report directory. Python tooling can be reproduced with `python3.11 -m venv .venv` followed by `.venv/bin/python -m pip install -r requirements-tooling.txt`.

## Remaining limits and publication blockers

Blender is not installed on this Mac. Reading its official 4.3 release directory returned HTTP 403 and was stopped. Local reruns of `verify-front-facing-hand.py` and `finalize-editable-hand-rig.py` were therefore not performed; `editable-rig.json` has not been fabricated. The imported rig SHA matches the imported numeric report: its stated 0° palm error, zero UV registration error and 22.05 mm minimum front clearance remain imported evidence. See `reports/hand-rig/local-rig-provenance.json`.

No physical iPhone/Android, real camera or printed-card recognition tests were performed. Desktop narrow viewports do not establish phone behavior. Safari/Firefox remain untested. Dynamic viewport changes during the sequence were subsequently checked in the supplemental local lifecycle audit below. Unit-state tests and synthetic failure paths are not scanning success.

The source/runtime ZIP restoration checks are recorded separately in `local-deliverables/local-package-verification.json`, with any restored-source test results in the same directory. This verifies local continuation snapshots only. A production backup, production access and a production restore rehearsal have not been established. No deployment, Site change or change to zevth.work was attempted.

## Supplemental background lifecycle audit

2026-10-14 UTC, after the user-facing Edge preview was opened. The existing Edge tab and persistent local service were left untouched. An isolated headless Chrome profile ran `node tests/lifecycle-browser.mjs`: **33/33 checks passed**. Evidence: `reports/qa/local-lifecycle/lifecycle-audit.json`; the initial harness timing failure remains under `local-lifecycle-first-pass/`.

Coverage includes sixteen mid-scroll viewport changes across four progress phases and desktop/portrait/landscape sizes; browser Back/Forward and actual restored scroll/hand state; changing reduced motion while mid-sequence; keyboard skip and scan navigation; leaving scan preparation without camera use; three repeated pending-request cancellations; page-hide cancellation; and returning through history without automatic scanner restart. Every pending camera request was replaced before app execution with a controlled promise. Its late simulated tracks were stopped, and videos, scan canvases, workers and collection records remained absent. No real device stream or recognition loop was started.

The only initial failure was a test synchronization race: the test could accept the old CSS progress immediately after resizing, then inspect the new progress before its new image decoded. The harness now waits for CSS progress to match the new layout and for the corresponding frame to decode. The confirmation passed without modifying application runtime code.

Safari was not launched because no nonintrusive background Safari automation channel had been established. Remote Automation and security settings were not changed. The prior ZIP snapshots were preserved; these supplemental test/report files are separate local additions. Library uploads were not retried and nothing was deployed.

## Local shared hand/card composition, 2026-10-14

The current local revision uses one frame transform for both hand and card: 1.14× desktop / 1.12× portrait, 5% downshift and a continuous extra 1.5% shared downshift while opening. The frame-normalized palm reference is (0.50, 0.73). A reference near the lower card edge at (0.59, 0.73) aligns to it using the actual object-fit-contain dimensions; this small horizontal correction tapers continuously as the card centers. Existing open/release/lift/turn phases remain absolute and reversible. Reduced motion preserves the initial static support correction.

This is a composition revision, not a new skeletal pose or physical-contact proof. The initial finger flexion remains 12°/6°/2°, with no wrist tilt or image perspective deformation. A true half-grasp/wrist inclination still needs Blender. Rig, source card model, all 32 PNG masters and the sequence manifest match the pre-change snapshot hashes.

121 unit tests and 481 source browser checks passed, including start/middle/open desktop and 390/320px samples, support-reference alignment, five fingertips in view, card turn, five-card catalogue, reverse state, reduced motion and failure paths. Source/dist files match; runtime application code matches after its documented lossless WebP path substitution. Build and source/runtime static checks passed. Evidence: `reports/qa/local-composition/`; three-frame sheets and restore snapshot live in the task's `local-deliverables/composition-20261014/` and `composition-before-20261014/`. Existing release ZIPs were preserved. No deployment, Library retry or real-camera test occurred.
