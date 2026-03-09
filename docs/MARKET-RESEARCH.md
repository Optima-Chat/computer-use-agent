# Computer Use Agent 商业化产品调研

**日期**: 2026-03-09

---

## 大厂产品

| 产品 | 公司 | 定价 | 特点 |
|------|------|------|------|
| Operator / ChatGPT Agent | OpenAI | Plus $20/月, Pro $200/月 | CUA 模型，已整合进 ChatGPT agent mode。OSWorld: 初代 38.1%, GPT-5.4 达 75%（超人类 72.4%） |
| ChatGPT Atlas | OpenAI | 同上 | 2025.10 推出的 agentic 浏览器，集成在 ChatGPT 内 |
| Project Mariner | Google | AI Ultra 订阅 | Gemini 2.0 驱动，Chrome 扩展形式，WebVoyager 83.5%。企业 API 预计 2026 Q1 |
| Copilot Studio CUA | Microsoft | 企业订阅 | 2025 年预览（04 首次预览，09 公共预览），面向企业 UI 自动化，替代传统 RPA |
| Edge Copilot Mode | Microsoft | 免费 | 2025.10 内置到 Windows Edge，免费 agentic 浏览器 |
| Computer | Perplexity | Max $200/月 | 2026.02.25 发布，协调 19 个模型执行复杂后台工作流，每任务按 credit 消耗 |
| Comet | Perplexity | Pro $20/月 | 2025.07 推出的 agentic 浏览器 |
| Claude Computer Use | Anthropic | API 按量计费 | 仅提供 API，需自建环境。2026.02 收购 Vercept，可能是为了产品化 |
| Adept (ACT-2) | Amazon (原 Adept) | 企业 | 最早做 computer use，2024 核心团队被 Amazon 挖走并授权技术，Amazon AGI SF Lab 继续开发 |

---

## 创业公司

| 产品 | 定位 | 状态 |
|------|------|------|
| Vercept (Vy) | 云端 MacBook computer use agent | 2026.02 被 Anthropic 收购（$50M 融资），3/25 关停产品 |
| Browser Use | 开源浏览器 agent 框架，WebVoyager 89.1% | 78K+ GitHub stars，Fortune 500 在用，YC 孵化 |
| Cua | 开源 computer use 基础设施，macOS/Linux/Windows 沙箱 | YC 孵化，类比"Docker for CUA"，支持多 LLM 后端 |
| MultiOn | Web 自动化 API 平台，跨网站多步骤任务 | 运营中，开发者导向 |
| Skyvern | 浏览器自动化（非桌面），LLM + CV 驱动，处理 CAPTCHA/动态内容 | 运营中，开源 |

---

## 传统 RPA 转型

UiPath、Automation Anywhere 等传统 RPA 巨头都在集成 AI agent 能力，从"按规则自动化"转向"AI 理解屏幕并操作"。

---

## 路线对比

```
┌──────────────────────────────────────────────────────────────────────┐
│                     Computer Use Agent 全景图                        │
├────────────────┬────────────────┬──────────────┬─────────────────────┤
│   to-C 产品     │  Agentic 浏览器  │  企业 RPA     │   API / 开源基础设施  │
├────────────────┼────────────────┼──────────────┼─────────────────────┤
│ OpenAI         │ ChatGPT Atlas  │ Microsoft    │ Anthropic           │
│ Operator →     │ Google Mariner │ Copilot      │ Computer Use API    │
│ ChatGPT Agent  │ Perplexity     │ Studio CUA   │ + 收购 Vercept      │
│                │ Comet          │              │                     │
│ Perplexity     │ Edge Copilot   │ UiPath       │ 开源                │
│ Computer       │ Mode (免费)    │ Automation   │ Browser Use (78K⭐) │
│ ($200/月)      │                │ Anywhere     │ Cua (YC)            │
├────────────────┼────────────────┼──────────────┼─────────────────────┤
│ Amazon/Adept   │                │              │ MultiOn / Skyvern   │
│ (ACT-2, 企业)  │                │              │                     │
└────────────────┴────────────────┴──────────────┴─────────────────────┘
```

---

## 关键结论

1. **赛道快速进化** — OpenAI CUA 从初代 38.1% 到 GPT-5.4 的 75%（超人类基线 72.4%），半年内翻倍
2. **四条路线并行** — to-C 产品（OpenAI）、agentic 浏览器（Google/Perplexity）、企业 RPA（Microsoft）、API + 开源（Anthropic/Browser Use/Cua）
3. **大厂全面入场** — OpenAI、Google、Microsoft、Anthropic、Amazon(Adept)、Perplexity 六家全部布局
4. **Anthropic 在加速** — 收购 Vercept（云端 Mac agent），可能要从纯 API 走向产品化
5. **开源生态爆发** — Browser Use（78K stars）、Cua 等开源项目快速增长，降低了 computer use 的门槛
6. **传统 RPA 被颠覆** — AI agent 直接看屏幕操作，不再需要预先定义规则和选择器
7. **定价模式未定** — 从免费（Edge）到 $200/月（Perplexity Max）不等，API 按 token 计费

---

## 参考链接

- [OpenAI Introducing Operator](https://openai.com/index/introducing-operator/)
- [OpenAI Computer-Using Agent](https://openai.com/index/computer-using-agent/)
- [Google Project Mariner](https://deepmind.google/models/project-mariner/)
- [Microsoft Copilot Studio CUA](https://www.microsoft.com/en-us/microsoft-copilot/blog/copilot-studio/announcing-computer-use-microsoft-copilot-studio-ui-automation/)
- [Perplexity Computer (VentureBeat)](https://venturebeat.com/technology/perplexity-launches-computer-ai-agent-that-coordinates-19-models-priced-at)
- [Anthropic acquires Vercept (TechCrunch)](https://techcrunch.com/2026/02/25/anthropic-acquires-vercept-ai-startup-agents-computer-use-founders-investors/)
- [Anthropic Computer Use API Docs](https://docs.anthropic.com/en/docs/build-with-claude/computer-use)
- [Amazon hires Adept founders (TechCrunch)](https://techcrunch.com/2024/06/28/amazon-hires-founders-away-from-ai-startup-adept/)
- [Browser Use (YC)](https://www.ycombinator.com/companies/browser-use)
- [Cua - Computer Use Agent Platform (YC)](https://www.ycombinator.com/companies/cua)
