# v3.3.3 Loon 发行整理

2026-11-05 按用户要求，以 NSRingo/WeatherKit 的 v3.3.2 为命名和更新说明参考，整理本 Fork 当前 Loon 发行。

| 项目 | 当前约定 |
| --- | --- |
| 版本与标签 | 3.3.3 / v3.3.3，仅表示本 Fork 版本 |
| 插件名称 |  iRingo: 🌤 WeatherKit |
| 功能描述、图标、主页 | 沿用上游 package 元数据 |
| 正式文件 | Loon/script/iRingo.WeatherKit.lpx |
| 既有入口 | WeatherKit.lpx、WeatherKit.plugin，与正式文件同字节 |
| 更新说明 | New Features、Bug Fixes、Dependencies、Breaking Changes、Other Changes |
| 发布范围 | 当前 Loon 版；其余客户端保留上游源码与模板 |

旧 cache-v9 的标签、资产与设备记录保留。新的发行重新走锁定依赖构建；构建通过前不将新版本写入正式订阅。没有改变算法、数据新鲜度、缓存容量、网络预算或宿主 API。最终 CI、运行脚本字节比较和公共下载核验将在发布完成后补充。
