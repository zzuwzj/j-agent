# j-agent

A hands-on project for building an AI Agent from scratch. Iterate step by step — from a minimal CLI skeleton to conversational AI, function calling, MCP protocol, and task management — to create an extensible command-line AI assistant.

[中文文档](README.zh-CN.md)

**Tech Stack:** Node.js (ESM) · Commander · OpenAI SDK · MCP SDK

**Features:**

- Streaming multi-turn conversation
- Function Call tool invocation
- MCP protocol (Client-Server over stdio)
- Stateful task management with smart routing (simple Q&A direct, complex requests auto-decomposed)
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

Four interactive modes:

```bash
npx j-agent chat   # Pure streaming chat
npx j-agent fc     # Function Call mode (weather etc.)
npx j-agent mcp    # MCP mode (read local files via MCP server)
npx j-agent task   # Task mode (smart decomposition + progress tracking)
```

Each mode supports `/exit`, `/clear`, `/help`; `task` also has `/status`.

## Development Log

| Stage | Topic | Keywords |
|---|---|---|
| [Day 1](docs/en/day1.md) | Build a Basic CLI Project | Commander, directory structure, command parsing |
| [Day 2](docs/en/day2.md) | Implement AI Chat | OpenAI SDK, streaming output, multi-turn conversation, env config |
| [Day 3](docs/en/day3.md) | Function Call: Give the Agent Hands & Feet | Tool definition, tool dispatcher, dual-mode CLI |
| [Day 4](docs/en/day4.md) | MCP: Opening the Door to the AI Tool Ecosystem | MCP protocol, Client-Server, stdio, multi-round tool calls |
| [Day 5](docs/en/day5.md) | Task Management: Becoming a Time-Management Wizard | State machine, task tools, multi-round loop, smart-routing REPL |

See [docs/overview.md](docs/overview.md) for a full index.

## Roadmap

```
CLI Skeleton → AI Chat → Function Call → MCP Protocol → Task Mgmt → Multi-Agent (next)
 Command         Streaming   Tool dispatch   Client-Server  State machine  Supervisor-Worker
 parsing         Multi-turn  Dual-mode CLI   External tools Smart routing  Task collaboration
```

## License

[MIT](LICENSE)
