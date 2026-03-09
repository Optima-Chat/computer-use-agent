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

## 潜在论文方向

| 方向 | 目标会议 | 核心贡献 | 难度 |
|------|---------|---------|------|
| CUA Serving 系统（KV Cache 优化、增量截图） | EuroSys / OSDI | 新 workload 的 serving 优化 | 中高 |
| CUA 资源调度（异构任务混合调度） | NSDI / SoCC | 调度算法 + 系统实现 | 中 |
| CUA Token 成本优化（截图传输与压缩） | MLSys / ATC | 系统优化 + 实验验证 | 中 |
| CUA Benchmark 系统（效率导向的评测框架） | ISCA / Workshop | 新 benchmark + 分析 | 低中 |

---

## 与现有工作的关系

```
iSING Lab 已有工作                    CUA 研究扩展
─────────────────                    ─────────────
MFS (LLM Serving)     ──────▶       CUA Serving（多轮图文推理优化）
GREEN (集群调度)       ──────▶       CUA 调度（异构任务、碳效率）
TACC (GPU 平台)       ──────▶       CUA Benchmark 平台
FuseLink (GPU 通信)   ──────▶       多 agent 并行通信优化
```

---

## 独特优势

1. **实测数据**: 我们已有 Sonnet 4.6 和 Opus 4.6 的完整 benchmark 数据，包括 token 分布、迭代模式、延迟特征
2. **可复现环境**: Docker + Bun 的 benchmark 框架已搭好，可以快速迭代实验
3. **系统视角稀缺**: 当前 CUA 研究主要集中在模型能力（CV/NLP），几乎没有从 ML Systems 角度分析的工作
4. **实验室积累**: MFS/Tabi 的 LLM Serving 经验可以直接迁移

---

## 建议优先级

1. **最推荐**: CUA Serving 优化 — 直接延续 MFS/Tabi 的研究线，有明确的系统挑战，且当前无竞争者
2. **次推荐**: CUA Token/成本优化 — 实用价值高，实验相对容易做，可以先出一篇短文/Workshop
3. **长线**: CUA Benchmark 系统 — 如果能成为标准 benchmark，影响力大但需要社区认可

---

## 参考

- [iSING Lab](https://ising.cse.ust.hk/)
- [Prof. Kai Chen](https://cse.hkust.edu.hk/~kaichen/)
- [MFS: LLM Family Serving (EuroSys 2026)](https://cse.hkust.edu.hk/~kaichen/publication.html)
- [Computer Use Agent Benchmark 结果](REPORT.md)
- [Computer Use Agent 市场调研](MARKET-RESEARCH.md)
