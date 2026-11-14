# WeatherKit Fork main 兼容修复更新

日期：2026-11-14（Asia/Taipei）。用户明确授权把已验证修复普通 fast-forward 同步到 `hhhoratioxu/WeatherKit:main`，使现有订阅可直接更新；保留 `fix/fork-compat-20261114` 作备份。沿用现有 Git 历史和 v3.3.6 版本号，不创建或移动 tag，不公开发布 Release，不改上游 PR #107 的 `sync/loon-v3-and-air-quality` 分支。允许 main 既有工作流自动产生 Draft 构建和草稿 Release。

## 更新方式

| 客户端 | 原 main 订阅 |
| --- | --- |
| Loon | [iRingo.WeatherKit.lpx](https://raw.githubusercontent.com/hhhoratioxu/WeatherKit/main/Loon/script/iRingo.WeatherKit.lpx) |
| Surge | [iRingo.WeatherKit.sgmodule](https://raw.githubusercontent.com/hhhoratioxu/WeatherKit/main/Surge/script/iRingo.WeatherKit.sgmodule) |

用户在原 WeatherKit 插件中手动更新即可，保留已有来源和 API 参数，无需切换订阅地址或启用第二份插件。本次不修改旧 v3.3.6 tag 和公开 Release 附件；这些后续修复以 main 入口为准。独立备份分支也保留同一组产物，产物内部脚本引用统一使用 main。

只读核对 Mac 现有 Loon 的实际订阅 URL 指向上述 Fork main，缓存插件和脚本仍为 v3.3.5。更新前不把它描述为已经安装了新修复。本次提交、推送及核对不会改写 Loon 配置、插件参数、VPN、节点、代理、规则、MITM 或系统网络配置。

## 提交范围与验证

提交此前全部适当的源码、测试和来源记录：预警实际未补全时保留 Apple 状态；已知 JSON 容器适配时保护未知子树；输出超限回退已经兼容的 Apple 正文；AQ 等级输入在转换前检查类型。12 项原有参数及默认值继续保留，已删除的 9 项控制没有加回。参考 #108/#110 的代码保留对应作者、完整来源 commit 和 Apache-2.0 说明。

完整测试 **395/395**、Loon **50** 个实际压缩脚本模拟场景及 **15** 项生成规则检查、Surge **39** 个模拟场景通过。构建仍使用本 Fork 的 1.1.2 schema，先提交源码，再以该源码提交为基准在隔离快照中生成两端产物。实际输入、产物 SHA-256 和源码提交记录在 [构建摘要](fork-branch-2026-11-14.json)。缓存、日志、API 凭据、设备抓包和依赖目录不提交。

生成插件的 12 条脚本引用必须全部指向 Fork main 的实际运行文件；不引用此前未发布的 `local-fork-fixes-20261114`，也不把新的脚本固定到旧的 v3.3.6 tag。推送后核对实际 main raw 插件和脚本的 SHA-256，保留兼容入口、参数和来源不变。

## CI 与验证边界

[现有验证工作流](https://github.com/hhhoratioxu/WeatherKit/actions/workflows/cache-validation.yml?query=branch%3Amain) 对目标 main 手动执行，使用原有仓库/包读取权限完成锁定依赖安装、完整测试和两端构建，不包含发布、部署或远端提交；构建资源引用使用执行时的 ref，去除此前上传依赖包快照的步骤，只上传客户端产物。另一个既有 Draft 流程会随 main 推送触发构建和草稿 Release，这一附带流程已获用户明确授权。没有触发公开 Release 的 tag 操作。

此前本地干净 `npm ci` 因 GitHub Packages E403 失败，当前本机构建沿用恢复后的依赖；远端验证如能使用既有 workflow 授权完成干净安装，应与本地失败记录分别报告。dev/#110 新协议仍因本地依赖缺少 `inspectTable` 导出而未完成验证，没有迁移该协议，也不能把本 Fork 的测试当作 dev 通过。

Loon/Surge 压缩脚本场景为自动模拟，规则检查不等同于原生客户端解析。本次四类修复仍没有完整原生天气 App、在线供应商、长期 VPN 或设备耗电/峰值内存验收。此前原生最小探测只能证明那次小范围探测执行成功且缓存恢复；GitHub 更新完成不表示候选已经安装在设备上。此前 [本地复核](fork-fixes-2026-11-14.md) 及 [PR 比较](pr107-review-2026-11-14.md) 保留当时的历史状态。
