# Independent public hand-held comparison

Published 2026-10-13 at 17:03 UTC.

- URL: https://zevth-handheld-card-preview.tunedlarch512.chatgpt.site
- Access: public, login-free. Pages request no indexing; this does not make the site private.
- Saved version: 1
- Project: `appgprj_6ace5234990081918f186b804514512c`
- Version: `appgprj_6ace5234990081918f186b804514512c~appgver_7c82a66b0afc819181ab144799f5a691`
- Deployment: `appgdep_6ace6444c8788191ac4ba981722bf968`
- Source commit: `8d6bd1b6f8a2ffcb25922a475a01fa0fd80286f7`
- Runtime: 125 exact files, aggregate hash `35d6fce19c31dd8ac6cf00009e1f62b59729a8fb527c3b31f7c203529b150e95`. The aggregate is SHA-256 of a sorted compact JSON path-to-SHA-256 mapping; individual hashes are in `runtime-filehashes-v0.4.json`.
- Local deployment archive: `Zevth-Handheld-Sites-v0.4.0.tar.gz`, 17,776,521 bytes, SHA-256 `9ecfd3fd538ef12ead0591b74fb62896804a9ea6cea32179a8737f7d1889d53d`. All 125 runtime file hashes were verified in this archive; its additional file is the hosting manifest.

Native deployment returned succeeded. Site state was separately read afterward and confirmed version 1/public. The old exhibit was separately rechecked: version 2, owner-only custom access, unchanged URL. Anonymous requests without cookies or Authorization returned HTTP 200 for all 7 page types, the hand manifest, first/last frames and the 4.4MB relief GLB (11 checks). Every downloaded body exactly matched its tested local runtime SHA-256. The actual hosted homepage was also opened in the supported cloud browser: it showed the hand-held scene, all images loaded, and no sign-in prompt.

## Restore or compare

`Zevth-Handheld-Runtime-v0.4.0.zip` contains the exact standalone runtime. Unzip and serve its `zevth-runtime/` directory over localhost or HTTPS. Its camera entry is opt-in; no camera is needed to review the hero animation.

`Zevth-Handheld-Source-v0.4.0.zip` contains authored source, original imagery, scripts/tests, fixed texture source, licensed rig, editable Blender scene and master frames. Extract `zevth-source/`, run `npm ci`, then `npm test` and `npm run build`. Source `public/` uses original PNG assets; the runtime edition preserves their exact decoded RGBA pixels in lossless WebP. See provenance and QA documents for the conversion checks and historical restored/rebuilt boundary.

This independent Site may be rolled back using its saved version 1, without changing its public access. Never use this project's hosting identity for the original exhibit or zevth.work.

The liked glass exhibit is preserved separately at https://zevth-flowers-private-preview.tunedlarch512.chatgpt.site. Its full backup is `Zevth-Exhibit-Full-Backup-v0.3-2026-10-13.zip`, SHA-256 `e0eb2baa63b85a4308b55d89e46583943b28302f2bdac723fef7a46191b2f840`, saved in Library. Follow its own restore instructions and identity; there is no need to restore it to compare the two live candidates.

## Limits

The hand is a textured CGI rendering of one skeletal action, not documentary footage. The cloud browser's fallback experience was inspected; live WebGL, physical-card recognition and real iPhone/Android performance remain separate acceptance work. No actual zevth.work deployment was performed.
