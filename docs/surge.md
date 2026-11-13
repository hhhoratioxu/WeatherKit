# Surge 版 WeatherKit

> 以下为 v3.3.5 的历史说明。当前 [v3.3.6](v3.3.6.md) 已按用户要求删除后加的 9 项控制，仅保留原有 12 项插件参数；不再使用响应短时缓存、合并、预算、冷却、额外统计、地区推断或备用来源查询。原生单请求超时仍按秒传给 Surge。

2026-11-08 按 Surge 官方 [模块](https://manual.nssurge.com/profile/module.html)、[脚本声明](https://manual.nssurge.com/scripting/overview.html)、[请求脚本](https://manual.nssurge.com/scripting/http-request.html)、[响应脚本](https://manual.nssurge.com/scripting/http-response.html) 和 [JavaScript API](https://manual.nssurge.com/scripting/api.html) 整理。使用独立原生模板，不将 Loon 条件语法或毫秒 HTTP 参数直接移入 Surge。

## 安装与设置

在 Surge 模块中安装仓库 Surge/script/iRingo.WeatherKit.sgmodule 的 Raw 地址并启用。名称与功能描述沿用原版；WeatherKit.sgmodule 为同内容兼容入口。模块只追加 weatherkit.apple.com，使用已有 MitM 证书。

模块参数表采用字母、数字与下划线名称。例如 Weather_Provider 对应原设置 Weather.Provider，AirQuality_Calculate_Algorithm 对应内置算法；脚本设置仍保留原来的点路径与含义。原版 12 项参数默认值保持，连同缓存、诊断、地区与明确开启的备用查询共 21 项。默认日志 WARN、运行统计关闭、备用查询关闭。

## 运行处理

402 字节的请求协商入口只为 HTTPS Apple v3 GET 与主天气 App 的 iOS/macOS User-Agent 设置 Accept: application/json；不读取正文、不访问存储、不联网。功能列表和空气质量标尺使用独立 JSC 入口。天气正文与预警详情明确使用 WebView，以使用官方 WebAPI；WebView 引擎需要 Surge iOS 5.9.0 / Mac 5.5.0 或更新版本。

v2 使用 binary-body-mode，v3 使用 JSON 文本。天气正文原生缓冲上限 4 MiB、功能列表 64 KiB；Surge 的响应 max-size 超限行为为跳过脚本并透传。脚本内部继续限制 JSON 字符数、向量、深度与节点。未修改、未知、失败、后台或未协商成功的 WK3 数据使用空结果透传，不把 WK3 二进制交给 WK2 schema。

供应商预算仍按毫秒记账，仅在 Surge 原生 HTTP 边界换算为秒；等待真实回调结束后单次完成。持久缓存、失败冷却、请求合并与容量边界沿用既有实现，诊断摘要不含令牌、地址或坐标。脚本无后台轮询、请求取消或提前结束网络任务。

## 证据范围

本地 Node v24.22.1：345 项回归、Loon 40 个压缩场景及 15 个规则检查、Surge 29 个压缩场景通过。场景包含原版默认值、实际模块参数、所有算法及 None、CO 单位、预警编号、详情缓存、失败回退、回调等待与一次完成。当前 Mac 未安装 Surge，未报告 Surge 原生或 iPhone VPN 验收；未测量设备电量或内存下降比例。
