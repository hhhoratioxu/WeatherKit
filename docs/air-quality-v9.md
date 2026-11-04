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

本地源代码 303 项自动回归通过，含全部算法的零浓度、缺项、非有限输入、单位等价、参考数值、边界、WK2 编解码和开发/发布两条 WK3 响应入口。压缩后的 Loon 脚本另检验全部算法、不转换、零额外供应商请求与单次完成，共 33 个 VM 场景；原生表达式、URL 路由和 jq 检查共 15 个场景。这些是桌面测试，不是 Loon 配置解析、全部设备或官方站点逐项对照验收。

2026-11-04/05 重新核对 Loon [Rewrite](https://nsloon.app/docs/Rewrite/rewrite_v2/)、[Script API](https://nsloon.app/docs/Script/script_api/) 和[插件](https://nsloon.app/docs/Plugin/)；使用原生 `request.header.set`、必要 URL Guard 和一个 script Action，全部 20 项参数继续由原生对象传入。最低 3.5.1(983)、正文边界、并发、缓存容量和超时不变。iOS/macOS 主 App 前缀的表达式夹具通过；真实 Mac 请求验证另记，不将合成 User-Agent 当作实际抓包。

参考 [EPA 2026 技术文件](https://document.airnow.gov/technical-assistance-document-for-the-reporting-of-daily-air-quailty.pdf) 的浓度精度与线性插值、[德国 UBA LQI](https://www.umweltbundesamt.de/themen/luft/luftqualitaet/der-luftqualitaetsindex-lqi) 的五项污染物、[香港环保署 AQHI 公式与分级](https://www.aqhi.gov.hk/en/what-is-aqhi/faqs.html)，以及加拿大政府托管的 [AQHI 技术说明](https://www2.gov.bc.ca/assets/gov/environment/air-land-water/air/reports-pub/aqhi-variation-bc.pdf)。对不能复核的研究阈值保留上游值，不宣称所有地区的官方认证。

正式发布使用 GitHub Actions 锁定依赖产物，构建提交、CI 链接和公共文件摘要记录于 [构建验证记录](loon-build-validation.json)。Loon 正式入口仍为 `.lpx`，旧 `.plugin` 与其同字节；运行脚本固定引用 `cache-v9`，不使用局域网地址。
