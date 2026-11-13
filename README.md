#  iRingo: 🌤 WeatherKit

本仓库是 [NSRingo/WeatherKit](https://github.com/NSRingo/WeatherKit) 的 Fork，保留原作者、Apache-2.0 许可证与 Git 历史。当前发行 **v3.3.6** 同时提供 Loon 和 Surge 版本，插件名称、功能描述与原有参数含义沿用原版。

[更新说明](CHANGELOG.md) · [正式 Release](https://github.com/hhhoratioxu/WeatherKit/releases/tag/v3.3.6) · [原版配置指南](https://NSRingo.github.io/guide/Weather/weather-kit)

## 安装与更新

| 客户端 | 订阅地址 |
| --- | --- |
| Loon | [一键导入](https://www.nsloon.com/openloon/import?plugin=https%3A%2F%2Fraw.githubusercontent.com%2Fhhhoratioxu%2FWeatherKit%2Fmain%2FLoon%2Fscript%2FiRingo.WeatherKit.lpx) · [iRingo.WeatherKit.lpx](https://raw.githubusercontent.com/hhhoratioxu/WeatherKit/main/Loon/script/iRingo.WeatherKit.lpx) |
| Surge | [iRingo.WeatherKit.sgmodule](https://raw.githubusercontent.com/hhhoratioxu/WeatherKit/main/Surge/script/iRingo.WeatherKit.sgmodule) |

Loon 原有 WeatherKit.lpx、WeatherKit.plugin 地址继续可用，与正式入口同内容。Surge 同时提供 WeatherKit.sgmodule 兼容入口。每个客户端只启用一份 WeatherKit，沿用已有的 MitM 证书配置。

## 功能

- 保留原版天气、空气质量、下一小时降水、天气预警与详情功能。
- 主天气 App 支持 WeatherKit v3；修复天气状态、降水统计与预警编号格式不兼容。
- 支持 11 种内置空气质量算法及 None，保留六项有效污染物浓度并修复 Apple QWeather CO 标签问题。
- 算法只作用于指定原始指数标准，默认目标仍为 HJ6332012；默认保留已有昨日对比及独立来源设置。
- 已有数据优先，缺项补充失败保留原有天气。仅使用所选数据源，单独填写另一来源令牌不会改变所选来源。
- v3.3.6 已移除短时请求缓存、在途合并、网络发起预算、失败冷却、额外运行统计、地区推断与备用查询，保留原有 12 项插件参数。更新现有插件后，相关 9 项控件不再显示；保留正常单请求超时和失败时的 Apple 数据。

Loon 最低版本为 3.5.1(983)。Surge 使用自己的 .sgmodule、字符串参数、秒制 HTTP 超时及 JSC/WebView 引擎，见 [Surge 说明](docs/surge.md)。WK3 自定义处理限 iOS/macOS 主天气 App；后台、组件和手表继续保留 Apple 原传输。供应商专用接口仍需要有效的账户权限与令牌。

[原版用途与参数核对](docs/upstream-intent-audit.md) · [v3.3.6 精简说明](docs/v3.3.6.md) · [预警编号修复](docs/weather-alert-id-v3.md) · [历史发行构建记录](docs/loon-build-validation.json) · [Mac 原生观察记录](docs/mac-native-observations-v3.3.5.json)

历史 v3.3.5 发行验证包含 345 项回归、Loon 40 个压缩脚本场景及 15 个规则检查、Surge 29 个压缩脚本场景。这些数字不代表当前未提交源码的验证。Surge 尚未独立原生实测；Mac 观察记录标明了实际测试的候选提交，未扩展为当前产物的设备耗电、内存或稳定性结论。

历史 [v3.3.4](https://github.com/hhhoratioxu/WeatherKit/releases/tag/v3.3.4)、[v3.3.3](https://github.com/hhhoratioxu/WeatherKit/releases/tag/v3.3.3) 和 [cache-v9](https://github.com/hhhoratioxu/WeatherKit/releases/tag/cache-v9) 保留。[原版合并请求 #107](https://github.com/NSRingo/WeatherKit/pull/107) 的实际状态见 [同步记录](docs/upstream-sync.md)。

2026-11-13 的 [技术审计](docs/development-audit-2026-11-13.md) 和 [本地精简验证](docs/remove-extra-controls-2026-11-13.md) 保留为发布前的历史记录。用户随后授权更新，v3.3.6 已将精简后的源码和生成的 Loon、Surge 文件一起发布。[锁定依赖 CI](https://github.com/hhhoratioxu/WeatherKit/actions/runs/43448848656) 通过 344 项测试、Loon 46 个压缩脚本场景及 15 项规则检查、Surge 35 个压缩脚本场景；main/tag/Release 共 57 份公开文件通过字节核对，见 [发布验证记录](docs/v3.3.6-publication-verification.json)。发布产物固定引用 `v3.3.6`，原有订阅地址和兼容入口保持不变。自动验证不代表 Loon/Surge 真机 VPN 或耗电验收。
