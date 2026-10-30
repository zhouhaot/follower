# 花开有声

五张实体花卡与数字展览：观看原作和三维花朵、阅读故事、聆听清荷的 AI 合成设计解说、主动收藏并在同一浏览器的花册中找回。

当前为验收候选。**实体卡扫描是正式上线硬门槛，尚未完成真机逐卡验收；不要据此更新正式服务器。** 本轮基线为 main `981d6ab4e26a5fbb921c9e770f09f80eeed77110`，开发分支为 `codex/quality-preview-20261029`。产物身份以构建后的 `dist/version.json` 为准。正式站点与仓库的一致性本轮未核验。

## 运行与验证

要求 Node.js 22+、npm 和 Python 3。干净克隆后运行：

```sh
npm ci
npm test
npm run build
python3 scripts/serve-local.py dist 4173
```

打开 `http://127.0.0.1:4173/`。另一终端运行：

```sh
npx playwright install chromium
npm run test:phase1-ui
npm run test:phase2-ui
npm run test:detail-ui
npm run test:pearl-ui
npm run test:quality-ui
```

macOS 默认使用已安装的 Google Chrome，也可用 `AUDIT_CHROMIUM` 指定可执行文件；Linux CI 使用 Playwright Chromium。所有浏览器脚本只允许 localhost，使用隔离的测试存储，不读取日常浏览器花册。`npm run dev` 则直接预览可编辑的 `public/`。

GitHub Actions 配置见 [quality.yml](.github/workflows/quality.yml)，在 push、PR 和手动触发时运行单测、资源校验、构建和浏览器回归，并以 Git SHA 命名证据附件。工作流失败会使 job 失败；是否禁止合并还取决于 GitHub 分支保护，当前未设置或核验该保护。

## 目录职责

| 目录 | 用途 |
|---|---|
| `public/` | 当前网站源码与资源，唯一发布输入；原图保留原字节 |
| `runtime-public/` | 历史轻量副本，未同步当前功能；不用于本轮构建或发布 |
| `dist/` | `npm run build` 生成；不手改、不入 Git |
| `tests/fixtures/hand-rig/` | 带许可证和 SHA-256 的手部模型测试夹具，不进入网站 |
| `work/` | 忽略的历史制作工作区，网站构建和单测不得依赖它 |
| `reports/quality-*/` | 当次运行日志、截图和结果；本地保留，CI 上传 |

`npm run test:assets` 检查 public 文件已被 Git 跟踪、代码中的静态引用、五卡映射及音频状态。保留在 `assets/originals/_source/` 的上游历史源码不作为应用入口检查。动态加载与故障行为由浏览器回归覆盖。构建生成 `version.json`，包含源提交、源码是否有未提交修改、逐文件 SHA-256 和整包摘要；复制成功不能替代运行验收。

## 内容和数据边界

- 清荷：AI 合成设计解说，按点击播放，提供全文、错误提示和重试。其余四款目前为文字导览。
- 五款三维花卉由代码生成；金属花卡使用本地 GLB。模型和珠光均为可选视图。
- 浏览、主动收藏与扫描记录含义不同。当前花册使用 v2；扫描和历史备份页仍使用 v1，不能宣称扫描已接入新版花册，也不能用旧备份页备份 v2 主动收藏。
- 无账号、无跨设备同步。花册只在当前浏览器保存。
- 原卡图片中的二维码沿用原始目的地，不自动指向本次独立预览站；实体入口必须另行验收。

## 验收与发布

[本轮要求、发现和上线门槛](docs/ACCEPTANCE-20261029.md) · [真机与用户试用记录表](docs/usability/ACCEPTANCE-20261029.md)。Sites 只承载独立测试环境；不覆盖 zevth.work。正式服务器上线由用户后续确认，需版本核对、旧版保留和实际回滚演练。

旧 README 完整保存在 [历史快照](docs/archive/README-before-quality-20261029.md)。根目录阶段报告、`docs/QA-STATUS.md` 与 `docs/DEPLOYMENT-v0.4.md` 均为各自日期的历史证据，不代表当前测试、部署或真实设备验收。
