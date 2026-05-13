# Day 9 - Agent Persistence and Memory: Letting AI Remember Everything

> Previous: [Day 8 - Agent Team: Multi-agent collaboration](day8.md) | **[Overview](../overview.md)**

## Goal

Promote everything from Day 1-8 from "in-session only" to "across sessions". After a restart the agent still knows the user's preferences, the project's tech stack, and past decisions. Three pieces make it work: a **file-backed memory store**, a **request middleware**, and a **toolset the LLM can call to write memory explicitly**.

## What Was Done

### 1. MemoryManager (src/memory/manager.js)

File-level KV store, partitioned by category:

```
memory/
├── user_profiles/{userId}.json        user profile + preferences
├── project_contexts/{projectId}.json  project background + decision log
├── conversation_history/{sessionId}.json  per-session message log
└── learned_knowledge/knowledge.json   loose facts the AI picks up
```

| Capability | API |
|---|---|
| Profile CRUD | `getUserProfile()` / `saveUserProfile()` / `updateUserPreference(key, value)` |
| Project CRUD | `getProjectContext()` / `saveProjectContext()` / `addProjectDecision()` / `forgetProject()` |
| Sessions | `saveMessage(role, content)` / `getConversationHistory()` / `getRecentSessions()` |
| Knowledge | `addKnowledge({category, content})` |
| Cross-type search | `searchMemories(query)` returns `{type, text}[]` |
| Maintenance | `getStats()` / `cleanupOldSessions(days=30)` |
| Context switching | `setCurrentUser/Project/Session(id)` |

Design notes:

- **Atomic writes**: write to `.tmp` then `rename`, so a crash never leaves a half-written JSON.
- **Path-injection guard**: `sanitizeId()` replaces `[^a-zA-Z0-9._-]` with `_` and collapses `..` to `.`, blocking inputs like `../../etc/passwd`.
- **Multi-user isolation**: `setCurrentUser(id)` swaps the active user; profiles, projects and sessions are partitioned.
- **ISO timestamps everywhere**: stable across processes, no surprise `Date` vs `string` mismatches.

### 2. MemoryMiddleware (src/memory/middleware.js)

Weaves memory into the request loop:

```js
const enriched = await middleware.beforeRequest(messages);
// → inserts a system message after the original system, containing
//   【User Profile】and【Current Project】blocks

const reply = await llm.chatWithCustomTools(enriched, memoryTools, handlers);

await middleware.afterRequest(userMessage, reply);
// → persists messages and runs heuristic extraction for prefs / decisions
```

`beforeRequest` is non-mutating — it returns a new array. `afterRequest` returns `{savedPreferences, savedDecisions}` so the REPL can print "auto-extracted and saved" feedback.

Extraction is conservative on purpose; precision is what `remember_xxx` tools are for.

| Pattern | Example match | Stored as |
|---|---|---|
| `(更喜欢|偏好|喜欢用|选择用?|习惯用) X` | "I prefer TypeScript" | `preferences.preferredLanguage` |
| `代码风格 X` | "code style ES6" | `preferences.codeStyle` |
| `用 中文/英文 回答` | "answer in Chinese" | `preferences.communicationLanguage` |
| `(决定|就用|最终选择) X` | "we decided on monorepo" | current project's decisions |
| `项目: X` / `开发一个 X 项目` | "project: fe-shop" | `currentProjectId` (switch only, no metadata write) |

### 3. Memory tools (src/tools/memory-tools.js)

Six Function Call tools the LLM uses to record / recall memory explicitly:

| Tool | Purpose |
|---|---|
| `remember_preference(key, value)` | Write a preference into the user profile |
| `remember_project(projectId, name, description?, techStack?)` | Save project metadata and switch active project |
| `remember_decision(decision)` | Append a decision to the active project (errors if none) |
| `switch_project(projectId)` | Activate an existing project |
| `recall_memory(query)` | Keyword search across profile / projects / knowledge |
| `get_memory_stats()` | Counts + current user/project/session |

Same factory pattern as Day 7/8: `createMemoryHandlers(manager)` closes over the manager so the whole session shares state.

### 4. Memory mode REPL (src/agent/memory.js)

Boot sequence:

1. `MemoryManager.initialize()` creates subdirs.
2. `MemoryMiddleware.buildContextBlocks()` prints the context that will be injected, so users see what the AI knows.
3. REPL loop:
   - `middleware.beforeRequest` injects context into system messages.
   - `llm.chatWithCustomTools(..., memoryTools, traced)` runs the multi-round tool loop.
   - `middleware.afterRequest` persists and extracts.
   - REPL prints a grey `(auto-extracted and saved: ...)` line when something landed.

Slash commands:

| Command | Effect |
|---|---|
| `/exit` | quit |
| `/clear` | reset in-memory conversation (disk memory preserved) |
| `/memory` | show the context currently injected into system |
| `/sessions` | list the 10 most recent sessions |
| `/switch-user <id>` | switch active user (independent profile) |
| `/switch-project <id>` | switch to an existing project |
| `/forget-project <id>` | delete all context for a project |
| `/cleanup [days]` | drop sessions older than N days (default 30) |
| `/help` | help |

### 5. CLI

```bash
j-agent memory   # alias: j-agent me
```

### 6. Project structure

```
j-agent/
├── src/
│   ├── memory/                 # 🆕 Day 9
│   │   ├── manager.js
│   │   └── middleware.js
│   ├── tools/
│   │   ├── memory-tools.js     # 🆕
│   │   └── (others)
│   ├── agent/
│   │   ├── memory.js           # 🆕
│   │   └── chat|fc|mcp|task|subagent|skills|team.js
│   └── (others)
├── memory/                     # 🆕 runtime data dir (in .gitignore)
└── bin/cli.js                  # 🔄 +memory subcommand
```

## Verification

Structural tests (no LLM, all green):

- subdir init / profile preference R/W / project & decision CRUD ✅
- session persistence / cross-type search ✅
- `MemoryMiddleware.beforeRequest` inserts memory after the original system message, not before ✅
- heuristic extraction on "我更喜欢 Python，我们决定用 monorepo" → preference + decision both captured ✅
- handlers: `remember_preference`/`remember_project` switches `currentProjectId`; `remember_decision` errors with no project; `switch_project` returns ❌ for missing id; `recall_memory` formats hits ✅
- tool count = 6, names match definitions ✅
- multi-user isolation: `setCurrentUser('alice')` profile is independent; switching back to `default` keeps the original ✅
- path injection guard: `setCurrentUser('../../../etc/passwd')` produces a filename without `/` or `..` ✅
- `j-agent --help` / `j-agent memory --help` ✅

End-to-end (with LLM): same DashScope free-tier limitation as Day 7/8 — once a paid key is in `.env`, `npx j-agent memory` should just work; the tool loop reuses the proven `chatWithCustomTools`.

## Key concepts

| Concept | Note |
|---|---|
| Short-term vs long-term | `ConversationManager` is in-session; `MemoryManager` is across sessions |
| Explicit vs implicit | LLM calls to `remember_xxx` are **explicit** (more accurate); middleware regex is **implicit** (more convenient) |
| Middleware | `beforeRequest`/`afterRequest` wrap each turn; business code doesn't need to know |
| Factory + closure | `createMemoryHandlers(manager)` keeps one manager alive across the session |
| Atomic writes | `.tmp` + rename, never a partial JSON |
| Path sanitization | `sanitizeId` does dual duty: replace illegal chars + collapse `..` |

## Differences from the doc version

1. **Richer decision shape.** The doc keeps `decisions: string[]`. I switched to `{content, createdAt}[]` to enable later time-decay or "show the last N" features.
2. **Tighter extraction.** The doc's `喜欢.*?(\w+)` would happily store "苹果" (apple) under preferredLanguage. Mine uses an explicit verb list (`更喜欢/偏好/喜欢用/选择用/习惯用`) and only reads `项目: X` when there isn't already an active project.
3. **Path-injection guard.** The doc reads `userId` straight into a file path. `sanitizeId` makes that safe.
4. **Atomic writes + corruption tolerance.** The doc uses raw `fs.writeFile`; SIGINT mid-write corrupts the file. I write to `.tmp` first, and treat `SyntaxError` on read as "missing" with a warning instead of a hard throw.
5. **Factory pattern.** Same as Day 7/8: `createMemoryHandlers(manager)` rather than a module-level singleton — multiple sessions don't accidentally share state.
6. **Visible feedback loop.** When middleware extraction lands a preference or decision, the REPL prints `(auto-extracted and saved: ...)` in grey so the user always knows what was captured. Avoids the "I never told you that, why did you remember it" surprise.

## Rough edges hit

1. **Date serialization.** First version stored `new Date()`. After JSON round-trips it became a string and any `getMemoryWeight()`-style code crashed. Standardised on ISO strings via `nowIso()`.
2. **System insertion order.** First version did `messages.unshift(memoryNote)`, putting memory **before** the original system. The LLM started biasing toward stale memory ("project uses React") instead of the current question. Inserting **after** the last system message and **before** the first non-system message fixes priority.
3. **Decision without active project.** The doc auto-creates an empty project named after the projectId. I throw instead — silently creating ghost projects from typo'd ids was a bigger footgun.
4. **Regex over-matching.** Early `PREFERENCE_PATTERNS` was too loose — anything after "喜欢" got stored. Locking to a verb list cleaned that up.

## Next

- Day 10: Safety and permission control — confirmation prompts, command tiers, audit log.
- Future directions:
  - Vector search: today's `searchMemories` is keyword-only; embeddings would catch semantic neighbours.
  - Conversation summarisation: roll up old messages into a single block to save tokens.
  - Memory decay: weight old preferences down so a 3-year-old "I like Python" doesn't pollute the system prompt forever.
  - Encryption: AES-encrypt sensitive profile fields on disk.
  - Different backends: swap JSON files for SQLite or a vector DB without changing the public API.

---

> Back: [Overview](../overview.md)
