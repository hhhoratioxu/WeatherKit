# 请求合并与短时缓存

本 Fork 基于 NSRingo/WeatherKit v3.3.2，保留上游许可证、作者信息及 Git 历史。2026-10-19 增加请求合并和短时缓存，目标客户端为 Loon。天气数据的来源选择、预报数值和转换算法保持上游行为。

## 使用与设置

Loon 入口为 `Loon/script/WeatherKit.plugin`，由 `npm run build:loon-cache` 生成。该入口必须和本 Fork 的 `request.bundle.js`、`response.bundle.js` 一起使用；上游发布脚本不含这些改动。生成器会检查五条 Script 全部指向本 Fork 的固定版本资源，保留原有匹配范围和 MITM 域名。

新增参数 `RequestCache.TTL` 为 Loon String input，脚本显式转换为数值。默认 60 秒，允许 0 至 300 秒；分钟降水始终最多 30 秒。0 禁用已经完成的响应复用，仍合并本次执行中尚未完成的相同请求。无效输入使用 60 秒，超大值限制到 300 秒。

缓存覆盖彩云 JSON 天气接口、和风 JSON 天气接口，以及 WAQI 的 Nearest/AQI2 数据接口。WAQI Token 接口、和风预警 HTML 页面、已有的和风地区网格缓存及 Apple 原始响应不进入新增持久化缓存。除 Loon 外，共享源码只在当前处理实例内复用，不新增跨用户的 Node/Worker 全局缓存。

## 合并、隔离与失效

- 每次 WeatherKit Response 创建一个共享缓存，最多允许三个第三方请求同时进行，最多保留十六个正在执行或等待的不同请求。相同请求直接等待同一个 Promise。
- 身份包含完整 URL、请求参数、全部请求头，以及供应商、国家、语言、版本和产品。城市坐标、Host、Token、语言或请求策略变化会得到不同身份，不合并到别的地点或凭据。
- 持久化索引使用 `@noble/hashes` 的 SHA-256；URL、请求头、Token 和 Cookie 不写入缓存记录。只保存成功 JSON 正文、状态码、索引摘要和绝对时间戳。
- 只有 HTTP 成功且通过对应供应商检查的 JSON 响应可以保存。网络失败、HTTP 错误、供应商错误、无效 JSON 不会覆盖一个可用响应，也不会被当成成功结果缓存。
- 命中不会延长有效期；过期或系统时钟回退后重新请求。减少 TTL 时，现有缓存也按较短的有效期判断。保留供应商原始上报时间，不把命中缓存描述为一次新的供应商观测。
- 尊重 `Cache-Control: no-store/no-cache`、`Vary: *`，并用 `max-age` 和 `Age` 缩短有效期。成功正文超出缓存上限时可正常处理但不保存。
- 每个调用取得独立响应对象及 Headers 副本，JSON 正文为不可变字符串，各供应商转换过程分别解析，不共享可变天气对象。

## 容量与异步边界

以下是应用主动设置的上限，单位为 JavaScript UTF-16 字符数：单条缓存正文 98,304，持久化快照 262,144，参与缓存身份计算的内容 8,192，单次可处理 JSON 响应 1,048,576。最多保存八条结果；内存条目同样有数量和单条大小上限。超出 JSON 处理上限或遇到二进制正文会交由已有错误处理路径处理。

新增逻辑只使用 Loon 的 `$persistentStore.read(key)` 和 `$persistentStore.write(value, key)`，独立 Key 为 `WeatherKit.ProviderResponses.v1`。不调用清空所有脚本数据的 `remove()`；读写失败或缓存损坏时继续走网络。写入前重新读取并合并最新快照。不同 Loon 执行环境之间没有共享 Promise 或存储事务，极少数同时写入可能丢失一个缓存条目并增加后续请求，不会把两个城市的内容合并。

Loon JSON 网络请求沿用官方毫秒单位，明确使用 5,000 ms 原生超时，并等待原生网络回调完成。新增逻辑不创建超时竞赛，不依赖 `clearTimeout`，不声称能取消宿主请求。实际回调前，宿主网络层可能已经持有完整正文；JavaScript 长度限制和请求数上限不等于宿主进程峰值内存上限，也不等于 VPN 稳定性保证。

## 验证与构建

`npm run test:cache` 检查缓存失效、隔离、失败恢复、并发/容量边界，以及真实 WAQI 适配器和独立浏览器 bundle。在没有 Node、WebCrypto、TextEncoder 的模拟 Loon 环境中检查网络回调、重复回调和跨执行存储复用。这里的请求响应为测试夹具，调用次数对比不能代表真实天气服务的延迟或 iPhone 实测。

`npm test` 运行完整回归测试。`npm run build:loon-cache` 先构建请求和响应源码，再生成本 Fork 的 Loon 文件、完整许可证、构建来源和 SHA-256 校验文件。完整构建需要读取上游 GitHub Packages 中的 `@nsringo/weatherkit@1.1.2`；不得用其他版本或伪造 schema 代替。独立的 `cache-validation.yml` 使用 Actions 临时令牌，权限仅为 `contents: read` 与 `packages: read`，并通过 `NODE_AUTH_TOKEN` 环境变量传给 npm；没有创建个人 Token。Fork 中继承的 Build、Draft、Dev、Deploy、Release、Pre-Release 工作流保持禁用，避免运行上游依赖作者私有 Secrets 或修改系统安全设置的流程。

源代码和模拟测试、CI 构建、发布文件字节校验、真实设备导入及 VPN 连续运行是不同验证层次。发布说明应分别记录结果。

### 2026-10-19 本次验证记录

- [GitHub Actions 运行 39193708665](https://github.com/hhhoratioxu/WeatherKit/actions/runs/39193708665) 使用锁文件安装真实依赖后，通过完整 144 项回归测试，0 失败、0 跳过，包括新增彩云/和风适配器、缓存与 FlatBuffer 回归。构建源码为 `8f2f8923ce1c1a7e64276d607fe53716a77efe9d`，Node.js 为 `v22.23.3`，上游 schema 包为 `1.1.2`。
- 真实 WAQI 类在模拟 Loon 原生网络回调下进行对照：上游六个并发消费者发出六次请求，优化版发出一次；同一实例的下一批六个消费者，上游仍发出六次请求，优化版在有效期内不发请求。对照直接构建上游 `c40e8f8a13c8304a7ef500cb74acc5948af14b3f` 的 WAQI 类，网络响应均为测试夹具。
- 可用 `node scripts/measure-cache-requests.mjs` 复现，结果及源码 SHA-256 保存在 [cache-request-measurements.json](cache-request-measurements.json)。这是请求次数验证，不是实际天气接口延迟、耗电或 VPN 稳定性测量。
- 缓存核心使用现有 Rollup resolver 也不包含 Node 原生模块；模拟 Loon 浏览器 bundle 在没有 Node、WebCrypto、TextEncoder 的上下文中通过。Loon 参数文件生成成功，新增 TTL 为 String input，并保留五条原有 Script 的匹配范围。
- 完整 Rollup 构建和 Loon 插件生成均通过。下载六个构建产物后，重新核对 SHA-256、锁文件摘要与来源提交；插件五条 Script 全部引用本 Fork 固定版本 `cache-v1`。两份实际发布 bundle 在模拟 Loon VM 中另通过请求空气质量标准规范化、响应可用能力合并、未处理正文透传三个场景，均只完成一次；测试没有 Node、WebCrypto 或 TextEncoder，也没有访问真实天气接口。详细文件大小、摘要与结果见 [loon-build-validation.json](loon-build-validation.json)。

## Loon 官方资料核对

核对日期：2026-10-19。新增运行时能力依据 [Script API](https://nsloon.app/docs/Script/script_api/) 的本地存储、HTTP Client、完成回调规定；参数类型依据 [插件文档](https://nsloon.app/docs/Plugin/)。保留上游旧 Script 输入语法，依据 [Script 文档](https://nsloon.app/docs/Script/script_v2/) 的输入兼容规定，不增加新的运行时最低版本要求。
