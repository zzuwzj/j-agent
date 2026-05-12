# Day 6 - SubAgent：Agent 分身术，独立处理子任务

> 上一篇：[Day 5 - 任务管理：变身时间管理大师](day5.md) | **[概述](../overview.zh-CN.md)**

## 目标

让 Agent 能"分身"：主 Agent 只做编排和汇总，把"搜代码结构"、"读代码理解逻辑"、"制定实施方案"这些专业子任务委托给各自领域的 SubAgent。每个 SubAgent 有独立的系统提示、工具集和对话历史，互不污染。

## 完成内容

### 1. SubAgent 基类（src/agents/sub-agent.js）

极简设计，单一职责：

```js
const agent = new SubAgent({
  name: "explorer",
  description: "搜索和探索代码库结构",
  systemPrompt: "...",
  tools: fileSystemTools,
  handlers: fileSystemToolHandlers,
  maxRounds: 6,
});

await agent.run("列出 src 目录");
agent.reset();           // 清空对话历史
agent.getStats();        // { name, messageCount, toolCount }
agent.registerTool(...); // 运行时追加工具
```

内部每个 SubAgent 持有自己的 `ConversationManager`，保证跨调用时历史隔离；如果构造时不传 tools，则降级成无工具的 `chatCompletion` 纯推理。

### 2. 三个预设 SubAgent（src/agents/preset-agents.js）

| SubAgent | 定位 | 挂载工具 | 典型任务 |
|---|---|---|---|
| **explorer** | 代码库结构探索者 | `list_directory` / `read_file` | 列出 src 下的主要模块 |
| **researcher** | 代码深度分析者 | `list_directory` / `read_file` / `search_code` | 解释 `chatWithMCPTools` 的实现 |
| **planner** | 技术方案规划者 | 无（纯推理） | 基于分析结果给出优化方案 |

暴露的是工厂函数 `createXxxAgent()`，每次都返回新实例 —— 一个 session 开始时通过 `createSubAgentRegistry()` 一口气拿到三个互相独立的 agent，方便在同一次主对话里让同一个 SubAgent 跨轮次累积上下文。

### 3. Function Call 版基础工具

为了让 SubAgent 不依赖 MCP 子进程，新建了两个本地工具文件，安全检查沿用 Day 4 MCP Server 的 `resolveSafe` 思路：

- `src/tools/filesystem.js` — `read_file` / `list_directory`，自动过滤 `.` 开头目录和 `node_modules`
- `src/tools/code-analysis.js` — 在 filesystem 之上增加 `search_code`：纯 Node 实现的递归关键词搜索，跳过二进制扩展名和常见噪声目录，最多返回 50 条命中

这两个文件互相独立，不和现有 MCP FileSystem Server 冲突。

### 4. 委托工具（src/tools/delegate-tools.js）

主 Agent 与 SubAgent 的统一调用面：

| 工具 | 作用 |
|---|---|
| `delegate_task` | 把任务委托给指定 SubAgent（enum: explorer/researcher/planner），可选 `context` 字段把前序 SubAgent 的产出传递下去 |
| `list_sub_agents` | 列出所有可用 SubAgent 及其一句话描述 |

`createDelegateHandlers(registry)` 工厂同时返回 `{ handlers, logs }`：
- `handlers` 绑定到主 Agent 注册的同一组 SubAgent 实例，保证多轮 delegate 时 SubAgent 对话历史得以累积
- `logs` 记录每次委托的 agent / task / context / 耗时 / 状态，用于 REPL 侧的 `/logs` 命令

### 5. LLM 通用工具循环（src/llm.js 新增 `chatWithCustomTools`）

Day 3 的 `chatWithTools` 只支持写死的 `allTools` + 单轮；Day 5 的 `chatWithTaskManager` 支持多轮但耦合了 taskTools。SubAgent 需要一个纯净的通用工具循环：

```
chatWithCustomTools(messages, tools, handlers, { maxRounds = 10 })
```

特性：
- 任何 Function Call 工具 + handler 表都能挂上去
- handler 支持同步或 async，返回值自动 JSON-stringify
- 多轮循环，无工具调用时退出返回自然语言
- 参数解析失败、未知工具名都降级成 tool 消息回灌，不中断
- SubAgent 用它跑自己的工具；主 Agent 的 `delegate_tools` 也通过它调度；未来新增场景可直接复用

### 6. 主 Agent REPL（src/agent/subagent.js）

系统提示词把主 Agent 定位为"编排者"：

> 你不直接读文件/搜代码，而是把专业子任务委托给 SubAgent，然后汇总结果给用户。

交互流程：

```
用户输入 → 主 Agent 判断意图
  ├─ 简单问答 → 直接回答,不调 SubAgent
  └─ 复杂任务 → delegate_task(agent=explorer, task=..., context=...)
                ↓
             SubAgent 运行自己的工具循环
                ↓
            返回给主 Agent → 主 Agent 决定下一步
                ↓  (可能继续委托 researcher → planner)
             全部完成后,主 Agent 汇总回复
```

为了让主 REPL 侧能看到"黑盒"内部发生了什么，在 handler 外包了一层 `tracedHandlers`，每次 `delegate_task` 都会打印 📤 委托和 📥 返回事件。

REPL 斜杠命令：`/exit`、`/clear`（同时 reset 所有 SubAgent + 清空 logs）、`/agents`（看每个 SubAgent 累积的消息数和工具数）、`/logs`（看委托轨迹）、`/help`。

### 7. CLI 接入（bin/cli.js）

```bash
j-agent subagent    # 或 j-agent sa
```

### 8. 项目结构

```
j-agent/
├── bin/cli.js
├── src/
│   ├── agent/
│   │   ├── chat.js / fc.js / mcp.js / task.js
│   │   └── subagent.js        # 🆕 主 Agent REPL
│   ├── agents/                # 🆕 Day 6
│   │   ├── sub-agent.js       # SubAgent 基类
│   │   └── preset-agents.js   # explorer / researcher / planner
│   ├── tools/
│   │   ├── filesystem.js      # 🆕 FS Function Call 工具
│   │   ├── code-analysis.js   # 🆕 read + search_code
│   │   ├── delegate-tools.js  # 🆕 delegate_task / list_sub_agents
│   │   ├── task-tools.js
│   │   └── weather.js
│   ├── mcp/ mcp-servers/ tasks/
│   ├── conversation.js
│   └── llm.js                  # 🆕 chatWithCustomTools
└── docs/zh-CN|en/day6.md
```

## 验证结果

**结构性（不依赖 LLM）** — 全部通过：

- SubAgent 基类：实例化 / `registerTool` / `getStats` ✅
- `createSubAgentRegistry()` 每次返回独立实例 ✅
- 三个预设 agent 的工具清单：explorer=2 / researcher=3 / planner=0 ✅
- `delegate_task` 对未知 agentName 有兜底错误提示 ✅
- `list_sub_agents` 返回包含 explorer 的字符串清单 ✅
- `filesystem` / `code-analysis` 工具直跑通过（列出 src、`search_code MCPClient` 命中 9 处）✅

**端到端（走 LLM）** — DashScope 免费额度已用完，无法实时验证对话流；代码路径与 Day 4/5 的工具循环同构，理论上一致可运行。开通付费后运行 `node /tmp/j-agent-subagent-test.mjs` 即可复测。

## 关键概念

| 概念 | 说明 |
|---|---|
| Main/Sub 分离 | 主 Agent 只做编排和汇总；SubAgent 干脏活累活 |
| 独立上下文 | 每个 SubAgent 有自己的 ConversationManager，互不污染 |
| 委托工具 | `delegate_task` 是主 → Sub 的唯一通道；`context` 字段串联多步 |
| 通用工具循环 | `chatWithCustomTools` 抽取为纯净的多轮循环，复用性最大 |
| Trace 包装 | REPL 侧 `tracedHandlers` 打印委托事件，让黑盒变灰盒 |

## 踩坑记录

1. **Agent 实例共享导致状态污染** — 一开始把 preset-agents 导出为单例常量，会让不同 session 共享同一个对话历史；换成工厂函数 `createXxxAgent()` 后每个 session 独立干净。
2. **handlers 一定要和 registry 同一组实例绑定** — 如果 `delegate_task` 每次新建 agent，多轮委托就拿不到对话累积的上下文；`createDelegateHandlers(registry)` 闭包绑定固定实例解决。
3. **planner 没工具反而更稳** — 最早给 planner 也挂了 `search_code`，结果它经常去"再找点信息"而不是直接给方案。把它剥光，强制"基于上下文推理"，输出质量立刻提升。
4. **`chatWithTools` 耦合了全局 allTools** — 原来的 Function Call 方法写死了 `./tools/index.js` 的 `allTools`，无法给 SubAgent 注入不同的工具集。抽出 `chatWithCustomTools` 后 SubAgent 和主 Agent 都用上了同一条路径。
5. **search_code 要过滤 node_modules** — 第一版忘了过滤，在自己仓库里一搜关键词就卡死 Node 进程。

## 下一步

- Day 7 预告：多 Agent 协作网络（Agent 间互相通信，不经过主 Agent）
- 进阶方向：
  - SubAgent 结果缓存（相同任务复用）
  - 并行 `Promise.all` 执行独立 SubAgent
  - 超时控制（`Promise.race`）
  - 权限收敛（只读 SubAgent）
  - 与 Day 5 任务管理结合：每次 delegate 自动挂一个 Task 进度

---

> 返回：[概述](../overview.zh-CN.md)
