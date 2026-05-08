# Day 2 - 实现基础 AI 聊天功能

## 目标

对接 LLM API，实现流式输出的多轮对话 CLI 助手。

## 完成内容

### 1. 安装新依赖

| 包 | 用途 |
|---|---|
| `openai` | OpenAI 官方 Node.js 客户端（兼容 DashScope 等） |
| `chalk` | 终端彩色输出 |

### 2. 会话管理器（src/conversation.js）

`ConversationManager` 类负责维护多轮对话上下文：

- `addMessage(role, content)` — 添加消息到对话历史
- `getFormattedHistory()` — 获取格式化的对话历史（发送给 LLM）
- `clear()` — 清空对话历史（保留系统提示）
- `getMessageCount()` — 获取消息数量

关键设计：
- `maxHistoryLength = 50`，防止 token 超限
- `clear()` 保留 system 消息，确保 AI 行为一致

### 3. LLM 客户端（src/llm.js）

`LLMClient` 类封装与 LLM API 的交互：

- `streamChatCompletion(messages)` — 异步生成器，逐 token 流式输出
- `chatCompletion(messages)` — 普通对话完成（非流式）

关键设计：
- 使用 `async *` + `for await...of` 实现打字机效果
- `stream: true` 启用流式输出
- 从 `.env` 读取 `OPENAI_BASE_URL`、`OPENAI_API_KEY`、`MODEL`
- 默认模型 `gpt-4`，兼容阿里云 DashScope 接口

### 4. CLI 交互实现（bin/cli.js）

新增 `chat` 命令（别名 `c`），`start` 命令改为指向聊天模式：

```bash
j-agent chat    # 启动聊天模式
j-agent c       # 别名
j-agent start   # 同 chat
```

特殊命令：
- `/exit` 或 `/quit` — 退出聊天
- `/clear` — 重置对话历史
- `/help` — 显示帮助

交互特性：
- 异步 `readline` 非阻塞输入
- `chalk` 彩色输出（蓝色提示符、绿色 AI 回复、红色错误）
- 空输入自动跳过

### 5. 环境配置

`.env.example` 新增 DashScope 替代方案注释。

### 6. 国内模型替代方案

如果无法访问 OpenAI API，可以使用阿里云通义千问（DashScope）的兼容接口，提供免费额度。

`.env` 配置：

```bash
# 阿里云 DashScope 配置
OPENAI_API_KEY=sk-xxxxx  # 在阿里云百炼控制台获取
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
MODEL=qwen3.5-flash
```

模型对比：

| 模型 | 特点 | 适用场景 |
|---|---|---|
| `qwen3.5-flash` | 快速、便宜 | 日常对话、简单任务 |
| `qwen3.5` | 能力强、速度中等 | 复杂推理、代码生成 |
| `qwen-max` | 最强模型 | 高难度任务 |

> API Key 获取：[阿里云百炼控制台](https://bailian.console.aliyun.com/)

## 验证结果

```bash
$ j-agent --help
Commands:
  chat|c          启动 AI 聊天模式
  start|s         启动 AI Agent（同 chat）
  init            初始化项目配置
  setup           环境设置向导
```

## 下一步

- 工具调用（Function Calling）
- 实现天气查询、搜索等实用工具
- 多模态支持（图片理解）
- 对话持久化存储