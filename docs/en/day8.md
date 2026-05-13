# Day 8 - Agent Team: Building an AI Dream Team

> Previous: [Day 7 - Skills: On-Demand Domain Knowledge](day7.md) | **[Overview](../overview.md)**

## Goal

Upgrade Day 6's "supervisor → worker" delegation into a real team. Multiple agents share a **message bus** and collaborate without a central controller. The host agent only schedules and summarises; team members can also ping each other or broadcast a task to gather multi-perspective output.

## What Was Done

### 1. Message bus (src/team/message-bus.js)

The plumbing for loosely-coupled inter-agent communication:

| Capability | API |
|---|---|
| Subscribe / unsubscribe | `subscribe(agentId, handler)` / `unsubscribe(agentId, handler)` |
| Unicast | `send(from, to, content, type='request')` |
| Broadcast | `broadcast(from, content)` — skips the sender, no self-loop |
| History | `getHistory(agentId?, limit=20)` — rolling window of 100 |
| Forward guard | a single message dies after 3 hops, with a warning |

Design notes:

- `subscribers: Map<agentId, Set<handler>>`, O(1) lookups, supports multiple handlers per agent
- `publish` `await`s every handler, so when `broadcast()` resolves, every response is already in history — the manager's `coordinate()` doesn't need any `setTimeout`
- Message id = `msg_<timestamp>_<random>` for tracing/dedup

### 2. TeamAgent base class (src/team/team-agent.js)

Each Team Agent owns:

- Its own `ConversationManager` (the system prompt is auto-extended with role + team-collaboration hints)
- Its own `LLMClient`
- A reference to the shared `messageBus`
- Optional Function Call tools

Core methods:

```js
agent.sendTo(otherId, content)   // ping another agent
agent.broadcast(content)         // broadcast
agent.handleMessage(message)     // default: request/broadcast → processRequest → response
agent.processRequest(content)    // overridable; default falls back to LLM (with tools if any)
agent.run(task)                  // direct invocation, bypassing the bus
```

`handleMessage` filters out messages the agent sent itself (so broadcasts don't loop back). After processing a `request`/`broadcast` it sends a `response` back to `from`, which is how the coordinator picks up results from history.

### 3. Three preset team agents (src/team/preset-agents.js)

| Agent | Role | Tools | Output style |
|---|---|---|---|
| **explorer** | code-base scout | `list_directory` / `read_file` | bulleted structure overview |
| **researcher** | code analyst | `list_directory` / `read_file` / `search_code` | deep analysis with line numbers |
| **advisor** | tech advisor | none (pure reasoning) | prioritised recommendations |

Reuses `fileSystemTools` and `codeAnalysisTools` from Day 6 — these agents actually do the work, unlike the doc's hard-coded stub responses.

### 4. AgentTeam manager (src/team/manager.js)

```js
const team = new AgentTeam();
await team.initialize();

await team.callAgent('explorer', 'list src/');         // single-shot, bypasses the bus
await team.coordinate('Evaluate this project');         // broadcast + summarise
team.reset();                                           // wipe all agents + bus history
team.setVerbose(true);                                  // log each message hitting the bus
team.getStats();                                        // counts per agent + bus state
```

`coordinate(task)`:

1. Snapshot `messageHistory.length` as the start index
2. `messageBus.broadcast` — every handler is awaited, so when the call returns all responses are in
3. Slice from the start index, keep `response` messages addressed to `coordinator`
4. Format a per-agent summary

No `setTimeout` involved; deterministic and testable.

### 5. Team toolset (src/tools/team-tools.js)

Four function calls the host agent uses to orchestrate the team:

| Tool | Purpose |
|---|---|
| `call_agent(agentId, task)` | dispatch to a specific specialist |
| `coordinate_team(task)` | broadcast and summarise |
| `list_agents` | inspect roster |
| `get_team_stats` | per-agent message counts + bus state |

`createTeamHandlers(team)` follows the same factory pattern as Day 7's `createSkillsHandlers`: handlers close over the team instance, so the same group of agents stays alive across a session.

### 6. Team mode REPL (src/agent/team.js)

The system prompt makes the rules explicit:

- skip the team for small talk
- use `call_agent` for single-specialist questions
- use `coordinate_team` only when multiple perspectives are required
- always integrate the team's output into a natural-language reply, never echo it raw

REPL `traced` handlers print each `call_agent` / `coordinate_team` invocation with elapsed time and reply size.

Slash commands:

| Command | Effect |
|---|---|
| `/exit` | quit |
| `/clear` | reset the host conversation and every Team Agent |
| `/agents` | show roster |
| `/stats` | show stats |
| `/messages` | tail the last 20 bus messages (type/from/to/preview) |
| `/verbose` | toggle: log every message as it flows through the bus |
| `/help` | help |

### 7. CLI

```bash
j-agent team    # or j-agent tm
```

### 8. Project structure

```
j-agent/
├── src/
│   ├── team/                    # 🆕 Day 8
│   │   ├── message-bus.js
│   │   ├── team-agent.js
│   │   ├── preset-agents.js
│   │   └── manager.js
│   ├── tools/
│   │   ├── team-tools.js        # 🆕
│   │   └── (others)
│   ├── agent/
│   │   ├── team.js              # 🆕
│   │   └── chat|fc|mcp|task|subagent|skills.js
│   └── (others)
└── bin/cli.js                   # 🔄 +team subcommand
```

## Verification

**Structural** (no LLM, all green):

- MessageBus unicast hits `to` only; broadcast skips the sender ✅
- History rolls correctly at 100 ✅
- Forward count > 3 → drop with warning ✅
- AgentTeam registers 3 agents on init; `getStats()` matches ✅
- TeamAgent.handleMessage auto-replies to request/broadcast and skips own messages ✅
- coordinate broadcasts → collects responses → summarises by agent name ✅ (mocked `processRequest` end-to-end)
- `list_agents` / `get_team_stats` / `call_agent`(unknown) handlers behave as expected ✅
- `j-agent --help` / `j-agent team --help` complete ✅

**End-to-end** (with LLM): same DashScope free-tier issue as Day 7, can't smoke-test the chat loop. The control flow mirrors Day 6/7's tool loops; once a paid key is plugged in, `npx j-agent team` should just work.

## Key concepts

| Concept | Note |
|---|---|
| Decentralised | no privileged "main agent"; `coordinator` is just an id, agents can ping each other too |
| Message-driven | every collaboration goes through `messageBus`; loose coupling, fully traceable |
| Synchronous broadcast | `publish` awaits every handler, so when `broadcast()` returns all responses are already in history |
| Factory + closure | `createTeamHandlers(team)` keeps team state alive for the whole session |
| Forward guard | drop messages once `forwardCount > maxForward` to prevent broadcast-response loops |

## Differences from the doc version

1. **Dropped the `setTimeout(2000)` placeholder.** The doc's `coordinate` waits with a fixed delay, which loses slow responses. I rely on `publish` awaiting every handler instead — when `broadcast()` resolves, every response is already in history.
2. **Preset agents do real work.** The doc stubs `processRequest` with hard-coded strings. Explorer/Researcher reuse the Day 6 local toolsets; Advisor stays pure-reasoning. The team can actually read files and analyse code.
3. **Forward-count guard.** Drops messages that have hopped more than 3 times to prevent any broadcast-response loops.
4. **`handleMessage` filters self.** The Manager already filters at subscription time (`to === self.id || to === 'broadcast'`), but the agent also rejects `from === self.id` as defence in depth.
5. **Factory pattern.** Same as Day 6/7 — the manager isn't a module-level singleton; every `chatWithTeam` spins up a fresh team.

## Rough edges

1. **Broadcasting to yourself loops.** First version of `MessageBus.publish` didn't skip the sender, so an agent that broadcast received its own message, replied, broadcast again… Skipping `from === agentId` for broadcasts fixed it.
2. **`coordinate` must slice from a start index.** Naively `getHistory().filter(type==='response')` would include stale responses from earlier turns. Using `messageHistory.length` as the cut point makes coordination idempotent across calls.
3. **Role info needs its own block.** With "you are Explorer" inline in the system prompt, the LLM kept forgetting its name. Putting "name / role / description" into a dedicated markdown block stabilised self-identification.
4. **Don't give Advisor tools.** Once Advisor had `read_file`, it kept reading files instead of giving advice. Empty tools + plain `chatCompletion` produces the cleanest recommendations.

## Next

- Day 9: Agent persistence and memory (remember preferences across sessions)
- Future directions:
  - More specialists: Reviewer / Tester / Refactorer
  - Pipeline mode: Explorer → Researcher → Advisor as a chain
  - Consensus: voting among agents
  - Smart dispatch: keyword-based routing
  - Persistence: save the team's collaboration trace as an audit log

---

> Back: [Overview](../overview.md)
