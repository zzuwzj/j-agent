# j-agent Architecture

> Simplicity above all: each layer solves exactly one thing.

## 1. Layered Overview

```
┌─────────────────────────────────────────────┐
│  bin/cli.js          ← Entry: register 8 modes │
├─────────────────────────────────────────────┤
│  src/agent/*.js      ← Mode layer: one REPL per mode │
│  chat  fc  mcp  task  subagent  skills  team  memory │
├─────────────────────────────────────────────┤
│  LLMClient + ConversationManager  ← Core     │
├─────────────────────────────────────────────┤
│  Capability layer (opt-in)                   │
│  tools/  mcp/  tasks/  agents/               │
│  skills/ team/   memory/                     │
├─────────────────────────────────────────────┤
│  External resources: skills/ dir, memory/ dir, MCP servers │
└─────────────────────────────────────────────┘
```

## 2. Core: Two Minimal Abstractions

The two classes that the rest of the project is built on:

| Module | Responsibility | Key APIs |
|---|---|---|
| `LLMClient` (src/llm.js) | Wraps every LLM interaction | `streamChatCompletion` / `chatCompletion` / `chatWithTools` / `chatWithCustomTools` / `chatWithTaskManager` / `chatWithMCPTools` |
| `ConversationManager` (src/conversation.js) | Holds one conversation's message history with a sliding window | `addMessage` / `getFormattedHistory` / `clear` |

Every mode is a composition of these two. `chatWithCustomTools` is the generic tool loop (any tools + handlers); SubAgent / Team / Skills all reuse it.

## 3. Eight Modes: Capabilities Stacked Progressively

Modes differ only in `system prompt + toolset`. The REPL skeleton is nearly identical.

```
chat       streaming chat              LLM only
fc         + local tools               allTools (weather, ...)
mcp        + protocol-based tools      MCPClient (stdio)
task       + task state machine        taskTools + TaskManager
subagent   + main/sub delegation       delegateTools → SubAgent
skills     + on-demand domain KB       skillsTools → SkillsManager
team       + decentralised multi-agent MessageBus + TeamAgent
memory     + cross-session persistence MemoryManager + Middleware
```

Each step introduces exactly one new concept. Earlier capabilities can be reused by later ones, but never coupled to them.

## 4. Four Key Designs

### 4.1 SubAgent: Context Isolation

The main agent doesn't do work itself; it dispatches to explorer / researcher / planner via the `delegate_task` tool. Each SubAgent owns its own `ConversationManager`, so subtasks don't pollute the main conversation. The main agent only summarises results.

→ Solves: long-task context bloat and capability mixing.

### 4.2 Skills: Resident Metadata + Lazy Content

At startup, only `skills/<name>/meta.json` (lightweight) is scanned and inlined into the system prompt. When the LLM decides it needs a Skill, it calls `load_skill` to read the full `SKILL.md` on demand. Loaded content is cached in memory; the cache can be cleared for hot reload.

→ Solves: token waste as the knowledge base grows.

### 4.3 Team: Message Bus + Broadcast-and-Summarise

All TeamAgents subscribe to a single `MessageBus`. `coordinate(task)` broadcasts the task; because `publish` internally `await`s every handler, returning means "all responses are in" — no polling, no timeouts. `maxForward = 3` guards against broadcast loops.

→ Solves: decentralised collaboration with loosely coupled agent-to-agent messaging.

### 4.4 Memory: File Store + Middleware Injection

```
memory/
  user_profiles/{userId}.json           explicit: preferences, profile
  project_contexts/{projectId}.json     explicit: tech stack, decisions
  conversation_history/{sessionId}.json implicit: every turn
  learned_knowledge/knowledge.json      implicit: free-form notes
```

- Writes: atomic (`.tmp` then rename); `sanitizeId` cleans path inputs to prevent injection.
- Reads: `MemoryMiddleware.beforeRequest` builds a context block from profile / current project / recent decisions and injects it as a system message.
- Two channels: the LLM may call memory tools to write precisely; the middleware uses conservative regex heuristics to extract preferences/decisions to reduce mis-remembering.

→ Solves: cross-session amnesia.

## 5. Flow Example: One SubAgent Call

```
user input
  ↓
chatWithSubAgent (REPL)
  ↓
LLMClient.chatWithCustomTools(messages, delegateTools, handlers)
  ├── LLM: decides to call delegate_task(agentName="explorer", task="…")
  ├── handler: looks up the explorer SubAgent → agent.run(task)
  │     └── runs chatWithCustomTools internally (its own conversation)
  ├── tool result is appended back to messages
  └── LLM: synthesises a final reply from the result
  ↓
print + write back to main conversation history
```

The tool loop is bounded by `maxRounds` to prevent runaway loops; on overflow it exits gracefully.

## 6. Design Principles

1. **Single responsibility.** Each file does one thing. `MessageBus` only routes, never decides; `MemoryManager` only stores, never extracts (extraction lives in the middleware).
2. **LLM-driven routing.** Decisions like "simple vs. complex" live in the system prompt and are made by the LLM — no hard-coded `if/else` (this is how task mode and SubAgent both work).
3. **Composable.** Capability modules are orthogonal and can be stacked (e.g. memory + team can be combined later).
4. **Incremental.** From a 50-line CLI on Day 1 to a multi-mode system on Day 9 — one capability per day, no rewrites.
5. **Tools over hard-coding.** Drive behaviour through tool calls, not branch logic.

## 7. Roadmap

```
Day 1 CLI → Day 2 streaming → Day 3 tools → Day 4 MCP →
Day 5 task → Day 6 SubAgent → Day 7 Skills → Day 8 Team →
Day 9 Memory → Day 10+ safety & permissions
```

One pain point per step. No premature abstraction.

---

See also: [overview.md](../overview.md) · [day1–day9](.) · [README](../../README.md) · [中文](../zh-CN/architecture.md)
