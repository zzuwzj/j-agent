#!/usr/bin/env node

import { program } from "commander";
import pkg from "../package.json" with { type: "json" };

program
  .name("j-agent")
  .version(pkg.version)
  .description("AI Agent 命令行工具 - 让你的 AI 助手执行真实任务");

// 命令：start - 启动 AI Agent 交互模式
program
  .command("start")
  .alias("s")
  .description("启动 AI Agent 交互模式")
  .option("-m, --model <model>", "指定使用的模型", "gpt-4")
  .action((options) => {
    console.log(`🤖 启动 AI Agent，使用模型：${options.model}`);
    console.log("Hello, AI Agent!");
  });

// 命令：init - 初始化配置文件
program
  .command("init")
  .description("初始化项目配置")
  .action(() => {
    console.log("📝 初始化配置...");
  });

// 命令：setup - 环境设置向导
program
  .command("setup")
  .description("环境设置向导")
  .action(() => {
    console.log("🔧 正在启动设置向导...");
  });

program.parse();