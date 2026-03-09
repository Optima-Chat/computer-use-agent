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

## 核心方向：推理 × 执行环境联合优化

### 现状：两条平行线

现有工作将推理侧和执行环境侧**分开研究**，没有联合优化：

```
线路 A: 推理优化（只看 GPU 侧）        线路 B: 执行环境（只看 VM 侧）
──────────────────────────           ─────────────────────────
Autellix (Agent 调度)                Cua/trycua (VM 沙箱)
AgentInfer (推理架构协同设计)          E2B / Daytona (代码沙箱)
VL-Cache (KV Cache 压缩)             Fly.io Sprites (microVM, 300ms restore)
                                     Google Agent Sandbox (GKE + gVisor)
                                     Blaxel (25ms 恢复)

              ↕ 几乎没人把这两侧一起优化 ↕
```

但 CUA 的实际瓶颈恰恰在**两者的交互**上。

### CUA 单轮迭代的时间分解

**实测数据**（Opus 4.6, 768x576, 远程 API）：

```
AGGREGATE (7 tasks, 73 iterations)
├─ Inference:  339.5s (91%)    ← API 往返 (网络 + 排队 + GPU)
├─ VM Total:    34.6s (9%)
│  ├─ Screenshots:  5.6s (17 captures, avg 327ms, 59KB/frame)
│  ├─ GUI Actions: 10.9s
│  └─ Bash:        18.1s
└─ Total:      374.1s

Per-task VM overhead: 6-12% (heaviest: browser form at 12%)
```

**注意**: 远程 API 场景下推理占 91%，VM 仅占 9%。这是因为 API 往返延迟（网络 + 排队 + GPU）远大于本地 VM 操作。

但在**本地部署场景**（自托管模型、边缘设备），情况会反转：
- API 往返延迟消除，推理降至纯 GPU 计算时间
- VM 侧占比可能升至 **30-50%**
- 截图传输 + 工具执行成为显著瓶颈

**关键洞察**: 随着推理侧持续优化（更快的模型、更好的 batch、本地部署），VM 侧会成为越来越显著的瓶颈。联合优化的价值在本地部署场景最为突出。

### 联合优化的研究问题

#### 问题 1: 推理-执行流水线化 (Pipeline Overlap)

当前是严格串行：截图 → 推理 → 执行 → 截图 → ...

```
当前（串行）:
VM:    [截图].............[执行][等渲染][截图].............[执行]
GPU:   .......[推理]........................[推理]...............

优化（流水线）:
VM:    [截图][预渲染]......[执行][截图+预取]......[执行]
GPU:   .......[推理]...........[推理]...............
               ↑ overlap ↑     ↑ overlap ↑
```

- 模型推理时，VM 侧可以做什么？预取可能的 UI 状态？预渲染？
- 模型输出 token 是流式的，能否在生成到一半时就开始准备执行环境？

#### 问题 2: 截图传输 — 共享内存 vs 网络

当前截图通过 `docker exec → scrot → base64 → HTTP API` 传输，经过多次编解码：

```
当前路径:
VM 帧缓冲 → scrot 写 PNG → base64 编码 → docker 管道 → HTTP body → API 解码

优化路径（co-locate 场景）:
VM 帧缓冲 → 共享内存 → GPU 直接读取（零拷贝）
```

如果推理和 VM 在同一物理节点上，截图完全不需要走网络。这是一个**系统架构设计**问题。

#### 问题 3: VM 快照 + KV Cache 联合 Checkpoint

```
CUA 任务状态 = KV Cache 状态 + VM 桌面状态

联合 checkpoint 可以实现：
- 任务暂停/恢复（不丢失推理上下文和桌面状态）
- 任务迁移（从节点 A 迁到节点 B）
- 失败恢复（回滚到上一个正确状态重试）
- 分支探索（fork VM + KV Cache，尝试不同操作路径）
```

Fly.io Sprites 已经有 VM checkpoint (~300ms)，但没有和 KV Cache 联合。

#### 问题 4: 自适应执行环境

不同任务对 VM 的需求完全不同：

| 任务类型 | VM 需求 | 推理需求 |
|---------|---------|---------|
| 终端命令 | 不需要 GUI，只需 shell | 低 token，快速响应 |
| 文本编辑 | 轻量 GUI (Mousepad) | 中等 token，多轮 |
| 浏览器操作 | 重量 GUI (Firefox, 大内存) | 高 token，长会话 |

```
自适应方案:
- 终端任务: 轻量容器（无 Xvfb），直接 bash → 省 VM 资源
- GUI 任务: 完整桌面 VM → 按需分配
- 浏览器任务: 大内存 VM + 更高分辨率 → 保证准确性
```

#### 问题 5: 多 Agent 的 VM 池 + GPU 联合调度

```
场景: 100 个 CUA agent 同时执行不同任务

     GPU 集群                    VM 池
┌──────────────┐          ┌──────────────┐
│ GPU 0: 推理   │◄────────►│ VM 0: 桌面    │
│ GPU 1: 推理   │◄────────►│ VM 1: 桌面    │
│ GPU 2: 推理   │◄────────►│ VM 2: 桌面    │
│ ...          │          │ ...          │
│ GPU N: 空闲   │          │ VM M: 冷备    │
└──────────────┘          └──────────────┘
       ↕ 需要联合调度 ↕
```

- GPU 和 VM 的**配比**是多少最优？（VM 在等推理时空闲，GPU 在等截图时空闲）
- 多个 agent 能否**分时复用**同一 GPU？（CUA 推理有大量等待间隙）
- VM 冷启动 vs 热池的**成本权衡**？

### 与已有工作的差异化

| 已有工作 | 关注点 | 本方向的差异 |
|---------|--------|------------|
| Autellix | 纯推理侧调度 | 加入 VM 执行侧的联合调度 |
| AgentInfer | 推理架构协同设计 | 加入执行环境的协同设计 |
| Cua/trycua | 纯 VM 沙箱 | 加入推理侧的联合优化 |
| E2B/Daytona | 代码沙箱冷启动 | 加入 KV Cache 联合 checkpoint |
| VL-Cache | KV Cache 压缩 | 加入截图传输路径优化 |
| Auras (Embodied AI) | 感知-生成解耦 | 类似思路但应用于 CUA 桌面场景 |

**核心 novelty**: 首个将 CUA 的**模型推理**和**桌面执行环境**作为统一系统进行端到端联合优化的工作。

---

## 潜在论文方向

| 方向 | 核心贡献 | 目标会议 | 难度 |
|------|---------|---------|------|
| **CUA 端到端 Characterization** | 首个 CUA workload 系统分析：推理 vs VM 延迟分解、瓶颈定位、资源使用模式 | MLSys / ATC | 中 |
| **CUA 推理-执行联合系统** | 流水线化 + 共享内存截图 + 自适应 VM + 联合调度，端到端加速 | OSDI / EuroSys | 高 |
| **CUA 视觉 token 优化** | 增量截图、自适应分辨率、VM 侧预处理（区别于 VL-Cache 的通用压缩） | EuroSys / NSDI | 中高 |
| **CUA Checkpoint/Restore** | KV Cache + VM 快照联合 checkpoint，支持任务暂停/迁移/分支探索 | SoCC / ATC | 中 |

---

## 与 iSING Lab 能力的映射

```
iSING Lab 能力                        CUA 联合优化方向
──────────────                       ─────────────────
MFS (LLM Serving)     ──────▶       CUA 推理侧优化 + 推理-执行流水线
GREEN (集群调度)       ──────▶       GPU-VM 联合调度
TACC (GPU 平台)       ──────▶       多 agent benchmark 平台
FuseLink (GPU 通信)   ──────▶       截图零拷贝传输 + 共享内存
数据中心网络           ──────▶       推理节点 ↔ VM 节点拓扑优化
```

**独特优势**: iSING Lab 同时具备**系统 (Serving) + 网络 (通信)** 能力，这恰好是联合优化所需要的。纯做 Serving 的组（如 Berkeley）缺少网络侧经验，纯做 VM 的组（如 Cua）缺少推理侧经验。

---

## 优势与风险

### 优势
1. **实测数据**: 已有 Sonnet 4.6 和 Opus 4.6 的完整 benchmark 数据
2. **可复现环境**: Docker + Bun 的 benchmark 框架已搭好
3. **实验室积累**: MFS/Tabi (Serving) + FuseLink (通信) 双重经验
4. **联合视角稀缺**: 推理侧和 VM 侧各有人做，但联合优化几乎没人做
5. **产业需求明确**: Cua (YC) 融资、Anthropic 收购 Vercept，CUA 基础设施是热点

### 风险
1. **系统复杂度高**: 联合优化涉及 GPU 调度 + VM 管理 + 网络通信，工程量大
2. **实验规模**: 需要足够多的 GPU + VM 实例才能做有说服力的实验
3. **Benchmark 规模**: 7 个任务可能不够，需要扩展或使用 OSWorld
4. **Berkeley 竞争**: Stoica 组可能会向 VM 侧扩展 Autellix

---

## 建议优先级

1. **第一步**: CUA Workload Characterization — 详细 profiling 推理 vs VM 各阶段延迟，量化联合优化的空间。这是所有后续工作的基础，也最容易出成果
2. **第二步**: 截图传输优化 + 推理-执行流水线 — 选一个具体优化点做深，证明联合优化的价值
3. **长线目标**: 完整的 CUA 联合系统 — GPU-VM 联合调度 + checkpoint/restore，目标 OSDI/EuroSys

---

## 参考

### 实验室
- [iSING Lab](https://ising.cse.ust.hk/)
- [Prof. Kai Chen](https://cse.hkust.edu.hk/~kaichen/)
- [MFS: LLM Family Serving (EuroSys 2026)](https://cse.hkust.edu.hk/~kaichen/publication.html)

### 推理侧相关工作
- [Autellix: Agent Serving Engine (Berkeley, 2025.02)](https://arxiv.org/abs/2502.13965)
- [AgentInfer: Inference-Architecture Co-Design (2025.12)](https://arxiv.org/abs/2512.18337)
- [VL-Cache: VLM KV Cache Compression (Amazon, 2024.10)](https://arxiv.org/abs/2410.23317)
- [Fara-7B: Efficient CUA Model (2025.11)](https://arxiv.org/abs/2511.19663)
- [Auras: Embodied AI Pipeline (2025.09)](https://arxiv.org/abs/2509.09560)

### 执行环境侧
- [Cua: Open-source CUA Infrastructure (YC)](https://github.com/trycua/cua)
- [E2B: Enterprise AI Agent Cloud](https://e2b.dev/)
- [Google Agent Sandbox on GKE](https://docs.google.com/kubernetes-engine/docs/how-to/agent-sandbox)
- [LLM-in-Sandbox (2026.01)](https://arxiv.org/abs/2601.16206)

### 本项目
- [Computer Use Agent Benchmark 结果](REPORT.md)
- [Computer Use Agent 市场调研](MARKET-RESEARCH.md)
- [Optima x CUA 机会分析](OPTIMA-CUA-ANALYSIS.md)
