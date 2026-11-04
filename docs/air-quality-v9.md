# cache-v9 空气质量与 WK3 稳定性修复

用户要求全部内置算法可切换、尽量保留六项污染物，并从 GitHub 拉取。本版在用户 Fork 发布；没有向原作者提交本版全部改动的 PR。

## 修复内容

- 清理非有限、负数、空值、无效单位和重复污染物；有效的零浓度保留。供应商数值字符串只接受完整可转换的非空数值。
- Apple 已有部分污染物时也补齐缺项；已有有效值优先。补充失败保留原有指数和天气。完整的六项浓度不会发起补充查询；补充沿用既有缓存、请求合并、预算、并发和冷却。
- 下拉选择的算法对非国标 Apple 数据也生效。高级配置显式清空 `AirQuality.Current.Index.Replace` 仍表示停用指数替换，`None` 保留原指数。
- 加拿大 AQHI 的 NO2/O3 使用 ppb，PM2.5 使用 µg/m³，修正质量/摩尔浓度转换和最近整数取整。QWeather CO 按实际单位转换，防止已归一化的 µg/m³ 再乘 1000；转换可重复执行而不会继续改变浓度。
- 美标 InstantCast 的颗粒物、NO2/SO2/CO 在插值前按浓度精度截断，CO 低端断点改为 0.1 ppm 的整数倍；保留 WAQI 自定义臭氧分段及其 0.1 ppb 精度，未改称官方 EPA NowCast。
- 修正浮点误差导致恰好 50 的国标分级错误、2025 草案零浓度分级、超量程插值多加一次区间上限，以及常数分段计算。风险模型缺少必要气体或全部适用颗粒物时不再虚构健康值。
- 标准没有定义的污染物不写 `index=-1`，但有效物理浓度继续保留。主要污染物改为单次遍历，不再排序、复制多层候选数组或为正常的同级污染物逐条报警。
- 更换计算算法后不沿用另一算法的昨日趋势。只有配置同算法历史计算且取得有效历史数据时才重算，否则保留未知状态。
- 合并本次 iOS 27.3 候选的云量百分比、整数范围、可选时间、无效 Unicode/数值、正文与头部一致性和逐产品回退修复。异步 HTTP 回调完成后只调用一次 `$done`。

## 算法与指标覆盖

所有选项都保留来源可提供的 PM2.5、PM10、O3、NO2、SO2、CO 六项有效浓度。参与总体计算的集合按各模型定义；不适用的分项不填造数值。

| 选项 | 参与指数计算的污染物 | 说明 |
| --- | --- | --- |
| 德国 LQI / UBA | PM2.5、PM10、O3、NO2、SO2 | CO 浓度保留，不参与指数 |
| 欧盟 EAQI | PM2.5、PM10、O3、NO2、SO2 | CO 浓度保留，不参与指数 |
| 美标 InstantCast | 六项 | 保留 WAQI 臭氧调整，不是使用逐小时历史的官方 NowCast |
| 国标 InstantCast 2012 | 六项 | 当前浓度换算，不等于官方日均发布值 |
| 国标 InstantCast 2025 草案 | 六项 | 保留草案名称，不宣称现行正式标准 |
| 加拿大 AQHI | PM2.5、O3、NO2 | 修正 ppb 和取整；未实现 AQHI+ 或额外野火修正规则 |
| 香港 AQHI | O3、NO2、SO2、PM10/PM2.5 较高风险者 | 使用上游已有 2025 系数 |
| AQHI-Multi 中国 | O3、NO2、PM10/PM2.5 组合 | 保留上游研究模型 |
| AQHI-Multi 中国+香港 | 上述加 SO2 | 保留上游研究模型 |
| 中国致死风险 AQHI | PM2.5、O3、NO2、SO2 | 保留上游研究系数与阈值 |
| 中国致死风险+香港 AQHI | 上述加 PM10 的风险选择 | 保留上游研究系数与阈值 |
| 不转换 | 原 Apple 指数 | 缺项仍可补齐，不重算指数 |

InstantCast 和风险模型使用来源提供的当前浓度；本次没有新增持续后台采样来构造官方要求的 3 小时、8 小时或 24 小时平均。因而“算法可使用”指输入处理、计算和 Apple 输出兼容性，不代表与各地官方实时发布值完全一致。无来源的指标不会伪造。

## 验证与依据

最终源码在锁定依赖 CI 中 309 项自动回归通过，含全部算法的零浓度、缺项、非有限输入、单位等价、参考数值、边界、WK2 编解码和开发/发布两条 WK3 响应入口。压缩后的 Loon 脚本另检验全部算法、不转换、零额外供应商请求与单次完成，共 35 个 VM 场景；原生表达式、URL 路由和 jq 检查共 15 个场景。这些是桌面测试，不是 Loon 配置解析、全部设备或官方站点逐项对照验收。

2026-11-04/05 重新核对 Loon [Rewrite](https://nsloon.app/docs/Rewrite/rewrite_v2/)、[Script API](https://nsloon.app/docs/Script/script_api/) 和[插件](https://nsloon.app/docs/Plugin/)；使用原生 `request.header.set`、必要 URL Guard 和一个 script Action，全部 20 项参数继续由原生对象传入。最低 3.5.1(983)、正文边界、并发、缓存容量和超时不变。iOS/macOS 主 App 前缀的表达式夹具通过；真实 Mac 请求验证另记，不将合成 User-Agent 当作实际抓包。

参考 [EPA 2026 技术文件](https://document.airnow.gov/technical-assistance-document-for-the-reporting-of-daily-air-quailty.pdf) 的浓度精度与线性插值、[德国 UBA LQI](https://www.umweltbundesamt.de/themen/luft/luftqualitaet/der-luftqualitaetsindex-lqi) 的五项污染物、[香港环保署 AQHI 公式与分级](https://www.aqhi.gov.hk/en/what-is-aqhi/faqs.html)，以及加拿大政府托管的 [AQHI 技术说明](https://www2.gov.bc.ca/assets/gov/environment/air-land-water/air/reports-pub/aqhi-variation-bc.pdf)。对不能复核的研究阈值保留上游值，不宣称所有地区的官方认证。

正式发布使用 GitHub Actions 锁定依赖产物，构建提交、CI 链接和公共文件摘要记录于 [构建验证记录](loon-build-validation.json)。Loon 正式入口仍为 `.lpx`，旧 `.plugin` 与其同字节；运行脚本固定引用 CI 产物的完整提交，不使用局域网地址。


## 原生排查历史（以下候选状态以当时为准）

Mac 为 macOS 27.3 (26C5035r)，Loon for Mac 0.5.0(1011)。00:08 的真实主应用请求确认 User-Agent 为 `WeatherKit_Weather_macOS_Version 27.3`；组件使用 `WeatherKit_WeatherWidget_macOS_`，新版守卫只接管前者。不能据此假设每个 iOS 组件都使用单独的 User-Agent。

第一版 GitHub 候选的两条真实请求在 Loon 中完成，分别耗时 29 ms 和 152 ms；日志可见英国及南京的 EAQI 计算。但系统天气仍未展示空气质量。原生统一日志进一步确认 `CurrentWeather.conditionCode`、小时/分时状态和分钟降水概述都要求 String，原始 v3 JSON 却包含数组；每日预报还缺少旧 JSON 读取器要求的 `precipitationAmount`。系统随后清除当前天气缓存，走 CloudKit 回退，并把空气质量标为不可用。这证明先前“200/JSON、脚本完成、天气可见”只证明运行与有限显示，不能证明系统采用了修改结果。

第二版候选区分 WK3 FlatBuffer 结构与主应用 JSON 读取器：状态取来源给出的首个字符串，降水/降雪取 expected 标量，从完整的按类型降水期望量补出总量；保留原始按类型字段与其他未知产品。转换覆盖未选择替换的已知分时产品，供应商失败也保留可读取的 Apple 数据。没有新增网络往返、后台采样或宿主 API。该兼容转换为新请求的 JSON 传输所必需，已是原生可读 JSON 且未改数据时仍原样返回。

第二版 GitHub 分支为 `mac-v9-validation-2`。代码与产物验证已完成；当时 Mac 自动锁屏，尚未完成第二版的原生复测。正式 main 入口继续保留旧版，等待系统解码和空气质量显示确认。GitHub Actions 同时受到官方通报的服务故障影响，排队状态不记为通过。


CI 随后恢复：源码 ae2ca5e 的 [Actions 41869896115](https://github.com/hhhoratioxu/WeatherKit/actions/runs/41869896115) 已成功完成锁定依赖安装、306 项回归和原生脚本构建。下载的八文件 ZIP 摘要与官方 artifact digest 一致，七条内部校验全部匹配，并重新通过 34 个压缩 VM 场景与 15 个表达式检查。第二版测试分支现使用这份 CI 的三个运行脚本原始字节，只调整导入名称、验证版号与测试分支脚本引用；[具体构建记录](air-quality-v9-build-validation.json) 区分原始 CI 资产和测试入口的处理。Mac 的第二版原生验收仍等待解锁，尚未替换正式 main。

测试导入文件的五条脚本引用现固定到 GitHub 完整提交 `dd6be7bb53db58c3f4643ddb4e2c7632f855c96b`，三个运行脚本与 CI 原始字节一致。更新测试分支文档或入口不会使这次运行混用另一批脚本。

## 2026-11-05 早间原生复测与 CO 修正

06:59 起在 Mac 安装第二版固定 GitHub 入口，杭州新请求于 07:00:45 完成（182 ms）。系统天气显示 EAQI Fair，详情中六项污染物及 iRingo 指数来源可见。这一轮原生统一日志统计为解码错误 0、Invalid weather data 0、CloudKit fallback 0，并确认 11 个 WDS 产品已进入系统缓存（含 currentWeather、forecastHourly、forecastDaily、forecastPeriodic 和 airQuality）。成都的新请求另显示加拿大 AQHI 4。未将这些结果记作 iPhone 设备验收。

逐项读取六项浓度时，发现上一轮通用单位清理漏掉了 Apple 原始 QWeather 的 CO 标签错误：数值按 mg/m³ 给出，却标为 µg/m³，页面因此出现小于 1 µg/m³。修复现显式区分入口：只有原始 Apple QWeather 产品修复该假标；已经归一化的供应商结果按其明确单位保留，不按数值大小猜测，也不额外请求另一来源。补充两条完整响应入口和一条单位回归，完整检查增至 309 项；压缩脚本再增加同场景检查，共 35 个 VM 场景与 15 个表达式检查。

新源码 4d10a76 的 [Actions 41931700904](https://github.com/hhhoratioxu/WeatherKit/actions/runs/41931700904) 已成功完成锁定依赖构建。下载的八文件 ZIP 摘要为 4fe0dee681961c9f3bfaefcfb08c708fe9b4525c2a4bad53003fd3d610e7d902，内部七条校验及真实压缩脚本复查通过。第三版入口使用该 CI 的三个原始运行脚本，并固定引用其完整 GitHub 提交；最终 CO 数值及其他算法的原生检查仍待完成，正式 main 暂未替换。

## 最终 GitHub 候选的 Mac 原生验收（2026-11-05）

最终入口 `11c2092f3459408c0cc170d3ce3639cf9583df3c` 的五条脚本引用固定至 `3c4a31d278e5380bec7a148ed73f1e174c222ffc`，三个运行文件与 Actions 41931700904 的原始资产一致。07:30:56 起以新的公开城市预览核对，未新增保存城市：

| 算法 | 公开测试城市 | 实际显示 | CO µg/m³ |
| --- | --- | --- | --- |
| EU_EAQI | 苏州 | Moderate | 800 |
| HK_AQHI | 广州 | 3 / Low | 700 |
| CN_DEATH_AQHI | 武汉 | 2 / 低 | 700 |
| WAQI_InstantCast_US | 深圳 | 64 / Moderate | 700 |
| CA_AQHI | 长沙 | 2 / Low Health Risk | 600 |
| WAQI_InstantCast_CN | 福州 | 52 / Good | 600 |
| UBA | 宁波 | Good | 800 |

七例均可打开六项污染物详情并显示 iRingo 指数来源，覆盖七类不同显示图例。系统统一日志统计为解码错误 0、Invalid weather data 0、CloudKit fallback 0；airQuality、currentWeather、小时／每日／分时等共 11 类 WDS 产品进入缓存。最终候选的原生检查完成后才准备 main 正式入口；默认算法恢复 EU_EAQI，日志 WARN，独立诊断关闭。

这是有限时段的 Mac 原生验收。11 种算法加 None 全部通过压缩脚本检查，其余五个选项未逐项进行 Mac 页面验收；未声称算法输出等于官方日均发布值，也未声称 v9 的 iPhone、手表、全部后台客户端、活跃预警或长时间 VPN 已验收。没有测量设备内存或电量改善比例。
