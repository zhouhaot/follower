# 珠光设计记录

记录日期：2026-10-23。模式：从已完成实现提取，不重新开展方向选择。

## 范围与来源

- 用户已确认“局部珠光应用首页和详情页、当代博物馆数字展览、注意性能”；方向及质量标准见 [direction.md](direction.md)。
- 新增根 [DESIGN.md](../../../DESIGN.md) 与 [.impeccable/design.json](../../../.impeccable/design.json)。写入前两者均不存在，没有覆盖既有设计文档。未创建 PRODUCT.md。
- 色彩和卡片外观来自 `public/pearl-exhibition.css`；自托管 Exhibition 字体、正文栈、导航及原有布局来自 `public/styles.css`；详情排版与切换基础来自 `public/detail-experience.css`。HTML 引入顺序确认珠光样式最后覆盖。
- 完整图片比例来自 `public/pearl-card.mjs`；输入、低动态与有限演示来自 `public/pearl-gallery.mjs`；共享渲染器、纹理缓存与像素预算来自 `public/pearl-renderer.mjs`。

## 记录约定

DESIGN 的 frontmatter 为 token 规范，采用规范允许的 colors、typography、rounded、spacing、components 字段，组件属性仅使用规定的八类。sidecar 使用 schemaVersion 2；色阶为预览面板按原色生成的八阶 OKLCH 示例，不是运行时色板或额外获准的设计决策。半透明色保留透明度。

sidecar 包含五个独立 HTML/CSS 组件样例，不依赖框架。卡片只预览卡缘与题签，明确显示原作占位说明，没有复制、替换或编造花纹。字体遵循宿主可用的原有字体及回退栈。没有记录并不存在的输入框。

## 证据与边界

[visual-review.md](visual-review.md) 最终 disposition 为 ship，仅关闭该审查提出的三项问题。[confirmed/checks.json](confirmed/checks.json) 已有报告为 138/138 通过；本次仅回读，没有重新运行浏览器或测试。

本记录只覆盖首页、详情及共享珠光卡；不声称独立图录、收藏或导览已完成统一设计。数字珠光不构成实体印刷效果承诺。本机浏览器和模拟触摸的证据不代表所有真机/GPU 性能。没有执行生产发布。

写入后回读三份文件，校验 JSON 可解析、schemaVersion、必要对象、色阶数量、组件引用与 canonical 章节顺序；没有修改运行代码。
