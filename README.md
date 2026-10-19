#  iRingo: 🌤 WeatherKit

本 Fork 为 Loon 增加数据源失败回退、受限网络预算、可选运行诊断、网页预警缓存、地区识别修复，以及按数据类型区分的短时缓存。保留上游作者、许可证与 Git 历史。

实现、默认值、限制及验证边界见 [稳定性与缓存优化 v3](docs/resilience.md)。Loon 导入文件由 `npm run build:loon-cache` 生成至 `Loon/script/WeatherKit.plugin`，运行脚本固定引用本 Fork 的 `cache-v3`。

## 本次更新

`3.3.2-cache.3` 修复共享 HTTP 工具库对短毫秒超时的单位转换，Loon 供应商请求改用原生 HTTP 回调。错误 HTTP 响应即使带有成功样式的 JSON，也会保留 Apple 数据；共享接口的预警失败可与正常实况分别处理。

关闭缓存的 WAQI 鉴权请求现在也受冷却保护，令牌响应仍不缓存；表单令牌正确编码，普通 AQI 日志移除令牌。地区网格 304 响应保留已有数据，空结果回退统计也已补齐。本版沿用已有插件参数，无需重新填写。

## 安装与更新

[一键导入 Loon](https://www.nsloon.com/openloon/import?plugin=https%3A%2F%2Fraw.githubusercontent.com%2Fhhhoratioxu%2FWeatherKit%2Fmain%2FLoon%2Fscript%2FWeatherKit.plugin) · [插件订阅直链](https://raw.githubusercontent.com/hhhoratioxu/WeatherKit/main/Loon/script/WeatherKit.plugin) · [固定版本 cache-v3](https://raw.githubusercontent.com/hhhoratioxu/WeatherKit/cache-v3/Loon/script/WeatherKit.plugin) · [旧版 cache-v2](https://github.com/hhhoratioxu/WeatherKit/releases/tag/cache-v2) · [旧版 cache-v1](https://github.com/hhhoratioxu/WeatherKit/releases/tag/cache-v1)

使用 Loon `3.5.1(983)` 或以上，在「配置 → 插件」中添加插件直链并启用；已订阅该地址的用户更新插件后重载配置即可。若已安装其他 WeatherKit 脚本版，请先停用旧版，避免同一接口重复处理。沿用已有的 Loon MitM 证书；首次使用需按 [Loon 官方 MitM 文档](https://nsloon.app/docs/MitM/) 配置证书。系统版本沿用上游的 iOS/iPadOS 18、macOS 15 及以上要求。

默认实况与空气质量缓存 60 秒、小时及每日预报 180 秒、分钟降水与预警 15 秒。网络发起预算 8000 毫秒、最多三个活跃请求；失败冷却 30 秒，诊断关闭，缺失 country 时采用 Auto 保守判断。`RequestCache.TTL=0` 禁用所有已完成响应缓存，仍合并本次执行的相同在途请求。

供应商失败时保留 Apple 原始数据；当原数据也缺失或不可用时，只有你已配置另一来源的专用凭据，才尝试一次备用查询。普通安装无需新增个人 Token；可选诊断仅输出一条不含令牌、URL 或原始坐标的汇总，独立于上游高级调试日志。

## 构建与验证

版本 `3.3.2-cache.3` 的 [GitHub Actions](https://github.com/hhhoratioxu/WeatherKit/actions/runs/39202789221) 使用锁定依赖完成 192 项回归测试与 11 个编译产物场景检查，全部通过。最终结果、来源提交与 SHA-256 见 [构建验证记录](docs/loon-build-validation.json) 和发布文件 `build-provenance.json`；构建时自动校验两个完整脚本的模拟 Loon 行为。真实 iPhone 导入、天气显示、耗电、延迟和 VPN 连续运行仍待设备验证。

构建使用 Actions 自带的临时 `GITHUB_TOKEN`，仅声明 `contents: read` 与 `packages: read`；无需为安装插件创建或提交个人 Token。下载依赖时读取上游的原始 `@nsringo/weatherkit@1.1.2`。历史第一版设计与模拟请求数对比见 [请求缓存说明](docs/request-cache.md)。
