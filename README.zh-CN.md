# j-agent

从零构建 AI Agent 的实战项目。逐步迭代，从 CLI 骨架到对话能力、工具调用、MCP 协议、任务管理、主从 Agent 分工、按需加载的 Skills 知识库、多 Agent 团队协作，打造一个可扩展的命令行 AI 助手。

[English](README.md)

**技术栈：** Node.js (ESM) · Commander · OpenAI SDK · MCP SDK

**核心特性：**

- 流式多轮对话
- Function Call 工具调用
- MCP 协议（Client-Server，stdio 通信）
- 带状态机的任务管理，智能路由（简单问答直接回答，复杂需求自动拆分）
- SubAgent 架构：主 Agent 通过 `delegate_task` 调度专职 SubAgent（explorer / researcher / planner）
- Skills：按需加载领域知识（git / docker / javascript），元数据常驻、内容懒加载
- Agent Team：多 Agent 通过共享消息总线去中心化协作（explorer / researcher / advisor），支持单点调用与广播汇总
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

七种交互模式：

```bash
npx j-agent chat       # 纯流式对话
npx j-agent fc         # Function Call 模式（天气等）
npx j-agent mcp        # MCP 模式（通过 MCP Server 读本地文件）
npx j-agent task       # 任务模式（智能拆分 + 进度跟踪）
npx j-agent subagent   # SubAgent 模式（主 Agent 委托 explorer / researcher / planner）
npx j-agent skills     # Skills 模式（按需加载 skills/ 下的领域知识）
npx j-agent team       # Team 模式（多 Agent 通过消息总线协作，支持广播汇总）
```

每种模式都支持 `/exit`、`/clear`、`/help`；`task` 额外有 `/status`；`subagent` 额外有 `/agents`、`/logs`；`skills` 额外有 `/skills`、`/stats`、`/reset-cache`；`team` 额外有 `/agents`、`/stats`、`/messages`、`/verbose`。

## 开发日志

| 阶段 | 内容 | 关键词 |
|---|---|---|
| [Day 1](docs/zh-CN/day1.md) | 搭建基础 CLI 项目 | Commander、目录结构、命令解析 |
| [Day 2](docs/zh-CN/day2.md) | 实现基础 AI 聊天功能 | OpenAI SDK、流式输出、多轮对话、环境配置 |
| [Day 3](docs/zh-CN/day3.md) | Function Call：给 Agent 装上手和脚 | 工具定义、工具分发、双模式 CLI |
| [Day 4](docs/zh-CN/day4.md) | MCP：打开 AI 工具生态的大门 | MCP 协议、Client-Server、stdio、多轮工具调用 |
| [Day 5](docs/zh-CN/day5.md) | 任务管理：变身时间管理大师 | 状态机、任务工具、多轮循环、智能路由 REPL |
| [Day 6](docs/zh-CN/day6.md) | SubAgent：Agent 分身术 | 主从架构、独立上下文、delegate_task、通用工具循环 |
| [Day 7](docs/zh-CN/day7.md) | Skills：按需加载领域知识 | 元数据常驻、内容按需、SKILL.md、缓存、热更新 |
| [Day 8](docs/zh-CN/day8.md) | Agent Team：团伙协作 | 消息总线、去中心化协作、广播+汇总 |

完整索引见 [docs/overview.zh-CN.md](docs/overview.zh-CN.md)。

## 演进路线

```
CLI → AI 聊天 → 工具调用 → MCP → 任务管理 → SubAgent → Skills → Agent Team → 记忆 (下一步)
 命令解析  流式对话   Function Call  Client-Server 状态机   主从委托   领域知识按需   消息总线协作   持久化
```

## License

[MIT](LICENSE)
