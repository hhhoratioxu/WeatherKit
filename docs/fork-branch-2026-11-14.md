# WeatherKit Fork 独立修复分支

日期：2026-11-14（Asia/Taipei）。用户要求提交全部适当的修复并能手动更新到自己的 Fork。目标仓库仅为 `hhhoratioxu/WeatherKit`，分支为 **`fix/fork-compat-20261114`**。沿用现有 Git 历史和 v3.3.6 版本号，不创建 tag/Release，不合并 main，不改上游 PR #107 的 `sync/loon-v3-and-air-quality` 分支。

## 更新方式

| 客户端 | 分支订阅 |
| --- | --- |
| Loon | [iRingo.WeatherKit.lpx](https://raw.githubusercontent.com/hhhoratioxu/WeatherKit/fix/fork-compat-20261114/Loon/script/iRingo.WeatherKit.lpx) |
| Surge | [iRingo.WeatherKit.sgmodule](https://raw.githubusercontent.com/hhhoratioxu/WeatherKit/fix/fork-compat-20261114/Surge/script/iRingo.WeatherKit.sgmodule) |

由用户手动把现有 WeatherKit 的订阅地址改为对应分支入口并更新，保留自己的 API 和来源参数。每个客户端只启用一份 WeatherKit。原 main 订阅继续取得正式 v3.3.6，不会自动包含该分支的修复。本次工作没有安装插件、改写用户设置或变动 Loon VPN、节点、规则、MITM 和系统网络配置。

## 提交范围与验证

保留此前全部源码、测试和来源记录，提交四类修复：预警实际未补全时保留 Apple 状态；已知 JSON 容器适配时保护未知子树；输出超限回退已经兼容的 Apple 正文；AQ 等级输入在转换前检查类型。12 项原有参数及默认值继续保留，已删除的 9 项控制没有加回。参考 #108/#110 的代码保留对应作者、完整来源 commit 和 Apache-2.0 说明。

提交前 [本地复核](fork-fixes-2026-11-14.md) 为 395/395 完整测试、Loon 50 个实际压缩脚本模拟场景及 15 项生成规则检查、Surge 39 个模拟场景。分支构建继续使用恢复的本地依赖与既有 1.1.2 schema，先提交源码，再以该源码提交为基准在隔离快照中生成两端产物。实际产物及输入摘要记录在同目录的 `fork-branch-2026-11-14.json`。

分支插件的 12 条脚本引用均指向本分支的实际脚本，保留兼容别名和 12 项原参数；不引用此前未发布的 `local-fork-fixes-20261114` 草稿，也不把新的脚本错误地固定到旧的 v3.3.6 tag。

## CI 与验证边界

[现有验证工作流](https://github.com/hhhoratioxu/WeatherKit/actions/workflows/cache-validation.yml?query=branch%3Afix%2Ffork-compat-20261114) 可对该分支手动执行；其权限为读取仓库和包，步骤为锁定依赖安装、测试、两端构建及产物上传，不含发布、部署或远端提交。构建资源引用使用执行时的分支名；去除此前上传依赖包快照的步骤，仅上传客户端构建结果。实际远端执行状态以 GitHub Actions 为准，不把本地测试写成远端 CI 通过。

此前本地干净 `npm ci` 因 GitHub Packages E403 失败；dev/#110 协议尝试因本地依赖缺少 `inspectTable` 导出而中断。这些限制保留，不据此判定上游代码故障。远端 CI 如能使用原有 workflow 授权完成干净安装，应与本地这次失败记录分别报告。

Loon/Surge 压缩脚本场景为自动模拟，生成规则检查不等同于原生客户端解析。尚无本次修复的完整原生天气 App、在线供应商、长期 VPN 或设备耗电/峰值内存验收；此前原生最小探测仅能证明那次小范围探测执行成功并恢复缓存。提交与分支分发不表示候选已经安装在设备上。
