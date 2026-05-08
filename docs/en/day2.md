# Day 2 - Implement AI Chat

> Previous: [Day 1 - Build a Basic CLI Project](day1.md) | **[Overview](../overview.md)** | Next: [Day 3 - Function Call: Give the Agent Hands & Feet](day3.md)

## Goal

Integrate with an LLM API and implement a streaming multi-turn conversation CLI assistant.

## What Was Done

### 1. New Dependencies

| Package | Purpose |
|---|---|
| `openai` | Official OpenAI Node.js client (compatible with DashScope, etc.) |
| `chalk` | Terminal colored output |

### 2. Conversation Manager (src/conversation.js)

The `ConversationManager` class maintains multi-turn conversation context:

- `addMessage(role, content)` — Add a message to conversation history
- `getFormattedHistory()` — Get formatted conversation history (to send to LLM)
- `clear()` — Clear conversation history (preserves system prompt)
- `getMessageCount()` — Get message count

Key design decisions:
- `maxHistoryLength = 50` to prevent token overflow
- `clear()` preserves system messages for consistent AI behavior

### 3. LLM Client (src/llm.js)

The `LLMClient` class wraps LLM API interactions:

- `streamChatCompletion(messages)` — Async generator for token-by-token streaming output
- `chatCompletion(messages)` — Standard completion (non-streaming)

Key design decisions:
- Uses `async *` + `for await...of` for typewriter effect
- `stream: true` enables streaming output
- Reads `OPENAI_BASE_URL`, `OPENAI_API_KEY`, `MODEL` from `.env`
- Default model `gpt-4`, compatible with Alibaba DashScope API

### 4. CLI Interaction (bin/cli.js)

Added `chat` command (alias `c`), and changed `start` command to point to chat mode:

```bash
j-agent chat    # Start chat mode
j-agent c       # Alias
j-agent start   # Same as chat
```

Built-in commands:
- `/exit` or `/quit` — Exit chat
- `/clear` — Reset conversation history
- `/help` — Show help

Interaction features:
- Async `readline` for non-blocking input
- `chalk` colored output (blue prompt, green AI response, red errors)
- Empty input is automatically skipped

### 5. Environment Configuration

#### Step 1: Get an API Key

Choose a platform based on your network environment:

**Option A: Alibaba DashScope (recommended for users in China)**

1. Visit [Alibaba Cloud Bailian Console](https://bailian.console.aliyun.com/)
2. Log in with your Alibaba Cloud account (register if you don't have one)
3. Find "API-KEY Management" in the left sidebar
4. Click "Create new API Key" and copy the generated key (format: `sk-xxxxx`)
5. New users typically have free quota available

**Option B: OpenAI**

1. Visit [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Register/log in to your OpenAI account
3. Click "Create new secret key"
4. Copy the generated key (format: `sk-xxxxx`, shown only once)

#### Step 2: Create the .env file

Copy the template in the project root directory:

```bash
cp .env.example .env
```

#### Step 3: Fill in the configuration

Edit the `.env` file with the appropriate values for your chosen platform:

**Using Alibaba DashScope:**

```bash
OPENAI_API_KEY=sk-xxxxx          # Replace with your API key from Step 1
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
MODEL=qwen3.5-flash
```

**Using OpenAI:**

```bash
OPENAI_API_KEY=sk-xxxxx          # Replace with your API key from Step 1
OPENAI_BASE_URL=https://api.openai.com/v1
MODEL=gpt-4
```

> **Note:** The `.env` file is already in `.gitignore` and won't be committed to the repository. Never hardcode API keys in source code.

### 6. Alternative: China-based Models

If you can't access the OpenAI API, you can use Alibaba Cloud's Qwen (DashScope) compatible endpoint, which offers free quota.

`.env` configuration:

```bash
# Alibaba DashScope configuration
OPENAI_API_KEY=sk-xxxxx  # Get from Alibaba Cloud Bailian Console
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
MODEL=qwen3.5-flash
```

Model comparison:

| Model | Characteristics | Use Case |
|---|---|---|
| `qwen3.5-flash` | Fast, affordable | Daily chat, simple tasks |
| `qwen3.5` | Capable, moderate speed | Complex reasoning, code generation |
| `qwen-max` | Most capable | High-difficulty tasks |

> Get your API Key at: [Alibaba Cloud Bailian Console](https://bailian.console.aliyun.com/)

## Verification

```bash
$ j-agent --help
Commands:
  chat|c          Start AI chat mode
  start|s         Start AI Agent (same as chat)
  init            Initialize project config
  setup           Environment setup wizard
```

## Next Steps

- Function Calling
- Implement practical tools like weather lookup and search
- Multimodal support (image understanding)
- Conversation persistence

---

> Next: [Day 3 - Function Call: Give the Agent Hands & Feet](day3.md)