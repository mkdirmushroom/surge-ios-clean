# surge-ios-clean

一套面向个人 iPhone 的、可审计且自行维护的 Surge 去广告模块。

## 当前状态

- 目标环境：Surge iOS 5.20.0、iOS 26.5.2。
- 当前只发布 `candidate`，还没有可声明为可信稳定版的 `stable` 模块。
- 未包含代理节点、证书、Cookie、Token、设备 ID、订单、聊天或抓包原文。
- 手机不直接订阅第三方脚本；上游变化只会生成候选 PR。

## 安全原则

1. 每个 App 一个模块。
2. 优先使用专用广告域名，其次使用精确 URL Rewrite/Map Local。
3. JavaScript 必须是无网络、无持久化、无动态执行、无敏感日志的纯转换。
4. 支付、订单、聊天、认证、位置和设备控制接口默认禁止进入脚本或 MITM。
5. 所有候选必须经过静态检查、脱敏 fixture 测试和真实 iPhone 灰度，才能进入 `stable`。

## Candidate 模块

| 模块 | 当前范围 | 风险说明 |
|---|---|---|
| `alipay-domain.sgmodule` | 支付宝专用广告域名 | 无 MITM |
| `unionpay-domain.sgmodule` | 云闪付专用广告域名 | 无 MITM |
| `meituan-domain.sgmodule` | 美团/外卖专用广告域名 | 无 MITM |
| `hupu.sgmodule` | 虎扑广告域和明确广告接口 | 需要 iPhone 灰度 |
| `mihome.sgmodule` | 米家广告配置和开屏接口 | 不涉及设备控制；仍需灰度 |
| `taobao-instant.sgmodule` | 淘宝闪购首页弹窗模板 | 不拦截 AMDC 或 IP 段 |
| `damai.sgmodule` | 大麦 popup/welcome 接口 | 不涉及购票、订单、实名或支付 |
| `xiachufang.sgmodule` | 下厨房专用广告接口 | 不使用图片目录猜测 |
| `china-telecom.sgmodule` | 中国电信广告域和开屏接口 | 不屏蔽更新、登录和业务接口 |

candidate 原始地址格式：

```text
https://raw.githubusercontent.com/mkdirmushroom/surge-ios-clean/main/dist/candidate/<module>.sgmodule
```

暂时不要在主力手机一次性启用全部 candidate。建议每次只灰度一个模块，并观察 24–48 小时。

## 本地验证

本项目没有第三方运行时依赖，使用 Node.js 内置模块：

```bash
npm run build
npm run audit
npm test
npm run check:surge
```

`npm run build` 会生成：

- `dist/candidate/`：全部候选模块；
- `dist/stable/`：只包含 `release/stable.json` 人工批准的模块；
- `dist/*/manifest.json`：SHA-256 内容清单。

`npm run check:surge` 使用本机 Surge 的 `surge-cli --check`。检查器会在临时副本里补上完整配置要求的 `FINAL,DIRECT`，不会修改源模块。

## 自动更新

`.github/workflows/upstream-watch.yml` 每天检查锁定的上游 commit。发生变化时只创建 draft PR，不会自动把第三方 JavaScript、MITM 或 Rewrite 发布到手机。

Surge 可以通过 URL 更新模块，但本项目的手机端只应订阅 `dist/stable`。candidate 用于人工灰度。

## 许可证与来源

本仓库采用 GPL-3.0。候选来源、commit、许可证和采用策略记录在 [`provenance/sources.json`](provenance/sources.json)。没有明确许可证的仓库仅作行为参考，不直接复制代码。
