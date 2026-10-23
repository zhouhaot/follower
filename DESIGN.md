---
name: "花开有声 · 局部珠光展陈"
description: "首页与花卡详情的当代博物馆数字展览设计记录"
colors:
  exhibit-room: "#182421"
  exhibit-ink: "#f0ece1"
  exhibit-muted: "#bdc8bf"
  exhibit-line: "#a7b8ad40"
  exhibit-paper: "#e5e8e1"
  action-paper: "#e1e7d7"
  action-ink: "#24362b"
  pearl-hover: "#d3c29c"
  focus: "#e0cea3"
  catalogue-paper: "#e8e7dd"
typography:
  display:
    fontFamily: "Exhibition, 'Noto Serif SC', 'Songti SC', SimSun, serif"
    fontSize: "58px"
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: ".04em"
  headline:
    fontFamily: "Exhibition, 'Noto Serif SC', 'Songti SC', SimSun, serif"
    fontSize: "44px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: ".04em"
  body:
    fontFamily: "Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "16px"
    lineHeight: 1.9
  story:
    fontFamily: "Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "16px"
    lineHeight: 2
  label:
    fontFamily: "Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "13px"
    lineHeight: 1.6
  card-title:
    fontFamily: "Exhibition, 'Noto Serif SC', 'Songti SC', SimSun, serif"
    fontSize: "18px"
    lineHeight: 1.6
    letterSpacing: ".04em"
rounded:
  control: "4px"
  card: "12px"
  small-card-mobile: "9px"
  navigation: "50px"
spacing:
  tools-gap: "8px"
  caption-gap: "10px"
  toolbar-gap: "12px"
  section-gap: "32px"
  detail-columns: "56px"
components:
  home-start:
    backgroundColor: "{colors.action-paper}"
    textColor: "{colors.action-ink}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
  pearl-button:
    backgroundColor: "transparent"
    textColor: "{colors.exhibit-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
  pearl-button-hover:
    backgroundColor: "{colors.pearl-hover}"
    textColor: "{colors.exhibit-room}"
  home-nav:
    backgroundColor: "#d5e5db12"
    textColor: "{colors.exhibit-muted}"
    rounded: "{rounded.navigation}"
    padding: "6px"
  exhibit-switch:
    backgroundColor: "transparent"
    textColor: "#d6dfd2"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  exhibit-switch-selected:
    backgroundColor: "{colors.action-paper}"
    textColor: "{colors.action-ink}"
  pearl-face:
    backgroundColor: "{colors.exhibit-paper}"
    rounded: "{rounded.card}"
    padding: "12px 12px 8px"
---

# Design System: 花开有声 · 局部珠光展陈

## Overview

**Creative North Star: "当代博物馆数字展览"**

以完整花卉纹样为主角，深绿展厅承托暖白文字，浅色卡缘提供观看边界。标题延续项目自托管 Exhibition 字体；局部珠光随观察动作变化，界面保持克制。

本记录只适用于首页、花卡详情及其共享珠光卡组件，来自用户已确认的局部珠光样稿与两页延展。首页的浅色五卡区域属于本次范围；独立图录、收藏、导览页面不据此宣称已统一。珠光是屏幕上的数字材质近似，不是实体印刷工艺或实物效果承诺。

**Key Characteristics:**
- 完整原作与五种花卉差异优先。
- 深绿背景、暖白文字、浅色卡缘和有限导航透光。
- 输入驱动的局部光影；静止时无持续绘制。

## Colors

色值以 frontmatter 为准；这是实际使用值的记录，不是新建运行时主题。

### Primary
- `action-paper` / `action-ink`：浅色开始入口及已选择的展示方式。
- `pearl-hover`：珠光工具悬停反馈。
- `focus`：首页与详情的键盘焦点。

### Neutral
- `exhibit-room` / `exhibit-ink` / `exhibit-muted`：展厅背景、主要文字及次级说明。
- `exhibit-line`：轻边界；保留原有带透明度的 CSS 色值。
- `exhibit-paper`：珠光卡缘；`catalogue-paper`：首页五卡区域底色。

**The Artwork First Rule.** 保留每种花卉自己的完整资源与比例；光影不得替代原作，原作入口保持可访问。

## Typography

标题及卡名使用 `--serif` 指向的 Exhibition 字体，项目从 `public/assets/fonts/exhibition.ttf` 自托管，采用 `font-display: swap`。正文与工具文字沿用系统无衬线栈；没有新引入字体。

frontmatter 的 `display` 为首页桌面标题，701–1000px 缩为 46px，≤700px 为 40px，≤350px 为 36px。`headline` 为详情标题，≤700px 为 34px，≤350px 为 32px。首页正文在手机为 14px；故事正文在 ≤1000px 为 15px、行高 2、最大宽度 70ch。卡名在手机为 17px。不是全站通用比例尺。

## Layout

首页桌面采用两列各 `minmax(0,1fr)`，留白 `160px 8vw 85px`，列间距 `7vw`；≤700px 改为纵向排列，留白 `155px 24px 35px`。首页五卡区域桌面五列，手机两列，第五卡居中。

详情主体最大宽度 1200px，左右内边距 20px；展台与故事桌面按 1.15:1 分列、间距 56px，701–1000px 等分两列、间距 32px，≤700px 单列。珠光展台高度依次为桌面 540px、平板 490px、手机 450px、≤350px 410px。

首页主卡桌面宽 300px、平板最多 270px、手机 `min(76vw,285px)`；详情主卡桌面 280px、平板 250px、手机 `min(66vw,255px)`。五张原作比例从各自资源尺寸取得，不套统一裁切。320px 首页导航使用 `calc(100% - 24px)` 宽度与等分项目，保持四项文字完整。

## Elevation & Depth

深度来自纸色卡缘、细侧边及有限投影。主卡投影为 `2px 3px 0 #9aa69e,8px 20px 32px #080e0c70`；首页五卡缩为 `1px 2px 0 #9aa69e,4px 12px 20px #253e3022`。导航保留 10px 模糊、无投影；不要将它扩展为整屏玻璃层。

**The Finite Motion Rule.** 珠光响应输入；手动演示在 1.6 秒后结束。隐藏、离屏或静止时不持续绘制，低动态偏好不倾转。

每组花卡共享一个离屏 WebGL 渲染器；首页六个可见卡位使用同一上下文，显示端保存 2D 快照。纹理缓存最多三张、纹理最长边最多 1024px，绘制像素比上限 1.5。不要为每张卡新增常驻 WebGL 上下文。

## Shapes

工具按钮和展示切换使用小圆角，卡缘及展台使用较大圆角；具体值见 `rounded`。导航仍是胶囊形。卡面将原作完整包含于边框内，`object-fit: contain`，不裁切、不放大悬停原画。

## Components

- **首页开始入口**：浅色实底，链接保留原有跳转；悬停变白。仅此入口采用 frontmatter 的 `home-start`，不能把全站旧式胶囊按钮都认作已替换。
- **珠光工具**：透明底、细边线，最小高度 44px；悬停采用暖色实底；禁用时半透明。焦点为 2px 暖色轮廓、偏移 5px。
- **首页导航**：有限透光；选中项使用淡暖底与暖白字。小屏触控高度至少 44px，最窄屏幕四项等分。
- **展示切换**：使用 `aria-pressed` 表示选中，始终保留珠光与原作入口，已有立体/金属视图按当前数据可用性呈现；不扩张为每种卡都拥有全部视图的承诺。
- **共享珠光卡**：图像先显示，增强延迟加载；指针或横向拖动调整视角，方向键微调，Home 归正。拖动不会误触跳转，纵向触摸保留阅读；`prefers-reduced-motion: reduce` 禁用倾转并隐藏演示按钮。
- **既有详情动作**：故事、收藏、模型及恢复提示继续沿用既有组件；此记录不重新定义它们的业务状态与存储契约。当前两页没有需新增记录的通用输入框。

sidecar 的卡组件仅演示边框和标题结构，不复制原作、不模拟真实 shader；实际花纹与珠光以运行页面和现有验收图为准。

## Do's and Don'ts

### Do:
- Do 保持完整花卉纹样可辨，使用对应原作资源与原始比例。
- Do 保留键盘方向键、Home 归正、纵向触摸阅读和清晰焦点。
- Do 让关键控件至少有 44px 高度，并保留原作、故事及现有收藏入口。
- Do 将图像、模块与 WebGL 故障回退到可阅读原作的路径。

### Don't:
- Don't 把局部珠光扩展成整屏光晕、持续自动旋转或空闲绘制循环。
- Don't 将此记录当成独立图录、收藏、导览已完成统一改版的证明。
- Don't 将本机浏览器与模拟触摸结果写成所有实体手机流畅的保证。
- Don't 将数字珠光描述为已经验证的实体珠光印刷效果。
