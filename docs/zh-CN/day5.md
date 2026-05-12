# Day 5 - 任务管理：变身时间管理大师

> 上一篇：[Day 4 - MCP：打开 AI 工具生态的大门](day4.md) | **[概述](../overview.zh-CN.md)** | 下一篇：[Day 6 - SubAgent：Agent 分身术](day6.md)

## 目标

给 Agent 装上"任务感"：让它面对复杂需求时能先分解、再逐项推进、实时汇报进度；面对简单提问时又不会多此一举——一句话能说清的事就直接回答。

## 完成内容

### 1. TaskManager（src/tasks/task-manager.js）

一个最小可用的内存任务状态机，基于 `Map<id, Task>` 存储，提供：

- `createTask(title, description?)` / `createTasksFromList(titles)` — 单个或批量创建
- `updateTaskStatus(id, status, result?, error?)` — 流转状态并记录执行结果/失败原因
- `getAllTasks()` / `getTasksByStatus(status)` / `getTask(id)` — 查询
- `getStats()` — 一次性拿到 total / pending / inProgress / completed / failed
- `formatTaskList()` — 渲染带 emoji 的清单（⏳🔄✅❌），直接喂给 LLM 或控制台
- `deleteTask(id)` / `clearAllTasks()` — 清理
- `saveToFile(path)` / `loadFromFile(path)` — JSON 持久化，跨会话复用

任务 ID 用 `task_${Date.now()}_${rand}` 生成，避免在短时间批量创建时重复。

### 2. 任务状态机

```
┌──────────┐   start_task   ┌─────────────┐  complete_task  ┌────────────┐
│ pending  │ ─────────────→ │ in_progress │ ──────────────→ │ completed │
└──────────┘                └─────────────┘                 └────────────┘
     ↑                             │
     │                             │ fail_task
     │                             ↓
     │                       ┌────────────┐
     └───────────────────────│   failed   │
          (重试即重新 start)    └────────────┘
```

四种状态、明确的转换边，便于 AI 推理"下一步该做什么"。

### 3. Task 工具集（src/tools/task-tools.js）

暴露给 LLM 的 6 个 Function Call：

| 工具 | 作用 |
|---|---|
| `create_tasks` | 一次性拆分多个有序子任务 |
| `start_task` | 进入 `in_progress` |
| `complete_task` | 进入 `completed`，要求带 `result` 描述产出物 |
| `fail_task` | 进入 `failed`，要求带 `error` 描述原因 |
| `get_task_status` | 查看统计 + 完整清单 |
| `delete_task` | 删除指定任务 |

每个工具都对应一个 handler（同步/异步均可），handler 返回一段面向用户的 emoji 文案，直接回灌到对话历史，LLM 就能基于上一轮结果决策下一步。

TaskManager 在 task-tools 里被作为**单例**导出，保证 REPL 内多轮对话共享同一份任务状态。

### 4. LLM 集成：`chatWithTaskManager`（src/llm.js）

相比 Day 3 的 `chatWithTools`（只跑一次工具），任务场景常常需要"拆 → 做 → 确认 → 下一步"反复多次，所以重新实现了多轮循环：

```
┌────────────────────────────┐
│ request LLM (带 task 工具) │──┐
└────────────────────────────┘  │
                                ↓
                    ┌─────────────────────┐
                    │ 有 tool_calls ?      │──否──→ 返回自然语言
                    └─────────────────────┘
                                │是
                                ↓
                    ┌─────────────────────┐
                    │ 把 assistant 消息    │
                    │ (含 tool_calls) 入史 │
                    └─────────────────────┘
                                ↓
                    ┌─────────────────────┐
                    │ 依次调 handler,     │
                    │ push tool 消息       │
                    └─────────────────────┘
                                └──→ 回到循环起点
```

关键实现细节：

- `MAX_ROUNDS = 20`：拆 3–8 个任务 × 每任务 `start + complete` 两步 + 首轮 `create_tasks`，需要 10 轮以上；留一些余量
- 支持并行 tool_calls：一次响应里 LLM 可以同时发 `start_task` 和 `complete_task`，拉低总轮次
- 签名 `chatWithTaskManager(messages, customTools = [], customToolHandlers = {})`：额外接受外部工具和 handler，方便后续把 MCP、weather 等都挂进来
- 参数解析失败兜底：`JSON.parse` 抛错时仍然 push 一条 `role:"tool"` 消息让循环继续
- 未知工具名也降级为错误消息，不会中断整个对话

### 5. 智能路由 REPL（src/agent/task.js）

文档原版的 Task 模式**一上来就强制拆分**，但现实里用户经常混着问（先问个概念、再让它拆系统）。所以这里把 system prompt 改造成"两步法"，让 LLM 自己判定：

> A. 简单对话 / 单点问答 → 直接自然语言回答，**不要**调用任何 task 工具
> B. 复杂需求 / 多步骤任务 → 调 `create_tasks` 拆 3–8 个子任务，然后 `start_task` → 产出 → `complete_task` 逐个推进

并给了"犹豫时倾向 A"的偏置，避免"什么是 async/await"这种提问也被误拆成任务。

REPL 自身命令：`/exit`、`/clear`（同时清空对话和任务列表）、`/status`（快速看进度）、`/help`。

### 6. CLI 接入（bin/cli.js）

```bash
j-agent task    # 或 j-agent t
```

帮助里标注"简单问答直接回答，复杂需求自动拆分"，降低用户认知成本。

### 7. 项目结构

```
j-agent/
├── bin/
│   └── cli.js
├── src/
│   ├── agent/
│   │   ├── index.js
│   │   ├── chat.js
│   │   ├── fc.js
│   │   ├── mcp.js
│   │   └── task.js           # 任务模式 REPL（含智能路由 prompt）
│   ├── tasks/
│   │   └── task-manager.js   # 状态机 + 持久化
│   ├── tools/
│   │   ├── index.js
│   │   ├── weather.js
│   │   └── task-tools.js     # 6 个 task 工具 + handlers
│   ├── mcp/...
│   ├── mcp-servers/...
│   ├── conversation.js
│   └── llm.js                # 含 chatWithTaskManager
└── package.json
```

## 验证结果

**单元级**：TaskManager 创建 → 状态流转 → 统计 → 持久化 → 重新加载，字段和状态完全保留。

**端到端**：

| 输入 | 任务数 | 行为 |
|---|---|---|
| `什么是 Function Call？` | 0 | 1 轮直接回答 ✅ |
| `async/await 和 Promise 区别？` | 0 | 1 轮表格对比 ✅ |
| `帮我规划一个博客系统的前端开发步骤` | 7 | 17 轮全部 completed，末尾给汇总 ✅ |

边界用例（概念对比）不会被误拆，明确"规划/步骤"类请求能稳定触发拆分+推进。

## 关键概念

| 概念 | 说明 |
|---|---|
| Task 状态机 | pending / in_progress / completed / failed 四态 + 明确转换 |
| Tool Handler | 接 LLM 工具调用，返回给 LLM 的文本结果 |
| 多轮循环 | 拿到工具结果后允许 LLM 再次决策是否调用下一批工具 |
| 智能路由 | 用 system prompt + 偏置，让模型自己区分问答 vs 任务 |

## 踩坑记录

1. **MAX_ROUNDS 一开始设 10 不够用** — 7 个任务需要 ≥ 15 轮，执行到一半就被截断。调到 20，并在 prompt 里鼓励并行 `start + complete` 才稳。
2. **assistant(tool_calls) 只能入史一次** — 与 Day 4 同一个坑：多个 tool_calls 时不能在 for 循环里反复 push 那条 assistant 消息。
3. **简单提问也被误拆** — system prompt 一开始只说"拆分复杂任务"，模型连"什么是变量"都想 `create_tasks`。加上"犹豫时倾向 A"的明确偏置立马改观。
4. **`updateTaskStatus` 的 result/error 不能用默认空串覆盖** — 原实现里 `if (result)` 过滤了空串，反而避免了这个坑，但阅读代码时要留意。

## 下一步

- Day 6 预告：多 Agents 协作（Supervisor-Worker、任务分配与结果聚合）
- 进一步可做：任务依赖图（DAG）、优先级、超时熔断、任务结果持久化到 `.j-agent/tasks.json`
- 把 MCP 的文件工具与任务工具合并挂在同一个 LLM 调用下——写代码类任务就能一边拆一边落盘

---

> 返回：[概述](../overview.zh-CN.md)
