# Day 1 - Build a Basic CLI Project

> **[Overview](../overview.md)** | Next: [Day 2 - Implement AI Chat](day2.md)

## Goal

Set up an executable AI Agent CLI project skeleton with command-line argument parsing.

## What Was Done

### 1. CLI Commands

Implemented three commands using the `commander` library:

```bash
j-agent start    # Start AI Agent interactive mode (alias: s)
j-agent init     # Initialize project config
j-agent setup    # Environment setup wizard
```

The `start` command supports a `-m/--model` option to specify the model, defaulting to `gpt-4`:

```bash
j-agent start --model gpt-4-turbo
j-agent s -m claude-3
```

### 2. Project Directory Structure

```
j-agent/
├── bin/
│   └── cli.js          # CLI entry point
├── src/
│   ├── index.js        # Main module export
│   ├── llm.js          # LLM client (to be implemented)
│   └── mcp/
│       └── index.js    # MCP module (to be implemented)
├── .env.example        # Environment variable template
├── .gitignore
├── package.json
└── README.md
```

### 3. Dependencies

| Package | Purpose |
|---|---|
| `commander` | Command-line argument parsing |
| `dotenv` | Environment variable management (for API keys) |

## Verification

```bash
$ j-agent --version
0.0.1

$ j-agent --help
Usage: j-agent [options] [command]

AI Agent CLI - Let your AI assistant perform real tasks

Options:
  -V, --version      output the version number
  -h, --help         display help for command

Commands:
  start|s [options]  Start AI Agent interactive mode
  init               Initialize project config
  setup              Environment setup wizard
  help [command]     display help for command

$ j-agent start
🤖 Starting AI Agent with model: gpt-4
Hello, AI Agent!

$ j-agent start --model gpt-4-turbo
🤖 Starting AI Agent with model: gpt-4-turbo
Hello, AI Agent!

$ j-agent s -m claude-3
🤖 Starting AI Agent with model: claude-3
Hello, AI Agent!

$ j-agent init
📝 Initializing config...

$ j-agent setup
🔧 Starting setup wizard...
```

All commands work without warnings.

## Next Steps

- Integrate LLM API (OpenAI / Qwen)
- Implement multi-turn conversation history management
- Support streaming output (typewriter effect)

---

> Next: [Day 2 - Implement AI Chat](day2.md)