# 研究计划：CUA Workload Characterization & System Optimization

**目标会议**: MLSys 2027 (截稿 ~2026.10) 或 EuroSys 2027 (截稿 ~2026.10)
**时间线**: 2026.03 → 2026.09（6 个月）

---

## 论文定位

**Title (暂定)**: *Dissecting Computer Use Agents: A Workload Characterization and System-Level Optimization*

**一句话**: 首篇对 CUA workload 的全面系统分析，揭示推理-执行交互中的瓶颈，并提出针对性优化。

**论文结构**:
```
§1 Introduction: CUA 是新型 VLM workload，与传统 LLM serving 本质不同
§2 Background & Motivation: CUA pipeline 分解，现有系统的局限
§3 Characterization Methodology: 369 任务 × 多模型 × 多环境的实验设计
§4 Workload Analysis: 六维分析（下文详述）
§5 Insight-Driven Optimization: 基于分析结果的 1-2 个系统优化
§6 Evaluation: 优化效果（延迟/吞吐/成本改进）
§7 Related Work
§8 Conclusion
```

---

## Phase 1: 基础设施搭建（3-4 周）

### 1.1 集成 OSWorld（第 1-2 周）

OSWorld 是 Python 生态（Gym-style），我们的 agent 是 Bun/TS。两种路径：

**方案 A（推荐）: Python adapter 包装我们的 agent**
```
OSWorld (Python)                    Our Agent (Bun/TS)
┌─────────────┐                    ┌──────────────────┐
│ DesktopEnv   │ ── screenshot ──▶ │ HTTP bridge       │
│ (VM管理)     │ ◀── pyautogui ── │ (接收截图,返回动作) │
│ evaluator    │                   │ → Anthropic API   │
└─────────────┘                    └──────────────────┘
```

- 写一个 Python agent class 实现 OSWorld 的 `predict(instruction, obs)` 接口
- 内部通过 HTTP 调用我们的 Bun agent，或直接用 Python Anthropic SDK
- 好处：直接用 OSWorld 的 VM 管理和评测体系，结果可比较

**方案 B: 提取 OSWorld 任务到我们的框架**
- 解析 OSWorld JSON 任务定义，适配到我们的 Task 接口
- 需要自己实现评测逻辑
- 好处：完全控制 profiling 粒度

**决策**: 先走方案 A 跑通 baseline，再按需迁移到方案 B 做深度 profiling。

### 1.2 增强 Profiling 框架（第 2-3 周）

当前 profiling 已有基础（`IterationProfile`），需要扩展：

```typescript
interface DetailedProfile {
  // 已有
  inferenceMs: number;
  toolExecutionMs: number;

  // 新增：推理侧细分
  inference: {
    networkRoundTripMs: number;   // 纯网络延迟（TCP RTT）
    queueWaitMs: number;          // API 排队时间（从 header 获取）
    prefillMs: number;            // prompt 处理时间
    decodeMs: number;             // token 生成时间
    inputTokens: number;
    outputTokens: number;
    cacheHitTokens: number;       // prompt cache 命中
    imageTokens: number;          // 截图占的 token 数
    textTokens: number;           // 文本占的 token 数
  };

  // 新增：执行侧细分
  execution: {
    screenshotCaptureMs: number;  // scrot 截图耗时
    screenshotEncodeMs: number;   // base64 编码耗时
    screenshotTransferMs: number; // docker cp / pipe 传输耗时
    screenshotBytes: number;      // 原始 PNG 大小
    guiActionMs: number;          // xdotool 执行耗时
    uiRenderWaitMs: number;       // UI 渲染等待（动画/加载）
    bashExecMs: number;           // bash 命令执行耗时
  };

  // 新增：上下文增长
  context: {
    totalTokens: number;          // 累计上下文长度
    imageCount: number;           // 累计截图数量
    imageTokenRatio: number;      // 图像 token / 总 token
  };
}
```

### 1.3 本地模型部署（第 3-4 周）

论文需要对比远程 API vs 本地部署，体现不同场景下的瓶颈转移。

- **vLLM + Qwen2.5-VL-72B** 或 **SGLang + Qwen2.5-VL-7B**: 开源 VLM，支持 tool use
- **Fara-7B**: 专为 CUA 设计的 7B 模型
- 部署在 TACC 集群（iSING Lab 的 160+ GPU）

```
对比矩阵:
                    远程 API          本地部署 (A100)     本地部署 (消费级)
Claude Opus 4.6      ✅ (已有)          ❌ (闭源)           ❌
Claude Sonnet 4.6    ✅ (已有)          ❌ (闭源)           ❌
GPT-4o CUA           ✅ (新增)          ❌ (闭源)           ❌
Qwen2.5-VL-72B       ❌                 ✅ (新增)           ❌
Qwen2.5-VL-7B        ❌                 ✅ (新增)           ✅ (新增)
UI-TARS-72B          ❌                 ✅ (新增)           ❌
```

---

## Phase 2: 大规模 Characterization（6-8 周）

### 2.1 六维分析框架

这是论文的核心贡献之一——定义 CUA workload 的分析维度：

#### D1: 延迟分解 (Latency Breakdown)
- 每轮迭代：推理 vs 截图 vs 执行 vs 等待，占比如何？
- 远程 API vs 本地部署：瓶颈从哪里转移到哪里？
- 不同任务类型（终端/GUI/浏览器/多应用）的分布差异

#### D2: Token 经济学 (Token Economics)
- 图像 token vs 文本 token 的比例随迭代如何变化？
- 截图的信息密度：大部分截图是否重复/冗余？
- 不同分辨率下的 token 成本 vs 任务成功率曲线

#### D3: 上下文增长模式 (Context Growth Pattern)
- CUA 的上下文增长比纯文本 agent 快多少？
- 什么时候触发 context window 上限？对任务成功率的影响？
- KV Cache 中的冗余度（连续截图的相似度分析）

#### D4: 任务异构性 (Task Heterogeneity)
- 369 个 OSWorld 任务的资源需求分布（迭代数/token/时间）
- 任务类型聚类：终端、单应用 GUI、多应用、浏览器
- 异构性对调度和资源分配的影响

#### D5: 失败模式分析 (Failure Pattern Analysis)
- 失败任务的资源浪费（跑满 max_steps 才失败）
- 早停策略能节省多少？什么信号可以预测失败？
- 不同模型的失败模式差异

#### D6: 多 Agent 并发特征 (Concurrency Characteristics)
- 模拟 N 个 agent 并发：GPU 利用率曲线
- CUA 的推理间隙（等待截图+执行）能否被其他 agent 填充？
- 最优 agent:GPU 配比

### 2.2 实验规模

| 维度 | 规模 |
|------|------|
| 任务数 | 369 (OSWorld full) + 50 (自建补充) |
| 模型数 | 5-6 个（3 闭源 API + 2-3 开源本地） |
| 分辨率 | 3 档：768×576, 1024×768, 1920×1080 |
| 部署场景 | 远程 API, 本地 A100, 本地消费级 GPU |
| 总实验次数 | ~2000-3000 runs |
| 预估成本 | API: $500-1000, GPU: TACC 集群（免费） |

---

## Phase 3: Insight-Driven Optimization（4-6 周）

基于 Phase 2 的数据，选择 1-2 个优化方向。以下是预期 insight → 优化的映射：

### 候选优化 A: CUA-Aware KV Cache Management

**预期 insight**: 连续截图高度相似（90%+ 像素相同），但 KV Cache 重复存储。

**优化方案**:
```
标准 VLM KV Cache:
  [sys][img1][text1][img2][text2][img3][text3]...
  每张截图完整占 590 tokens

CUA-Aware Cache:
  [sys][img1][text1][Δimg2][text2][Δimg3][text3]...
  增量编码：只缓存变化区域的 KV
  预期压缩 3-5x（基于截图相似度分析）
```

**需要修改**: vLLM/SGLang 的 KV Cache 管理模块（本地部署场景）

### 候选优化 B: 自适应截图策略

**预期 insight**: 很多截图是不必要的（执行 bash 命令后不需要截图，但模型仍会请求）。

**优化方案**:
```
当前: 模型每轮决定是否截图（模型侧控制）
优化: 系统侧根据上一步动作类型 + UI 变化量决定是否需要截图

规则示例:
- bash 命令（无 GUI 输出）→ 跳过截图，直接返回 stdout
- GUI 点击后 < 100ms → 延迟截图等 UI 渲染完成
- 连续截图 SSIM > 0.95 → 告诉模型"屏幕无变化"，省掉图像 token
```

### 候选优化 C: 推理-执行 Pipeline Overlap

**预期 insight**: 本地部署时 VM 执行占 30%+，严格串行造成浪费。

**优化方案**:
```
当前（串行）:
  GPU:  [推理1].............[推理2]..............
  VM:   .........[截图][执行].........[截图][执行]

流水线:
  GPU:  [推理1]......[推理2]......[推理3]
  VM:   ......[截图][执行+预取]...[截图][执行+预取]
              ↑ overlap ↑
```

- 流式解码：模型生成 action token 后立即开始执行，不等完整响应
- 预取截图：执行完成后立即截图并开始编码，不等模型请求

---

## Phase 4: 论文撰写（3-4 周）

### 核心图表清单

| 图表 | 内容 | 位置 |
|------|------|------|
| Fig 1 | CUA pipeline 概览 + 与传统 LLM 对比 | §1 |
| Fig 2 | 单轮迭代延迟分解（stacked bar, 6 个模型） | §4.1 |
| Fig 3 | 远程 vs 本地部署的瓶颈转移（sankey/alluvial） | §4.1 |
| Fig 4 | Token 组成随迭代变化（area chart, 图像 vs 文本） | §4.2 |
| Fig 5 | 分辨率 vs 成功率 vs token 成本（pareto front） | §4.2 |
| Fig 6 | 上下文增长曲线（CUA vs text-only agent） | §4.3 |
| Fig 7 | 369 任务资源需求分布（scatter: 迭代 × token） | §4.4 |
| Fig 8 | 失败任务的资源浪费 + 早停信号分析 | §4.5 |
| Fig 9 | 多 agent 并发 GPU 利用率曲线 | §4.6 |
| Fig 10 | 优化效果对比（before/after） | §6 |
| Tab 1 | OSWorld 全量结果（对比 leaderboard） | §6 |

---

## 里程碑时间线

```
2026.03 ──────────────── Phase 1: 基础设施 ────────────────
  W1-2  OSWorld 集成 + baseline 跑通 (test_small 50 任务)
  W2-3  Profiling 框架增强
  W3-4  本地模型部署 (vLLM + Qwen2.5-VL)

2026.05 ──────────────── Phase 2: Characterization ────────
  W5-6  远程 API 全量实验 (Claude + GPT-4o × 369 任务)
  W7-8  本地部署实验 (Qwen × 369 任务)
  W9-10 分辨率 / 并发 / 失败模式实验
  W10-12 数据分析 + insight 提炼

2026.07 ──────────────── Phase 3: Optimization ────────────
  W13-14 选定优化方向 + 实现
  W15-16 优化效果评测
  W17-18 补充实验 + ablation study

2026.09 ──────────────── Phase 4: Writing ─────────────────
  W19-20 初稿
  W21-22 修改 + 内部 review
  W23    投稿 (目标 2026.10)
```

---

## 风险与缓解

| 风险 | 概率 | 缓解 |
|------|------|------|
| OSWorld 集成困难（VM 环境差异） | 中 | 先用 test_small 验证，备选方案 B |
| 本地模型效果太差（开源 VLM CUA 能力弱） | 中 | 重点分析闭源 API，开源作为补充对比 |
| Characterization 缺乏惊人 insight | 中 | 六维分析确保广度，至少有 2-3 个有趣发现 |
| API 成本超预算 | 低 | 先跑 test_small 估算，必要时减少分辨率/模型组合 |
| 优化效果不显著 | 中 | 准备多个候选优化，选效果最好的 |
| 竞争对手发类似工作 | 低 | CUA 系统分析这个角度目前几乎没人做 |

---

## 立即行动

**本周目标**: OSWorld 集成 + baseline 跑通

1. 安装 OSWorld，配置 Docker provider
2. 用 Python Anthropic SDK 写 agent adapter
3. 跑通 test_small (50 任务) 的 Claude Sonnet baseline
4. 验证 profiling 数据能采集到
