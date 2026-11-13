# WeatherKit 技术审计与本地修复

> 历史候选记录：用户随后要求移除截图中的 9 项附加控制。本文的短时缓存、额外地区推断、备用查询策略及 397 项测试结果仅适用于先前候选，当前精简结果以 [移除记录](remove-extra-controls-2026-11-13.md) 为准。原候选已完整备份。

核对日期：2026-11-13。状态：**本地未发布**。工作分支：`fix/weatherkit-audit-20261113`，基准为远端 `main` 的 `2705a3be500172ae44ba1961816adccec292abad`。本轮没有提交、Push、tag、Release 或在线订阅更新。

本记录用于继续现有项目；历史发布和设备观察仍保存在原有文档。机器可读证据见 [验证摘要](development-audit-2026-11-13.json)，处理量测原始值见 [分钟预报量测](minutely-processing-2026-11-13.json)。

## 仓库和执行环境

本地包含完整、非 shallow 的 Git 仓库。起始工作区干净，217 个跟踪文件均已下载；`git fsck --full --no-reflogs` 成功，没有缺失或损坏对象。检查时有 dangling commit 提示，这不等于仓库损坏。通过 GitHub API 和 `git fetch origin main` 两次确认基准与远端主分支一致，原有分支及另一个工作树均保留。

iCloud 占位文件位于忽略的旧日志、另一工作树和部分依赖目录。通过系统 `brctl download` 补齐所需运行依赖，没有覆写原始占位文件。另发现 Hono 的部分文件实际缺失，已从锁文件指定的 npm 归档恢复 `hono@4.12.31`，并验证锁文件完整性摘要。原 `.cache/cache-test-deps/node_modules` 保留；当前 `node_modules` 使用单独的依赖覆盖目录。

iCloud 随后把原依赖符号链接恢复为 `node_modules 2`，其目标仍为原目录。本轮保留该链接，仅在本机 `.git/info/exclude` 排除，未删除或提交这份恢复项。

当前 shell 起初没有 Node/npm。本轮使用项目忽略目录中的 Node `22.23.5`，对应官方 `.tar.xz` 的 SHA-256 核对成功后才执行。11 个直接运行、构建包的版本与锁文件一致，但整个依赖树沿用恢复后的本地安装，**不宣称完成了全新的 `npm ci` 或 CI 验证**。依赖覆盖目录为 `.cache/audit-20261113/node_modules`，当前 `node_modules` 仍指向它；清理缓存前需保留正在使用的依赖。

## 请求和响应主链路

| 环节 | 实际行为及审计结论 |
| --- | --- |
| 传输协商 | Loon 用原生 Rewrite、Surge 用轻量 JSC 入口为已识别的 iOS/macOS 主 Weather App v3 GET 请求协商 JSON。后台、组件、手表及未知 WK3 二进位继续透传；没有将 WK3 字节交给 WK2 schema。 |
| 路由与设置 | `parseWeatherKitURL` 解析语言、坐标、country、dataSets；`setENV` 隔离默认设置副本；`planWeatherProducts` 仅选择已启用且需要处理的产品。未修改原始 endpoint 和参数默认值。 |
| WK2 | 选择性解码需要修改的根表；每个产品独立处理及回退；只有改变的产品进入 patch。未识别根表仍保留原始字节。 |
| WK3 JSON | 区分 Apple 的 JSON 结构与原生 Weather JSON 读取器；按已知产品规范 condition、降水统计和预警 UUID，保留未知产品。替换结果独立适配及校验，失败保留对应 Apple 产品。 |
| 供应商 | 保留彩云 v2.6、和风天气/空气质量/预警接口、QWeather 预警网页和 WAQI 的原有分工。网页只保存验证后的预警记录；鉴权响应不进入已完成正文缓存。 |
| 预警详情 | 原生 Loon/Surge 发行规则只匹配已支持的页面标识与坐标。通用 Request/Pages 也需要对未知 Apple ID 透传，不能制造空成功响应；本轮已统一共享处理函数。 |
| 异步完成 | 同一次响应共享请求协调器。保留等待原生 HTTP callback 后才完成的流程，没有取消 API、计时器竞赛、后台请求或额外轮询。 |

地区路由仍按显式 `country`、同坐标已确认记录、保守的离线几何判断、语言区域回退处理，不以设备或代理出口判断目标城市。默认天气替换区域仍为 CN；分钟预报沿用每个供应商自己的可用区域表。本轮没有把功能扩展到未经验证的地区。

空气质量仍优先保留有效 Apple 浓度，只补缺项；指数算法与替换目标分别控制，默认目标为 HJ6332012。保留 11 种算法和 None、CO 单位修正、六项浓度、原有昨日对比及独立来源。`ProviderFallback.Enabled` 默认 false，另一个 Token 本身不代表允许切换来源。既有相关测试全部继续通过。

## 已确认缺陷与修复

以下各项依据源码和可重复夹具确认；不把它们描述成已在本轮手机抓包中观察到的错误。

| 优先级 | 触发条件和原行为 | 本轮处理 |
| --- | --- | --- |
| P1 | WK2 正文改写后仍携带原 Apple ETag、长度和压缩标头；`bodyBytes` 还可能指向旧正文。 | WK2/WK3 共用 `rewriteWeatherResponse`，只在实际产生修改时删除原实体验证、长度、编码及摘要标头，设置 `Cache-Control: no-store`，移除旧 `bodyBytes`。未改动及整体编码失败保留原响应。 |
| P1 | 网格只读取 `headers.ETag`，最近更新时间可掩盖空/损坏网格，时钟回退会延长命中。 | 忽略 Header 大小写；缓存命中先验证网格和时间；非法数据不写入缓存。写入失败不丢弃已验证的在线结果。 |
| P1 | 304 的空正文仍经过 JSON 验证；网格在没有合法缓存实体时也允许条件响应。 | 304 不做正文解析。只有持有验证通过的网格和 ETag 才发条件请求并允许 304；孤立 304 拒绝、不给损坏缓存续期。不把供应商 304 自动当作成功 JSON。 |
| P1 | 彩云空分钟数组、null/负数/非数值降水，或和风无效日期和数值，能形成看似可用的分钟产品。 | 在缓存/转换之前验证输入；失败沿原路径回退。彩云无有效实时气温时也不替换健康 Apple 当前天气，不影响共用 realtime 接口的其他产品。 |
| P1 | 没有原 Apple 当前天气时，供应商不提供六个可选降水向量，WK2 编码器直接调用 `.map` 而失败。 | 缺省可选向量按空向量编码，不编造降水数值；新增 provider-only WK2 回归。根处理器整体编译失败返回原 arena 视图时，保持原正文及 Header。 |
| P2 | Summary 单笔不输出；最后一分钟不参与转段、概率/强度峰值计算，甚至覆盖前一段的 clear 状态。 | 每个样本使用同一分段逻辑，最后统一封口。保留 71 个摘要样本、85 个输出分钟和末段 `endTime=0` 的既有约定。 |
| P2 | 和风小时 `precipitationIntensity` 使用 `parseInt`，如 `0.4` 被截成 0。 | 使用浮点解析，保留小时降水的小数值。 |
| P2 | 只有 forecastPeriodic 或 weatherChanges 的 JSON 回应无法通过入口识别，跳过已实现的原生字段适配。 | 区分可替换产品与可适配产品；两种独立回包也适配，不增加供应商查询、不修改未知产品。 |
| P2 | 通用 Request/Pages 对原生 Apple UUID 返回 `200 []`；坐标预警选择 WeatherKit 时也制造空结果。 | 未支持 ID、无效坐标、未取得可用来源及 WeatherKit 来源选择均透传，保留原条件头；有验证证据的“确实无预警”仍可返回空数组。正式 Loon/Surge 规则原本已排除原生 UUID，未将这个通用路径缺陷扩大为全部客户端线上故障。 |

`GetWeatherAlerts` 从两个 Request 文件抽出为共享实现，release/development 和 Loon/Surge 原生入口调用同一函数，保留原 `Request.mjs` 的导出。响应缓存标头也使用共享函数，减少修复在两套代码间漂移。其余调试枚举和产品注入流程仍沿用原结构，没有进行整套重写。

## 快取、timeout、重试和资源边界

- 默认 TTL 仍为实况/AQI 60 秒、预报 180 秒、分钟和预警各 15 秒。全局 TTL 0 仍禁用完成响应缓存、保留在途合并；命中不续期，过期正文不作为供应商兜底。
- 响应缓存最多 8 条、单条 96 Ki 字符、快照 256 Ki 字符；持久失败记录最多 32 条/8192 字符。身份包含来源、城市、语言、鉴权与路由，持久身份保存摘要。继续遵守 `no-store`、`no-cache`、max-age/Age、Vary:*。
- 仍最多 3 个活跃、16 个在途/排队请求；默认网络发起预算 8000 ms。派发前重新核对预算，少于 250 ms 不发起。已发出请求等待原生回调，没有提前 `$done`。
- 内部和 Loon HTTP timeout 单位为毫秒；仅 Surge 原生边界除以 1000，保持小数秒。250、499、500、501、999、1499、5000 ms 及真实 provider 适配链只剩 499 ms 的既有回归继续通过。
- 没有新增同源循环重试。网络切换/timeout 走错误回退和原有冷却；认证/限流立即冷却、连续失败按现有阈值冷却。显式开启的备用来源最多尝试一次，仍共享预算。
- 网格保留原独立的 30 天策略。新验证限制为 8192 个网格格子、32768 个位置；网络正文仍最多 2 Mi 字符。此次读取公开网格确认了 `gridSize/grid` 结构及 684 个格子，但未用公共资料代替账户 API 验收。
- 天气正文保留 4 MiB 边界，JSON 仍为 1 Mi 字符及 UTF-8 大小检查；每个解码产品仍有限制向量、深度和节点数。上述均为脚本处理预算，不能限制宿主已接收的原生缓冲峰值。

## 性能证据

分钟产品原本先转换完整数组再截为 85 分钟。本轮彩云仅转换前 85 项；和风仅扩展前 17 个五分钟项，避免构造随后丢弃的分钟对象。Summary 在关闭 DEBUG 时不生成调试 JSON。没有扩大缓存、降低默认新鲜度或改变请求数来制造性能改善。

`scripts/measure-minutely-processing.mjs` 使用两个版本的真实 provider 源码、固定时间、相同有效正文、TTL 0 和同步模拟 HTTP。每个供应商/版本 5 个独立进程，每个进程预热 30 次后量测 500 次；两版本完整输出 SHA-256 一致，每个量测样本均为 500 个模拟请求。

| 500 次处理的中位数 | 原 v3.3.5 | 本轮 |
| --- | ---: | ---: |
| 彩云 CPU | 33.065 ms | 31.895 ms |
| 彩云墙钟耗时 | 19.813 ms | 19.848 ms |
| 彩云 GC 后保留堆增量 | 39,008 B | 35,528 B |
| 和风 CPU | 40.025 ms | 40.963 ms |
| 和风墙钟耗时 | 26.242 ms | 26.127 ms |
| 和风 GC 后保留堆增量 | 53,152 B | 38,208 B |

CPU/墙钟变化很小且方向不同，不能据此宣称普遍加速；更严格的输入验证也有成本。两个场景的进程峰值 RSS 接近持平，GC 后保留堆不等于分配总量或设备峰值。没有新增本轮 iPhone/macOS Loon 原生、Surge 原生、设备耗电或 VPN 长时间稳定性证据。

## 验证、产物与继续维护

| 检查 | 结果 |
| --- | --- |
| 恢复环境后的原版测试 | 345/345 |
| 新的 52 项回归在原版快照上 | 14 通过、38 失败，确认缺陷可重现 |
| 本轮完整测试 | 397/397，0 跳过 |
| 真正压缩 Loon 脚本 VM | 46/46 |
| Loon 生成表达式、路由正则、系统 jq | 15/15；不是原生配置解析器 |
| 真正压缩 Surge 脚本 VM | 35/35；包含有效 WK2 输出温度解码检查 |
| 生成文件 | 19 个本地草稿文件，17 条内部 checksum 和 12 条脚本引用均匹配实际文件 |
| 设置兼容 | 12 项原版参数默认值继续校验；Loon/Surge 21 项参数绑定保持 |
| 语法和局部 lint | 构建成功；针对 8 个相关文件的 lint 无错误，1 个既有未使用参数警告，非全仓格式验收 |

完整构建在 `.cache/audit-20261113/build` 的源码快照中执行。草稿引用 `local-audit-20261113`，**这个资源引用未发布，不可作为线上可导入订阅**。`Loon/script`、`Surge/script`、`modules`、package 版本和锁文件均保持原版内容。草稿 provenance 额外标明 `sourceDirty=true` 和源码清单摘要；基准 HEAD 不能单独代表这些修改。

常用验证命令（需要可用的 Node 22 和已恢复/安装的依赖）：

```sh
# 本机恢复的工具链；在 WeatherKit 根目录执行，不修改全局 shell 配置。
export PATH="$PWD/.cache/toolchains/node-v22.23.5-darwin-arm64/bin:$PATH"
npm test
node scripts/measure-minutely-processing.mjs --baseline .cache/audit-20261113/baseline --output .cache/audit-20261113/minutely-measurements.json
```

本轮的客户端构建命令在上述隔离快照内运行：

```sh
WEATHERKIT_RESOURCE_REF=local-audit-20261113 npm run build:clients
```

后续应优先用本轮候选收集原生导入、分钟降水、periodic 独立回包、预警详情、弱网切换与 304 行为的设备证据。账户权限、各地区覆盖、后台/组件/手表以及其他客户端的正式重新构建均未由本轮模拟测试验证。同步存储没有事务保证，跨执行并发覆盖仍可能造成额外查询；不以扩容或后台轮询掩盖这项限制。

## 官方文档核对记录

2026-11-13 重新读取 [Loon Script API](https://nsloon.app/docs/Script/script_api/)、[Script](https://nsloon.app/docs/Script/script_v2/) 与[插件](https://nsloon.app/docs/Plugin/)，并对照父目录 OfficialReference 的实践摘要。Loon 保持公开 `$httpClient`、毫秒 timeout、字符串存储、Uint8Array 和异步回调完成后单次 `$done`，未引入其他客户端的字段或提高最低版本 `3.5.1(983)`。

同日核对 [Surge JavaScript API](https://manual.nssurge.com/scripting/api.html) 的秒制 timeout、回调和完成约定，保持 Surge 自己的参数、引擎和 body 接口；同时核对 [和风分钟降水文档](https://dev.qweather.com/docs/api/minutely/minutely-precipitation/) 的日期、五分钟累计量与请求结构。没有更换 endpoint，也没有根据一个地区的数据推断其他地区的支持情况。
