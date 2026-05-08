#!/usr/bin/env node

/**
 * j-agent CLI 入口文件
 * 支持 chat（纯聊天）、fc（Function Call 工具调用）、init、setup 等命令
 */

import { program } from "commander";
import { startChat, chatWithTools } from "../src/agent/index.js";
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

// start 命令作为 chat 的别名，兼容旧版
program
  .command("start")
  .alias("s")
  .description("启动 AI Agent（同 chat）")
  .action(startChat);

// 初始化配置（后续章节实现）
program
  .command("init")
  .description("初始化项目配置")
  .action(() => {
    console.log("📝 初始化配置...");
  });

// 环境设置向导（后续章节实现）
program
  .command("setup")
  .description("环境设置向导")
  .action(() => {
    console.log("🔧 正在启动设置向导...");
  });

program.parse();