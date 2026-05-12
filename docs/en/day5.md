# Day 5 - Task Management: Becoming a Time-Management Wizard

> Previous: [Day 4 - MCP: Opening the Door to the AI Tool Ecosystem](day4.md) | **[Overview](../overview.md)** | Next: [Day 6 - SubAgent: Letting the Agent Clone Itself](day6.md)

## Goal

Give the agent a sense of "task": when faced with a complex request it decomposes first, drives each step, and reports progress; when faced with a simple question it doesn't overreach — one-liner answers stay one-liners.

## What Was Done

### 1. TaskManager (src/tasks/task-manager.js)

A minimal in-memory task state machine backed by `Map<id, Task>`:

- `createTask(title, description?)` / `createTasksFromList(titles)` — single and batch create
- `updateTaskStatus(id, status, result?, error?)` — transition state and record output / failure reason
- `getAllTasks()` / `getTasksByStatus(status)` / `getTask(id)` — queries
- `getStats()` — one-shot total / pending / inProgress / completed / failed
- `formatTaskList()` — render an emoji-annotated list (⏳🔄✅❌) for the LLM or console
- `deleteTask(id)` / `clearAllTasks()` — cleanup
- `saveToFile(path)` / `loadFromFile(path)` — JSON persistence across sessions

IDs use `task_${Date.now()}_${rand}` to avoid collisions during rapid batch creation.

### 2. Task State Machine

```
┌──────────┐   start_task   ┌─────────────┐  complete_task   ┌────────────┐
│ pending  │ ─────────────→ │ in_progress │ ───────────────→ │ completed │
└──────────┘                └─────────────┘                  └────────────┘
     ↑                             │
     │                             │ fail_task
     │                             ↓
     │                       ┌────────────┐
     └───────────────────────│   failed   │
          (retry = re-start)  └────────────┘
```

Four states with explicit transitions — makes it easy for the LLM to reason about "what's next."

### 3. Task Tools (src/tools/task-tools.js)

Six Function Calls exposed to the LLM:

| Tool | Purpose |
|---|---|
| `create_tasks` | Split into multiple ordered sub-tasks at once |
| `start_task` | Enter `in_progress` |
| `complete_task` | Enter `completed`, requires a `result` describing the output |
| `fail_task` | Enter `failed`, requires an `error` describing the reason |
| `get_task_status` | Stats plus full list |
| `delete_task` | Delete a specific task |

Each tool has a handler (sync or async) returning an emoji-annotated string that's fed back into the conversation, so the LLM can see the outcome and decide the next move.

TaskManager is exported as a **singleton** from task-tools, so all multi-turn interactions in the REPL share a single task store.

### 4. LLM Integration: `chatWithTaskManager` (src/llm.js)

Day 3's `chatWithTools` runs the tool loop exactly once, but task work usually needs "split → do → verify → next" many times. So we re-implemented it as a multi-round loop:

```
┌─────────────────────────────┐
│ request LLM (task tools)     │──┐
└─────────────────────────────┘  │
                                 ↓
                   ┌────────────────────────┐
                   │ tool_calls present?    │──no──→ return text
                   └────────────────────────┘
                                 │yes
                                 ↓
                   ┌────────────────────────┐
                   │ push assistant msg     │
                   │ (with tool_calls) once │
                   └────────────────────────┘
                                 ↓
                   ┌────────────────────────┐
                   │ run handlers,          │
                   │ push tool role msgs    │
                   └────────────────────────┘
                                 └──→ loop
```

Details worth noting:

- `MAX_ROUNDS = 20`: splitting 3–8 tasks × `start + complete` + initial `create_tasks` needs ~10+ rounds; 20 leaves headroom
- Parallel tool_calls supported: LLM can emit `start_task` + `complete_task` in one turn, reducing total rounds
- Signature `chatWithTaskManager(messages, customTools = [], customToolHandlers = {})` — accepts extra tools + handlers so MCP / weather can share the same loop
- Argument-parse failures push a tool message with the error and continue, instead of throwing
- Unknown tool names degrade to an error message rather than breaking the loop

### 5. Smart-Routing REPL (src/agent/task.js)

The doc's vanilla Task mode **always forces decomposition**, but in practice users mix things up — asking a concept one turn, requesting a system plan the next. So the system prompt was reshaped into a two-step decision:

> A. Simple Q&A → answer directly in natural language, **do not** call any task tool
> B. Complex, multi-step request → call `create_tasks` to split into 3–8 sub-tasks, then drive each with `start_task` → output → `complete_task`

With a "when in doubt, pick A" bias, so simple questions like "what is async/await?" are no longer misclassified as tasks to decompose.

REPL commands: `/exit`, `/clear` (resets both conversation and task list), `/status` (quick progress view), `/help`.

### 6. CLI Integration (bin/cli.js)

```bash
j-agent task    # or j-agent t
```

Help text says "simple Q&A answered directly, complex requests auto-split" to match the real behavior.

### 7. Project Structure

```
j-agent/
├── bin/
│   └── cli.js
├── src/
│   ├── agent/
│   │   ├── index.js
│   │   ├── chat.js
│   │   ├── fc.js
│   │   ├── mcp.js
│   │   └── task.js           # Task-mode REPL with smart routing prompt
│   ├── tasks/
│   │   └── task-manager.js   # State machine + persistence
│   ├── tools/
│   │   ├── index.js
│   │   ├── weather.js
│   │   └── task-tools.js     # 6 task tools + handlers
│   ├── mcp/...
│   ├── mcp-servers/...
│   ├── conversation.js
│   └── llm.js                # With chatWithTaskManager
└── package.json
```

## Verification

**Unit-level**: TaskManager create → state transitions → stats → persist → reload; all fields and statuses round-trip correctly.

**End-to-end**:

| Input | Tasks Created | Behavior |
|---|---|---|
| `What is Function Call?` | 0 | 1 turn, direct answer ✅ |
| `Difference between async/await and Promise?` | 0 | 1 turn, comparison table ✅ |
| `Plan the frontend dev steps for a blog system` | 7 | 17 turns, all completed, final summary ✅ |

Border-line cases (concept comparisons) are no longer misclassified; explicit planning requests reliably trigger the decompose-and-drive flow.

## Key Concepts

| Concept | Description |
|---|---|
| Task state machine | pending / in_progress / completed / failed with explicit transitions |
| Tool handler | Accepts an LLM tool call, returns a string result back into the conversation |
| Multi-round loop | After receiving tool results, let the LLM decide the next batch of tool calls |
| Smart routing | System prompt + bias lets the model distinguish Q&A vs tasks |

## Gotchas

1. **MAX_ROUNDS=10 was too low** — 7-task plans need 15+ rounds, so the loop got cut off. Raised to 20 and nudged the prompt toward parallel `start + complete` to stay within budget.
2. **assistant(tool_calls) must be pushed once** — Same trap as Day 4: when multiple tool_calls exist, do not re-push the assistant message inside the per-tool loop.
3. **Simple questions were being auto-decomposed** — Initial prompt only said "decompose complex tasks," so the model tried to `create_tasks` even for "what's a variable." Adding the explicit "when in doubt, choose A" bias fixed it instantly.
4. **Empty string vs undefined in `updateTaskStatus`** — The implementation filters with `if (result)`, which happens to handle both, but be careful when reading the code.

## Next Steps

- Day 6 preview: multi-agent collaboration (Supervisor-Worker, task dispatch and result aggregation)
- Further directions: DAG-style task dependencies, priorities, timeout/bail-out, persist results to `.j-agent/tasks.json`
- Plug the MCP filesystem tools into the same chatWithTaskManager loop — code-writing tasks can then decompose and write output files in one pass

---

> Back: [Overview](../overview.md)
