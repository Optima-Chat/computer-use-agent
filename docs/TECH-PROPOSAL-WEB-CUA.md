# 技术方案：Web CUA 自动化系统

**日期**: 2026-03-11
**目标**: 为 Optima 接入 Web CUA 能力，实现"有 API 用 MCP，没 API 用 CUA"
**优先级**: 高（替代大量手工系统集成开发）

---

## 1. 背景

Optima 当前有 60+ MCP 工具覆盖有 API 的服务。但以下场景没有 API：

| 场景 | 示例 | 频率 |
|------|------|------|
| 平台迁移（一键搬家） | 从 Shopify/Amazon/Temu 抓商品信息 | 每商户一次 |
| 物流后台操作 | 部分物流商只有网页后台 | 每单一次 |
| 竞品分析 | 浏览竞品网站，抓取价格/商品信息 | 每日/周 |
| 广告平台操作 | 部分小众广告平台无 API | 按需 |

这些场景需要 CUA（Computer Use Agent）来操作浏览器完成。

## 2. 技术选型

### 核心组件

| 组件 | 选择 | 理由 |
|------|------|------|
| 浏览器 Agent | **browser-use** (78K+ stars) | Python，支持 OpenAI/Anthropic/Gemini，Playwright 底层 |
| 工作流编译与重放 | **workflow-use** (同团队) | 从 agent 轨迹编译为确定性脚本，10x 加速 90% 降本 |
| LLM 后端 | **Anthropic Claude** (主) / **OpenAI GPT-4.1-mini** (备) | Claude 准确率高用于首次执行，GPT-4.1-mini 便宜用于 fallback |

### 为什么不自己造

- browser-use + workflow-use 已实现完整的"执行→录制→编译→重放"链路
- 活跃维护，社区大
- Python 生态，与 Optima 后端（FastAPI）直接集成
- 支持 headless、Docker 部署、并发执行

## 3. 架构设计

```
┌─────────────────────────────────────────────────────────┐
│  Optima Backend (FastAPI)                                │
│                                                          │
│  用户请求："帮我从 Shopify 搬家"                          │
│       │                                                  │
│       ▼                                                  │
│  ┌──────────────┐                                        │
│  │ Task Router   │ ── 有 workflow? ──▶ Workflow Replay   │
│  │              │                      (无 LLM, 秒级)    │
│  │              │ ── 没有 ──▶ Full Agent 执行             │
│  │              │              (browser-use + LLM)       │
│  │              │              ↓                          │
│  │              │         录制轨迹 → 编译 Workflow        │
│  │              │              ↓                          │
│  │              │         存储到 Workflow DB               │
│  └──────────────┘                                        │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │ Workflow DB (YAML 文件 + 元数据索引)              │    │
│  │  - shopify_export_products.workflow.yaml          │    │
│  │  - amazon_scrape_listing.workflow.yaml            │    │
│  │  - logistics_create_order.workflow.yaml           │    │
│  └──────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### 执行流程

```
第一个商户搬家（无 workflow）:
  1. Task Router 发现没有对应 workflow
  2. 启动 browser-use Agent，LLM 驱动浏览器操作 Shopify 后台
  3. 录制完整轨迹（截图 + 动作序列）
  4. 编译为参数化 workflow（商户名、店铺 URL 等作为变量）
  5. 存储 workflow
  6. 耗时 ~2 分钟，成本 ~$0.5-2

后续商户搬家（有 workflow）:
  1. Task Router 匹配到已有 workflow
  2. 传入新参数（新商户的 Shopify URL + 登录凭证）
  3. 直接重放 workflow，遇到 UI 偏差才回退 LLM
  4. 耗时 ~10-30 秒，成本 ~$0-0.05
```

## 4. 实现细节

### 4.1 项目结构

```
optima-web-cua/
├── pyproject.toml
├── .env                          # API keys
├── src/
│   ├── __init__.py
│   ├── router.py                 # Task Router: workflow 匹配 + 调度
│   ├── agent_runner.py           # 封装 browser-use Agent 执行
│   ├── workflow_manager.py       # workflow 编译、存储、检索
│   ├── tasks/                    # 预定义任务模板
│   │   ├── shopify_migration.py
│   │   ├── competitor_scrape.py
│   │   └── logistics_order.py
│   └── api.py                    # FastAPI endpoints
├── workflows/                    # 编译后的 workflow YAML 文件
├── storage/                      # 浏览器 storage state (cookies)
└── tests/
```

### 4.2 依赖

```toml
# pyproject.toml
[project]
name = "optima-web-cua"
requires-python = ">=3.12"
dependencies = [
    "browser-use>=0.12.0",
    "workflow-use>=0.2.11",
    "fastapi>=0.115.0",
    "uvicorn>=0.34.0",
    "anthropic>=0.76.0",
    "openai>=2.16.0",
]
```

```bash
# 安装
pip install -e .
playwright install chromium --with-deps
```

### 4.3 核心代码示例

#### Agent 执行 + 轨迹录制

```python
# src/agent_runner.py
from browser_use import Agent, Browser, ChatAnthropic
from browser_use.browser import BrowserProfile, BrowserSession

async def run_full_agent(
    task: str,
    storage_state: str | None = None,
    save_history: str | None = None,
) -> dict:
    """用 LLM 驱动浏览器完成任务，录制轨迹"""

    session = BrowserSession(
        browser_profile=BrowserProfile(
            headless=True,
            storage_state=storage_state,  # 登录态 cookies
        )
    )

    agent = Agent(
        task=task,
        llm=ChatAnthropic(model="claude-sonnet-4-6"),
        browser_session=session,
        max_actions_per_step=4,
        max_failures=3,
        use_vision=True,
        generate_gif=True,  # 调试用，生产可关
    )

    history = await agent.run(max_steps=30)

    # 保存轨迹用于编译 workflow
    if save_history:
        agent.save_history(save_history)

    return {
        "success": history.is_done(),
        "result": history.final_result(),
        "errors": history.errors(),
        "actions": history.model_actions(),
    }
```

#### Workflow 编译与存储

```python
# src/workflow_manager.py
from workflow_use.healing.service import HealingService
from workflow_use.storage.service import WorkflowStorageService
from workflow_use.workflow.service import Workflow
from browser_use import ChatAnthropic

STORAGE_DIR = "./workflows"

llm = ChatAnthropic(model="claude-sonnet-4-6")
storage = WorkflowStorageService(storage_dir=STORAGE_DIR)


async def compile_workflow(
    task_description: str,
    task_type: str,
) -> str:
    """从自然语言描述生成 workflow，返回 workflow ID"""

    healing = HealingService(
        llm=llm,
        enable_variable_extraction=True,       # 自动识别可参数化的值
        use_deterministic_conversion=True,      # 优先生成确定性步骤
    )

    workflow = await healing.generate_workflow_from_prompt(
        prompt=task_description,
        agent_llm=llm,
        extraction_llm=llm,
    )

    metadata = storage.save_workflow(
        workflow=workflow,
        generation_mode="browser_use",
        original_task=task_description,
    )

    return metadata.id


async def replay_workflow(
    workflow_id: str,
    inputs: dict,
) -> dict:
    """用参数重放已编译的 workflow"""

    workflow_data = storage.get_workflow(workflow_id)
    workflow = Workflow.load_from_file(
        workflow_data["path"],
        llm=llm,  # 仅用于 agent 类型步骤的 fallback
    )

    result = await workflow.run(inputs=inputs)

    return {
        "success": True,
        "context": result.context,
    }
```

#### Task Router

```python
# src/router.py
from .agent_runner import run_full_agent
from .workflow_manager import compile_workflow, replay_workflow, storage

# 任务类型 → workflow ID 映射
WORKFLOW_REGISTRY: dict[str, str] = {}


async def execute_task(
    task_type: str,
    task_description: str,
    inputs: dict,
    storage_state: str | None = None,
) -> dict:
    """路由决策：有 workflow 走重放，没有走 full agent"""

    workflow_id = WORKFLOW_REGISTRY.get(task_type)

    if workflow_id:
        # 有已编译的 workflow → 直接重放
        try:
            return await replay_workflow(workflow_id, inputs)
        except Exception:
            # 重放失败（UI 变化太大）→ 回退到 full agent
            pass

    # 没有 workflow 或重放失败 → full agent
    history_path = f"./histories/{task_type}.json"
    result = await run_full_agent(
        task=task_description,
        storage_state=storage_state,
        save_history=history_path,
    )

    # 执行成功 → 编译为 workflow 供后续使用
    if result["success"]:
        wf_id = await compile_workflow(task_description, task_type)
        WORKFLOW_REGISTRY[task_type] = wf_id

    return result
```

#### FastAPI 接口

```python
# src/api.py
from fastapi import FastAPI
from pydantic import BaseModel
from .router import execute_task

app = FastAPI(title="Optima Web CUA")


class CUARequest(BaseModel):
    task_type: str                    # e.g. "shopify_migration"
    task_description: str             # 自然语言任务描述
    inputs: dict = {}                 # 参数化变量
    storage_state: str | None = None  # cookies 文件路径


class CUAResponse(BaseModel):
    success: bool
    result: dict | None = None
    error: str | None = None


@app.post("/cua/execute", response_model=CUAResponse)
async def execute(req: CUARequest):
    try:
        result = await execute_task(
            task_type=req.task_type,
            task_description=req.task_description,
            inputs=req.inputs,
            storage_state=req.storage_state,
        )
        return CUAResponse(success=True, result=result)
    except Exception as e:
        return CUAResponse(success=False, error=str(e))


@app.get("/cua/workflows")
async def list_workflows():
    """列出所有已编译的 workflow"""
    from .workflow_manager import storage
    return storage.list_workflows()
```

### 4.4 Workflow YAML 示例

以 Shopify 商品导出为例，编译后的 workflow 大致如下：

```yaml
name: Shopify Export Products
description: 登录 Shopify 后台，导出所有商品信息
version: '1.0'

input_schema:
  - name: shop_url
    type: string
    required: true
    description: "Shopify 店铺后台 URL，如 https://mystore.myshopify.com/admin"
  - name: export_format
    type: string
    required: false
    description: "导出格式，默认 CSV"

steps:
  - type: navigation
    description: 打开 Shopify 后台
    url: "{shop_url}/products"

  - type: click
    description: 点击 Export 按钮
    cssSelector: "button[aria-label='Export']"
    xpath: "//button[contains(text(), 'Export')]"
    elementTag: BUTTON
    elementText: Export

  - type: click
    description: 选择 All products
    cssSelector: "input[value='all']"
    elementTag: INPUT

  - type: click
    description: 选择 CSV 格式
    cssSelector: "input[value='csv']"
    elementTag: INPUT

  - type: click
    description: 点击 Export products
    cssSelector: "button.Polaris-Button--primary"
    elementText: Export products

  - type: extract_page_content
    description: 提取导出确认信息
    goal: "Extract the confirmation message about the export being sent to email"
    output: export_status
```

### 4.5 登录态管理

CUA 操作 Shopify/Amazon 等平台需要登录态。方案：

```python
# 方案一：商户授权后导出 cookies
async def export_merchant_cookies(shop_url: str, output_path: str):
    """引导商户在浏览器中登录，导出 storage state"""
    browser = Browser.from_system_chrome(profile_directory="Default")
    await browser.start()
    # 商户在真实浏览器中完成登录...
    await browser.export_storage_state(output_path)
    await browser.stop()

# 方案二：用户名密码自动登录（需商户授权）
async def auto_login(shop_url: str, email: str, password: str):
    """CUA 自动完成登录流程"""
    agent = Agent(
        task=f"Go to {shop_url}/admin and login with email {email}",
        llm=ChatAnthropic(model="claude-sonnet-4-6"),
        sensitive_data={"password": password},  # browser-use 会安全处理
    )
    await agent.run(max_steps=10)
```

**推荐方案一**：让商户在 Optima 前端通过 OAuth 或浏览器扩展授权，导出 cookies 存储在后端。避免处理明文密码。

## 5. 部署

### Docker

```dockerfile
FROM python:3.12-slim

RUN apt-get update && apt-get install -y wget gnupg && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY pyproject.toml .
RUN pip install -e .
RUN playwright install chromium --with-deps

COPY src/ ./src/
COPY workflows/ ./workflows/

EXPOSE 8000
CMD ["uvicorn", "src.api:app", "--host", "0.0.0.0", "--port", "8000"]
```

### docker compose

```yaml
services:
  web-cua:
    build: .
    container_name: optima-web-cua
    ports:
      - "8000:8000"
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    volumes:
      - ./workflows:/app/workflows      # workflow 持久化
      - ./storage:/app/storage           # cookies 持久化
    shm_size: "2g"                       # Chromium 需要共享内存
    deploy:
      resources:
        limits:
          memory: 4G                     # 每个 Chromium 实例 ~500MB
```

### 并发

每个 Chromium 实例约 500MB 内存。一台 8GB 机器可以同时跑 ~10 个 agent。

```python
# 并发执行多个任务
import asyncio

async def batch_execute(tasks: list[dict]):
    """并发执行多个 CUA 任务"""
    semaphore = asyncio.Semaphore(5)  # 限制并发数

    async def run_one(task):
        async with semaphore:
            return await execute_task(**task)

    return await asyncio.gather(*[run_one(t) for t in tasks])
```

## 6. 与 Optima 现有系统的集成

### 在 MCP 工具层新增 CUA 工具

```python
# 新增到 Optima 的 MCP 工具列表
CUA_TOOLS = {
    "cua_shopify_export": {
        "description": "从 Shopify 后台导出商品数据",
        "inputs": ["shop_url"],
        "workflow": "shopify_export_products",
    },
    "cua_competitor_scrape": {
        "description": "抓取竞品网站商品信息",
        "inputs": ["competitor_url"],
        "workflow": "competitor_product_scrape",
    },
    "cua_logistics_order": {
        "description": "在物流商后台创建发货单",
        "inputs": ["tracking_number", "recipient", "address"],
        "workflow": "logistics_create_shipment",
    },
}
```

OptimaChat 调度时，对有 API 的服务调 MCP 工具，对无 API 的服务调 CUA 工具。CUA 工具内部自动走 workflow 重放或 full agent。

## 7. 开发计划

| 阶段 | 内容 | 时间 | 交付 |
|------|------|------|------|
| **P0: POC** | browser-use 跑通一个 Shopify 商品导出任务 | 3 天 | 能手动触发 agent 完成任务 |
| **P1: 编译** | workflow-use 集成，跑通录制→编译→重放 | 1 周 | 第二次执行无 LLM 重放成功 |
| **P2: API** | FastAPI 封装 + Task Router | 1 周 | HTTP 接口可调用 |
| **P3: 集成** | 接入 Optima MCP 工具层 | 1 周 | OptimaChat 可调度 CUA 任务 |
| **P4: 扩展** | 添加更多任务（竞品分析、物流等） | 持续 | 按业务需求逐步增加 |

## 8. 成本估算

| 场景 | Full Agent (首次) | Workflow Replay (后续) |
|------|-------------------|----------------------|
| LLM 调用 | 15-30 次 (~$0.5-2) | 0-3 次 (~$0-0.05) |
| 延迟 | 1-3 分钟 | 10-30 秒 |
| Chromium 资源 | ~500MB RAM | ~500MB RAM |
| **月成本 (1000 任务)** | **$500-2000** | **$0-50** |

首次执行每种任务类型花一次 full agent 的成本，之后所有同类任务走 workflow 重放。任务类型越多、执行越频繁，节省越大。

## 9. 风险与注意事项

| 风险 | 严重性 | 缓解 |
|------|--------|------|
| 网站 UI 更新导致 workflow 失效 | 中 | workflow-use 有 HealingService 自动修复；失败自动回退 full agent |
| 反爬/CAPTCHA | 高 | 部分网站有反自动化检测；需要代理 IP + 降低速率 |
| 登录态过期 | 中 | 定期刷新 cookies；支持自动重新登录 |
| Chromium 内存泄漏 | 低 | 每个任务用独立 BrowserSession，完成后关闭 |
| browser-use API 变更 | 低 | 锁定版本号，定期跟进升级 |
