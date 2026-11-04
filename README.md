#  iRingo: 🌤 WeatherKit

本 Fork 为 Loon 增加数据源失败回退、受限网络预算、网页预警缓存、地区识别修复，以及按数据类型区分的短时缓存。本版修复 iOS 27.3 Beta 转用 WeatherKit v3 后插件未生效的问题，保留此前的缓存及内存优化。保留上游作者、许可证与 Git 历史。

实现、默认值、限制及验证边界见 [稳定性与缓存优化](docs/resilience.md) 和 [iOS 27.3 v3 兼容说明](docs/ios273-v3.md)。Loon 导入文件由 `npm run build:loon-cache` 生成至 `Loon/script/WeatherKit.lpx`，运行脚本固定引用本 Fork 的 `cache-v8`。

## 本次更新

`3.3.2-cache.8` 为 `/api/v3/weather/` 使用 Loon 原生请求头协商 Apple JSON，在文本响应中适配 WK3 的天气状态数组、降水统计对象及数值元数据；复用已有数据源、缓存和失败回退。原 v2 二进制路径继续保留，未知 WK3 二进制原样放行。没有新增后台任务、轮询或请求重发。

手机正式 v8 已确认 iOS 请求命中 v3 脚本并完成实际响应改写，修改后返回 200/application/json，天气页面实况、小时及每日预报能够显示。正式订阅已恢复，临时统计关闭；空气质量各字段、活跃预警、所有地区、设备内存和耗电未全面实测。本次不承诺 iPhone 内存或省电比例。

v7 的按改动编码、延迟预警复制和日志优化继续保留；以下为此前版本的桌面测量。

[v7 测量方法与 84 个原始样本](docs/processing-memory-v7.md)：实际 CI 压缩脚本的桌面模拟中，混合天气场景完成后保留堆约降 15%、CPU 时间约降 29%；预警来源失败场景等待时保留堆约降 14%。只更新实况的对照场景基本持平。保留原始表也会使部分输出二进制略大；这些结果不代表 iPhone 内存或省电比例。

此前缓存只做一次最终序列化、相同正文字符串复用、小时／每日预报按需复制、供应商 JSON 每消费者一次解析的改动继续保留。历史证据见 [v6 缓存内存](docs/cache-memory-v6.md)、[v5 内存分配](docs/memory-work.md) 和 [v4 处理开销](docs/power-work.md)。

沿用 4 MiB 天气正文处理边界、每产品累计 8192 项向量解码预算。正常预报内容、默认新鲜度、缓存容量、网络预算及并发不变，来源失败仍保留 Apple 数据。这些是脚本处理边界，不能限制宿主已经接收的网络缓冲。

## 安装与更新

[一键导入 Loon](https://www.nsloon.com/openloon/import?plugin=https%3A%2F%2Fraw.githubusercontent.com%2Fhhhoratioxu%2FWeatherKit%2Fmain%2FLoon%2Fscript%2FWeatherKit.lpx) · [插件订阅直链（.lpx）](https://raw.githubusercontent.com/hhhoratioxu/WeatherKit/main/Loon/script/WeatherKit.lpx) · [固定版本 cache-v8](https://raw.githubusercontent.com/hhhoratioxu/WeatherKit/cache-v8/Loon/script/WeatherKit.lpx) · [旧版 cache-v7](https://github.com/hhhoratioxu/WeatherKit/releases/tag/cache-v7) · [旧版 cache-v6](https://github.com/hhhoratioxu/WeatherKit/releases/tag/cache-v6) · [旧版 cache-v5](https://github.com/hhhoratioxu/WeatherKit/releases/tag/cache-v5) · [旧版 cache-v4](https://github.com/hhhoratioxu/WeatherKit/releases/tag/cache-v4) · [旧版 cache-v3](https://github.com/hhhoratioxu/WeatherKit/releases/tag/cache-v3) · [旧版 cache-v2](https://github.com/hhhoratioxu/WeatherKit/releases/tag/cache-v2) · [旧版 cache-v1](https://github.com/hhhoratioxu/WeatherKit/releases/tag/cache-v1)

2026-10-20 将正式入口后缀规范为 `.lpx`；旧 `WeatherKit.plugin` 地址继续作为内容完全相同的兼容入口保留。构建会同时生成两个文件并校验内容一致。已安装旧入口可继续更新；切换到新入口时先停用旧入口，避免同时启用两份 WeatherKit。

使用 Loon `3.5.1(983)` 或以上，在「配置 → 插件」中添加插件直链并启用；已订阅该地址的用户更新插件后重载配置即可。若已安装其他 WeatherKit 脚本版，请先停用旧版，避免同一接口重复处理。沿用已有的 Loon MitM 证书；首次使用需按 [Loon 官方 MitM 文档](https://nsloon.app/docs/MitM/) 配置证书。系统版本沿用上游的 iOS/iPadOS 18、macOS 15 及以上要求。

默认实况与空气质量缓存 60 秒、小时及每日预报 180 秒、分钟降水与预警 15 秒。网络发起预算 8000 毫秒、最多三个活跃请求；失败冷却 30 秒，诊断关闭，缺失 country 时采用 Auto 保守判断。`RequestCache.TTL=0` 禁用所有已完成响应缓存，仍合并本次执行的相同在途请求。

供应商失败时保留 Apple 原始数据；当原数据也缺失或不可用时，只有你已配置另一来源的专用凭据，才尝试一次备用查询。普通安装无需新增个人 Token；可选诊断仅输出一条不含令牌、URL 或原始坐标的汇总，独立于上游高级调试日志。

## 构建与验证

版本 `3.3.2-cache.8` 的发布文件直接来自 [GitHub Actions](https://github.com/hhhoratioxu/WeatherKit/actions/runs/41831571162) 的锁定依赖构建：`npm ci --ignore-scripts --no-audit --no-fund`、Node v22.23.4，234 项回归测试、21 个实际压缩脚本场景、13 个原生表达式／路由／jq 检查全部通过。下载后核对了 CI ZIP 摘要、八个发布文件、七条校验清单和固定版本脚本引用，并再次运行编译产物检查。来源提交、环境与 SHA-256 见 [构建验证记录](docs/loon-build-validation.json) 和 `Loon/script/build-provenance.json`。

内存与 CPU 对比来自实际 CI 压缩脚本在独立本地 Node/V8 进程中的模拟运行，详见 [v7 测量记录](docs/processing-memory-v7.md)，不把桌面数值换算为 iPhone 内存或耗电。原生规则检查未调用真实 Loon 配置解析器；手机正式插件导入、v3 脚本完成、供应商请求及实际响应改写已观察；各功能的完整 UI 验收、活跃预警、内存及 VPN 连续运行仍需分别核验。

仓库的 CI 流程配置为使用 Actions 自带的临时 `GITHUB_TOKEN`，仅声明 `contents: read` 与 `packages: read`；无需为安装插件创建或提交个人 Token。下载依赖时读取上游的原始 `@nsringo/weatherkit@1.1.2`。历史第一版设计与模拟请求数对比见 [请求缓存说明](docs/request-cache.md)。
