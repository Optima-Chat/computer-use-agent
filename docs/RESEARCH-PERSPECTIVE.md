# Computer Use Agent：ML Systems 研究视角

**日期**: 2026-03-09
**实验室**: iSING Lab, HKUST CSE (Prof. Kai Chen)

---

## 实验室背景

iSING Lab 专注 **ML Systems + 数据中心网络**，核心能力：

- **AI 基础设施**: TACC 平台（160+ GPU），服务 HKUST 及研究社区
- **LLM Serving**: MFS (EuroSys 2026)、Tabi (EuroSys 2023) — 高效 LLM 推理系统
- **分布式训练**: MixNet (SIGCOMM 2025)、FuseLink (OSDI 2025) — GPU 通信与网络优化
- **资源调度**: GREEN (NSDI 2025) — ML 集群碳效率调度
- **发表级别**: SIGCOMM, OSDI, NSDI, EuroSys 等系统顶会

---

## Computer Use Agent 的系统研究机会

### 1. CUA Serving 系统优化

Computer Use Agent 的推理模式与传统 LLM 服务有本质不同：

```
传统 LLM:   用户 → 单次请求 → 响应
CUA:        用户 → [截图→推理→工具调用→截图→推理→...] × N 轮
```

**研究问题**:
- **长会话状态管理**: CUA 单任务可能 10-30 轮迭代，累积大量图文上下文，如何高效管理 KV Cache？
- **图文交替推理的 Serving 优化**: 每轮都有新截图（~590 tokens/张），如何做增量编码避免重复计算？
- **批处理困难**: CUA 请求是串行依赖的（上一步结果决定下一步），无法像普通 LLM 请求那样简单 batch

**与实验室能力的契合**: MFS 和 Tabi 已经在做 LLM Serving 优化，CUA 是一个有独特挑战的新 workload。

### 2. CUA 的资源调度与成本优化

从我们的 benchmark 数据：

| 任务类型 | 迭代数 | Tokens | 耗时 | 特点 |
|---------|--------|--------|------|------|
| 终端任务 | 3 | ~7K | ~10s | 几乎不需要截图 |
| GUI 任务 | 12-22 | 49-124K | 48-118s | 大量截图，token 消耗 10-20x |

**研究问题**:
- **异构调度**: 终端任务和 GUI 任务的资源需求差异巨大，如何混合调度？
- **截图 token 是主要成本**: 占总 token 70%+，如何在系统层面优化？
  - 增量截图（只传变化区域）
  - 截图压缩/下采样的最优策略（我们验证了 768x576 vs 1024x768 省 44% 不影响准确性）
  - 截图缓存与复用
- **碳效率**: GREEN 的思路可以扩展到 CUA 调度——GUI 任务耗资源多但可延迟，终端任务快但需即时

**与实验室能力的契合**: GREEN 已经在做 ML 集群调度，CUA workload 是新的调度场景。

### 3. CUA 的网络与通信优化

CUA 涉及大量 host ↔ container 通信：

```
Host (LLM API) ←→ Container (虚拟桌面)
     ↑                    ↑
  API 调用            截图传输 (base64 PNG)
  ~1-5KB/次           ~50-200KB/次
```

**研究问题**:
- **截图传输优化**: 每轮截图是 base64 PNG，是否有更高效的传输/编码方案？
- **多 agent 并行**: 如果同时运行多个 CUA agent（不同任务），如何优化 GPU ↔ 桌面容器的网络拓扑？
- **边缘部署**: CUA 能否在边缘设备上运行（本地 LLM + 本地桌面），减少云端往返？

### 4. CUA Benchmark 与评测系统

**研究问题**:
- **标准化 benchmark**: OSWorld 是当前主要 benchmark，但缺少对系统效率的评测维度（只看任务成功率）
- **效率指标**: 需要同时评估 成功率 × token 效率 × 延迟 × 成本
- **可复现性**: 我们的 Docker 方案提供了可复现的环境，但缺乏标准化

**与实验室能力的契合**: TACC 平台可以提供 benchmark 所需的计算资源和标准化环境。

---

## 已有相关工作

Agent 系统优化**并非空白**，需要了解已有工作才能找到差异化切入点：

### Agent Serving 系统
| 论文 | 来源 | 时间 | 内容 |
|------|------|------|------|
| **Autellix** | Berkeley / Google | 2025.02 | Agent Serving 引擎，程序级调度，比 vLLM 提升 4-15x 吞吐 |
| **Software-Defined Agentic Serving** | - | 2026.01 | Agent 推理的软件定义服务架构 |

### Agent 效率与成本分析
| 论文 | 时间 | 内容 |
|------|------|------|
| **The Cost of Dynamic Reasoning** | 2025.06 | Agent 系统级分析：资源、延迟、能耗、数据中心功耗 |
| **Efficient Agents** | 2025.07 | Agent 效率优化，token 成本分析 |
| **Beyond Benchmarks: Economics of AI Inference** | 2025.10 | 推理经济学框架 |

### CUA 专用模型
| 论文 | 时间 | 内容 |
|------|------|------|
| **Fara-7B** | 2025.11 | 专为 Computer Use 设计的高效 7B 模型 |

### VLM 推理优化
| 论文 | 来源 | 时间 | 内容 |
|------|------|------|------|
| **VL-Cache** | Amazon | 2024.10 | VLM KV Cache 压缩，只保留 10% cache 达到 2.33x 加速 |

### 差异化空间

上述工作主要是**泛化的 Agent Serving** 或 **VLM 推理优化**。专门针对 CUA 独特 workload 特征的系统研究仍较少：
- CUA 的**串行截图依赖**（上一步结果决定下一步，无法并行）
- **高图文比例**（截图占 70%+ token）
- **异构任务特征**（终端 3 轮 7K vs GUI 22 轮 124K，差异 20x）
- **实际桌面环境的端到端优化**（不只是推理，还包括截图传输、工具执行延迟）

---

## 潜在论文方向

需要与 Autellix 等已有工作做差异化：

| 方向 | 差异化点 | 目标会议 | 难度 |
|------|---------|---------|------|
| CUA 端到端系统分析 | 首个针对 CUA workload 的系统级 characterization（截图开销、迭代模式、瓶颈定位） | MLSys / ATC | 中 |
| CUA 视觉 token 优化 | 增量截图、自适应分辨率、视觉 token 去重（区别于 VL-Cache 的通用压缩） | EuroSys / OSDI | 中高 |
| CUA 异构任务调度 | 终端/GUI 混合 workload 调度（区别于 Autellix 的通用 Agent 调度） | NSDI / SoCC | 中 |
| CUA + 边缘部署 | 本地小模型 (Fara-7B) + 云端大模型混合推理 | MLSys | 中高 |

---

## 与现有工作的关系

```
已有外部工作                          iSING 可切入的方向
──────────                          ──────────────────
Autellix (Agent 调度)   ──对比──▶   CUA 专用调度（串行依赖 + 异构任务）
VL-Cache (VLM 压缩)    ──对比──▶   CUA 截图 token 优化（增量 + 自适应）
Fara-7B (CUA 小模型)   ──互补──▶   大小模型混合推理系统
Cost of Dynamic Reasoning ──延伸──▶ CUA 专项 characterization

iSING Lab 已有工作                   CUA 研究扩展
─────────────────                   ─────────────
MFS (LLM Serving)     ──────▶       CUA Serving（多轮图文推理优化）
GREEN (集群调度)       ──────▶       CUA 调度（异构任务、碳效率）
TACC (GPU 平台)       ──────▶       CUA Benchmark 平台
FuseLink (GPU 通信)   ──────▶       多 agent 并行通信优化
```

---

## 优势与风险

### 优势
1. **实测数据**: 已有 Sonnet 4.6 和 Opus 4.6 的完整 benchmark 数据
2. **可复现环境**: Docker + Bun 的 benchmark 框架已搭好
3. **实验室积累**: MFS/Tabi 的 LLM Serving 经验可以直接迁移
4. **CUA 专项分析稀缺**: 泛化 Agent 系统研究已有，但 CUA 专项的系统分析还少

### 风险
1. **Berkeley (Stoica 组) 已在前面**: Autellix 出自 vLLM 团队，他们在 Agent Serving 上有先发优势
2. **CUA 是否足够独特**: 需要有力论证 CUA workload 与一般 Agent workload 的系统层差异
3. **Benchmark 规模**: 我们目前只有 7 个任务，可能不足以支撑系统论文的实验部分

---

## 建议优先级

1. **最推荐**: CUA Workload Characterization — 先做一篇系统分析（profiling CUA 的 token 分布、延迟瓶颈、资源使用模式），为后续工作打基础
2. **次推荐**: CUA 视觉 token 优化 — 增量截图 + 自适应分辨率，实用价值高，与 VL-Cache 差异化
3. **谨慎**: CUA Serving 系统 — 需要与 Autellix 明确差异化，否则会被 review 挑战 novelty

---

## 参考

- [iSING Lab](https://ising.cse.ust.hk/)
- [Prof. Kai Chen](https://cse.hkust.edu.hk/~kaichen/)
- [MFS: LLM Family Serving (EuroSys 2026)](https://cse.hkust.edu.hk/~kaichen/publication.html)
- [Computer Use Agent Benchmark 结果](REPORT.md)
- [Computer Use Agent 市场调研](MARKET-RESEARCH.md)
