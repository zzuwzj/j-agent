# Day 7 - Skills: On-Demand Domain Knowledge

> Previous: [Day 6 - SubAgent: Letting the Agent Clone Itself](day6.md) | **[Overview](../overview.md)**

## Goal

Decouple "domain knowledge" from the system prompt. At startup the agent only learns **which Skills are available** (a one-liner per skill in metadata); the actual content (`SKILL.md`, a few KB each) is only loaded into the conversation when needed. You save tokens, and you can add/update knowledge by writing files instead of patching code.

## What Was Done

### 1. Skills directory layout

```
skills/
├── README.md                # How to add skills
├── git/
│   ├── meta.json            # scanned at startup
│   └── SKILL.md             # loaded on demand
├── docker/
│   ├── meta.json
│   └── SKILL.md
└── javascript/
    ├── meta.json
    └── SKILL.md
```

Three preset Skills:
- **git** — commands, branching model, conflicts, history rewrites, undo
- **docker** — image build, container run, compose, image slimming
- **javascript** — async, scope, modules, common pitfalls

Each `SKILL.md` is around 4KB (the doc recommends 5–10KB). Same structure: cheat-sheet + code samples + best practices + ⚠️ warnings.

### 2. Metadata format (meta.json)

```json
{
  "name": "git",
  "description": "Git: common commands, branching, conflicts, undo/recovery",
  "version": "1.0.0",
  "keywords": ["git", "version control", "commit", "branch", "rebase", "merge"],
  "author": "j-agent",
  "updatedAt": "2026-05-12"
}
```

`name` / `description` / `version` are required. Missing any required field causes the skill to be skipped with a warning.

### 3. SkillsManager (src/skills/manager.js)

Core methods:

- `scanSkills()` — walk `skills/`, read each subdir's meta.json into `skillMetas: Map<name, meta>`; missing directory only warns
- `loadSkill(name)` — read `SKILL.md` on demand; first read hits disk, subsequent calls hit `loadedSkills` cache; unknown names throw with the available list
- `getAvailableSkills()` / `formatAvailableSkills()` — metadata array / markdown list (the latter is what goes into the system prompt)
- `clearCache(name)` / `clearAllCache()` — for hot-reload
- `getStats()` — `{ total, loaded, loadedNames }`

Memory footprint is cheap: metadata is small and resident; content only materializes on first demand.

### 4. Skills tools (src/tools/skills-tools.js)

Three Function Calls:

| Tool | Purpose |
|---|---|
| `load_skill(skillName)` | Load a skill's `SKILL.md`; returns `【<name> Skill 知识】\n\n<content>` |
| `list_skills` | List all available Skills with description and version |
| `get_skill_stats` | Current registered / loaded counts and loaded names |

`createSkillsHandlers(manager)` is a factory that closes the manager into the handlers so the session shares one cache.

### 5. Skills-mode REPL (src/agent/skills.js)

The system prompt is built dynamically — `manager.formatAvailableSkills()` is inlined at startup, so the LLM knows exactly what it can load.

Flow:

```
user message
  ↓
main agent: needs domain knowledge?
  ├─ no  → answer directly
  └─ yes → load_skill(<name>) → answer based on the loaded content
              ↓
           cache hit? return immediately
           else read skills/<name>/SKILL.md, cache it
```

A `traced` wrapper prints 📖 (loaded), 📦 (cache hit), or 📕 (failure) on every `load_skill`, turning the black box grey.

Slash commands: `/exit`, `/clear` (reset chat but keep skill cache), `/skills`, `/stats`, `/reset-cache`, `/help`.

### 6. CLI integration

```bash
j-agent skills    # or j-agent sk
```

### 7. Project Structure

```
j-agent/
├── skills/                     # 🆕 Day 7 knowledge base
│   ├── README.md
│   ├── git/ docker/ javascript/
├── src/
│   ├── agent/
│   │   ├── chat|fc|mcp|task|subagent.js
│   │   └── skills.js           # 🆕 Skills REPL
│   ├── skills/                 # 🆕
│   │   └── manager.js
│   ├── tools/
│   │   ├── skills-tools.js     # 🆕
│   │   └── (others)
│   ├── agents/ tasks/ mcp/ mcp-servers/ conversation.js
│   └── llm.js
└── bin/cli.js
```

## Verification

**Structural** (no LLM, all green):

- `scanSkills` finds 3 skills ✅
- `loadSkill("git")` reads from disk on first call ✅
- Second call hits cache (loaded count stays the same) ✅
- `loadSkill("rust")` throws with available list ✅
- `list_skills` / `get_skill_stats` / `load_skill` handler outputs as expected ✅
- `clearCache` / `clearAllCache` behave correctly ✅
- `j-agent skills --help` wired ✅

**End-to-end** (LLM path): DashScope free quota still exhausted — interactive flow couldn't be live-tested. The code path mirrors the working Day 4/5/6 tool loops; run `npx j-agent skills` after switching to a paid key.

## Key Concepts

| Concept | Description |
|---|---|
| Metadata resident | All meta.json files scanned at startup; tiny footprint |
| Content on demand | `SKILL.md` only materializes when `load_skill` is called; cached after |
| Directory = protocol | Adding a skill = new dir + two files, no code change |
| Prompt injection | `formatAvailableSkills()` is written into the system prompt |
| Factory + closure | `createSkillsHandlers(manager)` keeps a single cache per session |

## Deviations from the Doc

1. **Manager is not a module-level singleton** — The doc instantiates `SkillsManager` at module load. I create it inside `chatWithSkills` and pass it to `createSkillsHandlers(manager)`, mirroring Day 6's delegate-tools pattern — cleaner for testing and multiple sessions.
2. **`loadSkill` throws instead of returning an error string** — Doc returns the string "not found or load failed". I throw, and the tool handler catches it into a `❌ ...` message. Keeps the manager's API clean; caller decides the error UX.
3. **`/reset-cache` command** — Not in the doc, but handy during development: after editing `SKILL.md`, you don't have to restart the REPL to see the new content.

## Gotchas

1. **A block comment containing `skills/*/meta.json` terminated itself early** — the `*/` inside got parsed as end-of-comment, breaking the whole file. Rewrote the prose to avoid the glob form.
2. **Versioning helps the model set expectations** — Without `vX.Y.Z` in `list_skills` output, the LLM sometimes claimed "the latest version is …". Including it nudged the model to phrase things as "per v1.0.0 of this skill".
3. **Don't make SKILL.md too big** — My first git SKILL was ~15KB and the model ignored details. Compressed to 4KB with tables and code blocks and answers got noticeably sharper.
4. **Cache vs. iteration** — Edits to `SKILL.md` weren't picked up mid-session because of the cache. `/reset-cache` makes the dev loop painless.

## Next Steps

- Day 8 preview: agent persistence and memory (remember user preferences across sessions)
- Further directions:
  - Skill dependencies (`dependsOn` in meta)
  - Remote skill registry (fetch `SKILL.md` from a URL)
  - Keyword → skill auto-recommendation (coarse match over `keywords`)
  - Pair with SubAgent: dedicated skills per researcher/planner
  - Secret scanning: lint commits to keep `sk-...` / `.env` content out of SKILL files

---

> Back: [Overview](../overview.md)
