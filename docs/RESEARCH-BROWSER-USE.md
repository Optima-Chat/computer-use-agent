# browser-use 技术调研报告

**日期**: 2026-03-11
**版本**: browser-use 0.12.1 (80K+ GitHub stars, MIT license)
**官方**: https://github.com/browser-use/browser-use

---

## 1. 核心架构

browser-use 是一个 **DOM-aware + Vision** 混合方案的浏览器自动化 Agent，核心区别于纯截图方案（如 Anthropic CUA）。

### 七层架构

```
Layer 1: 自然语言任务描述
Layer 2: Agent 推理 (sense-think-act loop)
Layer 3: 结构化动作 (Pydantic ActionModel)
Layer 4: 动作分发 (Tools registry)
Layer 5: 事件协调 (EventBus, bubus 库)
Layer 6: 事件执行 (Watchdogs → CDP 命令)
Layer 7: 浏览器控制 (Chrome DevTools Protocol)
```

### Agent 循环（每一步）

```
┌──────────────────────────────────────────────────────────┐
│  Step N                                                  │
│                                                          │
│  1. State Capture                                        │
│     ├── DOM.getDocument()           ─┐                   │
│     ├── DOMSnapshot.captureSnapshot() ├─ 3 路并行 CDP    │
│     └── Accessibility.getFullAXTree()─┘                  │
│     → 合并为 EnhancedDOMTreeNode                         │
│     → 5 阶段序列化压缩 (10K+ nodes → ~200 交互元素)     │
│                                                          │
│  2. Prompt 组装                                          │
│     ├── System prompt                                    │
│     ├── 序列化 DOM（~5KB, 带数字索引）                   │
│     ├── 可选: 截图 (base64 PNG)                          │
│     ├── 历史摘要                                         │
│     └── 任务描述                                         │
│                                                          │
│  3. LLM 决策 → AgentOutput                               │
│     {                                                    │
│       thinking: "...",                                   │
│       evaluation_previous_goal: "success/failure",       │
│       memory: "进度摘要 (1-3 句)",                       │
│       next_goal: "下一步目标",                           │
│       actions: [{click_element: {index: 5}}, ...]        │
│     }                                                    │
│                                                          │
│  4. 动作执行                                             │
│     Tools.execute_action() → EventBus → Watchdog → CDP   │
│                                                          │
│  5. 完成检查                                             │
│     done() action? 或 max_steps?                         │
└──────────────────────────────────────────────────────────┘
```

---

## 2. 核心差异：DOM-aware vs 纯截图

这是 browser-use 与 Anthropic CUA / OpenAI Operator 的**根本区别**：

| 维度 | browser-use (DOM-aware) | 纯 CUA (截图方案) |
|------|------------------------|-------------------|
| 页面理解 | 结构化可访问性树 + 可选截图 | 仅截图像素 |
| 元素定位 | 按索引号引用 `click_element(index=3)` | 按像素坐标 `click(x=542, y=318)` |
| 准确度 | 高（精确 DOM 匹配） | 中（坐标可能偏移） |
| Token 消耗 | ~5-10K/步（DOM 文本） | ~1K-4K/步（截图 token） |
| 适用范围 | **仅浏览器** | **任何桌面应用** |
| 反爬检测 | 中（使用 CDP，可被检测） | 低（模拟人类操作） |
| Shadow DOM/iframe | 部分支持（有边界情况） | 天然支持（看到什么操作什么） |

### DOM 处理流水线（5 阶段压缩）

```
原始 DOM (10,000+ nodes)
  │
  ├─ Stage 1: Simplification
  │   去除 script/style/meta, 检测可点击元素
  │
  ├─ Stage 2: Paint Order Filtering
  │   按 z-index/渲染顺序消除被遮挡元素
  │
  ├─ Stage 3: Structural Optimization
  │   展平单子节点链, 保留语义结构
  │
  ├─ Stage 4: BBox Filtering
  │   去除 99% 被包含的子元素
  │
  └─ Stage 5: Index Assignment
      仅对交互元素分配连续数字索引
      → 构建 selector_map
      │
      ▼
  压缩后 (~200 交互元素, ~5KB 文本)
```

**LLM 看到的格式**:
```
[1] <button>Submit</button>
[2] <input type="text" placeholder="Search...">
[3] <a href="/about">About Us</a>
[4] <select>
      <option>Electronics</option>
      <option>Clothing</option>
    </select>
```

LLM 通过索引号精确引用元素，不需要猜测坐标。

---

## 3. 动作空间

### 内置动作

| 类别 | 动作 | 说明 |
|------|------|------|
| **导航** | `go_to_url` | 打开 URL |
| | `go_back` | 浏览器后退 |
| **交互** | `click_element` | 按索引点击 |
| | `input_text` | 点击元素并输入文本 |
| | `send_keys` | 键盘快捷键 (Enter, Ctrl+A...) |
| | `select_dropdown_option` | 按可见文本选择下拉项 |
| | `hover` | 悬停 |
| | `dblclick` / `rightclick` | 双击 / 右键 |
| **滚动** | `scroll_down` / `scroll_up` | 页面滚动 |
| **标签页** | `switch_tab` | 切换标签页 |
| | `open_new_tab` | 打开新标签页 |
| **数据** | `extract_content` | LLM 提取页面内容 |
| | `screenshot` | 手动截图 |
| **控制** | `done` | 标记任务完成 |
| | `wait` | 等待指定秒数 |

### 批量执行

`max_actions_per_step` 默认 4，允许一次 LLM 调用返回多个动作依次执行（如填表单时一次性填多个字段）。

### 自定义动作

```python
tools = Tools()

@tools.action(description='Save data to database')
async def save_to_db(data: str, table: str) -> ActionResult:
    # 自定义逻辑
    db.insert(table, data)
    return ActionResult(extracted_content=f'Saved to {table}')

agent = Agent(task="...", llm=llm, tools=tools)
```

---

## 4. Vision 模式

三种配置：

| 模式 | `use_vision` | 行为 |
|------|-------------|------|
| Auto | `"auto"`（默认） | 提供截图工具，LLM 按需调用 |
| Always | `True` | 每步都附带截图 |
| DOM-only | `False` | 不使用截图，纯 DOM |

### 截图处理

1. 通过 CDP 截取原始 PNG
2. 可选: 在截图上绘制 highlight overlay（边界框 + 数字索引，与 DOM 序列化对应）
3. 作为 image content 加入 UserMessage
4. 按 LLM 提供商格式序列化（OpenAI base64 data URL / Gemini Part / Anthropic ImageBlockParam）

`vision_detail_level`: `'low'` / `'high'` / `'auto'`，控制分辨率和 token 成本。高清截图消耗 2000-4000 tokens/张。

### 上下文管理

`maybe_compact_messages()` 自动删除旧截图，避免 context window 溢出。

---

## 5. LLM 支持

### 支持的模型

| 提供商 | 模型 | 接口 |
|--------|------|------|
| **browser-use** | BU-30B-A3B-Preview | `ChatBrowserUse` (推荐) |
| **OpenAI** | GPT-4o, GPT-4 | `ChatOpenAI` |
| **Anthropic** | Claude Sonnet/Opus | `ChatAnthropic` |
| **Google** | Gemini | `ChatGoogleGenerativeAI` |
| **本地** | Llama, DeepSeek | Ollama |
| **AWS** | Bedrock | 部分兼容（有已知问题） |

### BU-30B-A3B-Preview (browser-use 自研模型)

- 基于 Qwen3-VL-30B-A3B-Instruct（MoE 架构）
- 30B 总参数，3B 活跃参数
- 65,536 token 上下文
- 单 GPU 可运行
- 成本效率比 BU 1.0 高 4x
- 可通过 vLLM 部署

### 容错机制

- `fallback_llm`: 主模型失败后切换备用模型（429/401/500 错误时触发）
- `page_extraction_llm`: 独立的便宜模型用于文本提取
- `SchemaOptimizer`: 跨提供商的可靠 JSON 解析

---

## 6. 错误处理与自纠正

```
┌─────────────────────────────────────────────────┐
│  多层错误恢复                                    │
│                                                  │
│  L1: LLM 自评估                                 │
│      每步输出 evaluation_previous_goal           │
│      success / failure / uncertain               │
│                                                  │
│  L2: 循环检测 (ActionLoopDetector)               │
│      检测重复行为模式 → 生成 "nudge" 提示        │
│      引导 agent 尝试新策略                       │
│                                                  │
│  L3: 失败计数                                    │
│      consecutive_failures 计数器                 │
│      超过 max_failures (默认 3) → 终止           │
│      final_response_after_failure → 最后一次尝试 │
│                                                  │
│  L4: Fallback LLM                                │
│      主模型 rate limit / 错误 → 切换备用模型     │
│                                                  │
│  L5: 上下文压缩                                  │
│      接近 context limit → 摘要早期步骤           │
│                                                  │
│  L6: 超时控制                                    │
│      per-action timeout (TIMEOUT_ClickElement)   │
│      llm_timeout (90s)                           │
│      step_timeout (120s)                         │
└─────────────────────────────────────────────────┘
```

---

## 7. 性能基准

### WebVoyager Benchmark

**browser-use 官方**: 89.1% (586 任务, GPT-4o)

| 网站 | 成功率 |
|------|--------|
| HuggingFace | 100% |
| Google Flights | 95% |
| Amazon | 92% |
| Booking.com | 80% |

平均步数: 8.5 (Coursera) ~ 36.2 (Google Flights)

### 排行榜对比

| Agent | WebVoyager |
|-------|-----------|
| Surfer 2 (H Company) | 97.1% |
| Magnitude | 93.9% |
| AIME Browser-Use | 92.3% |
| Browserable | 90.4% |
| **Browser Use** | **89.1%** |
| OpenAI Operator | 87.0% |
| Skyvern 2.0 | 85.9% |
| Google Project Mariner | 83.5% |

**注意**: 89% 结果尚未被独立复现。各团队的数据集子集、评估器、重试策略不同，分数不直接可比。

### vs 纯 CUA 实测对比

来源: TechStackups head-to-head 测试

| 场景 | browser-use | Anthropic CUA |
|------|------------|---------------|
| 表单填写 (demoqa.com) | 首次成功 | 42 条 debug 消息 |
| Wikipedia 导航 | 6 次点击 / 182s | 9 次点击 / 326s |
| 反爬检测 (Cloudflare) | 通过 | 完全被阻止 |
| 代码量 | ~12 行 | ~89+ 行 |

---

## 8. workflow-use 集成

[workflow-use](https://github.com/browser-use/workflow-use) 是 browser-use 的配套项目，实现"录制→编译→重放"。

### 工作流程

```
Demonstrate → Execute → Transform → Persist → Replay
                                                  │
                                        失败时回退到 browser-use Agent
```

1. 通过 Chrome 扩展录制浏览器交互
2. browser-use 实时执行任务
3. 执行历史转换为语义化 workflow（提取参数/变量）
4. 保存为 JSON 文件
5. 用新参数重放，无需 LLM

### CLI 命令

```bash
generate-workflow "从 Shopify 导出商品"        # 从自然语言生成
run-stored-workflow <id> --prompt "..."         # 重放已有 workflow
run-as-tool <file> --prompt "..."              # 单次执行 + AI fallback
create-workflow                                 # 手动录制
launch-gui                                      # 可视化管理界面
```

### 自愈机制

确定性步骤执行时使用录制的 DOM selector / 坐标。如果步骤失败（布局变化、动态内容），browser-use 的 AI Agent 接管恢复，并可更新 workflow 文件。

**状态**: 早期开发阶段，API 不稳定，非生产就绪。

---

## 9. 代码结构

```
browser_use/
├── agent/              # Agent 编排
│   ├── service.py      # 主 Agent 类: run() / step() 循环
│   ├── system_prompt.md # 系统 prompt 模板
│   └── views.py        # AgentOutput, AgentState, AgentHistory
├── browser/            # 浏览器会话管理
│   └── session.py      # BrowserSession + EventBus
├── dom/                # DOM 处理引擎 (核心)
│   ├── service.py      # DomService: 3-tree CDP 提取 + 合并
│   └── serializer.py   # DOMTreeSerializer: 5 阶段压缩
├── tools/              # 工具注册 + 内置动作
├── llm/                # LLM 提供商抽象层
├── actor/              # 动作执行层
├── code_use/           # 代码执行能力
├── mcp/                # MCP 服务器集成
├── skills/             # Skill 加载系统
├── sandbox/            # Cloud sandbox 支持
├── tokens/             # Token 计数管理
├── screenshots/        # 截图处理
├── filesystem/         # 文件系统操作
├── telemetry/          # 遥测
└── cli.py              # CLI 入口
```

---

## 10. 已知局限

| 局限 | 严重性 | 说明 |
|------|--------|------|
| **仅浏览器** | 高 | 无法控制桌面应用，与 CUA 互补而非替代 |
| **PDF 查看器** | 中 | 浏览器原生 PDF 组件的 DOM 提取不可靠 |
| **Shadow DOM** | 中 | 复杂 Shadow DOM 元素可能被可访问性树遗漏 |
| **iframe** | 中 | 嵌套上下文需递归处理，边界情况可能失败 |
| **新标签页检测** | 中 | 点击打开新标签页时 agent 有时检测不到 (issue #3657) |
| **CAPTCHA** | 高 | 无法读取变形文字验证码 |
| **反爬检测** | 中 | 开源版缺少 stealth fingerprinting (Cloud 版有) |
| **循环行为** | 中 | 尽管有 ActionLoopDetector，agent 仍可能卡在重复模式 |
| **页面加载时序** | 低 | 有时在页面未完全加载时就继续操作 (issue #3972) |
| **AWS Bedrock** | 低 | 结构化输出存在根本性兼容问题 |

---

## 11. 与 Optima 集成的技术要点

### 推荐方案

1. **browser-use 处理 Web 自动化**：无 API 的第三方平台（Shopify 后台、物流网站、竞品页面）
2. **workflow-use 处理重复任务**：首次 agent 执行，编译 workflow，后续无 LLM 重放
3. **封装为 `web-cua-cli`**：作为 optima-agent 的一个 Skill，与 commerce-cli 等并列

### 注意事项

- browser-use 是 Python 生态，需要与 Optima 的 Node/Bun 后端做进程级隔离（CLI 封装或 HTTP 微服务）
- workflow-use 仍处于早期阶段，生产部署需要额外的稳定性工作
- 需要处理登录态持久化（cookies/storage state 管理）
- 并发时每个 Chromium 实例 ~500MB 内存，需要资源规划

### 与纯 CUA 方案的选择

| 场景 | 推荐方案 |
|------|---------|
| Web 表单操作 | browser-use（DOM 精确，反爬能力强） |
| 桌面应用操作 | Anthropic CUA（browser-use 不支持） |
| 需要高可靠性的重复任务 | workflow-use（编译后确定性执行） |
| 复杂跨应用流程 | CUA + browser-use 混合 |

---

## 参考资料

- [browser-use GitHub](https://github.com/browser-use/browser-use)
- [browser-use SOTA Technical Report](https://browser-use.com/posts/sota-technical-report)
- [workflow-use GitHub](https://github.com/browser-use/workflow-use)
- [BU-30B-A3B-Preview (HuggingFace)](https://huggingface.co/browser-use/bu-30b-a3b-preview)
- [WebVoyager Leaderboard (Steel.dev)](https://leaderboard.steel.dev/)
- [browser-use vs CUA 对比 (TechStackups)](https://techstackups.com/comparisons/browser-use-vs-claude-computer-use/)
- [DOM Processing Engine (DeepWiki)](https://deepwiki.com/browser-use/browser-use/2.4-dom-processing-engine)
