# v3.3.4 原版含义修正

2026-11-05 对照原版 c40e8f8 源码、v3.3.2 正式插件及配置指南后修正本 Fork，完整说明见[原版用途与参数核对](upstream-intent-audit.md)。本版仍沿用原版名称与五段式更新说明，只发布当前 Loon 版本。

恢复指数目标标准的控制：默认 HJ6332012，选择算法不能绕过目标列表。污染物补齐独立进行，不将供应商指数写入目标外结果；空目标列表与 None 停用本地指数转换。恢复默认保留已有昨日对比及独立来源的配置。备用查询加入明确开关且默认关闭，单独填写 Token 不会改变来源选择。

已发布的 WK3 主 App JSON 适配、CO 单位修复、算法数值处理、缓存与请求合并继续保留。没有新增后台轮询、宿主 API、取消能力或最低版本要求。v3 自定义处理限主天气 App；未知后台、组件及手表的 WK3 二进制仍保留 Apple 传输。

## 构建证据

源码 dabcbf8b0778a417cf70f5c85dc70fd33433aefc 的 [Actions 41970394845](https://github.com/hhhoratioxu/WeatherKit/actions/runs/41970394845) 使用 Node v22.23.4 和完整锁定安装，通过 325 项回归（0 失败、0 跳过）、38 个实际压缩脚本场景与 15 个表达式／路由／jq 检查。原版 12 项正式参数默认值全部一致，Fork 插件共 21 项声明且均传入主 App 原生脚本参数。

下载的九文件资产 ZIP SHA-256 为 02945d007fe1d97fa9a9635f6892ed701f3e530863af794d625de9b3b4e1050f，与 GitHub artifact digest 一致。内部八条校验全部匹配，三个导入入口同字节，实际下载的压缩脚本重新通过 38/15 检查。发布使用原始 CI 文件，运行引用固定到 v3.3.4，不进行二次加工。

v3.3.3 的完整构建记录另存为 [历史验证](loon-build-validation-v3.3.3.json)，原 tag 和附件保留。本轮没有重新进行独立设备验证；cache-v9 的 Mac 观察和 iPhone 用户反馈不能替代 v3.3.4 的设备复测。设备耗电、内存比例与长期 VPN 稳定性未测量。

上游 PR #107 在本次核对期间保持草稿，尚未合入原版；Fork 发布与原版维护者审核分开记录。

## 发布完成

Fork [v3.3.4](https://github.com/hhhoratioxu/WeatherKit/releases/tag/v3.3.4) 已发布为 Latest，tag 固定为 4b39eddecc27032268bad0c9e22fcb95050bc5c0。Release 更新说明与 CHANGELOG 统一换行后完全一致；九个原始 CI 文件在 Release、tag、main 分别通过 9/9 公共字节检查，共 27 项，三条订阅入口同字节。运行文件引用 v3.3.4 tag，旧订阅地址继续可用，旧版本 tag 与附件保留。

完整记录见[发布字节验证](v3.3.4-publication-verification.json)与[构建验证](loon-build-validation.json)。原版草稿分支也通过独立的锁定构建，详情见[同步记录](upstream-sync.md)。
