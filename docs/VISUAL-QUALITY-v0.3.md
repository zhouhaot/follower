# Exhibition material study / 展陈质感改版

2026-10-13. Requested direction: a documentary, photographic exhibition appearance, while retaining the pedestal.

## Scope

The existing metal relief card remains the exhibit. Original full card artwork and all five geometric flower models are unchanged. The hero presentation now uses a physically measured glass vitrine and a solid charcoal pedestal rather than a thin CSS slab. Both the real-time scene and no-WebGL fallback are updated. These images are rendered exhibition simulations, not photographs of an actual museum installation.

The fallback uses registered base and glass image layers from a shared camera. Native scroll lifts the glass layer and reveals the original five-card catalogue; reverse scrolling restores it. There is no scroll interception, autoplay animation loop, camera request or collection write. Reduced-motion keeps the exhibit stationary and exposes the catalogue without the pinned transition.

## Acceptance

75/75 automated tests pass, including eight new numeric scene tests and three hero-layout integrity checks. The supplied metal GLB and original artworks retain their exact hashes. The hero-only added geometry is 19 meshes / 1,738 triangles / five materials / two small procedural textures. Final registered images total 602,150 bytes; both use 1200 × 1400 frames. Final browser verification passed 865/865 source assertions and 922/922 runtime assertions across 19 routes at 1440×900, 390×844 and 320×844 CSS viewports, plus 20/20 native-scroll/caption assertions. Both final images decode at 1200×1400. The phone caption is separated from the introduction and no longer overlaps the base or static-preview label. All mode switches, navigation returns, collection isolation and camera opt-in checks remain intact. Source/runtime fingerprints were unchanged after this audit. The cloud browser does not support live WebGL. CPU-rendered material appearance and fallback behavior can be inspected here, but live GPU rendering and physical-card AR remain separate unverified acceptance items.
