#  iRingo: 🌤 WeatherKit

本仓库是 [NSRingo/WeatherKit](https://github.com/NSRingo/WeatherKit) 的 Fork，保留原作者、Apache-2.0 许可证与 Git 历史。当前按上游命名与更新说明格式整理 Loon 发行 `v3.3.3`；插件名称、功能描述和原版一致，下载资源来自本 Fork。

[更新说明](CHANGELOG.md) · [v3.3.3 发布记录](docs/release-v3.3.3.md) · [上游使用指南](https://NSRingo.github.io/guide/Weather/weather-kit)

## 安装与更新

[一键导入 Loon](https://www.nsloon.com/openloon/import?plugin=https%3A%2F%2Fraw.githubusercontent.com%2Fhhhoratioxu%2FWeatherKit%2Fmain%2FLoon%2Fscript%2FiRingo.WeatherKit.lpx) · [插件订阅直链](https://raw.githubusercontent.com/hhhoratioxu/WeatherKit/main/Loon/script/iRingo.WeatherKit.lpx) · [正式 Release](https://github.com/hhhoratioxu/WeatherKit/releases/tag/v3.3.3)

正式文件为 `Loon/script/iRingo.WeatherKit.lpx`。已订阅 `WeatherKit.lpx` 或 `WeatherKit.plugin` 的用户可继续更新，三个入口内容相同；只启用一份 WeatherKit。最低 Loon 版本为 `3.5.1(983)`，沿用既有 MitM 配置。默认算法 EU_EAQI、日志 WARN、独立诊断关闭。

## 功能与边界

保留原版的天气、空气质量、下一小时降水和预警设置。本 Fork 修复主天气 App 的 WeatherKit v3 JSON 兼容、11 种算法的输入与单位及 CO 标签问题，并保留缺项补充、逐产品失败回退、缓存和请求合并。完整六项污染物不额外请求供应商。

默认实况／空气质量缓存 60 秒、小时／每日预报 180 秒、分钟降水／预警 15 秒；网络发起预算 8000 毫秒、最多三个活跃请求。保留正文、向量、缓存容量与异步完成边界；没有新增后台轮询。设置与限制见[稳定性与缓存](docs/resilience.md)、[v3 兼容说明](docs/ios273-v3.md)和[空气质量修复](docs/air-quality-v9.md)。InstantCast 和研究模型的当前浓度换算不等于官方日均发布值。

本次发行范围为 Loon。其他客户端保留上游源码与模板，不将 Loon 原生规则直接移植过去。

## 构建与验证

使用锁定依赖的 GitHub Actions 构建，产物包含正式名称、兼容入口、三个运行脚本、许可证、构建来源和 SHA-256 清单。当前构建记录见[验证文件](docs/loon-build-validation.json)。

此前 cache-v9 完成 309 项回归、35 个实际压缩脚本场景和 15 个表达式／路由／jq 检查，Mac 原生核对七种算法及六项污染物；2026-11-05 用户确认 iPhone 使用成功。这些历史证据按当时版本保留，v3.3.3 的 CI 与公共文件核验另行记录。设备耗电或内存下降比例未测量；桌面模拟不能作为设备 VPN 稳定性证明。

历史 [cache-v9](https://github.com/hhhoratioxu/WeatherKit/releases/tag/cache-v9) 及更早发布保留。此前内存工作见 [v7](docs/processing-memory-v7.md)、[v6](docs/cache-memory-v6.md)、[v5](docs/memory-work.md)；其中比例仅为 Node/V8 桌面测量。
