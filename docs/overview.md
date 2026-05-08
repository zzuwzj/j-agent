# j-agent Development Log

## About

j-agent is a hands-on project for building an AI Agent from scratch. Through iterative development, we start from a minimal CLI skeleton and progressively implement conversation, function calling, and MCP protocol to create an extensible command-line AI assistant.

**Tech Stack:** Node.js (ESM) + Commander + OpenAI SDK

**Key Features:**
- Streaming multi-turn conversation
- Function Call tool invocation
- MCP protocol support (planned)
- Compatible with OpenAI / Alibaba DashScope and more

## Documentation Index

| Document | Topic | Keywords |
|---|---|---|
| [Day 1](en/day1.md) | Build a Basic CLI Project | Commander, directory structure, command parsing |
| [Day 2](en/day2.md) | Implement AI Chat | OpenAI SDK, streaming output, multi-turn conversation, env config |
| [Day 3](en/day3.md) | Function Call: Give the Agent Hands & Feet | Tool definition, tool dispatcher, dual-mode CLI |

[中文版](overview.zh-CN.md)

## Roadmap

```
Day 1: CLI Skeleton ──→ Day 2: AI Chat ──→ Day 3: Function Call ──→ Day 4+: MCP Protocol
  Command parsing         Streaming          Tool dispatch            Plug-and-play tools
  Directory layout        Multi-turn         Dual-mode CLI            External service integration
```