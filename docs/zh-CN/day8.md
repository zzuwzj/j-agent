# Day 8 - Agent Team：多 Agent 协作，构建 AI 梦之队

> 上一篇：[Day 7 - Skills：按需加载领域知识](day7.md) | **[概述](../overview.zh-CN.md)**

## 目标

把 Day 6 的"主从委托"升级成"团队协作"：多个 Agent 通过共享的**消息总线**通信，去中心化地完成复杂任务。主 Agent 只负责"调度 + 汇总"，团队成员之间也能互发消息，必要时还能广播任务收集多视角输出。

## 完成内容

### 1. 消息总线（src/team/message-bus.js）

Agent 之间松耦合通信的基础设施：

| 能力 | API |
|---|---|
| 订阅/取消订阅 | `subscribe(agentId, handler)` / `unsubscribe(agentId, handler)` |
| 单播 | `send(from, to, content, type='request')` |
| 广播 | `broadcast(from, content)` — 跳过发送者本人，避免自循环 |
| 历史查询 | `getHistory(agentId?, limit=20)` — 滚动窗口 100 条 |
| 转发保护 | 单条消息最多转发 3 次，超限丢弃并告警 |

设计要点：

- `subscribers: Map<agentId, Set<handler>>`，O(1) 查找、支持同一 Agent 注册多个 handler
- `publish` 内部 `await` 每个 handler，所以 `broadcast()` 返回时所有响应已经回灌到历史 —— 这让 Manager 的 coordinate 不需要 `setTimeout` 等待
- 消息 ID = `msg_<timestamp>_<random>`，便于追踪和去重

### 2. TeamAgent 基类（src/team/team-agent.js）

每个 Team Agent 持有：

- 独立的 `ConversationManager`（system prompt 自动拼上"你的角色"和"团队协作"说明）
- 独立的 `LLMClient`
- 共享的 `messageBus` 引用
- 可选的 Function Call 工具集

核心方法：

```js
agent.sendTo(otherId, content)   // 发请求给某个 Agent
agent.broadcast(content)         // 广播
agent.handleMessage(message)     // 默认行为：request/broadcast → processRequest → response
agent.processRequest(content)    // 子类可重写；默认走 LLM(可带工具)
agent.run(task)                  // 直接执行，不经消息总线
```

`handleMessage` 收到消息时会过滤"自己发的消息"，避免 broadcast 时回环。处理完 `request`/`broadcast` 后自动给 `from` 回一条 `response`，让协调者能从 history 取到结果。

### 3. 三个预设 Team Agent（src/team/preset-agents.js）

| Agent | 角色 | 挂载工具 | 输出风格 |
|---|---|---|---|
| **explorer** | 代码库探索者 | `list_directory` / `read_file` | 条目化结构概览 |
| **researcher** | 代码分析师 | `list_directory` / `read_file` / `search_code` | 带行号的深度分析 |
| **advisor** | 技术顾问 | 无（纯推理） | 按优先级排序的建议 |

复用了 Day 6 的 `fileSystemTools` 和 `codeAnalysisTools`，相比文档版本的"硬编码字符串响应"是真能干活的实现。

### 4. AgentTeam 管理器（src/team/manager.js）

```js
const team = new AgentTeam();
await team.initialize();

await team.callAgent('explorer', '列出 src 目录');     // 单点调用，不经总线
await team.coordinate('评估这个项目的代码质量');       // 广播 + 汇总
team.reset();                                           // 重置所有 Agent + 总线历史
team.setVerbose(true);                                  // 打印每条流过的消息
team.getStats();                                        // Agent 数 / 消息数 / 各 Agent 计数
```

`coordinate(task)` 流程：

1. 记录广播前的 `messageHistory` 长度作为起点
2. `messageBus.broadcast` —— 内部 `await` 所有 handler，等价于"所有响应已到位"
3. 取 startIndex 之后的 `response` 类型且 `to === 'coordinator'` 的消息
4. 按 Agent 名汇总输出

不依赖 `setTimeout`，行为稳定可测。

### 5. Team 工具集（src/tools/team-tools.js）

主 Agent 通过 Function Call 调度团队的四件套：

| 工具 | 作用 |
|---|---|
| `call_agent(agentId, task)` | 单点调用某个专家 |
| `coordinate_team(task)` | 广播任务、汇总多视角输出 |
| `list_agents` | 看团队成员 |
| `get_team_stats` | 看各 Agent 的对话计数和消息总线状态 |

`createTeamHandlers(team)` 工厂把 team 实例闭包进 handlers，与 Day 7 的 `createSkillsHandlers` 同构：一次 session 内同一组 Agent 共享对话历史和消息总线状态。

### 6. Team 模式 REPL（src/agent/team.js）

system prompt 把团队成员、调度规则、约束写得很明确，让主 Agent 知道：

- 简单闲聊不要调度团队
- 单一专家就能搞定的用 `call_agent`
- 多视角协同的复杂任务才用 `coordinate_team`
- 团队返回的内容**整合后**用自然语言回复用户，不要原样转发

REPL 侧包了 `traced` handlers，每次 `call_agent` / `coordinate_team` 在控制台打印调度记录（耗时 + 返回字符数）。

斜杠命令：

| 命令 | 作用 |
|---|---|
| `/exit` | 退出 |
| `/clear` | 重置主对话和所有 Team Agent |
| `/agents` | 查看团队成员 |
| `/stats` | 查看统计 |
| `/messages` | 查看消息总线最近 20 条（含 type/from/to/preview） |
| `/verbose` | 切换：每条消息流过总线时打印一行 |
| `/help` | 帮助 |

### 7. CLI 接入

```bash
j-agent team    # 或 j-agent tm
```

### 8. 项目结构

```
j-agent/
├── src/
│   ├── team/                    # 🆕 Day 8
│   │   ├── message-bus.js       # 消息总线
│   │   ├── team-agent.js        # Team Agent 基类
│   │   ├── preset-agents.js     # explorer / researcher / advisor
│   │   └── manager.js           # AgentTeam 管理器
│   ├── tools/
│   │   ├── team-tools.js        # 🆕 主 Agent 调度工具
│   │   └── (其它)
│   ├── agent/
│   │   ├── team.js              # 🆕 Team 模式 REPL
│   │   └── chat|fc|mcp|task|subagent|skills.js
│   └── (其它)
└── bin/cli.js                   # 🔄 +team 子命令
```

## 验证结果

**结构性**（不依赖 LLM，全部通过）：

- MessageBus 单播只发给 to，广播跳过发送者本人 ✅
- 消息历史正确写入并按 100 条滚动 ✅
- 转发计数 > 3 时丢弃并告警 ✅
- AgentTeam 初始化后注册 3 个 Agent，`getStats()` 输出符合预期 ✅
- TeamAgent.handleMessage 收到 request/broadcast 自动回 response，过滤自己发的消息 ✅
- coordinate 广播 → 收集响应 → 按 Agent 名汇总 ✅（用 mock processRequest 跑通端到端）
- `list_agents` / `get_team_stats` / `call_agent`(unknown) handler 输出符合预期 ✅
- `j-agent --help` / `j-agent team --help` 子命令信息完整 ✅

**端到端**（走 LLM）：DashScope 免费额度仍未恢复，没办法实测对话流。代码路径与 Day 6 / Day 7 的工具循环同构，切付费 key 后直接 `npx j-agent team` 即可复测。

## 关键概念

| 概念 | 说明 |
|---|---|
| 去中心化 | 没有"主 Agent"占优，coordinator 只是一个 ID，Agent 之间也可互发消息 |
| 消息驱动 | 所有协作走 messageBus，松耦合、易追溯 |
| 同步广播 | `publish` 内部 `await` 所有 handler，`broadcast()` 返回时所有响应已到位 |
| 工厂 + 闭包 | `createTeamHandlers(team)` 让 session 内共享同一团队状态 |
| 转发保护 | `forwardCount > maxForward` 自动丢弃，避免广播-响应链无限循环 |

## 和文档版本的差异

1. **去掉了 `setTimeout(2000)` 的占位**。文档原始 `coordinate` 用 `setTimeout` 等响应，行为不稳定（响应慢就会丢）。改为利用"`publish` 内部 await 所有 handler"的同步语义：广播返回时所有响应天然在历史里。
2. **预设 Agent 真能干活**。文档示例的 `processRequest` 是硬编码字符串。我让 Explorer/Researcher 复用 Day 6 的本地工具集（`fileSystemTools`/`codeAnalysisTools`），Advisor 走纯推理，Team 模式启动后是能真正读文件和分析代码的。
3. **加了消息转发保护**。`forwardCount > 3` 丢弃，避免广播-响应链可能的回环。
4. **`handleMessage` 过滤自己**。订阅时 Manager 已经过滤了 `to === self.id || to === 'broadcast'`，但 Agent 内部再加一道 `from === this.id` 过滤，让"广播到自己"也安全（订阅者层面已过滤，内部再加一层属于深防御）。
5. **工厂模式**。和 Day 6/7 一致，Manager 不做模块级单例，每次 `chatWithTeam` 启动新实例。

## 踩坑记录

1. **广播到自己会回环**。第一版 `MessageBus.publish` 没过滤 `from === agentId`，结果 Agent 自己广播后自己也会收到，进而回 response，进而再广播…… 改成"广播跳过发送者"后立刻清净。
2. **coordinate 必须按 startIndex 切片**。如果直接 `getHistory().filter(type==='response')`，前面 session 的旧响应会被混进来。改为用 `messageHistory.length` 作为起点切片，只取本次广播之后的响应。
3. **Agent 角色信息要单独拼**。一开始 system prompt 只写了"你是 Explorer"，LLM 经常忘记自己叫什么。把"名字/角色/描述"独立成一个 markdown 块拼在 user-defined prompt 后面，模型自我认知就稳定了。
4. **不要让 advisor 也挂工具**。advisor 是纯推理的"军师"，挂工具反而会让它去读文件而不是给建议。空 tools + 纯 chatCompletion 跑得最干净。

## 下一步

- Day 9 预告：Agent 持久化与记忆（跨会话记住用户偏好）
- 进阶方向：
  - 新增 Reviewer / Tester / Refactorer 等专业 Agent
  - 链式协作：Explorer → Researcher → Advisor 的 pipeline 模式
  - 共识机制：多个 Agent 投票决定方案
  - 智能任务分发：根据关键词路由给最合适的 Agent
  - 和 Memory 结合：把团队协作的过程持久化为可追溯的工作日志

---

> 返回：[概述](../overview.zh-CN.md)
