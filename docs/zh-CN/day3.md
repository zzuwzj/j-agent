# Day 3 - Function Call：给 Agent 装上手和脚

> 上一篇：[Day 2 - 实现基础 AI 聊天功能](day2.md) | **[概述](../overview.zh-CN.md)** | 下一篇：[Day 4 - MCP：打开 AI 工具生态的大门](day4.md)

## 目标

实现 Function Call 工具调用，让 AI 从"只会聊天"升级为"能办实事"。

## 完成内容

### 1. 天气查询工具（src/tools/weather.js）

定义了第一个工具 `getCurrentWeather`，包含：
- 工具实现函数 — 获取城市天气信息（当前为模拟数据）
- 工具定义清单 — `name`、`description`、`parameters`，传递给 LLM 让其判断何时调用

关键点：`description` 越详细，AI 判断何时调用越准确。

### 2. 工具分发器（src/tools/index.js）

- 合并所有工具定义为 `allTools` 数组，新增工具时在此添加
- `executeTool` 分发器根据函数名路由到对应实现

### 3. 改造 LLM 客户端（src/llm.js）

新增 `chatWithTools(messages)` 方法，实现完整的 Function Call 流程：

1. **第一次请求** — AI 判断是否需要调用工具（`tool_choice: "auto"`）
2. **执行工具** — 根据 AI 返回的函数名和参数调用实际函数
3. **第二次请求** — AI 根据工具结果生成自然语言回复

错误处理：工具执行失败时将错误信息返回给 AI，而非直接抛出。

### 4. 重构 CLI 为双模式（src/agent/）

将聊天逻辑从 `bin/cli.js` 拆分到 `src/agent/` 目录：

| 文件 | 功能 |
|---|---|
| `src/agent/chat.js` | 纯聊天模式，流式输出 |
| `src/agent/fc.js` | Function Call 模式，支持工具调用 |
| `src/agent/index.js` | 统一导出 |

CLI 命令：

```bash
j-agent chat    # 纯聊天模式（别名 c）
j-agent fc      # Function Call 模式（别名 f）
j-agent start   # 同 chat，兼容旧版
```

### 5. 项目结构

```
j-agent/
├── bin/
│   └── cli.js
├── src/
│   ├── agent/
│   │   ├── index.js      # 统一导出
│   │   ├── chat.js       # 纯聊天模式
│   │   └── fc.js         # Function Call 模式
│   ├── tools/
│   │   ├── index.js      # 工具分发器
│   │   └── weather.js    # 天气查询工具
│   ├── conversation.js
│   └── llm.js
├── .env.example
└── package.json
```

## 验证结果

```bash
$ j-agent --help
Commands:
  chat|c    启动纯聊天模式
  fc|f      启动 Function Call 模式（可调用工具）
  start|s   启动 AI Agent（同 chat）
```

## 关键概念

| 概念 | 说明 |
|---|---|
| Tool Definition | 工具定义，告诉 AI 有哪些工具可用 |
| Tool Choice | AI 决定是否调用工具及调用哪个 |
| Tool Call | 工具调用请求（包含函数名和参数） |
| Tool Response | 工具执行结果，以 `role: "tool"` 格式返回 |

Function Call 与 MCP 对比：

| 特性 | Function Call | MCP |
|---|---|---|
| 工具定义 | 代码内嵌 | 外部服务 |
| 扩展性 | 需要改代码 | 即插即用 |
| 适合场景 | 核心工具 | 第三方工具 |

## 下一步

- 实现 MCP（Model Context Protocol）协议
- MCP Client-Server 架构
- 实现文件系统 MCP Server
- 连接官方和社区 MCP 工具

---

> 返回：[概述](../overview.zh-CN.md)