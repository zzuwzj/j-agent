# Day 3 - Function Call: Give the Agent Hands & Feet

> Previous: [Day 2 - Implement AI Chat](day2.md) | **[Overview](../overview.md)** | Next: [Day 4 - MCP: Opening the Door to the AI Tool Ecosystem](day4.md)

## Goal

Implement Function Call tool invocation, upgrading the AI from "just chatting" to "getting things done."

## What Was Done

### 1. Weather Query Tool (src/tools/weather.js)

Defined the first tool `getCurrentWeather`, including:
- Tool implementation function — fetches weather info for a city (currently using mock data)
- Tool definition schema — `name`, `description`, `parameters`, sent to the LLM so it can decide when to call

Key insight: The more detailed the `description`, the more accurately the AI determines when to invoke the tool.

### 2. Tool Dispatcher (src/tools/index.js)

- Merges all tool definitions into an `allTools` array; add new tools here
- `executeTool` dispatcher routes by function name to the corresponding implementation

### 3. LLM Client Enhancement (src/llm.js)

Added `chatWithTools(messages)` method implementing the full Function Call flow:

1. **First request** — AI decides whether to call a tool (`tool_choice: "auto"`)
2. **Execute tool** — Calls the actual function based on the AI-returned function name and arguments
3. **Second request** — AI generates a natural language response based on the tool result

Error handling: When a tool execution fails, the error message is returned to the AI rather than thrown directly.

### 4. Refactored CLI into Dual Mode (src/agent/)

Extracted chat logic from `bin/cli.js` into the `src/agent/` directory:

| File | Function |
|---|---|
| `src/agent/chat.js` | Pure chat mode, streaming output |
| `src/agent/fc.js` | Function Call mode, supports tool invocation |
| `src/agent/index.js` | Unified exports |

CLI commands:

```bash
j-agent chat    # Pure chat mode (alias: c)
j-agent fc      # Function Call mode (alias: f)
j-agent start   # Same as chat, backward compatible
```

### 5. Project Structure

```
j-agent/
├── bin/
│   └── cli.js
├── src/
│   ├── agent/
│   │   ├── index.js      # Unified exports
│   │   ├── chat.js       # Pure chat mode
│   │   └── fc.js         # Function Call mode
│   ├── tools/
│   │   ├── index.js      # Tool dispatcher
│   │   └── weather.js    # Weather query tool
│   ├── conversation.js
│   └── llm.js
├── .env.example
└── package.json
```

## Verification

```bash
$ j-agent --help
Commands:
  chat|c    Start pure chat mode
  fc|f      Start Function Call mode (with tool support)
  start|s   Start AI Agent (same as chat)
```

## Key Concepts

| Concept | Description |
|---|---|
| Tool Definition | Defines available tools for the AI |
| Tool Choice | AI decides whether and which tool to call |
| Tool Call | Tool invocation request (includes function name and arguments) |
| Tool Response | Tool execution result, returned as `role: "tool"` |

Function Call vs MCP:

| Feature | Function Call | MCP |
|---|---|---|
| Tool definition | Embedded in code | External service |
| Extensibility | Requires code changes | Plug-and-play |
| Best for | Core tools | Third-party tools |

## Next Steps

- Implement MCP (Model Context Protocol)
- MCP Client-Server architecture
- Build a filesystem MCP Server
- Connect official and community MCP tools

---

> Back: [Overview](../overview.md)