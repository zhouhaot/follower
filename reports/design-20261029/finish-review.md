disposition: fix

缺失输入：`direction-options.json` 指向的 `.impeccable/mocks/decision/challenger-portal.webp` 不存在；本次按明确的 code-led 契约评审，以已提供的 `portal-reference.webp` 为工艺参考，不把它当作批准的成稿。独立代理只审阅截图、源码和已有测试记录，未运行浏览器或新的检测器。

## persistence

pass：`PRODUCT.md` 与 `.impeccable/surfaces/public-index-html.md` 存在；FORM 中 seed `a43fbcac` 能由 `reports/design-20261029/directions.md:16` 印证，采用 code-led，无须 comp-led 构建状态和复刻差分。10 张要求的截图均已打开；重拍后的 `mobile.png` 显示五张完整作品，原 recapture 问题已解决。当前 `DESIGN.md` 仍记载旧深绿、胶囊导航和纸缘世界；这是调用方已声明交给 documenter 的本轮收尾工作，最终交付前必须完成，不将现有旧文档当作新设计证据。

## fidelity

| 元素或契约 | 状态 | 截图及源码证据 |
| --- | --- | --- |
| TYPE | match | 首页两行展名、详情花名和各页标题使用契约指定的自托管 Exhibition 字体；首页桌面最大 96px、手机 58px，有明确标题与正文层级。参考板的拉长英文字形不是本项目规格。 |
| MATERIAL | match | 所有作品、石刻照片和三维静态图以真实现有图像呈现；光场由 `exhibition-portal.mjs` 的 fragment shader 绘制，没有把平面 CSS 伪称为实体材料。 |
| GROUND | match | 截图呈冷深蓝与青绿提示，`exhibition.css:2` 为 `#0b1426` / `#070f1e`，符合 OWN-WORLD 的深靛蓝空间；原型解释段浅纸色是阅读分区，未把首屏变回旧深绿世界。 |
| THESIS | match | 首页中央原作完整显示、五款选择轨可见，图录与详情保留完整原作；作品没有被导航或背景覆盖。 |
| OWN-WORLD | match | 各页采用文字导航、细直线控件、冷白正文；花册已取消拟真书册结构。`exhibition.css:170` 明确覆盖旧 `.album-plate` 阴影，截图未显示 detector 所报旧金色光晕。 |
| STORY | match | 首页有进入作品和图录入口，详情有阅读、收藏与现有 AI 合成讲解，花册提供备份入口；备份说明明确本机记录和历史扫描语义。已有 54/54 浏览器检查支持动作与状态一致，未把这些记录扩大为真机扫描验收。 |
| FIRST VIEWPORT：桌面边缘排版 | contradicted | `desktop.png` 中展名和作品说明都落在舞台中上部，构成居中的三列信息区，五款选择轨上方留下大段空场；契约明确要求“左下”展名、“右下”作品名与入口。`exhibition.css:40,54` 的两个 `align-self:center` 直接造成此偏差，未提供内容或可访问性约束作为理由。 |
| FIRST VIEWPORT：手机重排 | adaptation | `mobile.png` 将展名、完整原作和作品入口纵向排列，五款轨与后续正文可自然滚动；这是契约 FIRST VIEWPORT 明确允许的手机适配。 |
| FORM | match | 原生光标、自然滚动、有限时长指针响应与静态回退均与契约一致；源码使用 900ms 唤醒窗口，已有检查覆盖暂停、静止、减少动态效果及 WebGL 不可用。 |

## ceiling

参考板使用粒子密度、交错光束和明暗层次制造纵深；本作以较简练的蓝色波带和原作承担视觉记忆，没有使用粒子场、游标替换、装饰加载器或卡片光晕。后几项受真实内容、原生操作和有限动态约束，不应复制。首屏目前能记住“深蓝中的清荷花卡”，但边缘排版未兑现，中央作品的独占感被三列居中布局削弱；先修复这一明确承诺，无须另起视觉世界或增加持续运动。

## material_fixes

1. FIRST VIEWPORT：将桌面 `.portal-wordmark` 与 `.portal-detail` 锚定在主舞台可用区域的下沿，保留中央完整原作和下方五款选择轨；依据 `desktop.png` 与 `exhibition.css:40,54`，修复契约要求的左下／右下构图，并保持现有手机纵向重排。不要通过改写契约为居中来消除偏差。

## keep

保持完整原作与真实署名、冷深蓝与青绿体系、手机自然滚动、清晰收藏和历史扫描语义、有限时长光场与可读回退；保留图录、详情和备份已验证的操作路径。
