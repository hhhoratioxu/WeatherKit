#  iRingo: 🌤 WeatherKit

本 Fork 为 Loon 增加数据源失败回退、受限网络预算、网页预警缓存、地区识别修复，以及按数据类型区分的短时缓存。本版继续减少脚本启动、重复存储读取、无效查询和无需替换的数据解码。保留上游作者、许可证与 Git 历史。

实现、默认值、限制及验证边界见 [稳定性与缓存优化 v4](docs/resilience.md)。Loon 导入文件由 `npm run build:loon-cache` 生成至 `Loon/script/WeatherKit.plugin`，运行脚本固定引用本 Fork 的 `cache-v4`。

## 本次更新

`3.3.2-cache.4` 将功能列表和普通 AQI 标尺改为 Loon 原生 Rewrite，这两类请求不再启动 JavaScript。HK/CN 自定义 AQHI 标尺拆成约 30 KB 的独立脚本；预警入口也不再加载标尺代码。原生规则按 2026-10-19 官方文档核对。

处理六项缓存产品时，快照只读取一次；同一小时的昨日空气质量查询对齐整点，让已有缓存真正命中。明确不替换的数据不解码、不复制，供应商与离线地图按需要构造；同坐标、同国家确认记录每小时最多写一次。默认新鲜度、功能与容量不变。工作量、脚本大小、Node 延迟与原始测量见 [处理开销对比](docs/power-work.md)。这些结果不等于 iPhone 耗电比例。

同时修复预警详情首个 `ids` 参数匹配、和风昨日对比可选函数异常与无效类别比较；失败保留 Apple 数据。关闭 LogLevel 时不再输出常规启动／结束／供应商版本日志，可选安全诊断仍保留。

## 安装与更新

[一键导入 Loon](https://www.nsloon.com/openloon/import?plugin=https%3A%2F%2Fraw.githubusercontent.com%2Fhhhoratioxu%2FWeatherKit%2Fmain%2FLoon%2Fscript%2FWeatherKit.plugin) · [插件订阅直链](https://raw.githubusercontent.com/hhhoratioxu/WeatherKit/main/Loon/script/WeatherKit.plugin) · [固定版本 cache-v4](https://raw.githubusercontent.com/hhhoratioxu/WeatherKit/cache-v4/Loon/script/WeatherKit.plugin) · [旧版 cache-v3](https://github.com/hhhoratioxu/WeatherKit/releases/tag/cache-v3) · [旧版 cache-v2](https://github.com/hhhoratioxu/WeatherKit/releases/tag/cache-v2) · [旧版 cache-v1](https://github.com/hhhoratioxu/WeatherKit/releases/tag/cache-v1)

使用 Loon `3.5.1(983)` 或以上，在「配置 → 插件」中添加插件直链并启用；已订阅该地址的用户更新插件后重载配置即可。若已安装其他 WeatherKit 脚本版，请先停用旧版，避免同一接口重复处理。沿用已有的 Loon MitM 证书；首次使用需按 [Loon 官方 MitM 文档](https://nsloon.app/docs/MitM/) 配置证书。系统版本沿用上游的 iOS/iPadOS 18、macOS 15 及以上要求。

默认实况与空气质量缓存 60 秒、小时及每日预报 180 秒、分钟降水与预警 15 秒。网络发起预算 8000 毫秒、最多三个活跃请求；失败冷却 30 秒，诊断关闭，缺失 country 时采用 Auto 保守判断。`RequestCache.TTL=0` 禁用所有已完成响应缓存，仍合并本次执行的相同在途请求。

供应商失败时保留 Apple 原始数据；当原数据也缺失或不可用时，只有你已配置另一来源的专用凭据，才尝试一次备用查询。普通安装无需新增个人 Token；可选诊断仅输出一条不含令牌、URL 或原始坐标的汇总，独立于上游高级调试日志。

## 构建与验证

版本 `3.3.2-cache.4` 的 [GitHub Actions](https://github.com/hhhoratioxu/WeatherKit/actions/runs/39210121980) 使用锁定依赖完成 201 项回归测试、14 个编译产物场景与 11 个原生表达式／路由／jq 检查，全部通过。最终结果、来源提交与 SHA-256 见 [构建验证记录](docs/loon-build-validation.json) 和发布文件 `build-provenance.json`；构建时自动校验三个完整脚本的模拟 Loon 行为，并检查实际生成的导入规则。原生规则检查未调用真实 Loon 配置解析器。真实 iPhone 导入、天气显示、耗电、延迟和 VPN 连续运行仍待设备验证。

构建使用 Actions 自带的临时 `GITHUB_TOKEN`，仅声明 `contents: read` 与 `packages: read`；无需为安装插件创建或提交个人 Token。下载依赖时读取上游的原始 `@nsringo/weatherkit@1.1.2`。历史第一版设计与模拟请求数对比见 [请求缓存说明](docs/request-cache.md)。
