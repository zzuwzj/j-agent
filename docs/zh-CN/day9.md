# Day 9 - Agent 持久化与记忆：让 AI 记住一切

> 上一篇：[Day 8 - Agent Team：多 Agent 协作](day8.md) | **[概述](../overview.zh-CN.md)**

## 目标

把 Day 1-8 的能力都从「会话内」升级到「跨会话」。Agent 重启后还能记得用户偏好、当前项目的技术栈、过去做过的决策。靠的是一套**文件级持久化记忆系统** + **请求中间件** + **LLM 主动写入工具**三件套。

## 完成内容

### 1. MemoryManager（src/memory/manager.js）

文件级 KV 存储，按类型分子目录：

```
memory/
├── user_profiles/{userId}.json        用户画像与偏好
├── project_contexts/{projectId}.json  项目背景 + 决策列表
├── conversation_history/{sessionId}.json  对话历史
└── learned_knowledge/knowledge.json   零散知识
```

| 能力 | API |
|---|---|
| 画像 CRUD | `getUserProfile()` / `saveUserProfile()` / `updateUserPreference(key, value)` |
| 项目 CRUD | `getProjectContext()` / `saveProjectContext()` / `addProjectDecision()` / `forgetProject()` |
| 会话落盘 | `saveMessage(role, content)` / `getConversationHistory()` / `getRecentSessions()` |
| 知识 | `addKnowledge({category, content})` |
| 跨类型检索 | `searchMemories(query)` 返回 `{type, text}[]` |
| 维护 | `getStats()` / `cleanupOldSessions(days=30)` |
| 上下文切换 | `setCurrentUser/Project/Session(id)` |

设计要点：

- **原子写**：先写 `.tmp` 再 rename，避免崩溃时留下半截 JSON
- **路径注入防御**：`sanitizeId()` 把 `[^a-zA-Z0-9._-]` 替换成 `_`，并把 `..` 折成 `.`，防止 `../../etc/passwd` 之类的攻击
- **多用户隔离**：`setCurrentUser(id)` 切换后，画像/项目/会话各自独立
- **时间戳一律 ISO 字符串**：跨进程读出来类型稳定，不会突然变成 Date 对象

### 2. MemoryMiddleware（src/memory/middleware.js）

把记忆「织」进对话流的中间件：

```js
const enriched = await middleware.beforeRequest(messages);
// → 在原 system 之后插入一条 system,内容是【用户画像】+【当前项目】

const reply = await llm.chatWithCustomTools(enriched, memoryTools, handlers);

await middleware.afterRequest(userMessage, reply);
// → 落盘消息 + 启发式提取偏好 / 决策
```

`beforeRequest` 不修改原数组，返回新数组。`afterRequest` 返回 `{savedPreferences, savedDecisions}`，REPL 可以打印「自动提取并落盘」提示。

启发式提取通过几条保守正则做，目的是减少误记忆——更精确的写入交给 LLM 主动调用 `remember_xxx` 工具：

| 模式 | 命中示例 | 落点 |
|---|---|---|
| `(更喜欢|偏好|喜欢用|选择用?|习惯用) X` | "我更喜欢 TypeScript" | `preferences.preferredLanguage` |
| `代码风格 X` | "代码风格 ES6" | `preferences.codeStyle` |
| `用 中文/英文 回答` | "用中文回答" | `preferences.communicationLanguage` |
| `(决定|就用|最终选择) X` | "我们决定用 monorepo" | 当前项目的 decisions |
| `项目: X` / `开发一个 X 项目` | "项目：fe-shop" | `currentProjectId`(只切换,不写入) |

### 3. Memory 工具（src/tools/memory-tools.js）

让 LLM 显式记忆 / 召回的 6 个 Function Call 工具：

| 工具 | 用途 |
|---|---|
| `remember_preference(key, value)` | 写入用户画像偏好 |
| `remember_project(projectId, name, description?, techStack?)` | 写入项目元数据,并切换为当前项目 |
| `remember_decision(decision)` | 把决策写入当前项目(无当前项目则报错) |
| `switch_project(projectId)` | 切换活跃项目 |
| `recall_memory(query)` | 跨画像/项目/知识的关键词检索 |
| `get_memory_stats()` | 统计 + 当前 user/project/session |

复用 Day 7/8 的工厂模式：`createMemoryHandlers(manager)` 把 `manager` 闭包进 handlers，整个会话共享同一份状态。

### 4. Memory 模式 REPL（src/agent/memory.js）

启动流程：

1. `MemoryManager.initialize()` 创建子目录
2. `MemoryMiddleware.buildContextBlocks()` 在终端打印当前会被注入的背景，让用户一眼看到 AI 知道什么
3. 进入 REPL，每轮：
   - `middleware.beforeRequest` 注入背景到 system
   - `llm.chatWithCustomTools(..., memoryTools, traced)` 多轮工具调用
   - `middleware.afterRequest` 落盘 + 提取
   - 打印「自动提取并落盘」提示

斜杠命令：

| 命令 | 作用 |
|---|---|
| `/exit` | 退出 |
| `/clear` | 重置内存对话(磁盘记忆保留) |
| `/memory` | 看当前注入到 system 的背景 |
| `/sessions` | 列出最近 10 个会话 |
| `/switch-user <id>` | 切到另一个用户(独立画像) |
| `/switch-project <id>` | 切到已存在的项目 |
| `/forget-project <id>` | 删除项目所有上下文 |
| `/cleanup [days]` | 清理 N 天前的会话(默认 30) |
| `/help` | 帮助 |

### 5. CLI 接入

```bash
j-agent memory   # 或 j-agent me
```

### 6. 项目结构

```
j-agent/
├── src/
│   ├── memory/                 # 🆕 Day 9
│   │   ├── manager.js
│   │   └── middleware.js
│   ├── tools/
│   │   ├── memory-tools.js     # 🆕
│   │   └── (其他)
│   ├── agent/
│   │   ├── memory.js           # 🆕
│   │   └── chat|fc|mcp|task|subagent|skills|team.js
│   └── (其他)
├── memory/                     # 🆕 运行时数据目录(已加 .gitignore)
└── bin/cli.js                  # 🔄 +memory 子命令
```

## 验证

不依赖 LLM 的结构化测试，全部通过：

- 子目录初始化、画像偏好读写、项目上下文/决策 CRUD ✅
- 会话落盘、跨类型搜索 ✅
- `MemoryMiddleware.beforeRequest` 在原 system 之后正确插入背景 ✅
- 启发式提取「更喜欢 Python，我们决定用 monorepo」→ 偏好+决策双命中 ✅
- handlers:`remember_preference` / `remember_project` 后 `currentProjectId` 自动切换、`remember_decision` 在没有项目时正确报错、`switch_project` 找不到时返回 ❌、`recall_memory` 命中后格式化输出 ✅
- 工具数量 = 6,名字与定义一致 ✅
- 多用户隔离:`setCurrentUser('alice')` 后画像独立,切回 `default` 仍读到原画像 ✅
- 路径注入防御:`setCurrentUser('../../../etc/passwd')` 落地的文件名不含 `/` 也不含 `..` ✅
- `j-agent --help` / `j-agent memory --help` 通过 ✅

端到端(带 LLM)和 Day 7/8 一样,本地无付费 key 跑不起来,但工具循环复用 `chatWithCustomTools`,跟前面的 Skills/Team 同模式,接通就能用。

## 关键概念

| 概念 | 说明 |
|---|---|
| 短时 vs 长时 | `ConversationManager` 还是会话内的;`MemoryManager` 才是跨会话 |
| 显式 vs 隐式 | LLM 调 `remember_xxx` 是**显式**记忆(更准);中间件正则提取是**隐式**记忆(更省事) |
| 中间件 | `beforeRequest`/`afterRequest` 包住每轮对话,业务代码不感知 |
| 工厂 + 闭包 | `createMemoryHandlers(manager)` 让一个 manager 实例服务整个会话 |
| 原子写 | `.tmp` + rename,防止半截 JSON |
| 路径 sanitize | `sanitizeId` 双保险:换非法字符 + 折点 |

## 与文档版本的差异

1. **决策结构升级**:文档里 decisions 是 `string[]`,我换成 `{content, createdAt}[]`,方便后续做时间衰减或筛选最近 N 条。
2. **更稳的提取规则**:文档的偏好正则只有 `喜欢.*?(\w+)`,会把"喜欢吃苹果"也存进 preferredLanguage。我用一组更明确的引导词(`更喜欢/偏好/喜欢用/选择用/习惯用`),并且只在没当前项目时才识别"项目: X",避免重复触发。
3. **路径注入防御**:文档没处理 `userId = '../../etc/passwd'` 之类的输入,我用 `sanitizeId` 一层兜底。
4. **原子写 + 损坏文件容错**:文档直接 `fs.writeFile`,中途 SIGINT 会留下半截 JSON 导致下次读全炸。我先写 `.tmp` 再 rename;读到 `SyntaxError` 也不直接 throw,而是 warn + 当作 null。
5. **工厂模式**:同 Day 7/8,`createMemoryHandlers(manager)` 而不是模块级单例,避免多个会话共享一个 manager。
6. **REPL 反馈循环**:每轮对话后,如果中间件提取到偏好或决策,会主动打印一行灰色 `(自动提取并落盘:...)`,让用户知道哪些信息被悄悄记下了——避免「我没让你记你怎么记下的」的困扰。

## 踩过的坑

1. **Date 序列化**:第一版直接存 `new Date()`,JSON.parse 后变成字符串,`getMemoryWeight()` 之类的函数算时间差就崩了。统一改成 `nowIso()` 返回 ISO 字符串,读出来用 `new Date(str).getTime()`。
2. **system 消息插入位置**:第一版用 `messages.unshift(memoryNote)`,把记忆放到原 system **之前**,LLM 容易先按记忆里的"项目用 React"来回答而不是当前对话主题。改成插在原 system **之后**、第一条非 system **之前**,优先级正确。
3. **决策无项目时的兜底**:文档版本会偷偷新建一个以 projectId 为名的空项目。我改成直接报错,因为大多数情况下是 LLM 漏调了 `remember_project`,新建一个空壳项目反而埋雷。
4. **正则误伤**:`PREFERENCE_PATTERNS` 第一版写得太宽,"我喜欢吃苹果"会把 "苹果" 存进 preferredLanguage。加引导词限定后,精确度高多了。

## 下一步

- Day 10 安全与权限控制:危险操作二次确认、命令分级、审计日志
- 持续方向:
  - 向量化检索:目前 `searchMemories` 是关键词匹配,加上 embedding 后能召回语义近似的记忆
  - 记忆摘要:对话超过 N 条后自动总结,只保留摘要节省后续 token
  - 记忆衰减:旧的偏好/决策权重随时间下降,避免"3 年前喜欢 Python 现在还在 system 里晃"
  - 加密存储:涉及敏感信息时用 AES 加密 user_profiles
  - 更换后端:把 JSON 文件换成 SQLite / 向量库,接口不变

---

> 返回:[概述](../overview.zh-CN.md)
