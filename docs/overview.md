# j-agent 开发日志

## 项目简介

j-agent 是一个从零构建 AI Agent 的实战项目。通过逐步迭代，从一个最简 CLI 骨架出发，逐步实现对话能力、工具调用、MCP 协议等核心功能，最终打造一个可扩展的命令行 AI 助手。

**技术栈：** Node.js (ESM) + Commander + OpenAI SDK

**核心特性：**
- 流式多轮对话
- Function Call 工具调用
- MCP 协议支持（规划中）
- 兼容 OpenAI / 阿里云 DashScope 等多平台

## 文档索引

| 文档 | 内容 | 关键词 |
|---|---|---|
| [Day 1](day1.md) | 搭建基础 CLI 项目 | Commander、目录结构、命令解析 |
| [Day 2](day2.md) | 实现基础 AI 聊天功能 | OpenAI SDK、流式输出、多轮对话、环境配置 |
| [Day 3](day3.md) | Function Call：给 Agent 装上手和脚 | 工具定义、工具分发、双模式 CLI |

## 项目演进路线

```
Day 1: CLI 骨架 ──→ Day 2: AI 聊天 ──→ Day 3: 工具调用 ──→ Day 4+: MCP 协议
  命令解析           流式对话           Function Call        即插即用工具
  目录结构           多轮上下文          双模式交互           外部服务集成
```