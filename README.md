#  iRingo: 🌤 WeatherKit

本 Fork 为 Loon 增加数据源失败回退、受限网络预算、网页预警缓存、地区识别修复，以及按数据类型区分的短时缓存。本版继续减少脚本启动、重复存储读取、无效查询和无需替换的数据解码。保留上游作者、许可证与 Git 历史。

实现、默认值、限制及验证边界见 [稳定性与缓存优化 v5](docs/resilience.md)。Loon 导入文件由 `npm run build:loon-cache` 生成至 `Loon/script/WeatherKit.plugin`，运行脚本固定引用本 Fork 的 `cache-v5`。

## 本次更新

`3.3.2-cache.5` 继续减少运行内存分配：小时／每日预报不再提前深复制整份数据，只创建实际修改的行；校验后的供应商 JSON 直接交给当前消费者，避免保存与转换时重复解析，同时保持请求之间的对象隔离。

小时／每日解码复用同一行的 schema 视图，关闭调试时不构造数据对象的 JSON 日志。新增 4 MiB 天气正文处理边界、每产品累计 8192 项向量解码预算，数量异常时停止该产品解码。正常预报内容、默认新鲜度、缓存容量、网络预算及并发保持不变；来源失败仍保留 Apple 数据。

[内存测量方法与全部样本](docs/memory-work.md) 区分等待回调时保留的堆、采样分配和完成后保留的堆；结果来自独立 Node/V8 进程，不能换算成真实 iPhone 的 Loon 内存或峰值。上一版取消轻量接口脚本启动、减少缓存读写的效果继续保留，历史对比见 [v4 处理开销记录](docs/power-work.md)。

## 安装与更新

[一键导入 Loon](https://www.nsloon.com/openloon/import?plugin=https%3A%2F%2Fraw.githubusercontent.com%2Fhhhoratioxu%2FWeatherKit%2Fmain%2FLoon%2Fscript%2FWeatherKit.plugin) · [插件订阅直链](https://raw.githubusercontent.com/hhhoratioxu/WeatherKit/main/Loon/script/WeatherKit.plugin) · [固定版本 cache-v5](https://raw.githubusercontent.com/hhhoratioxu/WeatherKit/cache-v5/Loon/script/WeatherKit.plugin) · [旧版 cache-v4](https://github.com/hhhoratioxu/WeatherKit/releases/tag/cache-v4) · [旧版 cache-v3](https://github.com/hhhoratioxu/WeatherKit/releases/tag/cache-v3) · [旧版 cache-v2](https://github.com/hhhoratioxu/WeatherKit/releases/tag/cache-v2) · [旧版 cache-v1](https://github.com/hhhoratioxu/WeatherKit/releases/tag/cache-v1)

使用 Loon `3.5.1(983)` 或以上，在「配置 → 插件」中添加插件直链并启用；已订阅该地址的用户更新插件后重载配置即可。若已安装其他 WeatherKit 脚本版，请先停用旧版，避免同一接口重复处理。沿用已有的 Loon MitM 证书；首次使用需按 [Loon 官方 MitM 文档](https://nsloon.app/docs/MitM/) 配置证书。系统版本沿用上游的 iOS/iPadOS 18、macOS 15 及以上要求。

默认实况与空气质量缓存 60 秒、小时及每日预报 180 秒、分钟降水与预警 15 秒。网络发起预算 8000 毫秒、最多三个活跃请求；失败冷却 30 秒，诊断关闭，缺失 country 时采用 Auto 保守判断。`RequestCache.TTL=0` 禁用所有已完成响应缓存，仍合并本次执行的相同在途请求。

供应商失败时保留 Apple 原始数据；当原数据也缺失或不可用时，只有你已配置另一来源的专用凭据，才尝试一次备用查询。普通安装无需新增个人 Token；可选诊断仅输出一条不含令牌、URL 或原始坐标的汇总，独立于上游高级调试日志。

## 构建与验证

版本 `3.3.2-cache.5` 在本地 macOS arm64、Node v24.19.0 与锁定依赖环境完成 212 项回归测试、16 个实际压缩脚本场景和 11 个原生表达式／路由／jq 检查，全部通过。发布文件来自本地构建。[GitHub CI](https://github.com/hhhoratioxu/WeatherKit/actions/runs/39280821737) 在发布前核对时仍为 `queued`，未使用 CI 产物，不将排队算作通过。最终结果、来源提交与 SHA-256 见 [构建验证记录](docs/loon-build-validation.json) 和发布文件 `build-provenance.json`；构建时自动校验三个完整脚本的模拟 Loon 行为，并检查实际生成的导入规则。原生规则检查未调用真实 Loon 配置解析器。真实 iPhone 导入、天气显示、耗电、延迟和 VPN 连续运行仍待设备验证。

构建使用 Actions 自带的临时 `GITHUB_TOKEN`，仅声明 `contents: read` 与 `packages: read`；无需为安装插件创建或提交个人 Token。下载依赖时读取上游的原始 `@nsringo/weatherkit@1.1.2`。历史第一版设计与模拟请求数对比见 [请求缓存说明](docs/request-cache.md)。
