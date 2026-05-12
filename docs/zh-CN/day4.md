# Day 4 - MCP：打开 AI 工具生态的大门

> 上一篇：[Day 3 - Function Call：给 Agent 装上手和脚](day3.md) | **[概述](../overview.zh-CN.md)**

## 目标

实现 MCP（Model Context Protocol）协议，让 Agent 能以"即插即用"的方式连接外部工具服务，而不是把工具代码写死在仓库里。

## 完成内容

### 1. FileSystem MCP Server（src/mcp-servers/filesystem-server.js）

基于 `@modelcontextprotocol/sdk` 实现一个本地文件系统 Server，暴露两个只读工具：

| 工具 | 能力 |
|---|---|
| `read_file` | 读取指定文件的全部内容 |
| `list_directory` | 列出目录下的文件和文件夹 |

- 通过 `StdioServerTransport` 以子进程 + stdio 的方式与 Client 通信
- 使用 `path.resolve()` + `startsWith()` 双重校验，严格限制只能访问启动时指定的 `rootPath`，防止路径遍历攻击
- 日志走 stderr，不污染 stdio 协议通道

### 2. MCP Client 封装（src/mcp/client.js）

封装 SDK 的高层 API，屏蔽 `request` 的底层细节：

- `connectServer(name, command, args)` — 启动并连接 Server，按名称索引，重复连接复用
- `listTools(serverName)` — 列出工具，并做一层内存缓存
- `listAllTools()` — 聚合所有 Server 的工具列表，输出 `{serverName, tool}` 结构
- `callTool(serverName, toolName, args)` — 调用工具并把 `content` 展平为纯文本；遇到 `isError` 时抛错
- `disconnectAll()` — 真正 `client.close()`，避免子进程泄漏

### 3. LLM 集成 MCP 工具（src/llm.js）

`LLMClient` 新增两个方法：

- `initMCP()` — 连接 FileSystem Server，把 MCP 工具描述转成 OpenAI Function Call 格式缓存，工具命名统一为 `serverName:toolName`，避免跨 Server 重名
- `chatWithMCPTools(messages)` — 支持 **多轮工具调用** 的对话循环，上限 5 轮：

```
┌──────────────────────────┐
│  request LLM (带 tools)   │──┐
└──────────────────────────┘  │
                              ↓
                    ┌──────────────────────┐
                    │ 有 tool_calls?        │──否──→ 返回自然语言
                    └──────────────────────┘
                              │是
                              ↓
                    ┌──────────────────────┐
                    │ 把 assistant 消息     │
                    │ (含 tool_calls) 入历史│
                    └──────────────────────┘
                              ↓
                    ┌──────────────────────┐
                    │ 依次执行每个工具并    │
                    │ push tool 消息        │
                    └──────────────────────┘
                              └── 回到循环起点
```

修复了前一版的两个问题：
- assistant(tool_calls) 消息在 for 循环里被重复 push
- 只支持单轮工具调用，LLM 拿到工具结果后无法再追加调用

### 4. CLI 新增 mcp 子命令（bin/cli.js、src/agent/mcp.js）

```bash
j-agent mcp    # 启动 MCP 模式（别名 m），可读取本地文件、列目录
```

交互模式沿用 `/exit`、`/clear`、`/help` 指令。进入时自动 `initMCP()`，退出时 `disconnectMCP()` 彻底关闭子进程。

### 5. 项目结构

```
j-agent/
├── bin/
│   └── cli.js
├── src/
│   ├── agent/
│   │   ├── index.js          # 统一导出
│   │   ├── chat.js           # 纯聊天模式
│   │   ├── fc.js             # Function Call 模式
│   │   └── mcp.js            # MCP 模式
│   ├── mcp/
│   │   ├── index.js
│   │   └── client.js         # MCP Client 封装
│   ├── mcp-servers/
│   │   └── filesystem-server.js  # 文件系统 Server
│   ├── tools/
│   │   ├── index.js
│   │   └── weather.js
│   ├── conversation.js
│   └── llm.js                # 含 chatWithMCPTools
├── .env.example
└── package.json
```

## 验证结果

```bash
$ j-agent --help
Commands:
  chat|c    启动纯聊天模式
  fc|f      启动 Function Call 模式（可调用工具）
  mcp|m     启动 MCP 模式（可连接文件系统等 MCP Server）
  start|s   启动 AI Agent（同 chat）
```

实测：

```
> src 目录下有哪些文件？
⚙️ 第 1 轮：执行 1 个 MCP 工具调用...
   → filesystem:list_directory { path: 'src' }
✓ 请求完成，经历 2 轮对话

> 请先看看 src 目录结构,然后告诉我 package.json 里的依赖
⚙️ 第 1 轮：执行 2 个 MCP 工具调用...
   → filesystem:list_directory { path: 'src' }
   → filesystem:read_file { path: 'package.json' }
```

并行多工具调用和多轮工具调用都能正常工作。

## 关键概念

| 概念 | 说明 |
|---|---|
| MCP Server | 提供工具能力的独立进程/服务，通过 stdio 或 HTTP 暴露 |
| MCP Client | 连接并调用 Server 的一端，这里就是 Agent 本身 |
| Transport | 通信方式，本地用 stdio，远程用 StreamableHTTP |
| Tool 命名 | 统一为 `serverName:toolName`，避免不同 Server 的工具重名 |

Function Call 与 MCP 对比：

| 维度 | Function Call | MCP |
|---|---|---|
| 工具定义 | 写死在 Agent 代码里 | 独立进程,按需启动 |
| 扩展性 | 新工具 = 改代码 | 新工具 = 启动新 Server |
| 生态 | 无 | 有（npm 上已有大量开源 Server） |
| 适合场景 | 核心业务工具、高频、对延迟敏感 | 第三方通用工具、隔离执行环境 |

项目里两者**并存**：`weather` 这类核心工具走 Function Call，文件读取这类通用能力走 MCP。

## 踩坑记录

1. **SDK 的 `client.request()` 签名不直观** —— 示例文档给的是 `request({method}, {method, params})`，实际在 `@modelcontextprotocol/sdk ^1.29` 里直接用高层 API `client.listTools()` / `client.callTool({name, arguments})` 更稳
2. **Server 的日志必须走 stderr** —— 如果 Server 把启动提示 `console.log` 到 stdout，会污染 stdio 协议流，Client 连接时直接 `JSON parse error`
3. **assistant(tool_calls) 只能 push 一次** —— 多个工具并行调用时，若把 assistant 消息写进 for 循环里会被重复 push，导致 LLM 看到错乱的对话历史
4. **必须调用 `client.close()`** —— 不关 Client，Server 子进程会一直挂着，反复开启会残留多个 node 进程

## 下一步

- 实现多 Agent 协作（Day 5 预告）
- 给 Agent 加上工具调用审批机制，危险操作人工确认
- 尝试连接官方 MCP Server（github、fetch、sqlite 等）

---

> 返回：[概述](../overview.zh-CN.md)
