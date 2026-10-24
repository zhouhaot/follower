# -*- coding: utf-8 -*-
"""从五张实体花卡的印刷版式中裁取纯插画画面，供数字图录放大展示。

印刷卡 = 米白纸边 + 深底插画窗口 + 底部信息条（含二维码）。数字图录只应
展示插画窗口本身；完整印刷卡在详情页「实体花卡」视图查看。窗口几何对
五张卡一致（flowers 为 2x 版本），来源为实测印刷模板。

用法：python scripts/make-artwork.py   （在仓库根目录，Pillow+numpy 见 requirements-tooling.txt）
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent

# 插画窗口（原卡坐标，含 2x 的 flowers 版本）；inset 再向内收 6px 去掉窗口描边
WINDOWS = {
    "flowers": ("public/assets/originals/card.png", 105, 105, 1994, 2750),
    "peony": ("public/assets/originals/peony/card-named.png", 50, 50, 1049, 1442),
    "chrysanthemum": ("public/assets/originals/chrysanthemum/card-named.png", 50, 50, 1049, 1452),
    "lotus": ("public/assets/originals/lotus/card-named.png", 50, 50, 1049, 1469),
    "leaves": ("public/assets/originals/leaves/card-named.png", 51, 50, 1049, 1474),
}
INSET = 6


def main():
    for key, (rel, x0, y0, x1, y1) in WINDOWS.items():
        src = ROOT / rel
        out = src.parent / "artwork.png"
        im = Image.open(src).convert("RGB")
        a = np.array(im)
        # 防御：按行/列中位亮度复核窗口边界，模板若有出入以实测为准
        crop = a[y0 + INSET : y1 - INSET, x0 + INSET : x1 - INSET]
        Image.fromarray(crop).save(out, optimize=True)
        print(f"{key:15s} {im.size} -> artwork {crop.shape[1]}x{crop.shape[0]}  {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
