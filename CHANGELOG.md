## 3.3.2-cache.9 · 2026-11-05

修复 iOS 27.3 Beta 下插件功能未生效、天气偶发空白和空气质量指标异常。

- 适配主天气 App 的 v3 JSON 读取器：状态数组、降水统计及每日总量转为可读取的表示，同时处理已知未替换分时产品并保留未知字段。
- 修正 11 种内置空气质量算法的输入、单位、零浓度、无效值、插值和分级边界；保留六项有效污染物浓度，按需补齐缺项。
- 修复 Apple 原始 QWeather CO 的错误单位标签，区分原始产品与已归一化供应商数据；修正加拿大 AQHI 的 ppb 换算、取整和美标 InstantCast 截断精度。
- 完整六项污染物不发起补充查询，主要污染物改用单次遍历；保留缓存、请求合并、预算、并发及逐产品失败回退，没有新增后台轮询或重发。
- 正式入口为 `.lpx`，`.plugin` 保持同字节兼容；五条运行引用固定为同一份 CI 产物提交。

验证：锁定依赖 CI 309 项回归、35 个真实压缩脚本场景、15 个表达式与 jq 检查通过；Mac 原生核对七种算法和六项污染物，最终轮次无解码错误、无效天气或 CloudKit 回退。2026-11-05 用户确认 iPhone 使用成功，按用户反馈记录，不扩展为全部算法或设备耗电测量结论。

[正式 Release](https://github.com/hhhoratioxu/WeatherKit/releases/tag/cache-v9) · [详细修复与验证范围](docs/air-quality-v9.md) · [设备反馈](docs/iphone-v9-user-confirmation.json)

---

### 🆕 New Features
  * none

### 🛠️ Bug Fixes
  * 修复 WeatherKit Response 处理范围未同时受用户设置和 URL `dataSets` 约束的问题：现在只处理两者的交集，避免地图天气小组件只请求当前天气与空气质量时扩展处理其他数据集。
  * 修复和风天气历史空气质量接口路径多余斜杠的问题，确保请求使用正确的 `/v7/historical/air` 路径。

### 🔣 Dependencies
  * 将 FlatBuffer Root 处理器迁移至已发布的 `@nsnanocat/flatbuffer-root@1.0.0`，移除仓库内重复实现。

### ‼️ Breaking Changes
  * none

### 🔄 Other Changes
  * 从 BoxJs 设置中隐藏仅供插件参数使用的 `Storage` 选项，保留运行时配置行为。
  * 补充数据集交集、用户设置过滤、FlatBuffer 根槽映射和 QWeather 接口路径的回归测试。
