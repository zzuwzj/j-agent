# j-agent

从零构建 AI Agent 的实战项目。逐步迭代，从 CLI 骨架到对话能力、工具调用、MCP 协议，打造一个可扩展的命令行 AI 助手。

[English](README.md)

**技术栈：** Node.js (ESM) · Commander · OpenAI SDK

**核心特性：**

- 流式多轮对话
- Function Call 工具调用
- MCP 协议支持（规划中）
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

# 启动聊天
npx j-agent chat

# 启动 Function Call 模式
npx j-agent fc
```

## 开发日志

| 阶段 | 内容 | 关键词 |
|---|---|---|
| [Day 1](docs/zh-CN/day1.md) | 搭建基础 CLI 项目 | Commander、目录结构、命令解析 |
| [Day 2](docs/zh-CN/day2.md) | 实现基础 AI 聊天功能 | OpenAI SDK、流式输出、多轮对话、环境配置 |
| [Day 3](docs/zh-CN/day3.md) | Function Call：给 Agent 装上手和脚 | 工具定义、工具分发、双模式 CLI |

## 演进路线

```
CLI 骨架 ──→ AI 聊天 ──→ 工具调用 ──→ MCP 协议
 命令解析      流式对话     Function Call   即插即用工具
 目录结构      多轮上下文    双模式交互      外部服务集成
```

## License

[MIT](LICENSE)