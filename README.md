#  iRingo: 🌤 WeatherKit

本 Fork 为 Loon 增加数据源失败回退、受限网络预算、网页预警缓存、地区识别修复，以及按数据类型区分的短时缓存。本版继续减少脚本启动、重复存储读取、无效查询和无需替换的数据解码。保留上游作者、许可证与 Git 历史。

实现、默认值、限制及验证边界见 [稳定性与缓存优化 v6](docs/resilience.md)。Loon 导入文件由 `npm run build:loon-cache` 生成至 `Loon/script/WeatherKit.lpx`，运行脚本固定引用本 Fork 的 `cache-v6`。

## 本次更新

`3.3.2-cache.6` 继续减少缓存内存分配：写入前先计算能保留的记录，只生成一次最终缓存 JSON，避免超限后反复序列化大段正文；重新读取存储时复用相同正文的不可变字符串。缓存内容、时效、城市优先级及命中行为保持一致。

[v6 测量方法与全部样本](docs/cache-memory-v6.md)：接近缓存上限的桌面样本中，累计 JSON 输出字符减少约 91%，GC 后保留堆增量减少约 32%。较小缓存增加少量长度检查开销；这些是 Node/V8 测量，不是 iPhone 的整体内存或省电比例。

此前小时／每日预报按需复制修改行、供应商 JSON 每个消费者只解析一次的改动继续保留，同时保持请求之间的对象隔离。

小时／每日解码复用同一行的 schema 视图，关闭调试时不构造数据对象的 JSON 日志。新增 4 MiB 天气正文处理边界、每产品累计 8192 项向量解码预算，数量异常时停止该产品解码。正常预报内容、默认新鲜度、缓存容量、网络预算及并发保持不变；来源失败仍保留 Apple 数据。

[内存测量方法与全部样本](docs/memory-work.md) 区分等待回调时保留的堆、采样分配和完成后保留的堆；结果来自独立 Node/V8 进程，不能换算成真实 iPhone 的 Loon 内存或峰值。上一版取消轻量接口脚本启动、减少缓存读写的效果继续保留，历史对比见 [v4 处理开销记录](docs/power-work.md)。

## 安装与更新

[一键导入 Loon](https://www.nsloon.com/openloon/import?plugin=https%3A%2F%2Fraw.githubusercontent.com%2Fhhhoratioxu%2FWeatherKit%2Fmain%2FLoon%2Fscript%2FWeatherKit.lpx) · [插件订阅直链（.lpx）](https://raw.githubusercontent.com/hhhoratioxu/WeatherKit/main/Loon/script/WeatherKit.lpx) · [固定版本 cache-v6](https://raw.githubusercontent.com/hhhoratioxu/WeatherKit/cache-v6/Loon/script/WeatherKit.lpx) · [旧版 cache-v5](https://github.com/hhhoratioxu/WeatherKit/releases/tag/cache-v5) · [旧版 cache-v4](https://github.com/hhhoratioxu/WeatherKit/releases/tag/cache-v4) · [旧版 cache-v3](https://github.com/hhhoratioxu/WeatherKit/releases/tag/cache-v3) · [旧版 cache-v2](https://github.com/hhhoratioxu/WeatherKit/releases/tag/cache-v2) · [旧版 cache-v1](https://github.com/hhhoratioxu/WeatherKit/releases/tag/cache-v1)

2026-10-20 将正式入口后缀规范为 `.lpx`；旧 `WeatherKit.plugin` 地址继续作为内容完全相同的兼容入口保留。构建会同时生成两个文件并校验内容一致。已安装旧入口可继续更新；切换到新入口时先停用旧入口，避免同时启用两份 WeatherKit。

使用 Loon `3.5.1(983)` 或以上，在「配置 → 插件」中添加插件直链并启用；已订阅该地址的用户更新插件后重载配置即可。若已安装其他 WeatherKit 脚本版，请先停用旧版，避免同一接口重复处理。沿用已有的 Loon MitM 证书；首次使用需按 [Loon 官方 MitM 文档](https://nsloon.app/docs/MitM/) 配置证书。系统版本沿用上游的 iOS/iPadOS 18、macOS 15 及以上要求。

默认实况与空气质量缓存 60 秒、小时及每日预报 180 秒、分钟降水与预警 15 秒。网络发起预算 8000 毫秒、最多三个活跃请求；失败冷却 30 秒，诊断关闭，缺失 country 时采用 Auto 保守判断。`RequestCache.TTL=0` 禁用所有已完成响应缓存，仍合并本次执行的相同在途请求。

供应商失败时保留 Apple 原始数据；当原数据也缺失或不可用时，只有你已配置另一来源的专用凭据，才尝试一次备用查询。普通安装无需新增个人 Token；可选诊断仅输出一条不含令牌、URL 或原始坐标的汇总，独立于上游高级调试日志。

## 构建与验证

版本 `3.3.2-cache.6` 的发布文件直接来自 [GitHub Actions](https://github.com/hhhoratioxu/WeatherKit/actions/runs/41317771863) 的锁定依赖构建：`npm ci --ignore-scripts --no-audit --no-fund`、Node v22.23.4，217 项回归测试、16 个实际压缩脚本场景、11 个原生表达式／路由／jq 检查全部通过。下载后核对了 CI ZIP 摘要、八个发布文件、七条校验清单和固定版本脚本引用，并再次运行编译产物检查。来源提交、环境与 SHA-256 见 [构建验证记录](docs/loon-build-validation.json) 和 `Loon/script/build-provenance.json`。

内存对比来自独立的本地 Node/V8 源码测量，详见 [v6 内存记录](docs/cache-memory-v6.md)，不把桌面数值换算为 iPhone 内存或耗电。原生规则检查未调用真实 Loon 配置解析器；真实 iPhone 导入、天气显示、内存及 VPN 连续运行仍待设备验证。

仓库的 CI 流程配置为使用 Actions 自带的临时 `GITHUB_TOKEN`，仅声明 `contents: read` 与 `packages: read`；无需为安装插件创建或提交个人 Token。下载依赖时读取上游的原始 `@nsringo/weatherkit@1.1.2`。历史第一版设计与模拟请求数对比见 [请求缓存说明](docs/request-cache.md)。
