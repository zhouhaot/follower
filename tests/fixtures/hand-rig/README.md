# 手部源模型测试夹具

`generic-hand-right.glb` 是历史手掌序列使用的源模型，来自 immersive-web/webxr-input-profiles 的 `packages/assets/profiles/generic-hand/right.glb`，MIT / Copyright 2019 Amazon，完整许可见同目录 LICENSE.txt。

- 来源记录：`public/assets/hand-sequence/manifest.json`。
- SHA-256：`291790c14f7f88a7f9bd35330c47392ed8e8d395ae6728f4bb7089f1bc1f2b96`。
- 2026-10-29 从旧工程保留源文件恢复，哈希与已有记录一致；没有重新生成模型。
- 单测直接读取此夹具，不依赖被忽略的 `work/`。它不进入 `dist/`。
- 历史 Blender 渲染脚本按原样保留，维持历史报告的脚本哈希；如需重渲染，先将本夹具复制到 `work/hand-rig/source/generic-hand-right.glb`。Blender 重渲染不属于网站构建，本轮未执行。
