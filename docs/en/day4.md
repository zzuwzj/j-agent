# Day 4 - MCP: Opening the Door to the AI Tool Ecosystem

> Previous: [Day 3 - Function Call: Give the Agent Hands & Feet](day3.md) | **[Overview](../overview.md)**

## Goal

Implement the Model Context Protocol (MCP) so the agent can plug into external tool services, instead of hard-coding every tool inside the repo.

## What Was Done

### 1. FileSystem MCP Server (src/mcp-servers/filesystem-server.js)

Built on `@modelcontextprotocol/sdk`, the server exposes two read-only tools:

| Tool | Capability |
|---|---|
| `read_file` | Read the full contents of a file |
| `list_directory` | List files and folders under a directory |

- Communicates with the client over `StdioServerTransport` as a child process
- Validates paths with `path.resolve()` + `startsWith()` so the server can only touch files inside the launch-time `rootPath` — blocks traversal attacks
- Logs go to stderr to avoid polluting the stdio protocol channel

### 2. MCP Client Wrapper (src/mcp/client.js)

Thin wrapper around the SDK's high-level API:

- `connectServer(name, command, args)` — Spawn and connect, indexed by name; reconnect is a no-op
- `listTools(serverName)` — List tools with an in-memory cache
- `listAllTools()` — Aggregate across servers, returning `{serverName, tool}` entries
- `callTool(serverName, toolName, args)` — Invoke a tool; flattens `content` into plain text; throws on `isError`
- `disconnectAll()` — Actually calls `client.close()` so we don't leak child processes

### 3. LLM Integration with MCP (src/llm.js)

Two new methods on `LLMClient`:

- `initMCP()` — Connect to the FileSystem server and cache tool definitions in OpenAI Function Call format. Tools are namespaced as `serverName:toolName` to avoid collisions.
- `chatWithMCPTools(messages)` — A **multi-round** tool-calling loop, capped at 5 rounds:

```
┌─────────────────────────────┐
│  request LLM (with tools)    │──┐
└─────────────────────────────┘  │
                                 ↓
                     ┌────────────────────────┐
                     │ has tool_calls?        │──no──→ return text
                     └────────────────────────┘
                                 │yes
                                 ↓
                     ┌────────────────────────┐
                     │ push assistant msg     │
                     │ (with tool_calls) once │
                     └────────────────────────┘
                                 ↓
                     ┌────────────────────────┐
                     │ run each tool and push │
                     │ its tool-role message  │
                     └────────────────────────┘
                                 └── loop back
```

This fixes two bugs from the earlier draft:
- The assistant(tool_calls) message was pushed inside the `for` loop, so it appeared multiple times when several tools ran in parallel.
- Only a single round of tool calls was supported, so the LLM couldn't chain further calls after seeing a tool result.

### 4. New `mcp` CLI Subcommand (bin/cli.js, src/agent/mcp.js)

```bash
j-agent mcp    # Start MCP mode (alias: m) — read files, list directories
```

Same `/exit`, `/clear`, `/help` commands as the other modes. `initMCP()` runs on entry, and `disconnectMCP()` tears down the child process on exit.

### 5. Project Structure

```
j-agent/
├── bin/
│   └── cli.js
├── src/
│   ├── agent/
│   │   ├── index.js          # Unified exports
│   │   ├── chat.js           # Pure chat mode
│   │   ├── fc.js             # Function Call mode
│   │   └── mcp.js            # MCP mode
│   ├── mcp/
│   │   ├── index.js
│   │   └── client.js         # MCP Client wrapper
│   ├── mcp-servers/
│   │   └── filesystem-server.js
│   ├── tools/
│   │   ├── index.js
│   │   └── weather.js
│   ├── conversation.js
│   └── llm.js                # Now with chatWithMCPTools
├── .env.example
└── package.json
```

## Verification

```bash
$ j-agent --help
Commands:
  chat|c    Start pure chat mode
  fc|f      Start Function Call mode (with tool support)
  mcp|m     Start MCP mode (connect to filesystem etc.)
  start|s   Start AI Agent (same as chat)
```

Real runs:

```
> What files are in the src directory?
⚙️ Round 1: running 1 MCP tool call...
   → filesystem:list_directory { path: 'src' }
✓ Done in 2 turns

> Show me the src layout, then tell me which dependencies are in package.json
⚙️ Round 1: running 2 MCP tool calls...
   → filesystem:list_directory { path: 'src' }
   → filesystem:read_file { path: 'package.json' }
```

Both parallel and multi-round tool calls work.

## Key Concepts

| Concept | Description |
|---|---|
| MCP Server | Standalone process/service exposing tools via stdio or HTTP |
| MCP Client | The side that connects and calls — here, the agent itself |
| Transport | stdio for local, StreamableHTTP for remote |
| Tool naming | `serverName:toolName` avoids collisions across servers |

Function Call vs MCP:

| Dimension | Function Call | MCP |
|---|---|---|
| Tool definition | Hardcoded in agent | External process, on demand |
| Extensibility | New tool = code change | New tool = launch new server |
| Ecosystem | None | Rich (many OSS servers on npm) |
| Best for | Core, latency-sensitive tools | Generic tools, sandboxed execution |

Both coexist in this project: `weather` goes through Function Call; file I/O goes through MCP.

## Gotchas

1. **The SDK's `client.request()` signature is awkward** — docs show `request({method}, {method, params})`, but in `@modelcontextprotocol/sdk ^1.29` the high-level `client.listTools()` / `client.callTool({name, arguments})` is cleaner and more stable.
2. **Server logs must go to stderr** — A `console.log` on stdout corrupts the stdio protocol stream and the client immediately fails with a JSON parse error.
3. **assistant(tool_calls) must be pushed exactly once** — Pushing it inside the per-tool loop duplicates the message and breaks the conversation history.
4. **Always call `client.close()`** — Otherwise the server subprocess lingers, and repeated runs leave zombie `node` processes.

## Next Steps

- Multi-agent collaboration (Day 5 preview)
- Human-in-the-loop approval for risky tool calls
- Connect to official MCP servers (github, fetch, sqlite, …)

---

> Back: [Overview](../overview.md)
