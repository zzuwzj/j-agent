# j-agent 开发日志

## 项目简介

j-agent 是一个从零构建 AI Agent 的实战项目。通过逐步迭代，从一个最简 CLI 骨架出发，逐步实现对话能力、工具调用、MCP 协议等核心功能，最终打造一个可扩展的命令行 AI 助手。

**技术栈：** Node.js (ESM) + Commander + OpenAI SDK

**核心特性：**
- 流式多轮对话
- Function Call 工具调用
- MCP 协议支持
- 兼容 OpenAI / 阿里云 DashScope 等多平台

## 文档索引

| 文档 | 内容 | 关键词 |
|---|---|---|
| [Day 1](zh-CN/day1.md) | 搭建基础 CLI 项目 | Commander、目录结构、命令解析 |
| [Day 2](zh-CN/day2.md) | 实现基础 AI 聊天功能 | OpenAI SDK、流式输出、多轮对话、环境配置 |
| [Day 3](zh-CN/day3.md) | Function Call：给 Agent 装上手和脚 | 工具定义、工具分发、双模式 CLI |
| [Day 4](zh-CN/day4.md) | MCP：打开 AI 工具生态的大门 | MCP 协议、Client-Server、stdio、多轮工具调用 |
| [Day 5](zh-CN/day5.md) | 任务管理：变身时间管理大师 | 状态机、任务工具、多轮循环、智能路由 REPL |
| [Day 6](zh-CN/day6.md) | SubAgent：Agent 分身术 | 主从架构、独立上下文、delegate_task、通用工具循环 |
| [Day 7](zh-CN/day7.md) | Skills：按需加载领域知识 | 元数据常驻、内容按需、SKILL.md、缓存、热更新 |
| [Day 8](zh-CN/day8.md) | Agent Team：团伙协作 | 消息总线、去中心化协作、广播+汇总 |
| [Day 9](zh-CN/day9.md) | Agent 持久化与记忆：让 AI 记住一切 | 文件存储、记忆中间件、显式/隐式记忆、多用户隔离 |

[English](overview.md)

## 项目演进路线

```
Day 1 CLI 骨架 → Day 2 AI 聊天 → Day 3 工具调用 → Day 4 MCP → Day 5 任务管理 → Day 6 SubAgent → Day 7 Skills → Day 8 Agent Team → Day 9 记忆 → Day 10+ 安全与权限
 命令解析         流式对话         Function Call    Client-Server 状态机         主从委托         领域知识按需     消息总线协作      跨会话持久化     权限分级
```