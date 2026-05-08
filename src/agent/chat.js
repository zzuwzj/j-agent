/**
 * 纯聊天模式
 * 流式输出，不调用工具
 */

import readline from "readline";
import chalk from "chalk";
import { ConversationManager } from "../conversation.js";
import { LLMClient } from "../llm.js";

export const startChat = async () => {
  const conversation = new ConversationManager();
  const llmClient = new LLMClient();

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