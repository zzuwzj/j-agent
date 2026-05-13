# j-agent

A hands-on project for building an AI Agent from scratch. Iterate step by step — from a minimal CLI skeleton to conversational AI, function calling, MCP protocol, task management, a main/sub-agent split, on-demand Skills, multi-agent team collaboration, and cross-session persistent memory — to create an extensible command-line AI assistant.

[中文文档](README.zh-CN.md)

**Tech Stack:** Node.js (ESM) · Commander · OpenAI SDK · MCP SDK

**Features:**

- Streaming multi-turn conversation
- Function Call tool invocation
- MCP protocol (Client-Server over stdio)
- Stateful task management with smart routing (simple Q&A direct, complex requests auto-decomposed)
- SubAgent architecture: main agent orchestrates specialist sub-agents (explorer / researcher / planner) via `delegate_task`
- Skills: on-demand domain knowledge (git / docker / javascript), metadata resident, content lazily loaded
- Agent Team: multi-agent decentralised collaboration over a shared message bus (explorer / researcher / advisor), supports both single-agent calls and broadcast-then-summarise
- Memory: file-backed persistent memory (user profile / project context / decisions) with auto-injecting middleware and explicit `remember_*` tools
- Compatible with OpenAI / Alibaba DashScope and more

## Quick Start

```bash
# Clone the project
git clone https://github.com/zzuwzj/j-agent.git
cd j-agent

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and fill in your API Key (see docs/en/day2.md for details)
```

Eight interactive modes:

```bash
npx j-agent chat       # Pure streaming chat
npx j-agent fc         # Function Call mode (weather etc.)
npx j-agent mcp        # MCP mode (read local files via MCP server)
npx j-agent task       # Task mode (smart decomposition + progress tracking)
npx j-agent subagent   # SubAgent mode (main agent delegates to explorer / researcher / planner)
npx j-agent skills     # Skills mode (on-demand domain knowledge from skills/)
npx j-agent team       # Team mode (multi-agent collaboration over a shared message bus)
npx j-agent memory     # Memory mode (remember preferences, project context and decisions across sessions)
```

Every mode supports `/exit`, `/clear`, `/help`. `task` adds `/status`; `subagent` adds `/agents` and `/logs`; `skills` adds `/skills`, `/stats`, `/reset-cache`; `team` adds `/agents`, `/stats`, `/messages`, `/verbose`; `memory` adds `/memory`, `/sessions`, `/switch-user`, `/switch-project`, `/forget-project`, `/cleanup`.

## Development Log

| Stage | Topic | Keywords |
|---|---|---|
| [Day 1](docs/en/day1.md) | Build a Basic CLI Project | Commander, directory structure, command parsing |
| [Day 2](docs/en/day2.md) | Implement AI Chat | OpenAI SDK, streaming output, multi-turn conversation, env config |
| [Day 3](docs/en/day3.md) | Function Call: Give the Agent Hands & Feet | Tool definition, tool dispatcher, dual-mode CLI |
| [Day 4](docs/en/day4.md) | MCP: Opening the Door to the AI Tool Ecosystem | MCP protocol, Client-Server, stdio, multi-round tool calls |
| [Day 5](docs/en/day5.md) | Task Management: Becoming a Time-Management Wizard | State machine, task tools, multi-round loop, smart-routing REPL |
| [Day 6](docs/en/day6.md) | SubAgent: Letting the Agent Clone Itself | Main/Sub split, context isolation, delegate_task, generic tool loop |
| [Day 7](docs/en/day7.md) | Skills: On-Demand Domain Knowledge | Metadata resident, content on demand, SKILL.md, caching, hot-reload |
| [Day 8](docs/en/day8.md) | Agent Team: Building an AI Dream Team | Message bus, decentralised collaboration, broadcast + summarise |
| [Day 9](docs/en/day9.md) | Agent Persistence and Memory | File-backed store, memory middleware, explicit/implicit memory, multi-user isolation |

See [docs/overview.md](docs/overview.md) for a full index.

## Roadmap

```
CLI → Chat → Function Call → MCP → Task → SubAgent → Skills → Agent Team → Memory → Safety (next)
 parsing streaming tool dispatch client-server state machine main/sub on-demand KB message bus persistence permission tiers
```

## License

[MIT](LICENSE)
