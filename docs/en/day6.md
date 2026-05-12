# Day 6 - SubAgent: Letting the Agent Clone Itself

> Previous: [Day 5 - Task Management: Becoming a Time-Management Wizard](day5.md) | **[Overview](../overview.md)** | Next: [Day 7 - Skills: On-Demand Domain Knowledge](day7.md)

## Goal

Give the agent the ability to "clone itself": the main agent only orchestrates and summarizes, delegating specialist sub-tasks — "explore code structure", "read and understand code", "draft an implementation plan" — to SubAgents that each own their system prompt, tool set, and conversation history. No cross-contamination.

## What Was Done

### 1. SubAgent base class (src/agents/sub-agent.js)

Minimal, single responsibility:

```js
const agent = new SubAgent({
  name: "explorer",
  description: "Search and explore the codebase structure",
  systemPrompt: "...",
  tools: fileSystemTools,
  handlers: fileSystemToolHandlers,
  maxRounds: 6,
});

await agent.run("List the src directory");
agent.reset();           // clear conversation
agent.getStats();        // { name, messageCount, toolCount }
agent.registerTool(...); // hot-plug a new tool
```

Each SubAgent owns a private `ConversationManager` so history is isolated across calls. If no tools are provided, `run` falls back to `chatCompletion` (pure reasoning).

### 2. Three preset SubAgents (src/agents/preset-agents.js)

| SubAgent | Role | Tools | Typical task |
|---|---|---|---|
| **explorer** | Codebase structure scout | `list_directory` / `read_file` | List the main modules under src |
| **researcher** | Deep code reader | `list_directory` / `read_file` / `search_code` | Explain the implementation of `chatWithMCPTools` |
| **planner** | Technical planner | none (pure reasoning) | Draft an optimization plan from prior findings |

Exposed as factory functions `createXxxAgent()` so each call returns a fresh instance. A session uses `createSubAgentRegistry()` to get three independent agents that keep context across multiple delegations within that session.

### 3. Function Call tools

To keep SubAgents free of MCP subprocess overhead, two local tool modules were added, reusing the `resolveSafe` pattern from Day 4's MCP server:

- `src/tools/filesystem.js` — `read_file` / `list_directory`, auto-filtering `.` directories and `node_modules`
- `src/tools/code-analysis.js` — builds on filesystem and adds `search_code`: a pure-Node recursive keyword search that skips binary extensions and heavy dirs, capped at 50 hits

These live alongside the existing MCP FileSystem server without conflict.

### 4. Delegate tools (src/tools/delegate-tools.js)

The one interface between main and sub:

| Tool | Purpose |
|---|---|
| `delegate_task` | Delegate to a specific SubAgent (enum: explorer/researcher/planner); optional `context` field to pass prior SubAgent output forward |
| `list_sub_agents` | List available SubAgents with one-line descriptions |

`createDelegateHandlers(registry)` returns `{ handlers, logs }`:
- `handlers` close over the same registry instance, so repeated delegations share the SubAgent's conversation history
- `logs` records each delegation (agent / task / context / elapsed / status) for the REPL `/logs` command

### 5. Generic tool loop in LLM (`chatWithCustomTools`)

Day 3's `chatWithTools` hard-codes `allTools` and runs a single round; Day 5's `chatWithTaskManager` supports multi-round but is coupled to taskTools. SubAgent needs a clean, generic loop:

```
chatWithCustomTools(messages, tools, handlers, { maxRounds = 10 })
```

Properties:
- Accepts any Function Call tool set + handler map
- Handlers can be sync or async; non-string returns are JSON-stringified
- Multi-round; exits with natural-language reply when no tool is called
- Argument-parse and unknown-tool failures degrade to tool messages, never throw
- SubAgent uses it to run its tools; the main agent's `delegate_tools` runs through it too; future modes can reuse it directly

### 6. Main-agent REPL (src/agent/subagent.js)

System prompt frames the main agent as an orchestrator:

> You do not read files or search code yourself — you delegate specialist sub-tasks to SubAgents and summarize their outputs for the user.

Interaction flow:

```
user input → main agent classifies intent
  ├─ simple Q&A → direct answer, no delegation
  └─ complex task → delegate_task(explorer, ...)
                      ↓
                    SubAgent runs its own tool loop
                      ↓
                  returns to main agent → decide next step
                      ↓  (optionally chain researcher → planner)
                   main agent summarizes and replies
```

A `tracedHandlers` wrapper turns the black box into a grey box — every `delegate_task` prints 📤 (out) and 📥 (in) events in the REPL.

Slash commands: `/exit`, `/clear` (also resets every SubAgent and the logs), `/agents` (inspect per-SubAgent message and tool counts), `/logs` (delegation trace), `/help`.

### 7. CLI integration (bin/cli.js)

```bash
j-agent subagent   # or j-agent sa
```

### 8. Project Structure

```
j-agent/
├── bin/cli.js
├── src/
│   ├── agent/
│   │   ├── chat.js / fc.js / mcp.js / task.js
│   │   └── subagent.js        # 🆕 main-agent REPL
│   ├── agents/                # 🆕 Day 6
│   │   ├── sub-agent.js
│   │   └── preset-agents.js
│   ├── tools/
│   │   ├── filesystem.js      # 🆕
│   │   ├── code-analysis.js   # 🆕
│   │   ├── delegate-tools.js  # 🆕
│   │   ├── task-tools.js
│   │   └── weather.js
│   ├── mcp/ mcp-servers/ tasks/
│   ├── conversation.js
│   └── llm.js                  # 🆕 chatWithCustomTools
└── docs/zh-CN|en/day6.md
```

## Verification

**Structural (no LLM)** — all green:

- SubAgent base: instantiation / `registerTool` / `getStats` ✅
- `createSubAgentRegistry()` yields distinct instances per call ✅
- Preset tool counts: explorer=2 / researcher=3 / planner=0 ✅
- `delegate_task` guards unknown agent names ✅
- `list_sub_agents` returns a string containing `explorer` ✅
- `filesystem` / `code-analysis` work directly (listed src; `search_code MCPClient` found 9 hits) ✅

**End-to-end (LLM path)** — the DashScope free quota is exhausted, so interactive delegation couldn't be live-tested. The code path is structurally equivalent to Day 4/5's working tool loops; re-run `node /tmp/j-agent-subagent-test.mjs` after switching to a paid key to confirm.

## Key Concepts

| Concept | Description |
|---|---|
| Main/Sub split | Main agent orchestrates and summarizes; SubAgents do the work |
| Context isolation | Each SubAgent has its own ConversationManager |
| Delegation tool | `delegate_task` is the only path; `context` chains steps |
| Generic loop | `chatWithCustomTools` is a clean reusable multi-round tool loop |
| Trace wrapper | REPL `tracedHandlers` surfaces delegation events |

## Gotchas

1. **Shared SubAgent instances pollute state** — Exposing presets as singleton constants let sessions share the same conversation history. Switching to `createXxxAgent()` factories fixed it.
2. **Handlers must close over the registry instances** — If `delegate_task` creates a fresh agent each time, multi-step delegations lose context. `createDelegateHandlers(registry)` closure binds a fixed set of instances.
3. **Giving planner tools hurt quality** — Initially planner had `search_code`; it kept re-exploring instead of writing a plan. Stripping tools and forcing "reason from provided context" produced sharper plans.
4. **`chatWithTools` was coupled to `allTools`** — The Day 3 method hard-coded `./tools/index.js` imports, making it impossible to inject a different tool set. Extracting `chatWithCustomTools` gave both SubAgent and the main agent a single code path.
5. **`search_code` must skip node_modules** — The first version didn't; a single keyword search on this repo froze the Node process.

## Next Steps

- Day 7 preview: Agent collaboration network (agents talk directly, not just through the main agent)
- Further directions:
  - SubAgent result caching (reuse on identical tasks)
  - Parallel `Promise.all` execution for independent SubAgents
  - Timeouts via `Promise.race`
  - Permission narrowing (read-only SubAgents)
  - Integrate with Day 5's task manager — each delegation auto-creates a Task for progress tracking

---

> Back: [Overview](../overview.md)
