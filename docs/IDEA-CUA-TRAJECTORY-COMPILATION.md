# Research Idea: CUA Trajectory Compilation

**日期**: 2026-03-11
**状态**: ❌ 已验证 — 核心 idea 不新，已有多个实现

---

## 一句话

CUA 自动生成可复用的 workflow，后续执行直接重放，LLM 只在异常时介入。将 CUA 单任务成本从 $5 降到 $0.05。

## 动机

CUA 当前的核心问题是**成本太高**（$1-5/任务）。但在实际商业场景中（如电商平台 Optima），大量 CUA 任务是**重复的**：

- 1000 个商户都要在 Shopify 上架商品 → 操作路径 90% 相同
- 每天都要从竞品网站抓取价格 → 同一个页面同一套操作
- 批量处理物流后台订单 → 流程固定

当前做法：每次都走完整的 LLM 推理循环（截图→推理→执行×N），成本和延迟不可接受。

## 核心思想

```
Phase 1: Full CUA（发现阶段）
  LLM 看截图 → 决定操作 → 执行 → 截图 → ... → 完成
  记录完整轨迹：[(screenshot_1, action_1), (screenshot_2, action_2), ...]
  成本: $5, 延迟: 2分钟, LLM 调用: 20次

Phase 2: Compile（编译阶段）
  从成功轨迹中提取：
  - 操作序列（点击坐标/输入文本/快捷键）
  - UI 状态检查点（关键元素的视觉/DOM 特征）
  - 参数化变量（商品名、价格等可替换字段）
  → 生成 Workflow Template

Phase 3: Replay（重放阶段）
  按 template 直接执行，每步做轻量级 UI 状态验证：
  - 匹配 → 直接执行下一步（无需 LLM）
  - 不匹配 → 回退到 LLM 处理当前步骤
  成本: $0.05, 延迟: 5秒, LLM 调用: 0-2次
```

## 与已有工作的关系

| 方法 | 灵活性 | 成本 | 可靠性 | 问题 |
|------|--------|------|--------|------|
| 传统 RPA (UiPath) | 低 | 低 | 高但脆弱 | 人工编程，UI 变了就废 |
| 纯 CUA (Claude/GPT) | 高 | 极高 | 中 (75%) | 每次完整推理，重复浪费 |
| **Compiled CUA** | **高** | **低** | **高** | 本工作 |

**关键差异**：
- vs RPA: 不需要人工编程，CUA 自动发现 workflow；遇 UI 变化有 LLM 兜底
- vs 纯 CUA: 重复任务不重复推理，10-100x 成本降低
- vs Agent workflow learning: 不是学一个通用 policy，而是编译具体轨迹为确定性脚本

## 系统贡献（适合系统顶会）

1. **轨迹记录与编译框架** — 从 LLM-guided CUA 轨迹中提取可复用 workflow template
2. **自适应执行引擎** — compiled workflow + LLM fallback 的混合执行机制
3. **轨迹缓存与索引** — 按任务类型/UI 状态索引，支持跨用户复用（CUA 的 CDN）
4. **调度策略** — compiled vs full CUA 的动态选择

## 商业价值

对 Optima AI（AI 原生电商平台）：
- 当前 60+ MCP 工具需要逐个开发集成 → CUA + compilation 可以自动生成大部分集成
- 平台迁移（一键搬家）：第一个商户用 full CUA，后续商户用 compiled workflow
- 无 API 服务集成：CUA 操作一次，编译为可重复的自动化脚本

## 预期结果

| 指标 | Full CUA | Compiled CUA | 改善 |
|------|----------|-------------|------|
| 单任务成本 | $1-5 | $0.01-0.1 | 10-100x |
| 单任务延迟 | 1-5 min | 5-30 sec | 10-20x |
| 成功率 | 75% | ≥75%（可重试） | 持平或提升 |
| LLM 调用次数 | 15-30 | 0-3 | 10x |

## 目标会议

EuroSys / MLSys / ATC 2027

## 验证结果（2026-03-11）

### 结论：核心 idea 不新

"CUA 执行 → 编译为脚本 → 无 LLM 重放 + 异常回退"这个 pattern 已有多个实现。

### 已有实现（直接竞争）

| 项目 | 做了什么 | 效果 | 局限 |
|------|---------|------|------|
| **Skyvern** (商业产品) | CUA 执行一次 → 编译为 Playwright 脚本 → 无 LLM 重放 + 失败回退到 LLM | 2.7x 降本, 2.3x 加速 | 仅浏览器 |
| **browser-use/workflow-use** (开源) | 录制 agent 会话 → LLM 转为确定性脚本（含 AI 步骤） → 重放 | 自称 10x 加速, 90% 降本 | 仅浏览器 |
| **Cua/trycua** (开源, YC) | 录制演示 → 存为 skill (SKILL.md + trajectory.json) → 指导后续 agent | LLM 仍在循环中 | 指导而非编译 |

### 相关学术工作

| 论文 | 会议 | 做了什么 | 与我们的差异 |
|------|------|---------|------------|
| **Agentic Plan Caching (APC)** | NeurIPS 2025 | 缓存 agent 计划模板，轻量 LLM 适配复用 | 50% 降本，仍需 LLM |
| **Agent Workflow Memory (AWM)** | arXiv 2409.07429 | 从轨迹提取 workflow 模式增强 prompt | LLM 仍在循环中 |
| **CUA-Skill** | arXiv 2601.21123 | 手工构建参数化 skill 库，运行时 LLM 编排 | 非自动编译 |
| **LearnAct** | arXiv 2504.13805 | 单次演示提升 mobile GUI agent 性能 | 用于指导而非替代 LLM |
| **AgentTrek** | ICLR 2025 | 从教程合成轨迹作为训练数据 | 目标是训练而非运行时复用 |

### 工业界

- **Microsoft Power Automate "Record with Copilot"**: 录制人类演示 → AI 转为自动化流程（从人类录制，非从 CUA 录制）
- **UiPath Autopilot**: NL → RPA workflow（从文本描述，非从 CUA 轨迹）

### 可能仍有空间的差异化角度

1. **全桌面 CUA 编译**（非仅浏览器）— Skyvern/workflow-use 只做 browser，桌面 GUI 更难
2. **跨应用轨迹编译** — 浏览器 + 桌面应用 + 文件系统的复合任务
3. **编译质量研究** — Skyvern 只报了 2.7x 降本，远低于理论上限，瓶颈在哪？
4. **置信度回退机制** — 用视觉相似度判断何时从编译模式回退到 LLM

### 判断

核心 pattern 已被占据，仅做 incremental 改进（如扩展到桌面）不足以撑顶会论文。**建议换方向。**
