# Computer Use Agent 商业化产品调研

**日期**: 2026-03-09

---

## 大厂产品

| 产品 | 公司 | 定价 | 特点 |
|------|------|------|------|
| Operator / ChatGPT Agent | OpenAI | Plus $20/月, Pro $200/月 | CUA 模型，已整合进 ChatGPT agent mode，主要做 Web 任务。OSWorld: 初代 38.1%, GPT-5.4 达 75%（超人类 72.4%） |
| Copilot Studio CUA | Microsoft | 企业订阅 | 2025 年预览（04 首次预览，09 公共预览），面向企业 UI 自动化，替代传统 RPA，操作 Web + 桌面应用 |
| Computer | Perplexity | Max $200/月 | 2026.02.25 发布，协调 19 个模型执行复杂后台工作流，每任务按 credit 消耗 |
| Claude Computer Use | Anthropic | API 按量计费 | 仅提供 API，需自建环境。2026.02 收购 Vercept，可能是为了产品化 |

---

## 创业公司

| 产品 | 定位 | 状态 |
|------|------|------|
| Vercept (Vy) | 云端 MacBook computer use agent | 2026.02 被 Anthropic 收购（$50M 融资），3/25 关停产品 |
| MultiOn | Web 自动化 API 平台，跨网站多步骤任务 | 运营中，开发者导向 |
| Skyvern | 浏览器自动化（非桌面），LLM + CV 驱动，处理 CAPTCHA/动态内容 | 运营中，开源 |

---

## 传统 RPA 转型

UiPath、Automation Anywhere 等传统 RPA 巨头都在集成 AI agent 能力，从"按规则自动化"转向"AI 理解屏幕并操作"。

---

## 路线对比

```
┌─────────────────────────────────────────────────────────────┐
│                   Computer Use Agent 路线图                  │
├──────────────┬──────────────┬───────────────────────────────┤
│   to-C 产品   │   企业 RPA    │         API 平台              │
├──────────────┼──────────────┼───────────────────────────────┤
│ OpenAI       │ Microsoft    │ Anthropic                     │
│ Operator →   │ Copilot      │ Computer Use API              │
│ ChatGPT      │ Studio CUA   │ + 收购 Vercept                │
│ Agent Mode   │              │                               │
├──────────────┼──────────────┼───────────────────────────────┤
│ Perplexity   │ UiPath       │ 创业公司                       │
│ Computer     │ Automation   │ MultiOn / Skyvern             │
│ ($200/月)    │ Anywhere     │                               │
└──────────────┴──────────────┴───────────────────────────────┘
```

---

## 关键结论

1. **赛道快速进化** — OpenAI CUA 从初代 38.1% 到 GPT-5.4 的 75%（超人类基线 72.4%），半年内翻倍，但各大厂仍在押注
2. **三条路线并行** — OpenAI 走 to-C（Operator），Microsoft 走企业 RPA 替代，Anthropic 走 API + 收购
3. **Anthropic 在加速** — 收购 Vercept（云端 Mac agent），可能要从纯 API 走向产品化
4. **传统 RPA 被颠覆** — AI agent 直接看屏幕操作，不再需要预先定义规则和选择器
5. **定价模式未定** — 从 $20/月（OpenAI Plus）到 $200/月（Perplexity Max）不等，API 按 token 计费

---

## 参考链接

- [OpenAI Introducing Operator](https://openai.com/index/introducing-operator/)
- [OpenAI Computer-Using Agent](https://openai.com/index/computer-using-agent/)
- [Microsoft Copilot Studio CUA](https://www.microsoft.com/en-us/microsoft-copilot/blog/copilot-studio/announcing-computer-use-microsoft-copilot-studio-ui-automation/)
- [Perplexity Computer (VentureBeat)](https://venturebeat.com/technology/perplexity-launches-computer-ai-agent-that-coordinates-19-models-priced-at)
- [Anthropic acquires Vercept (TechCrunch)](https://techcrunch.com/2026/02/25/anthropic-acquires-vercept-ai-startup-agents-computer-use-founders-investors/)
- [Anthropic Computer Use API Docs](https://docs.anthropic.com/en/docs/build-with-claude/computer-use)
