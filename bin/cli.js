#!/usr/bin/env node

/**
 * j-agent CLI 入口文件
 * 支持 chat（流式对话）、init（初始化配置）、setup（环境向导）等命令
 */

import { program } from "commander";
import chalk from "chalk";
import readline from "readline";
import { ConversationManager } from "../src/conversation.js";
import { LLMClient } from "../src/llm.js";
import pkg from "../package.json" with { type: "json" };

// 配置命令基本信息
program
  .name("j-agent")
  .version(pkg.version)
  .description("AI Agent 命令行工具 - 让你的 AI 助手执行真实任务");

/**
 * 启动聊天模式
 * 创建会话管理器和 LLM 客户端，进入交互式对话循环
 */
const startChat = async () => {
  const conversation = new ConversationManager();
  const llmClient = new LLMClient();

  // 创建 readline 接口（异步非阻塞，不影响流式输出）
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(chalk.yellow("🤖 AI Agent 聊天模式已启动"));
  console.log(chalk.gray("输入 /exit 退出，/clear 重置对话，/help 查看帮助"));
  console.log();

  /** 将 rl.question 封装为 Promise，支持 await 调用 */
  const askQuestion = () => {
    return new Promise((resolve) => {
      rl.question(chalk.blue("> "), (answer) => {
        resolve(answer);
      });
    });
  };

  try {
    while (true) {
      const input = await askQuestion();

      // 退出命令
      if (input === "/exit" || input === "/quit") {
        console.log(chalk.green("👋 再见！"));
        break;
      }

      // 清空对话历史（保留 system 提示）
      if (input === "/clear") {
        conversation.clear();
        console.log(chalk.green("✨ 对话历史已重置"));
        continue;
      }

      // 帮助信息
      if (input === "/help") {
        console.log(chalk.gray(`
命令列表：
  /exit   - 退出聊天模式
  /clear  - 重置对话历史
  /help   - 显示帮助信息
        `));
        continue;
      }

      // 跳过空输入
      if (!input.trim()) continue;

      // 将用户消息加入对话历史
      conversation.addMessage("user", input);

      try {
        process.stdout.write(chalk.green("AI: "));
        let fullResponse = "";

        // 流式输出 AI 回复，逐 token 打印实现打字机效果
        for await (const token of llmClient.streamChatCompletion(
          conversation.getFormattedHistory()
        )) {
          process.stdout.write(token);
          fullResponse += token;
        }

        process.stdout.write("\n\n");

        // 将 AI 回复加入对话历史，维持多轮上下文
        conversation.addMessage("assistant", fullResponse);
      } catch (error) {
        console.log(chalk.red("\n❌ 请求失败："), error.message);
      }
    }
  } finally {
    rl.close();
  }
};

// 注册 chat 命令（主命令）
program
  .command("chat")
  .alias("c")
  .description("启动 AI 聊天模式")
  .action(startChat);

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