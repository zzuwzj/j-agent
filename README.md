# j-agent

A hands-on project for building an AI Agent from scratch. Iterate step by step — from a minimal CLI skeleton to conversational AI, function calling, and MCP protocol — to create an extensible command-line AI assistant.

[中文文档](README.zh-CN.md)

**Tech Stack:** Node.js (ESM) · Commander · OpenAI SDK

**Features:**

- Streaming multi-turn conversation
- Function Call tool invocation
- MCP protocol support (planned)
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

# Start chat mode
npx j-agent chat

# Start Function Call mode
npx j-agent fc
```

## Development Log

| Stage | Topic | Keywords |
|---|---|---|
| [Day 1](docs/en/day1.md) | Build a Basic CLI Project | Commander, directory structure, command parsing |
| [Day 2](docs/en/day2.md) | Implement AI Chat | OpenAI SDK, streaming output, multi-turn conversation, env config |
| [Day 3](docs/en/day3.md) | Function Call: Give the Agent Hands & Feet | Tool definition, tool dispatcher, dual-mode CLI |

## Roadmap

```
CLI Skeleton ──→ AI Chat ──→ Function Call ──→ MCP Protocol
 Command parsing   Streaming      Tool dispatch     Plug-and-play tools
 Directory layout  Multi-turn     Dual-mode CLI     External service integration
```

## License

[MIT](LICENSE)