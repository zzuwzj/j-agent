# j-agent Development Log

## About

j-agent is a hands-on project for building an AI Agent from scratch. Through iterative development, we start from a minimal CLI skeleton and progressively implement conversation, function calling, and MCP protocol to create an extensible command-line AI assistant.

**Tech Stack:** Node.js (ESM) + Commander + OpenAI SDK

**Key Features:**
- Streaming multi-turn conversation
- Function Call tool invocation
- MCP protocol support
- Compatible with OpenAI / Alibaba DashScope and more

## Documentation Index

| Document | Topic | Keywords |
|---|---|---|
| [Day 1](en/day1.md) | Build a Basic CLI Project | Commander, directory structure, command parsing |
| [Day 2](en/day2.md) | Implement AI Chat | OpenAI SDK, streaming output, multi-turn conversation, env config |
| [Day 3](en/day3.md) | Function Call: Give the Agent Hands & Feet | Tool definition, tool dispatcher, dual-mode CLI |
| [Day 4](en/day4.md) | MCP: Opening the Door to the AI Tool Ecosystem | MCP protocol, Client-Server, stdio, multi-round tool calls |
| [Day 5](en/day5.md) | Task Management: Becoming a Time-Management Wizard | State machine, task tools, multi-round loop, smart-routing REPL |
| [Day 6](en/day6.md) | SubAgent: Letting the Agent Clone Itself | Main/Sub split, context isolation, delegate_task, generic tool loop |
| [Day 7](en/day7.md) | Skills: On-Demand Domain Knowledge | Metadata resident, content on demand, SKILL.md, caching, hot-reload |
| [Day 8](en/day8.md) | Agent Team: Building an AI Dream Team | Message bus, decentralised collaboration, broadcast + summarise |

[中文版](overview.zh-CN.md)

## Roadmap

```
Day 1 CLI → Day 2 Chat → Day 3 Function Call → Day 4 MCP → Day 5 Task → Day 6 SubAgent → Day 7 Skills → Day 8 Team → Day 9+ Memory
 parsing     streaming    tool dispatch         client-server state       main/sub         on-demand KB    message bus    persistence
```