# j-agent

从零构建 AI Agent 的实战项目。逐步迭代，从 CLI 骨架到对话能力、工具调用、MCP 协议、任务管理，打造一个可扩展的命令行 AI 助手。

[English](README.md)

**技术栈：** Node.js (ESM) · Commander · OpenAI SDK · MCP SDK

**核心特性：**

- 流式多轮对话
- Function Call 工具调用
- MCP 协议（Client-Server，stdio 通信）
- 带状态机的任务管理，智能路由（简单问答直接回答，复杂需求自动拆分）
- 兼容 OpenAI / 阿里云 DashScope 等多平台

## 快速开始

```bash
# 克隆项目
git clone https://github.com/zzuwzj/j-agent.git
cd j-agent

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入 API Key（详见 docs/zh-CN/day2.md）
```

四种交互模式：

```bash
npx j-agent chat   # 纯流式对话
npx j-agent fc     # Function Call 模式（天气等）
npx j-agent mcp    # MCP 模式（通过 MCP Server 读本地文件）
npx j-agent task   # 任务模式（智能拆分 + 进度跟踪）
```

每种模式都支持 `/exit`、`/clear`、`/help`；`task` 额外有 `/status`。

## 开发日志

| 阶段 | 内容 | 关键词 |
|---|---|---|
| [Day 1](docs/zh-CN/day1.md) | 搭建基础 CLI 项目 | Commander、目录结构、命令解析 |
| [Day 2](docs/zh-CN/day2.md) | 实现基础 AI 聊天功能 | OpenAI SDK、流式输出、多轮对话、环境配置 |
| [Day 3](docs/zh-CN/day3.md) | Function Call：给 Agent 装上手和脚 | 工具定义、工具分发、双模式 CLI |
| [Day 4](docs/zh-CN/day4.md) | MCP：打开 AI 工具生态的大门 | MCP 协议、Client-Server、stdio、多轮工具调用 |
| [Day 5](docs/zh-CN/day5.md) | 任务管理：变身时间管理大师 | 状态机、任务工具、多轮循环、智能路由 REPL |

完整索引见 [docs/overview.zh-CN.md](docs/overview.zh-CN.md)。

## 演进路线

```
CLI 骨架 → AI 聊天 → 工具调用 → MCP 协议 → 任务管理 → 多 Agent (下一步)
 命令解析    流式对话   Function Call  Client-Server  状态机     Supervisor-Worker
            多轮上下文  双模式交互     外部工具接入   智能路由   任务协作
```

## License

[MIT](LICENSE)
