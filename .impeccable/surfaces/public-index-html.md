---
version: 1
slug: "public-index-html"
primary_target: "public/index.html"
related_targets: ["public/catalogue.html","public/flower-detail.html","public/collection.html","public/backup.html","public/guide.html"]
---

# 首页、图录、详情与花册

Mode: Experience（详情正文为 Read，备份为 Operate）。

## Direction contract

THESIS: 用户选定沉浸式光场入口。五张真实纹样成为数字展览的主角；完整原作占据中心，导航和操作退至边缘，内容不能藏在动效后。

OWN-WORLD: 深靛蓝空间、冷白正文、青绿的作品提示，原作保留自身全部色彩。标题沿用自托管 Exhibition，正文使用系统中文字体。导航为清晰的文字轨道，控件为平直轮廓，取消装饰性玻璃导航和拟真书册阴影。

STORY: 首屏看到作品、知道这是五款花卡的展览；可切换主作品，进入阅读与听讲解，主动收藏，回到花册备份。原型、设计解释和扫描记录不混为一谈。

FIRST VIEWPORT: 深蓝全屏光场，完整花卡居中；左下为两行大型“花开有声”，右下为当前作品名、“读作品故事”主按钮与前后切换，展名区保留“开始观展”文字快捷入口与“浏览图录”；上沿公共导航，下沿五款作品选择轨。手机把展名、原作与入口排成可自然滚动的一列。签名互动是指针/触摸引起有限时长的光场变化；静止、离屏或减少动态效果时不持续绘制。

FORM: 用户选择 seed a43fbcac 的 challenger webgl-shader-portal，code-led。参考板用于工艺标准，不复制其虚构品牌、加载器、指标或商业文案。保留原生光标和自然滚动，以实际内容与可访问性约束背景效果。

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

约束：原作不裁切；不伪造媒体、馆藏或授权；真机扫描门槛保留。无自动音频、无强制转场加载。已有资源作为 pre-existing 使用，字节不修改。

## Current implementation · 2026-10-29 refinement

本轮延续既有世界，无新增 raster。首页的“读作品故事”主按钮与当前作品归组；展名区保留“开始观展”文字快捷入口与图录入口，使窄屏首屏可直接进入作品。作品切换同步两个作品入口的链接。

详情 DOM 与手机阅读顺序为标题 → 展台 → 简介、收藏与讲解；桌面左侧展台跨两行，右侧先标题后操作。创作图上标注和文字说明使用原生 button 与同步 aria-pressed。图录与详情收藏默认透明、选中青绿实底，悬停按收藏状态分别使用展面底与浅青绿底。共享键盘焦点为青绿轮廓。

备份以“保存一份备份”和“从备份恢复”分组：桌面两列，≤1000px 单列；旧版扫描记录收进 details，预检通过且有新增记录后才出现勾选与确认操作。参观指南在 ≤1000px 单列，平板扫描入口保留至少 44×44px 目标。

以上记录源码已实现的结构与样式，不追加部署、实体扫描或真实用户验收结论。历史材质与不在本轮范围内的样式漂移未据此扩展为体系规则。
