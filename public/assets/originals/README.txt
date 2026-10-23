Original public assets recovered from https://zevth.work/ on 2026-10-13.

Identity and tracking index are verified against live cards.json, app-v5.js,
and the decoded five-flowers.mind MessagePack target dimensions:
0 flowers       花开有声   《瓶插花卉图》  900 × 1260 target
1 peony         牡丹承瑞   《瓶插牡丹图》  877 × 1222 target
2 chrysanthemum 菊影流金   《摘枝菊花图》  875 × 1228 target
3 lotus         清荷入梦   《荷花图》      884 × 1255 target
4 leaves        花叶生辉   《芙蓉花图》    881 × 1255 target

assets.json contains original card metadata, source URLs, local paths,
image dimensions, SHA-256 checksums, and AR runtime/dependency details.
All downloaded image and runtime bytes are unchanged.

Front card images include their existing printed QR codes. Do not treat the
QR destination as the candidate preview host; these are original artwork.

AR runtime import map:
three -> /assets/originals/_source/vendor/three.module.js
three/addons/renderers/CSS3DRenderer.js -> /assets/originals/_source/vendor/CSS3DRenderer.js
Import /assets/originals/_source/vendor/mindar-image-three.prod.js
imageTargetSrc: /assets/originals/five-flowers.mind
Three revision: 160. Two relative module dependencies are present locally.

Original AR visuals use textured PlaneGeometry, not GLB/GLTF models.
flowers uses ornaments.png, greens.png, vase.png, blooms.png, details.png.
Other four cards use shader masks of the unchanged corresponding target.png.
Model availability in the replacement app is a separate implementation choice.
