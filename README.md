# WeatherKit

本仓库是 [NSRingo/WeatherKit](https://github.com/NSRingo/WeatherKit) 的 Fork，保留原作者、Apache-2.0 许可证与 Git 历史。当前发行 **v3.3.6** 同时提供 Loon 和 Surge 版本；本地维护中的插件显示名称统一为 `WeatherKit`，功能描述与原有参数含义沿用原版。

[更新说明](CHANGELOG.md) · [正式 Release](https://github.com/hhhoratioxu/WeatherKit/releases/tag/v3.3.6) · [原版配置指南](https://NSRingo.github.io/guide/Weather/weather-kit)

## 安装与更新

| 客户端 | 订阅地址 |
| --- | --- |
| Loon | [一键导入](https://www.nsloon.com/openloon/import?plugin=https%3A%2F%2Fraw.githubusercontent.com%2Fhhhoratioxu%2FWeatherKit%2Fmain%2FLoon%2Fscript%2FiRingo.WeatherKit.lpx) · [iRingo.WeatherKit.lpx](https://raw.githubusercontent.com/hhhoratioxu/WeatherKit/main/Loon/script/iRingo.WeatherKit.lpx) |
| Surge | [iRingo.WeatherKit.sgmodule](https://raw.githubusercontent.com/hhhoratioxu/WeatherKit/main/Surge/script/iRingo.WeatherKit.sgmodule) |

Loon 原有 WeatherKit.lpx、WeatherKit.plugin 地址继续可用，与正式入口同内容。Surge 同时提供 WeatherKit.sgmodule 兼容入口。每个客户端只启用一份 WeatherKit，沿用已有的 MitM 证书配置。

2026-11-14 的四类兼容修复通过 **Fork main 的现有订阅入口**更新，版本号保持 3.3.6。请在原 WeatherKit 插件中更新，保留自己的参数，无需切换订阅地址或启用另一份插件。本次更新不改旧 v3.3.6 tag 和公开 Release 附件；要取得这些后续修复，请使用上表的 main 入口。

| 修复分支备份 | 入口 |
| --- | --- |
| Loon | [iRingo.WeatherKit.lpx](https://raw.githubusercontent.com/hhhoratioxu/WeatherKit/fix/fork-compat-20261114/Loon/script/iRingo.WeatherKit.lpx) |
| Surge | [iRingo.WeatherKit.sgmodule](https://raw.githubusercontent.com/hhhoratioxu/WeatherKit/fix/fork-compat-20261114/Surge/script/iRingo.WeatherKit.sgmodule) |

本次更新包含预警状态保留、未知 JSON 容器保护、输出超限时保留已兼容 Apple 数据，以及 AQ 等级输入检查。详细边界见 [main 更新与验证](docs/fork-branch-2026-11-14.md)，远端测试状态见 [验证工作流](https://github.com/hhhoratioxu/WeatherKit/actions/workflows/cache-validation.yml?query=branch%3Amain)。提交到 GitHub 不表示设备已自动安装，仍由用户在原插件中更新。

## 功能

- 保留原版天气、空气质量、下一小时降水、天气预警与详情功能。
- 主天气 App 支持 WeatherKit v3；修复天气状态、降水统计与预警编号格式不兼容。
- 支持 11 种内置空气质量算法及 None，保留六项有效污染物浓度并修复 Apple QWeather CO 标签问题。
- 算法只作用于指定原始指数标准，默认目标仍为 HJ6332012；默认保留已有昨日对比及独立来源设置。
- 已有数据优先，缺项补充失败保留原有天气。仅使用所选数据源，单独填写另一来源令牌不会改变所选来源。
- v3.3.6 已移除短时请求缓存、在途合并、网络发起预算、失败冷却、额外运行统计、地区推断与备用查询，保留原有 12 项插件参数。更新现有插件后，相关 9 项控件不再显示；保留正常单请求超时和失败时的 Apple 数据。

本次新增第 13 项 `[天气预警] 正文语言偏好`（`WeatherAlerts.Language`）：自动、简体中文或 English，默认自动保持旧行为。仅向当前来源请求对应语言；不支持、缺少译文或返回混合语言时保留来源原文、签发单位和出处，不调用第三方翻译。其他天气产品语言、Apple 原始预警标题和页面标签分别沿用各自设置。来源返回文字的实际语言未确认时使用 `und` 标识，不将其冒充已核验的译文。原有 12 项参数及默认值保留，已移除的 9 项控制不恢复。实现与前期阶段记录见 [预警语言候选](docs/warning-language-2026-11-14.md)。后续使用同一份重建候选临时导入 Mac Loon，已确认 13 项设置、原 12 项值不变，以及有效公开预警的中英文正文、签发单位和来源链接实际显示；中文完整原生 JSON 也与本轮来源逐段核对一致，详见 [本轮预警原生验收与范围](docs/native-warning-acceptance-2026-11-14.md)。验收后恢复原插件并停止本机服务。GitHub 源码与生成产物更新不代表设备已安装，仍由用户自行更新原订阅。

Loon 最低版本为 3.5.1(983)。Surge 使用自己的 .sgmodule、字符串参数、秒制 HTTP 超时及 JSC/WebView 引擎，见 [Surge 说明](docs/surge.md)。WK3 自定义处理限 iOS/macOS 主天气 App；后台、组件和手表继续保留 Apple 原传输。供应商专用接口仍需要有效的账户权限与令牌。

同时修复未知预警到期时间在正时区跨入 10000 年的兼容边界，兼容旧占位值并保留真实到期时间；它与此前无正文现象没有已证实的因果关系。重建候选的原生 JSON 已确认输出安全占位值且不制造事件结束时间，详见 [未知到期时间兼容修复](docs/unknown-expiry-2026-11-14.md) 及 [后续原生结果](docs/native-warning-acceptance-2026-11-14.md)。全量回归 434/434、Loon 编译场景 52/52 与规则 15/15、Surge 编译场景 41/41 均通过。主天气、AQ、降水等旧功能本轮以自动回归为依据，旧轮 f571a49 的实机观察单独保留；Surge 真机、其他地区／来源及长期资源表现仍未验证。

[原版用途与参数核对](docs/upstream-intent-audit.md) · [v3.3.6 精简说明](docs/v3.3.6.md) · [预警编号修复](docs/weather-alert-id-v3.md) · [历史发行构建记录](docs/loon-build-validation.json) · [Mac 原生观察记录](docs/mac-native-observations-v3.3.5.json)

历史 v3.3.5 发行验证包含 345 项回归、Loon 40 个压缩脚本场景及 15 个规则检查、Surge 29 个压缩脚本场景。这些数字不代表当前未提交源码的验证。Surge 尚未独立原生实测；Mac 观察记录标明了实际测试的候选提交，未扩展为当前产物的设备耗电、内存或稳定性结论。

历史 [v3.3.4](https://github.com/hhhoratioxu/WeatherKit/releases/tag/v3.3.4)、[v3.3.3](https://github.com/hhhoratioxu/WeatherKit/releases/tag/v3.3.3) 和 [cache-v9](https://github.com/hhhoratioxu/WeatherKit/releases/tag/cache-v9) 保留。[原版合并请求 #107](https://github.com/NSRingo/WeatherKit/pull/107) 的实际状态见 [同步记录](docs/upstream-sync.md)。

2026-11-13 的 [技术审计](docs/development-audit-2026-11-13.md) 和 [本地精简验证](docs/remove-extra-controls-2026-11-13.md) 保留为发布前的历史记录。用户随后授权更新，v3.3.6 已将精简后的源码和生成的 Loon、Surge 文件一起发布。[锁定依赖 CI](https://github.com/hhhoratioxu/WeatherKit/actions/runs/43448848656) 通过 344 项测试、Loon 46 个压缩脚本场景及 15 项规则检查、Surge 35 个压缩脚本场景；main/tag/Release 共 57 份公开文件通过字节核对，见 [发布验证记录](docs/v3.3.6-publication-verification.json)。发布产物固定引用 `v3.3.6`，原有订阅地址和兼容入口保持不变。自动验证不代表 Loon/Surge 真机 VPN 或耗电验收。

2026-11-14 的 [PR #107 比较、修复与本地候选](docs/pr107-review-2026-11-14.md) 保留此前比较快照；PR #107 本身没有随本次 Fork 分支更新。

同日完成的 [Fork 四类修复复核](docs/fork-fixes-2026-11-14.md) 记录提交前的 395/395 完整测试、Loon 50 个模拟场景及 15 项规则检查、Surge 39 个模拟场景；“仅本地”对应当时状态。后续提交与分支产物见 [分支更新记录](docs/fork-branch-2026-11-14.md)。dev 新协议及本次修复的原生/在线验收仍未完成，不恢复已移除的 9 项控制。

后续 [Mac Loon 安装核对与有限原生观测](docs/mac-native-observation-2026-11-14.md) 已确认插件及三个缓存脚本与 f571a49 一致，并记录两次来自 Apple 天气的 CN/GB 请求命中 v3 脚本、完成且无脚本异常；363 次 VPN 状态采样均为 Connected。原生界面工具随后超时，天气画面、来源替换、AQ 和预警内容尚未验收，不能把这次有限观测称为全部真机功能通过。
