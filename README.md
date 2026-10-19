#  iRingo: 🌤 WeatherKit

本 Fork 增加面向 Loon 的请求合并与短时缓存：普通数据默认 60 秒、分钟降水最多 30 秒，并限制并发和缓存容量。保留上游作者、许可证与 Git 历史。

实现、配置、构建方法和验证边界见 [请求缓存说明](docs/request-cache.md)。Loon 导入文件由 `npm run build:loon-cache` 生成至 `Loon/script/WeatherKit.plugin`；必须使用本 Fork 对应的运行脚本。

## 安装到 Loon

[一键导入 Loon](https://www.nsloon.com/openloon/import?plugin=https%3A%2F%2Fraw.githubusercontent.com%2Fhhhoratioxu%2FWeatherKit%2Fmain%2FLoon%2Fscript%2FWeatherKit.plugin) · [插件订阅直链](https://raw.githubusercontent.com/hhhoratioxu/WeatherKit/main/Loon/script/WeatherKit.plugin) · [固定版本 cache-v1](https://raw.githubusercontent.com/hhhoratioxu/WeatherKit/cache-v1/Loon/script/WeatherKit.plugin)

在 Loon 的「配置 → 插件 → 插件」中添加插件直链并启用。若已安装其他 WeatherKit 脚本版，请先停用旧版，避免同一接口重复处理。沿用已有的 Loon MitM 证书；首次使用需按 [Loon 官方 MitM 文档](https://nsloon.app/docs/MitM/) 配置证书。适用系统沿用上游的 iOS/iPadOS 18、macOS 15 及以上要求。

插件参数中的「请求缓存」默认 60 秒，分钟降水最多 30 秒；设为 0 仅保留本次执行中的相同请求合并。完整脚本固定引用本 Fork 的 `cache-v1`，不会加载上游未包含优化的运行脚本。

版本 `3.3.2-cache.1` 已通过 [GitHub Actions 完整构建与 144 项回归测试](https://github.com/hhhoratioxu/WeatherKit/actions/runs/39193708665)，下载后的两份完整脚本另通过 3 项 VM 冒烟验证。构建来源、文件 SHA-256 与验证边界见 [构建验证记录](docs/loon-build-validation.json)。真实 iPhone 导入和 VPN 连续运行仍待设备验证。

构建使用 Actions 自带的临时 `GITHUB_TOKEN`，仅声明 `contents: read` 与 `packages: read`；无需为安装插件创建或提交个人 Token。下载依赖时读取上游的原始 `@nsringo/weatherkit@1.1.2`。
