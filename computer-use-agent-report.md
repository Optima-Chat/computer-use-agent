# Computer Use Agent 调研报告

> 调研日期：2026-03-08

## 一、什么是 Computer Use？

Anthropic 的 **Computer Use** 是一种让 Claude 像人一样操控电脑的能力——通过截屏看屏幕、移动光标、点击按钮、输入文字。2024 年 10 月随 Claude 3.5 Sonnet 发布，是**首个提供桌面自主控制的前沿 AI 模型**。

> **注意区分**：OpenAI 的产品叫 "CUA (Computer-Using Agent)"，Anthropic 的官方名称是 "Computer Use"。

---

## 二、工作原理

### 核心机制：基于截图的"翻页书"方式

```
用户提供指令 + 声明 computer use 工具
        ↓
Claude 分析屏幕截图，决定执行什么操作
        ↓
你的应用执行操作（点击/输入等），截图返回给 Claude
        ↓
Claude 分析新截图：
  → 任务未完成 → 继续循环
  → 任务完成 → 返回文本响应
```

Claude 通过**精确计算像素坐标**来定位点击位置。关键：Claude 不直接连接计算环境，你的应用充当中间人。

### 架构图

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   用户指令   │────▶│   Agent Loop     │────▶│   计算环境           │
│             │     │  (你的应用)       │     │  (Docker/VM)        │
│             │     │                  │     │                     │
│             │     │  1. 发送截图给    │◀────│  - 虚拟显示器(Xvfb)  │
│             │     │     Claude API   │     │  - 桌面环境(Mutter)  │
│             │     │  2. 接收操作指令  │────▶│  - 应用程序          │
│             │     │  3. 执行操作      │     │  - 浏览器/终端       │
│             │     │  4. 截图返回      │◀────│                     │
│             │◀────│  5. 循环直到完成  │     │                     │
└─────────────┘     └──────────────────┘     └─────────────────────┘
```

### 配套工具

| 工具 | 说明 |
|------|------|
| `computer_20251124` | 最新版本，支持 zoom 区域放大 |
| `bash_20250124` | 执行系统命令 |
| `text_editor_20250728` | 直接编辑文件 |

### 支持的操作

- **基础**：`screenshot`, `left_click`, `type`, `key`, `mouse_move`
- **增强**：`scroll`, `right_click`, `double_click`, `drag`, `hold_key`, `wait`
- **最新**：`zoom`（区域放大查看，提高精度）

---

## 三、支持的模型

| 模型 | 工具版本 | Beta Header |
|------|---------|-------------|
| Claude Opus 4.6, Sonnet 4.6, Opus 4.5 | `computer_20251124` | `computer-use-2025-11-24` |
| Sonnet 4.5, Haiku 4.5, Sonnet 4, Sonnet 3.7 | `computer_20250124` | `computer-use-2025-01-24` |

### API 调用示例

```python
import anthropic

client = anthropic.Anthropic()
response = client.beta.messages.create(
    model="claude-opus-4-6",
    max_tokens=1024,
    tools=[
        {
            "type": "computer_20251124",
            "name": "computer",
            "display_width_px": 1024,
            "display_height_px": 768,
            "display_number": 1,
        },
        {"type": "bash_20250124", "name": "bash"},
    ],
    messages=[{"role": "user", "content": "打开浏览器搜索天气"}],
    betas=["computer-use-2025-11-24"],
)
```

**可用平台**：Anthropic API、Amazon Bedrock、Google Vertex AI

**SDK 支持**：Python, TypeScript, C#, Go, Java, PHP, Ruby

---

## 四、竞品对比

### Anthropic vs OpenAI vs Google

| 维度 | Anthropic Computer Use | OpenAI CUA / Operator | Google Project Mariner |
|------|----------------------|----------------------|----------------------|
| **范围** | 桌面全局（原生应用+浏览器+终端） | 仅浏览器 | 仅 Chrome 浏览器 |
| **环境** | 自建 Docker/VM | OpenAI 云端虚拟浏览器 | 云端 VM |
| **设置难度** | 需要技术能力 | 零配置（消费者友好） | Chrome 扩展 |
| **定价** | 按 token 付费 | $200/月 ChatGPT Pro | Gemini 订阅 |
| **OSWorld 基准** | ~72.5% | 38.1% | - |
| **WebVoyager 基准** | 56% | 87% | 83.5% |
| **并行任务** | 单任务 | 单任务 | 最多 10 个 |
| **可用地区** | 全球 | 仅美国（初期） | 全球 |

```
                        能力范围对比
  ┌──────────────────────────────────────────────┐
  │                                              │
  │  Anthropic Computer Use                      │
  │  ┌────────────────────────────────────────┐  │
  │  │  桌面应用 + 终端 + 文件系统            │  │
  │  │  ┌──────────────────────────────────┐  │  │
  │  │  │  浏览器操作                       │  │  │
  │  │  │  (OpenAI CUA & Google Mariner    │  │  │
  │  │  │   也覆盖此范围)                   │  │  │
  │  │  └──────────────────────────────────┘  │  │
  │  └────────────────────────────────────────┘  │
  └──────────────────────────────────────────────┘
```

**关键差异**：Anthropic 是唯一支持**完整桌面控制**的方案（不仅限浏览器），但纯 Web 场景下 OpenAI 和 Google 表现更好。

### 开源方案：trycua/cua

- GitHub: https://github.com/trycua/cua
- 支持 macOS、Linux、Windows 沙箱
- Apple Silicon 上近原生 VM 性能
- MIT 开源

---

## 五、性能演进

```
OSWorld 基准得分
100% ┬─────────────────────────────────────────────────
     │                                     人类水平
 75% ┤─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─●─ ─ ─ ─ ─  (70-75%)
     │                               ●
 60% ┤                          ●        Claude Opus 4.5/4.6
     │                   Claude 4.5 Sonnet   72.5%
 50% ┤                       60%+
     │
 40% ┤              ● OpenAI CUA (Operator)
     │                    38.1%
 25% ┤
     │
 15% ┤  ●
     │  Claude 3.5 Sonnet
  0% ┴──┬──14.9%─┬──────┬──────┬──────┬──────────────
     2024.10  2025.Q1  2025.Q3  2026.Q1
```

> **说明**：除 OpenAI CUA 为竞品对比外，其余三个点均为 Anthropic Computer Use，
> 展示底层模型从 Claude 3.5 → 4.5 → 4.6 升级带来的性能提升。

---

## 六、当前状态

**仍为 Beta**（截至 2026 年 3 月）

- API 调用需要 beta header
- 不支持 Zero Data Retention (ZDR)
- 无公开 GA 日期

### Claude Cowork（消费级产品）

2026 年 1 月发布的研究预览版，基于 Computer Use 技术：
- 封装在 Claude Desktop GUI 中，无需编码
- 支持 macOS 和 Windows
- 可连接 Google Drive、Gmail、DocuSign 等服务
- 覆盖约 70% 桌面计算市场

---

## 七、费用考虑

### API 定价

| 模型 | 输入 (每百万 token) | 输出 (每百万 token) |
|------|-------------------|-------------------|
| Haiku 4.5 | $1 | $5 |
| Sonnet 4.5 | $3 | $15 |
| Opus 4.5 | $5 | $25 |

### 额外开销

- Computer use beta 系统提示增加 ~466-499 tokens
- 每张截图按图片 token 计算（与分辨率相关）
- 一次任务可能涉及**数十张截图**，成本远高于纯文本调用

### 优化策略

| 策略 | 节省幅度 | 说明 |
|------|---------|------|
| Prompt Caching | 最高 90% | 缓存重复上下文 |
| Batch API | 50% | 非实时任务批处理 |
| 降低分辨率 | 显著 | 使用 1024x768 而非更高分辨率 |
| 迭代上限 | 防失控 | 设置 `max_iterations` |

---

## 八、最佳实践与局限

### 最佳实践

1. **沙箱运行** — Docker 容器或 VM，最小权限
2. **限制数据访问** — 不暴露敏感凭据
3. **限制网络** — 域名白名单
4. **人工确认关键操作** — 金融交易、登录、条款接受
5. **每步截图验证** — 提示词加入 "每步后截图确认结果"
6. **优先用键盘快捷键** — 比鼠标操作更可靠（尤其是下拉菜单、滚动条）
7. **设置迭代上限** — 防止无限循环和成本失控

### 已知局限

| 局限 | 影响程度 | 说明 |
|------|---------|------|
| 复杂 UI 操作不稳定 | 高 | 滚动、拖拽、手势仍有挑战 |
| 动态界面易出错 | 高 | 弹窗、覆盖层、快速变化内容 |
| Prompt Injection 风险 | 中 | 屏幕恶意内容可能影响行为 |
| 速度比人慢 | 中 | 延迟明显 |
| 不支持 ZDR | 中 | Beta 功能不适用零数据保留 |
| Token 消耗高 | 中 | 截图处理成本高 |

### 安全风险

- **Prompt injection**：网站或图片中的恶意内容可能覆盖指令
- **滥用潜力**：自主计算机控制可能被用于恶意目的
- 当前评估为 **AI Safety Level 2 (ASL-2)**

---

## 九、实际应用场景

### 企业生产部署

| 企业 | 应用 | 效果 |
|------|------|------|
| **Spotify** | 代码迁移 | 工程时间减少 90%，每月 650+ AI 代码变更 |
| **Novo Nordisk** | NovoScribe 药品监管文档 | 自动化监管文档生成 |
| **Replit** | 应用构建评估 | UI 导航+视觉验证 |
| **Thomson Reuters** | 关键工作流 | Amazon Bedrock 上的 Claude Agent |

### 典型场景分类

```
┌─────────────────────────────────────────────────────┐
│                Computer Use 应用场景                 │
├──────────────────┬──────────────────────────────────┤
│  软件开发与测试   │  • 自动化 UI 测试                 │
│                  │  • 跨应用工作流（IDE+浏览器+终端）  │
│                  │  • 代码迁移与视觉验证              │
├──────────────────┼──────────────────────────────────┤
│  业务流程自动化   │  • 多系统表单填写与数据录入        │
│                  │  • 文档处理与报告生成              │
│                  │  • 跨系统数据同步                  │
├──────────────────┼──────────────────────────────────┤
│  系统管理        │  • 终端服务器管理                  │
│                  │  • 配置管理                       │
│                  │  • 监控仪表盘交互                  │
├──────────────────┼──────────────────────────────────┤
│  个人生产力       │  • 文件整理与重命名               │
│  (Claude Cowork) │  • 收据截图转费用表格             │
│                  │  • 笔记生成报告                   │
└──────────────────┴──────────────────────────────────┘
```

---

## 十、关键链接

### 官方资源

| 资源 | 链接 |
|------|------|
| 官方文档 | https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool |
| 参考实现 | https://github.com/anthropics/anthropic-quickstarts/tree/main/computer-use-demo |
| 开发博客 | https://www.anthropic.com/news/developing-computer-use |
| Claude Cowork | https://claude.com/blog/cowork-research-preview |
| 定价页面 | https://platform.claude.com/docs/en/about-claude/pricing |
| 构建高效 Agent | https://www.anthropic.com/research/building-effective-agents |

### 第三方资源

| 资源 | 链接 |
|------|------|
| 竞品对比（WorkOS） | https://workos.com/blog/anthropics-computer-use-versus-openais-computer-using-agent-cua |
| 开源替代 trycua | https://github.com/trycua/cua |
| Web Agent 对比（Helicone） | https://www.helicone.ai/blog/browser-use-vs-computer-use-vs-operator |
| OpenAI CUA 示例 | https://github.com/openai/openai-cua-sample-app |

---

## 总结

Anthropic Computer Use 的核心优势是**桌面全局控制**（不限于浏览器），适合企业级复杂自动化场景。劣势是设置门槛高、纯 Web 场景不如 OpenAI/Google、仍在 Beta 且成本较高。随着 Claude Cowork 的推出，Anthropic 正在将这一能力从开发者工具扩展为消费级产品。

**选型建议**：
- 需要操控桌面应用（IDE、Office、终端）→ **Anthropic Computer Use**
- 纯 Web 自动化、追求易用性 → **OpenAI Operator**
- 需要并行处理多任务 → **Google Project Mariner**
- 需要自托管、完全控制 → **trycua/cua（开源）**
