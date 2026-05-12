/**
 * 任务管理模式
 * AI 自动分解任务、追踪进度、逐步执行
 */

import readline from "readline";
import chalk from "chalk";
import { ConversationManager } from "../conversation.js";
import { LLMClient } from "../llm.js";
import { taskManager } from "../tools/task-tools.js";

const SYSTEM_PROMPT = `你是一个智能助手，能根据用户需求的复杂度自主选择处理方式。

第一步（必须）：判断用户的本轮输入属于下列哪一类——

A. **简单对话/单点问答**：闲聊、概念解释、一两句能说清的建议、代码片段、事实类问题等
   → 直接用自然语言回答，**不要**调用任何 task 工具

B. **复杂需求/多步骤任务**：需要规划、拆解、分阶段产出的事情，例如"规划……"、"帮我设计一个……系统"、"分析……流程"、"从零实现……"、明显包含多个可独立完成子步骤的请求
   → 调用 create_tasks 把它拆成 3-8 个有序、粒度适中的子任务；然后按顺序用 start_task → 产出内容 → complete_task 逐个推进；遇到无法解决的使用 fail_task；可用 get_task_status 回顾进度

判断准则（当你犹豫时，倾向于 A）：
- 用户没有明确说"拆解/规划/列步骤"且输出不超过 5-6 段就能讲清楚 → A
- 输入很短（一两句话的提问）且不要求产出多份交付物 → A
- 存在"先 X 然后 Y 再 Z"或"规划 / 方案 / 步骤 / 实现一个 / 从头开发"等信号，且一次回答装不下 → B

其它规则：
- 不要把任务拆得过细（每个子任务至少一个实打实的交付物）
- 为节省对话轮次，在同一次响应里可以并行发起多个 tool_calls：例如同时发起 start_task 和 complete_task（配合足够详尽的 result 字段）
- 如果前一轮已经创建了任务，这一轮继续推进任务而不是再次 create_tasks
- 全部任务推进结束后，附一段自然语言总结给用户，交付物逐条列清楚`;

export const chatWithTask = async () => {
  const conversation = new ConversationManager(SYSTEM_PROMPT);
  const llmClient = new LLMClient();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(chalk.yellow("📋 AI Agent - 任务模式"));
  console.log(chalk.gray("简单问题直接回答；复杂需求自动拆分 → 逐步执行 → 追踪进度"));
  console.log(chalk.gray("输入 /exit 退出，/clear 重置对话，/status 查看任务，/help 帮助"));
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
        taskManager.clearAllTasks();
        console.log(chalk.green("✨ 对话历史和任务已重置"));
        continue;
      }

      // 查看任务状态
      if (input === "/status") {
        const stats = taskManager.getStats();
        const list = taskManager.formatTaskList();
        console.log(chalk.cyan(`📊 任务统计：${stats.completed}/${stats.total} 完成`));
        console.log(chalk.gray(list));
        console.log();
        continue;
      }

      // 帮助信息
      if (input === "/help") {
        console.log(chalk.gray(`
命令列表：
  /exit   - 退出
  /clear  - 重置对话和任务
  /status - 查看任务进度
  /help   - 显示帮助

简单问题 — 直接回答：
  - 什么是 Function Call？
  - 推荐一个 Node.js 测试框架

复杂需求 — 自动拆分任务并逐步执行：
  - 帮我规划一个博客系统的开发步骤
  - 分析如何从零实现一个 AI Agent
  - 从头设计一个带评论的待办事项应用
        `));
        continue;
      }

      // 跳过空输入
      if (!input.trim()) continue;

      // 将用户消息加入对话历史
      conversation.addMessage("user", input);

      try {
        process.stdout.write(chalk.cyan("AI: "));

        // 调用带任务管理工具的对话接口
        const response = await llmClient.chatWithTaskManager(
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