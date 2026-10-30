---
name: "花开有声 · 沉浸式光场数字艺术展"
description: "深靛蓝展厅中的完整花卉原作、有限光场与清晰观展入口"
colors:
  room: "#0b1426"
  room-deep: "#070f1e"
  room-panel: "#142139"
  text: "#f0f3ed"
  soft: "#b9c9d7"
  signal: "#c5e6c2"
  rule: "#8196b54d"
  paper: "#edf1ed"
  paper-ink: "#192d36"
  signal-hover: "#e0f2de"
typography:
  display:
    fontFamily: "Exhibition, 'Noto Serif SC', 'Songti SC', SimSun, serif"
    fontSize: "clamp(64px,7vw,96px)"
    fontWeight: 400
    lineHeight: 1.08
    letterSpacing: "-.025em"
  headline:
    fontFamily: "Exhibition, 'Noto Serif SC', 'Songti SC', SimSun, serif"
    fontSize: "clamp(40px,5.5vw,76px)"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "-.025em"
  title:
    fontFamily: "Exhibition, 'Noto Serif SC', 'Songti SC', SimSun, serif"
    fontSize: "clamp(28px,3vw,42px)"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: ".015em"
  body:
    fontFamily: "Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "16px"
    lineHeight: 1.7
  story:
    fontFamily: "Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "16px"
    lineHeight: 1.95
  label:
    fontFamily: "Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "13px"
rounded:
  square: "0"
  control: "3px"
  direction: "50%"
spacing:
  switch-gap: "8px"
  action-gap: "12px"
  artwork-inset: "20px"
  mobile-inset: "24px"
  album-gap: "32px"
components:
  button-primary:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.room}"
    rounded: "{rounded.control}"
    padding: "10px 24px"
  button-primary-hover:
    backgroundColor: "{colors.signal-hover}"
    textColor: "{colors.room}"
  pearl-button:
    backgroundColor: "transparent"
    textColor: "{colors.soft}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
  navigation:
    backgroundColor: "transparent"
    textColor: "{colors.soft}"
    rounded: "{rounded.square}"
    padding: "8px 0"
  work-selector:
    backgroundColor: "transparent"
    textColor: "{colors.soft}"
    padding: "12px 10px"
  collect-button:
    backgroundColor: "transparent"
    textColor: "{colors.signal}"
    rounded: "{rounded.control}"
    padding: "7px 14px"
  collect-button-selected:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.room}"
  artwork-container:
    backgroundColor: "{colors.room-panel}"
    rounded: "{rounded.square}"
    padding: "20px"
  backup-action:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.room}"
    rounded: "{rounded.control}"
    padding: "8px 18px"
  backup-file:
    backgroundColor: "{colors.room-deep}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
---

# Design System: 花开有声 · 沉浸式光场数字艺术展

## Overview

**Creative North Star: "深靛蓝中的光场花园"**

以深靛蓝空间承托完整花卉原作，冷白文字负责阅读，青绿提示负责方向。大标题、平直控件与文字导航构成稳定界面，作品保留自己的全部色彩。光场由代码生成，珠光随观察动作变化；内容与入口始终独立于图形增强。

本记录从当前代码提取，延续已确认的深靛蓝光场体系；本轮精修入口层级、详情阅读顺序、收藏状态与备份操作，适用首页、图录、详情、花册、备份与共享导航。它记录视觉实现，不代表正式部署、真实用户试用或实体扫描验收。首页构图策略以 surface brief 为准，不扩大为每页必须使用全屏光场。

**Key Characteristics:**
- 深靛蓝空间、冷白正文、青绿方向提示。
- 完整原作先呈现；图形失败仍可阅读和进入故事。
- 文字导航与平直轮廓；作品页按阅读与操作需要调整密度。
- 有限时长、输入驱动的光影，保留自然滚动与原生光标。

实现来源：[主样式](public/exhibition.css)、[光场与切换](public/exhibition-portal.mjs)、[首页入口](public/app.mjs)、[共享导航](public/site-chrome.mjs)、[基础字体与继承样式](public/styles.css)、[珠光组件](public/pearl-exhibition.css)、[备份控件](public/business.css)。五个入口均最后加载 exhibition.css；提取考虑既有更高优先级选择器。

## Colors

frontmatter 是可复用色值的规范层；运行时对应同名 CSS custom properties，`signal-hover` 是主操作的实际悬停色。

### Primary
- `signal`：浅青绿，用于主要入口、作品序号、选中指示与收藏反馈；`signal-hover` 提供主入口悬停。

### Neutral
- `room` / `room-deep` / `room-panel`：页面、光场与导航底、作品容器及局部阅读层。
- `text` / `soft`：冷白主文字、蓝灰次级说明。
- `rule`：透明细线，界定导航选中、作品轨道和阅读分节。
- `paper` / `paper-ink`：首页原型转化段落的浅底与深字，是局部阅读节奏，不是全站浅色外壳。

**The Artwork First Rule.** 原作始终完整包含，不用裁切、悬停放大或 shader 遮挡替代真实纹样。

详情展示切换的选中态与收藏选中态统一使用青绿实底、深靛蓝字。备份主动作沿用同一方向色，次要动作透明底、蓝灰字；文件字段采用深夜展厅底与冷白字。局部旧材质和历史样式残留不构成新主题。

## Typography

**Display Font:** Exhibition，回退 Noto Serif SC、Songti SC、SimSun、serif。
**Body Font:** Arial、PingFang SC、Microsoft YaHei、sans-serif。

标题字体从 `public/assets/fonts/exhibition.ttf` 自托管，使用 `font-display: swap`。艺术标题与系统正文形成分工；序号使用等宽数字特性，不额外引入等宽字体。正文通用上限 70ch，详情导读桌面 32ch。

frontmatter 的 display 为首页展名，headline 为通用页标题，title 为当前作品名，story 为详情阅读正文。它们记录实际角色，并非统一比例尺。首页展名在 ≤1000px 为 70px、≤700px 为 58px、≤350px 为 49px；手机行高 1.1。通用页标题手机为 42px、行高 1.25。详情标题采用 `clamp(40px,4.6vw,64px)`，≤1000px 为 40px，手机为 42px；详情正文手机为 15px。

## Layout

共享导航在普通文档流中，桌面高度 100px、三列 `1fr auto 1fr`，两侧留白 4vw；手机为两行，最小高度 126px，上行品牌与扫描入口、下行等宽文字导航。通用页容器最大 1400px，桌面内边距 `72px 5vw 100px`，手机为 `44px 24px 64px`。

首页桌面使用三列 `1fr minmax(300px,1.3fr) 1fr`，最小高度 `calc(100svh - 100px)`。≥701px 时左右文字区底端对齐，中间作品保持居中；≤700px 改为单列自然流，保留五项作品选择轨。“读作品故事”主按钮与前后切换归在当前作品信息区；展名区保留“开始观展”文字快捷入口与“浏览图录”，便于窄屏首屏进入作品。两个作品入口均随所选作品同步，快捷链接按内容宽度对齐。主链接容器宽 `min(100%,340px)`，超宽屏为 390px；内部珠光卡仍有独立宽度约束，不能把外层宽度误当最终画幅。手机外层宽 `min(64vw,285px)`。

图录与花册桌面三列，≤1000px 两列，≤700px 一列；首页简版图录是五列，手机两列。图录作品图固定可用高度 390px、手机 360px，使用 contain；花册作品图为 300px、手机 340px。详情主体最大 1320px，DOM 顺序为标题、展台、简介与操作；桌面左列展台跨两行，右列先标题后简介与操作，列宽比 1.2:1；≤700px 按 DOM 顺序单列呈现。展台高度依次为 570px、510px、460px、≤350px 时 395px。

备份内容最大 1100px，桌面导出与恢复按 1:1.25 分列、间距 48px，恢复区以左侧细线区分；≤1000px 转单列和上方分隔线。参观指南在 ≤1000px 单列呈现，步骤编号保留独立窄列；共享扫描入口在平板隐藏文字时仍至少为 44×44px。

## Elevation & Depth

新展厅主要靠深浅色面与代码光场建立深度：导航无模糊、无外投影，图录与花册无拟真纸页阴影，首页主作品外壳透明平直。细线服务分区和状态。详情内部珠光组件仍保留旧纸缘材质（12px 圆角与 `2px 3px 0 #9aa69e,8px 20px 32px #080e0c70` 投影），仅限这个既有数字材质组件，不推广到导航、图录或花册。

**The Finite Motion Rule.** 光场响应输入，在有限时间后停止；隐藏、离屏和减少动态效果时不保持连续绘制。

首页 shader 每次唤醒最多续绘约 900ms，画布像素比上限 1.5；切换先等待新图解码，再以 320ms 叠化覆盖保留的旧图，缓动为 `cubic-bezier(.16,1,.3,1)`。减少动态效果时取消该切换动画、珠光倾转与持续光场。首页不提供演示或开关按钮；光场默认响应输入，珠光在作品就绪时自动演示一次并停止。不可用时保留作品与文字反馈；shader 不是内容加载门槛。

## Shapes

展厅、图录画面和花册采用平直轮廓；主要控件为 3px 小圆角。前后切换为圆形，桌面 48px、手机 44px。所有作品使用完整包含，不统一裁切比例。详情内部珠光纸缘是上一节记录的局部材质例外。

## Components

### Buttons
主要入口采用青绿底、深靛蓝字，最小高度 48px。珠光工具为透明底、细线与蓝灰字，最小高度 44px，悬停转为青绿实底；禁用态沿用半透明。图录与详情收藏都以青绿字、透明底表示未收藏，以青绿实底、深靛蓝字表示已收藏，并通过 `aria-pressed` 表达状态；未收藏悬停为蓝色展面底与青绿字，已收藏悬停使用主操作悬停色与深靛蓝字。详情收藏最小高度 48px，图录为 44px。

### Navigation
文字轨道，普通项蓝灰，当前项冷白并带底部 2px 青绿内线；没有胶囊底或玻璃模糊。手机导航完整放到第二行，单项最小高度 44px。首页五项作品轨以 `aria-pressed` 表示选择，顶线与文字同时变化；移动端编号在名称上方。

### Cards / Containers
图录以完整原作、标题、来源、描述与操作组成开放单元；作品区域深蓝面、20px 内边距，手机 24px。花册使用开放网格，已收藏、扫描相遇、最近浏览分别显示。备份导出摘要采用无底色的开放布局；恢复预检区采用深蓝面与细线边界，内边距 24px，手机 20px。

### Inputs / Fields
当前备份使用原生文件输入和确认复选框，没有通用搜索框或文本输入系统。文件字段采用深夜展厅底、冷白字、3px 圆角、最小高度 44px 和最大宽度 500px，手机全宽；原生文件按钮采用蓝色展面底、最小高度 36px。确认框使用青绿 accent，关联说明至少 44px 高。初始隐藏预检与确认区；预检通过后展示摘要，仅有新增记录时展示确认区，勾选确认后才能合并。旧版扫描导出放在原生 details 内，以 CSS 折角标示展开状态；撤销作为恢复区的次要动作。文件预检、明确确认与合并结果分别呈现，不能把样例控件当可执行恢复流程。

### Focus and selection
共享链接、按钮、summary 与备份输入的键盘焦点统一为青绿 2px 轮廓、5px 偏移，覆盖旧暖色和旧绿焦点规则。创作说明的图上标注与文字说明均使用原生 button，并同步 `aria-pressed`、活动样式及关联说明；标注为 44px 圆形，说明按钮至少 48px 高，选中项附带圆点。保留原生 Tab、Enter 与 Space 操作，不使用不完整的 tablist 语义。

### Light-field and artwork interaction
代码光场处于装饰层，不接管点击。五项按钮及前后箭头同步当前作品、描述、入口和 URL hash；原作先显示，WebGL 不可用仍可进入故事。珠光继续保留指针、触摸与键盘操作，不用强制转场或自动播放音频。

sidecar 样例只展示组件外观与原生交互状态；图录卡示例以清晰文字占位解释画幅，不复制或生成原作，不模拟 shader。色阶条是由现有色值生成的预览辅助，并不是产品新增色阶。现有 raster 来源及逐项 hash 见 [资源来源清单](docs/ASSET-PROVENANCE-20261029.json)，其许可未由本次文档重新认证。

## Do's and Don'ts

### Do:
- Do 保留每款花卡自己的完整原作、比例、署名与可用媒体。
- Do 保持原作与故事入口在图形增强失败时可访问。
- Do 保持主要控件至少 44px 高，保留语义化当前项、选中态和键盘焦点。
- Do 让手机内容自然重排与滚动，使用真实可用的收藏和备份状态。

### Don't:
- Don't 恢复装饰性玻璃导航、拟真书册阴影或全页纸色外壳。
- Don't 把静态截图或普通浏览记录标成实体卡识别成功。
- Don't 为缺失媒体、馆藏授权、生成图或真机性能编造证明。
- Don't 将 sidecar 的色阶预览与组件样例当成新的产品界面或运行时 token。

## 2026-10-30 内容精简

首页保留一句展览介绍、作品名与来源、明确入口；移除重复的观看说明和作品特征副文案。图录与详情不重复显示英文副标题，图录与花册取消重复操作指导。页脚保留来源和授权边界；正常静态作品与就绪珠光不显示说明，加载、失败、重试和三维手势仍有反馈。备份保留格式大小、预检确认、数据保留和撤销冲突提示；用分组标题表达下载与恢复关系。
