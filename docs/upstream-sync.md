# 原版同步记录

2026-11-05 按用户要求，先整理本 Fork 的 Loon 命名与发行，再对照原版用途及参数含义修正处理逻辑。Fork 正式版本为 [v3.3.4](https://github.com/hhhoratioxu/WeatherKit/releases/tag/v3.3.4)；原版 [NSRingo/WeatherKit #107](https://github.com/NSRingo/WeatherKit/pull/107) 保持 Open、Draft，尚未合入。

原版基线为 c40e8f8，正式插件、源码及指南的核对见[原版含义审计](upstream-intent-audit.md)。本轮恢复指数目标名单、默认保留昨日对比及独立来源的控制，并要求明确开启备用查询。算法数值、CO 单位、WK3 主 App 适配及有界缓存继续保留。

PR 分支 sync/loon-v3-and-air-quality 当前提交为 831852ff37cdfd74cabab9c3665fefb754c037bf，共五个提交、69 个源码、构建、文档与测试文件。保留原版包名、版本策略、插件名称和 Release URL；编译发行文件、Fork 订阅入口、个人凭据及原始设备抓包不进入 PR。Loon 使用独立 .loon.bundle.js，新增参数在生成后明确声明原生类型。

[当前分支 CI](https://github.com/hhhoratioxu/WeatherKit/actions/runs/41971388558) 使用 Node v22.23.4、完整锁定安装，通过 325 项回归、38 个压缩脚本场景和 15 个表达式／路由／jq 检查；原版 12 项正式参数默认值逐项一致。下载的五文件资产 ZIP SHA-256 为 9710a1ccf33c786b70b88875013becbbb2623ad760b2ba8f7fbb4f2c6355c2b1，归档及重新执行检查通过。三个运行文件与 Fork v3.3.4 整份文件同字节；0.0.0-test 只表示构建夹具。

Fork 的 Release、固定 tag 和 main 各九个文件已与 CI 原始字节匹配，共 27 个公共文件。原版仓库仍由维护者审核决定实际合入，不能将 Fork 发布解释为原版官方订阅已更新。本轮尚未独立复测设备；旧版 Mac 观察与 iPhone 用户反馈不等于新修正的设备或耗电验收。

结构化证据见[当前同步验证](upstream-sync-validation.json)。此前 v3.3.3 的 309/35/15、dac6b02 分支与非草稿状态仅为历史快照，另存于[历史验证](upstream-sync-validation-v3.3.3.json)。
