# Mac Loon 安装核对与有限原生观测

日期：2026-11-14（Asia/Taipei）。目标运行文件来自 [f571a49](https://github.com/hhhoratioxu/WeatherKit/commit/f571a49eb3404caf5214cb9b629ee1bd74cf239c)，版本号仍为 3.3.6。环境为 macOS 27.3（26C5035r）、Loon for Mac 0.5.0（1011）。**已完成安装文件核对，并观察到真实 Apple 天气请求命中脚本；天气画面和产品内容验收尚未完成。**

## 更新与保留情况

用户明确恢复授权后，先复核可回退备份和 Connected 状态，再在现有 WeatherKit 详情页点击一次 Update Plugin。订阅沿用 Fork main。插件更新前已经启用，本轮没有操作启用开关。回退副本仅在本机受限权限的忽略目录中保存，不上传配置、依赖、缓存或私有备份。

| 安装文件 | 本机缓存与 f571a49 SHA-256 核对 |
| --- | --- |
| iRingo.WeatherKit.lpx | 一致 |
| request.bundle.js | 一致 |
| response.bundle.js | 一致 |
| scale.bundle.js | 一致 |

参数声明从旧版 21 项变为原有 12 项；保留的 12 项声明和默认值逐字一致，未手工修改参数。更新前界面显示天气来源 ColorfulClouds、预警来源 QWeatherWeb、内置算法 EU_EAQI；更新后的完整界面值比较因工具超时未完成，不能把声明一致扩大为逐项 UI 验收通过。

活跃及保存配置文件均与更新前逐字节相同，WeatherKit 配置条目保持原状；比较的 14 个其他插件文件无变化。Loon 主进程的 PID 和启动时间保持不变。没有操作 VPN 开关、节点、代理、规则、MITM、其他插件或系统网络配置。

## 实际 App 请求与脚本命中

尝试打开 Apple 天气的观测窗口内，进程可见；只读关联 Loon 的会话及执行记录，确认以下请求来自 `com.apple.weather`。下表只保留国家参数，不保留城市、坐标、原始 URL 或请求头。

| App 请求 country 参数 | HTTP / Content-Type | 命中的脚本 | 执行记录 |
| --- | --- | --- | --- |
| CN | 200 / application/json | WeatherKit.api.v3.weather.json.response | 已完成，无脚本异常 |
| GB | 200 / application/json | WeatherKit.api.v3.weather.json.response | 已完成，无脚本异常 |

两次请求均声明需要 AQ、当前天气、每日/逐小时/下一小时/periodic、预警及其他天气产品。请求了产品不等于已正确替换该产品。数据库的 `requestedCount` 两次均为 0；没有独立验证第三方 API 返回或替换结果。响应正文未保存，不能据此判断来源归属、AQ 数值、预警内容、条件类型或原生读取器是否接受了修改结果。

执行记录中的脚本路径为临时虚拟文件名，无法从该字段单独反推所加载的源码版本。因此“磁盘缓存四项 SHA 一致”和“两次真实原生脚本命中”是分别取得的证据，不把它们包装为对加载版本及全部功能的完整验收。

## VPN 采样及界面限制

状态采样共 **363 次**，跨度约 **371 秒**，全部观察为 Connected，结束时仍为 Connected。采样进程已停止。这只能说明采样时的状态，不是无间隙监测或长期 VPN 稳定性结论。

更新后读取 Loon 界面、打开/读取 Apple 天气、枚举原生界面三次发生 `cua_repl` 超时，并伴随工具内核重置。本轮结束 UI 操作，没有通过重启应用、断开 VPN 或修改网络来绕过问题。工具超时没有被判定为 WeatherKit、Loon 或 Apple 天气的运行故障，也没有据此修改代码。

尚未覆盖：天气 App 的可见温度/预报画面和刷新交互；手动选择公开城市的受控国内/海外比较；来源替换及归属；AQ 浓度、EAQI 和昨日对比；有预警/无预警/不可用状态、详情和实际预警补全；Surge 真机；dev/#110 新协议；网络切换、长期运行、耗电、CPU 和峰值内存。CN/GB 两条网络记录不能代表所有国内/海外地区均可用。

## 自动测试与本轮观测的区别

此前 [f571a49 的 CI](https://github.com/hhhoratioxu/WeatherKit/actions/runs/43539548163) 已通过干净锁定依赖安装、395 项测试、Loon 50 个压缩脚本模拟及 15 项规则检查、Surge 39 个模拟场景。这些是既有自动验证，不计入本轮两次真实脚本命中，也不代替 App 画面验收。

本次没有确认到需要修改运行代码的具体缺陷，只提交脱敏报告和文档链接，不改变版本、上游 PR、tag 或公开 Release。完整摘要及四项安装文件 SHA 见 [机器可读记录](mac-native-observation-2026-11-14.json)。原始日志、响应正文、个人位置、凭证、私有配置和备份不随报告提交。
