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

## 锁定依赖构建

源码 4bfe3a7248b25c3185c9d6b7d7c95988dad10493 的 [Actions 41941086743](https://github.com/hhhoratioxu/WeatherKit/actions/runs/41941086743) 已通过：Node v22.23.4、完整 npm ci、309 项回归、35 个实际压缩脚本场景及 15 个表达式／路由／jq 检查。九文件 ZIP SHA-256 为 f4c200338e2e02972145a25f843ad8f8b9d55426575e4cba9a060377db313f1e，八条内部摘要均匹配。

三个入口与 CI 同字节，名称、描述和主页使用上游 package 元数据；五条脚本引用固定到 v3.3.3。三个运行脚本与已原生验证的 cache-v9 去掉首行版本注释后逐字节一致，没有变更执行逻辑。CI 的九个文件不做发布后加工。此前 Mac 原生验收和 iPhone 用户反馈保留在 [v9 构建记录](loon-build-validation-v9.json)，不标成 v3.3.3 重新进行的设备测试。
