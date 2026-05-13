#!/usr/bin/env node

/**
 * j-agent CLI 入口文件
 * 支持 chat（纯聊天）、fc（Function Call）、mcp（MCP 工具调用）、init、setup 等命令
 */

import { program } from "commander";
import { startChat, chatWithTools, chatWithMCP, chatWithTask, chatWithSubAgent, chatWithSkills, chatWithTeam, chatWithMemory } from "../src/agent/index.js";
import pkg from "../package.json" with { type: "json" };

// 配置命令基本信息
program
  .name("j-agent")
  .version(pkg.version)
  .description("AI Agent 命令行工具 - 能聊天，能办事");

// 聊天模式（纯对话，流式输出）
program
  .command("chat")
  .alias("c")
  .description("启动纯聊天模式")
  .action(startChat);

// Function Call 模式（带工具调用）
program
  .command("fc")
  .alias("f")
  .description("启动 Function Call 模式（可调用工具）")
  .action(chatWithTools);

// MCP 模式（使用 MCP 协议连接外部工具）
program
  .command("mcp")
  .alias("m")
  .description("启动 MCP 模式（可连接文件系统等 MCP Server）")
  .action(chatWithMCP);

// Task 模式（智能识别复杂需求，自动拆分任务、逐步执行）
program
  .command("task")
  .alias("t")
  .description("启动任务模式（简单问答直接回答，复杂需求自动拆分）")
  .action(chatWithTask);

// SubAgent 模式（主 Agent + explorer / researcher / planner）
program
  .command("subagent")
  .alias("sa")
  .description("启动 SubAgent 模式（主 Agent 把代码任务委托给专职 SubAgent）")
  .action(chatWithSubAgent);

// Skills 模式（按需加载领域知识库）
program
  .command("skills")
  .alias("sk")
  .description("启动 Skills 模式（按需加载 git / docker / javascript 等领域知识）")
  .action(chatWithSkills);

// Team 模式（多 Agent 协作，共享消息总线）
program
  .command("team")
  .alias("tm")
  .description("启动 Team 模式（多 Agent 通过共享消息总线去中心化协作）")
  .action(chatWithTeam);

// Memory 模式（持久化记忆 + 中间件 + 工具）
program
  .command("memory")
  .alias("me")
  .description("启动 Memory 模式（跨会话记住偏好、项目背景与决策）")
  .action(chatWithMemory);

// start 命令作为 chat 的别名，兼容旧版
program
  .command("start")
  .alias("s")
  .description("启动 AI Agent（同 chat）")
  .action(startChat);

// 初始化配置
program
  .command("init")
  .description("初始化项目配置")
  .action(() => {
    console.log("📝 初始化配置...");
  });

// 环境设置向导
program
  .command("setup")
  .description("环境设置向导")
  .action(() => {
    console.log("🔧 正在启动设置向导...");
  });

program.parse();