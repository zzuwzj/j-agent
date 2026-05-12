/**
 * SubAgent 模式
 * 主 Agent 理解用户目标,把专业子任务委托给预设的 SubAgent(explorer/researcher/planner)
 * 主 Agent 只负责编排与汇总,不直接操作文件/搜代码
 */

import readline from "readline";
import chalk from "chalk";
import { ConversationManager } from "../conversation.js";
import { LLMClient } from "../llm.js";
import { createSubAgentRegistry } from "../agents/preset-agents.js";
import { delegateTools, createDelegateHandlers } from "../tools/delegate-tools.js";

const SYSTEM_PROMPT = `你是主 Agent,负责协调完成用户的复杂任务。你不直接读文件/搜代码,
而是把专业子任务委托给 SubAgent,然后汇总结果给用户。

## 可用 SubAgent
- **explorer**: 搜索和探索代码库结构。需要了解项目结构、定位文件时用
- **researcher**: 深入阅读和理解代码逻辑。需要分析具体代码实现时用
- **planner**: 根据已有分析产出实施计划。需要方案/步骤/优化建议时用

## 工作方式
1. 先判断用户意图:简单闲聊/概念问答就直接回答,不要委托
2. 复杂任务拆成 1-3 个委托:
   - 如果要先探索再分析,依次 explorer → researcher
   - 如果最终要方案,最后一步一定是 planner,并把前序结果放进 context 字段
3. 调 delegate_task 时 task 要具体可执行,context 放前序产出的关键信息
4. 所有 SubAgent 完成后,用自然语言给用户一份整合汇总

## 约束
- 不确定委托谁时,先调 list_sub_agents 查一下
- 一次对话里 SubAgent 总调用次数不要超过 5 次
- 每次 delegate 后都要对结果做一句话点评,再决定下一步`;

export const chatWithSubAgent = async () => {
  const conversation = new ConversationManager(SYSTEM_PROMPT);
  const llm = new LLMClient();
  const registry = createSubAgentRegistry();
  const { handlers, logs } = createDelegateHandlers(registry);

  // 包一层日志 handler,在 REPL 侧展示委托轨迹
  const tracedHandlers = {
    ...handlers,
    delegate_task: async (args) => {
      console.log();
      console.log(chalk.magenta(`📤 委托 → [${args.agentName}]`));
      console.log(chalk.gray(`   任务:${args.task}`));
      if (args.context) console.log(chalk.gray(`   上下文:${args.context.slice(0, 80)}${args.context.length > 80 ? "..." : ""}`));
      const result = await handlers.delegate_task(args);
      console.log(chalk.magenta(`📥 [${args.agentName}] 返回 ${result.length} 字符`));
      console.log();
      return result;
    },
  };

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = () => new Promise((r) => rl.question(chalk.blue("> "), r));

  console.log(chalk.yellow("🤖 AI Agent - SubAgent 模式"));
  console.log(chalk.gray("主 Agent 会把代码探索/分析/规划任务委托给 SubAgent"));
  console.log(chalk.gray("可用 SubAgent:explorer、researcher、planner"));
  console.log(chalk.gray("输入 /exit 退出,/clear 重置,/agents 查看 SubAgent,/logs 查看委托轨迹,/help 帮助"));
  console.log();

  try {
    while (true) {
      const input = await ask();

      if (input === "/exit" || input === "/quit") {
        console.log(chalk.green("👋 再见!"));
        break;
      }

      if (input === "/clear") {
        conversation.clear();
        for (const agent of Object.values(registry)) agent.reset();
        logs.length = 0;
        console.log(chalk.green("✨ 主对话和所有 SubAgent 已重置"));
        continue;
      }

      if (input === "/agents") {
        console.log(chalk.cyan("📋 可用 SubAgent:"));
        for (const [name, agent] of Object.entries(registry)) {
          const s = agent.getStats();
          console.log(chalk.gray(`  - ${name}: ${agent.description} (消息数 ${s.messageCount}, 工具数 ${s.toolCount})`));
        }
        console.log();
        continue;
      }

      if (input === "/logs") {
        if (logs.length === 0) {
          console.log(chalk.gray("暂无委托记录"));
        } else {
          logs.forEach((log, i) => {
            console.log(
              chalk.gray(
                `#${i + 1} [${log.status}] ${log.agent} — ${log.task.slice(0, 60)}${log.elapsed ? ` (${log.elapsed}ms)` : ""}`
              )
            );
          });
        }
        console.log();
        continue;
      }

      if (input === "/help") {
        console.log(chalk.gray(`
命令列表:
  /exit   - 退出
  /clear  - 重置主对话和所有 SubAgent
  /agents - 查看 SubAgent 及其累积的消息数
  /logs   - 查看委托轨迹
  /help   - 帮助

试试:
  - 什么是 SubAgent?        (简单问答,主 Agent 直接回答)
  - 分析一下 src/llm.js 里的 chatWithMCPTools 流程
  - 帮我看看这个项目的结构,然后给几条重构建议
        `));
        continue;
      }

      if (!input.trim()) continue;

      conversation.addMessage("user", input);

      try {
        process.stdout.write(chalk.cyan("AI: "));
        const reply = await llm.chatWithCustomTools(
          conversation.getFormattedHistory(),
          delegateTools,
          tracedHandlers,
          { maxRounds: 6 }
        );
        console.log(reply + "\n");
        conversation.addMessage("assistant", reply);
      } catch (error) {
        console.log(chalk.red("\n❌ 请求失败:"), error.message);
      }
    }
  } finally {
    rl.close();
  }
};
