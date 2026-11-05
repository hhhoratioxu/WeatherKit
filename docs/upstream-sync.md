# 原版同步记录

2026-11-05，先完成本 Fork 的 Loon v3.3.3 命名、更新说明与发布整理，再向原版提交 [NSRingo/WeatherKit #107](https://github.com/NSRingo/WeatherKit/pull/107)。

本 Fork 正式发行使用原版插件名称、功能描述、v3.3.3 标签与五段式更新说明。正式文件 iRingo.WeatherKit.lpx 和两条既有入口同字节，九个文件分别通过 Release、tag、main 的公共字节核对。三个执行脚本与先前通过原生观察的版本完整一致。

原版 PR 基于 c40e8f8，独立分支 sync/loon-v3-and-air-quality 的最终提交为 dac6b02970c1f8a942bcab0796f68815bbfd28a9。四个提交包含运行处理、Loon 原生接入、回归文档和完整依赖许可，共 65 个源码、构建与测试文件；保留原版自己的包名、版本决策和发布 URL。编译发行文件和本 Fork 的个人订阅入口不进入该 PR。

[最终分支 CI](https://github.com/hhhoratioxu/WeatherKit/actions/runs/41943886570) 使用 Node v22.23.4、完整锁定安装，通过 309 项回归、35 个压缩脚本场景和 15 个表达式／路由／jq 检查。下载的五文件资产 ZIP SHA-256 为 3cf2fd58f0cf1e0466c75541ee3e8fc643a1ef935743e03bb3912bbdb19bce7a；三个 Loon 运行文件与本 Fork 正式发布的执行脚本逐字节一致。生成的 0.0.0-test 入口仅是验证夹具。

上述提交时 PR 为 Open、非 Draft，未合入。2026-11-05 用户要求先完整核对原版含义，已将 #107 转为 Draft；本轮先完成 Fork 的目标标准、昨日对比及来源选择修正，详见[原版含义核对](upstream-intent-audit.md)。原版仓库的实际合并由维护者审核执行，本记录不表示原版官方订阅已经更新。结构化证据见 [同步验证](upstream-sync-validation.json)。
