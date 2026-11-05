### 🆕 New Features
  * 备用查询增加独立开关 ProviderFallback.Enabled，默认关闭；明确开启且 Apple 数据与所选来源均不可用、另一来源有专用凭据时，最多尝试一次。

### 🛠️ Bug Fixes
  * 恢复原版空气指数目标标准的含义：先匹配 AirQuality.Current.Index.Replace，再按所选来源或算法转换，默认只替换 HJ6332012，不因选择算法而全局重算。
  * 修复部分污染物补齐可能引入目标外供应商指数的问题；有效 Apple 指数与浓度分别保留，空目标列表和 None 停用本地指数转换。
  * 恢复原版昨日对比开关及独立来源：默认保留已有对比，缺失或明确重算时使用所选来源，来源查询失败不丢弃已取得的当前数据。
  * 修复另一来源 Token 被当成自动切换来源授权的问题；保留已发布的 iOS 27.3 主 App JSON 适配、算法数值和 CO 单位修复。

### 🔣 Dependencies
  * 保持锁定的 @nsringo/weatherkit@1.1.2；缓存键哈希使用 @noble/hashes@1.8.0，并保留相应许可证。

### ‼️ Breaking Changes
  * 原版参数含义恢复后，未匹配目标标准的 Apple 指数会保留原值；需要转换其他标准时，应显式配置目标列表。最低 Loon 仍为 3.5.1(983)。

### 🔄 Other Changes
  * 沿用原版名称、功能描述及五段式更新说明，Fork 版本为 v3.3.4；正式文件 iRingo.WeatherKit.lpx 与 WeatherKit.lpx、WeatherKit.plugin 兼容入口同字节。
  * 以原版 v3.3.2 正式插件、默认参数、源码和指南建立行为核对记录及回归夹具；原版 PR #107 保持草稿等待核对。
  * 保留缓存、请求合并、正文与并发边界，没有新增后台轮询。v3 自定义处理仍限主天气 App；设备历史证据与本轮构建验证分别记录。
