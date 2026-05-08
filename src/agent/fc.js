/**
 * Function Call 聊天模式
 * 支持工具调用的对话模式，AI 可自动判断是否需要调用工具
 */

import readline from "readline";
import chalk from "chalk";
import { ConversationManager } from "../conversation.js";
import { LLMClient } from "../llm.js";

export const chatWithTools = async () => {
  const conversation = new ConversationManager();
  const llmClient = new LLMClient();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(chalk.yellow("🛠️  AI Agent - Function Call 模式"));
  console.log(chalk.gray("能力：天气查询、文件操作等"));
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
  /exit   - 退出
  /clear  - 重置对话
  /help   - 显示帮助

试试问这些问题：
  - 北京现在多少度？
  - 上海天气怎么样？
  - 推荐一个适合周末旅游的城市
        `));
        continue;
      }

      // 跳过空输入
      if (!input.trim()) continue;

      // 将用户消息加入对话历史
      conversation.addMessage("user", input);

      try {
        process.stdout.write(chalk.cyan("AI: "));

        // 调用带工具能力的对话接口
        const response = await llmClient.chatWithTools(
          conversation.getFormattedHistory()
        );
        console.log(response + "\n");

        // 将 AI 回复加入对话历史
        conversation.addMessage("assistant", response);
      } catch (error) {
        console.log(chalk.red("\n❌ 请求失败："), error.message);
      }
    }
  } finally {
    rl.close();
  }
};