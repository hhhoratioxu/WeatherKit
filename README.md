#  iRingo: 🌤 WeatherKit

本 Fork 增加面向 Loon 的请求合并与短时缓存：普通数据默认 60 秒、分钟降水最多 30 秒，并限制并发和缓存容量。保留上游作者、许可证与 Git 历史。

实现、配置、构建方法和验证边界见 [请求缓存说明](docs/request-cache.md)。Loon 导入文件由 `npm run build:loon-cache` 生成至 `Loon/script/WeatherKit.plugin`；必须使用本 Fork 对应的运行脚本。
