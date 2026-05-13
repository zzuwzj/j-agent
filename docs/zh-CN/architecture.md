# j-agent 架构设计

> 大道至简：每一层只解决一件事。

## 一、整体分层

```
┌─────────────────────────────────────────────┐
│  bin/cli.js          ← 入口：注册八种模式    │
├─────────────────────────────────────────────┤
│  src/agent/*.js      ← 模式层：每模式一个 REPL│
│  chat  fc  mcp  task  subagent  skills  team  memory │
├─────────────────────────────────────────────┤
│  LLMClient + ConversationManager  ← 内核    │
├─────────────────────────────────────────────┤
│  能力层（按需启用）                          │
│  tools/  mcp/  tasks/  agents/               │
│  skills/ team/   memory/                     │
├─────────────────────────────────────────────┤
│  外部资源：skills/ 目录、memory/ 目录、MCP Server │
└─────────────────────────────────────────────┘
```

## 二、内核：两个最小抽象

整个项目最关键的两个类：

| 模块 | 职责 | 关键 API |
|---|---|---|
| `LLMClient` (src/llm.js) | 封装与 LLM 的所有交互 | `streamChatCompletion` / `chatCompletion` / `chatWithTools` / `chatWithCustomTools` / `chatWithTaskManager` / `chatWithMCPTools` |
| `ConversationManager` (src/conversation.js) | 维护一条对话的消息历史，控制窗口 | `addMessage` / `getFormattedHistory` / `clear` |

所有模式都靠这两个类组合出来。`chatWithCustomTools` 是通用工具循环（任意 tools + handlers），SubAgent / Team / Skills 都复用它。

## 三、八种模式：能力的渐进叠加

每种模式只在 `system prompt + 工具集` 上做差异，REPL 框架几乎一致。

```
chat       流式对话                 仅 LLM
fc         + 本地工具调用            allTools (天气等)
mcp        + 外部协议工具            MCPClient (stdio)
task       + 任务状态机              taskTools + TaskManager
subagent   + 主从委托                delegateTools → SubAgent
skills     + 领域知识按需加载        skillsTools → SkillsManager
team       + 多 Agent 去中心协作     MessageBus + TeamAgent
memory     + 跨会话持久化            MemoryManager + Middleware
```

每升一级，都只引入一个新概念。前一级的能力可被后一级复用，但不强耦合。

## 四、四个关键设计

### 1. SubAgent：上下文隔离

主 Agent 不直接干活，通过 `delegate_task` 工具把子任务派给 explorer / researcher / planner。每个 SubAgent 拥有独立的 `ConversationManager`，互不污染主对话。返回结果由主 Agent 汇总。

→ 解决：长任务上下文爆炸、专业能力混杂。

### 2. Skills：元数据常驻 + 内容懒加载

启动时只扫所有 `skills/<name>/meta.json`（轻量），写进 system prompt。LLM 决定要哪个 Skill 时，调 `load_skill` 工具按需读 `SKILL.md`。已加载内容缓存在内存，热更新可清缓存。

→ 解决：知识规模变大时 token 浪费。

### 3. Team：消息总线 + 广播汇总

所有 TeamAgent 订阅同一个 `MessageBus`。`coordinate(task)` 用 broadcast 发出，`publish` 内部 `await` 所有 handler，等价于"所有响应都到位"再汇总。无需轮询/超时。`maxForward = 3` 防止广播无限循环。

→ 解决：去中心化协作、Agent 间松耦合通信。

### 4. Memory：文件存储 + 中间件织入

```
memory/
  user_profiles/{userId}.json       显式：偏好、画像
  project_contexts/{projectId}.json 显式：技术栈、决策
  conversation_history/{sessionId}.json 隐式：每轮对话
  learned_knowledge/knowledge.json  隐式：零散知识
```

- 写入：原子写（`.tmp` + rename），路径输入 `sanitizeId` 清洗防注入。
- 读出：`MemoryMiddleware.beforeRequest` 把画像/项目/最近决策拼成 system 注入。
- 双通道：LLM 主动调 memory tools 写（精确）；中间件用正则启发式提取偏好/决策（保守，减少误记）。

→ 解决：跨会话遗忘。

## 五、流程示例：一次 SubAgent 调用

```
用户输入
  ↓
chatWithSubAgent (REPL)
  ↓
LLMClient.chatWithCustomTools(messages, delegateTools, handlers)
  ├── LLM: 决定调 delegate_task(agentName="explorer", task="…")
  ├── handler: 找到 explorer SubAgent → agent.run(task)
  │     └── 内部走 chatWithCustomTools（独立 conversation）
  ├── 把工具结果塞回 messages
  └── LLM: 综合结果生成最终回复
  ↓
打印 + 写回主对话历史
```

工具循环最多 `maxRounds` 轮，避免死循环；超限优雅退出。

## 六、设计原则

1. **单一职责**：每个文件只做一件事。`MessageBus` 只管路由，不管业务；`MemoryManager` 只管存取，不管提取规则（提取在 Middleware）。
2. **LLM 自主路由**：复杂/简单的判定写在 system prompt 里交给 LLM，代码不写硬规则（任务模式、SubAgent 都是这个套路）。
3. **可组合**：能力层之间正交，可以叠加（例如未来把 memory + team 合并）。
4. **渐进式**：从 Day 1 的 50 行 CLI 长到 Day 9 的多模式系统，每天只新增一个能力，不重写。
5. **工具优于硬编码**：让 LLM 通过工具调用驱动行为，而不是 if/else。

## 七、演进路线

```
Day 1 CLI → Day 2 流式对话 → Day 3 工具 → Day 4 MCP →
Day 5 任务 → Day 6 SubAgent → Day 7 Skills → Day 8 Team →
Day 9 Memory → Day 10+ 安全与权限
```

每一步只解决一个痛点，不提前抽象。

---

参考：[overview.zh-CN.md](../overview.zh-CN.md) · [day1–day9](.) · [README](../../README.zh-CN.md) · [English](../en/architecture.md)
