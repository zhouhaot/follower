# Five-card AR candidate status

This candidate has now been imported and locally integrated on the Mac. Local automated browser checks block camera calls and do not verify physical-card recognition. See QA-STATUS.md for current local evidence. It has not changed the live zevth.work deployment or any production collection data. The first release ZIP is retained unchanged. “Supported” in the candidate means that a distinct geometric model and selected-card tracking path are implemented; it does not mean physical-device acceptance has passed.

## Implemented target and model mapping

The original cards.json and app-v5.js establish the target order. The local MindAR v2 MessagePack file was decoded again on 2026-10-13; its five target dimensions exactly match the original target PNGs and `assets/originals/assets.json`:

| Card key | Title | Target index | Original target dimensions | New geometric model |
| --- | --- | --- | --- | --- |
| flowers | 花开有声 | 0 | 900 × 1260 | Vase bouquet |
| peony | 牡丹承瑞 | 1 | 877 × 1222 | Layered peony |
| chrysanthemum | 菊影流金 | 2 | 875 × 1228 | Chrysanthemum |
| lotus | 清荷入梦 | 3 | 884 × 1255 | Lotus |
| leaves | 花叶生辉 | 4 | 881 × 1255 | Hibiscus with lobed leaves |

- Each selected card gets its own model from the bloom registry. The scanner rejects unknown cards, caller-supplied target-index mismatches and unavailable models before requesting the camera.
- The shared `image-target-tracker.mjs` checks every target's exact dimensions, including non-selected entries, before matching starts. A truncated, reordered or mismatched dataset is rejected.
- Detection receives only the selected target index. Tracking and recovered poses use that same index; an unexpected matcher result is discarded. Only the selected key can be written while scanning it. This binding invariant does not prove the real matcher cannot confuse visually similar printed cards; physical-image false positives still require testing.
- Tracking uses the original local feature matcher and pose recovery, not a click, classification placeholder or simulated success timer. New model geometry is anchored in the card plane (XY; +Z toward the viewer), then grows above it.
- The original metal relief GLB remains a separate scheme B hero/card preview. It is not used as any of the five scanning flowers. These are new geometric candidates, not an asserted transfer of the earlier Mac project.

## Recognition and isolated collection

- Camera use remains opt-in. Secure context, camera API, model availability and WebGL are checked before the request. Opening a page or preview never requests the camera.
- Collection requires at least eight valid selected-target observations spanning 1.2 seconds, with no gap over 650 ms. Lost tracking, wrong-card events, invalid observation times and stale sessions reset or reject pending evidence. Only the boolean `tracked: true` counts.
- Candidate progress still uses only `flowers-speak:cloud-candidate:collection:v1`. Existing valid version-one lotus records remain readable and are preserved when the other four cards are added. No production storage key is read, copied or overwritten.
- Both new evidence and stored records must pair a known key with its exact target index and `image-target` method. Unknown cards, preview sources, all twenty cross-card key/index combinations and insufficient evidence cannot create records. Repeated recognition does not duplicate a card.
- Failed or unavailable storage is disclosed as recognition without saved collection. Reacquisition and target-loss messages preserve that distinction. Preview code never writes collection records.

## Lifecycle and failure handling

The controller handles insecure contexts, unavailable camera APIs, unavailable models, WebGL limitations, permission denial, loading, target loss, interrupted startup, retries, startup timeout, camera track termination, storage failure, Close, Back, preview navigation, page hiding and history navigation. Pending camera requests and tracker callbacks are generation-checked; a stream returned after cancellation is stopped immediately. A prior session cannot collect or fail a newer retry.

Aborted target loading is cancelled. Video, geometric model resources, owned tracker tensors, worker, renderer, resize observers and listeners are disposed when stopping. Constructor failures and context loss clean up already-created resources. The page remains restartable after ordinary page-hide/history navigation; permanent cleanup removes its bindings.

Camera frames remain in the browser. There is no image-upload endpoint or production collection access. Runtime, target file and model code are local same-origin assets. Real use still requires HTTPS (or localhost), camera permission, WebGL and an appropriate camera permission policy when embedded.

## Verification completed

`node --test tests/scan-state.test.mjs`: 32 tests passed on 2026-10-13.

Coverage includes all five selected-card state machines, canonical titles, camera opt-in, support/security/model guards, schema validation, durable-write checks, existing v1 lotus preservation, cross-card rejection, weak evidence, target loss, stale frames and sessions, denied/retry, cancellation during camera and tracker startup, startup timeout, context loss, camera termination, preview/Back/page-hide/visibility handling, and idempotent cleanup.

The constructor integration tests build the actual five geometric models while injecting a deterministic matcher runtime and renderer. They verify selected-index arguments, real model-factory selection, wrong-index rejection, whole-dataset dimension checks and model/worker/video/renderer disposal. They are not GPU rendering or image-recognition tests.

The target file was independently decoded with Python MessagePack; it contains version 2 and the five exact dimensions listed above. Tests also compare the canonical mapping to the provenance manifest and read the actual PNG header dimensions for all five cards.

## Browser and physical-device verification limits

A real camera has not yet been shown to identify any of the five physical printed cards in this candidate. Printed-card recognition, phone camera behavior, alignment, perspective tracking, thermal behavior and frame rate remain unverified for all five cards.

The cloud browser's WebGL implementation reports Disabled (`BindToCurrentSequence failed`), which blocks GPU model rendering and actual MindAR matching in that browser. Direct shell Chromium also failed to launch because the cloud runtime restricts its required socket. These are verification limits, not successful AR results.

The earlier lotus-only synthetic fixture was run in that cloud browser: idle → requesting → loading (128 ms) → error (262 ms), with “Initialization of backend webgl failed” / “WebGL is not supported on this device”. Stop left zero videos, zero canvases and no saved records. See `reports/qa/matcher-webgl-blocked.txt`. This verifies blocked-startup cleanup only, not successful recognition. It does not automatically validate the generalized five-card fixture.

The updated `tests/browser/target-check.html` supports choosing each scanner and independently presenting any of the five original targets or a blank frame. It passes a canvas-captured stream into the actual matcher and writes only to an in-memory collection store. Serve the project root to open it. Run each matching case, all twenty wrong-card pairs, and a blank case for every scanner on a WebGL-capable test browser. A successful synthetic-frame run would still not establish physical-card or phone-camera behavior.

## Physical acceptance checklist: repeat for all five cards

1. Open the candidate over HTTPS in current iPhone Safari. Page load must not request camera permission. Confirm the selected title/model/index matches the mapping above.
2. Open that card's geometric preview, and the separate lotus metal-card preview. Neither may increase collection progress.
3. Start scanning, deny permission, return and retry after allowing it in the browser settings. Verify explicit loading/error feedback on slow or failed startup.
4. Present the matching original printed card in even light. Confirm its distinct flower grows out of the card and follows translation and tilt rather than remaining fixed on screen. Check anchor scale, orientation and placement.
5. Remove or obscure the card before stable confirmation. Confirm no record is created. Reacquire and hold it steady; exactly the selected card should persist once.
6. While that scanner is selected, present each of the other four printed cards, unrelated images and blank frames. None may produce a collection success. Switch scanners explicitly and verify independent progress for all five.
7. Turn the phone, resize, background the browser, navigate to preview, go Back/Forward and close scanning. Check that camera use stops and restart needs an explicit tap.
8. Repeat start/stop at least ten times. Check for duplicate videos/canvases, continuing camera indicators, runaway workers or material memory growth. Verify no stale worker callback affects a later session.
9. Test blocked storage: successful recognition may show the model but must disclose that collection was not saved, including after target loss/reacquisition. Then verify a previously saved v1 lotus record survives collecting another card.
10. Repeat on Android Chrome. Record browser/device versions, card printing size, lighting, camera orientation, time to first match, approximate FPS, failures and cleanup observations. Preserve the evidence before making a live-ready claim.

## Source provenance

Original public sources: https://zevth.work/cards.json?v=20260913-pages, https://zevth.work/app-v5.js and https://zevth.work/assets/five-flowers.mind. Downloaded original assets and runtime provenance remain under `public/assets/originals/`. Three.js stays pinned to r160 for original runtime compatibility.
