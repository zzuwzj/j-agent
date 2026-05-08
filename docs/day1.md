# Day 1 - 搭建基础 CLI 项目

## 目标

搭建一个可执行的 AI Agent CLI 项目骨架，实现命令行参数解析。

## 完成内容

### 1. 实现 CLI 命令

使用 `commander` 库实现三个命令：

```bash
j-agent start    # 启动 AI Agent 交互模式（别名 s）
j-agent init     # 初始化项目配置
j-agent setup    # 环境设置向导
```

`start` 命令支持 `-m/--model` 参数指定模型，默认 `gpt-4`：

```bash
j-agent start --model gpt-4-turbo
j-agent s -m claude-3
```

### 2. 创建项目目录结构

```
j-agent/
├── bin/
│   └── cli.js          # CLI 入口文件
├── src/
│   ├── index.js        # 主模块出口
│   ├── llm.js          # LLM 客户端（后续实现）
│   └── mcp/
│       └── index.js    # MCP 相关模块（后续实现）
├── .env.example        # 环境变量模板
├── .gitignore
├── package.json
└── README.md
```

### 3. 安装依赖

| 包 | 用途 |
|---|---|
| `commander` | 命令行参数解析 |
| `dotenv` | 环境变量管理（存放 API Key） |

## 验证结果

```bash
$ j-agent --version
0.0.1

$ j-agent --help
Usage: j-agent [options] [command]

AI Agent 命令行工具 - 让你的 AI 助手执行真实任务

Options:
  -V, --version      output the version number
  -h, --help         display help for command

Commands:
  start|s [options]  启动 AI Agent 交互模式
  init               初始化项目配置
  setup              环境设置向导
  help [command]     display help for command

$ j-agent start
🤖 启动 AI Agent，使用模型：gpt-4
Hello, AI Agent!

$ j-agent start --model gpt-4-turbo
🤖 启动 AI Agent，使用模型：gpt-4-turbo
Hello, AI Agent!

$ j-agent s -m claude-3
🤖 启动 AI Agent，使用模型：claude-3
Hello, AI Agent!

$ j-agent init
📝 初始化配置...

$ j-agent setup
🔧 正在启动设置向导...
```

所有命令正常，无 warning。

## 下一步

- 对接 LLM API（OpenAI / 通义千问）
- 实现多轮对话历史管理
- 支持流式输出（打字机效果）