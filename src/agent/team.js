/**
 * Team 模式 REPL
 * 主 Agent 不直接干活,而是通过 Function Call 调度团队里的 Explorer / Researcher / Advisor。
 * 与 SubAgent 模式的区别:Team Agent 之间通过共享消息总线协作,可广播任务收集多视角结果。
 */

import readline from "readline";
import chalk from "chalk";
import { ConversationManager } from "../conversation.js";
import { LLMClient } from "../llm.js";
import { AgentTeam } from "../team/manager.js";
import { teamTools, createTeamHandlers } from "../tools/team-tools.js";

const SYSTEM_PROMPT = `你是 Agent Team 的协调者。你不直接读文件/写代码,而是把任务交给团队成员。

## 团队成员
- **explorer**:搜索代码结构、定位文件
- **researcher**:深入读代码、分析实现
- **advisor**:权衡取舍、给出方案建议

## 工作方式
1. 先判断用户意图:简单闲聊/概念问答 → 直接回答,不要调度团队
2. 单一专家就能搞定的 → 用 call_agent(agentId, task)
3. 需要多视角协同的复杂任务(如代码评审、项目体检、重构评估) → 用 coordinate_team(task) 广播
4. 不确定调谁 → 先 list_agents 看清单
5. 团队返回的内容,**整合后**用自然语言回复用户,不要原样转发

## 约束
- 一次对话总调度次数不超过 6 次
- coordinate_team 适合"评估/体检/对比"类需求,不要滥用(单点查询用 call_agent 即可)
- 团队执行完后,务必给用户一份带结论的总结,不要只说"已经叫他们做了"`;

export const chatWithTeam = async () => {
  const team = new AgentTeam();
  await team.initialize();

  const handlers = createTeamHandlers(team);
  const conversation = new ConversationManager(SYSTEM_PROMPT);
  const llm = new LLMClient();

  // REPL 侧加日志,让用户看到调度轨迹
  const traced = {
    ...handlers,
    call_agent: async (args) => {
      console.log();
      console.log(chalk.magenta(`📤 调度 → [${args.agentId}]`));
      console.log(chalk.gray(`   任务:${args.task}`));
      const start = Date.now();
      const result = await handlers.call_agent(args);
      console.log(
        chalk.magenta(`📥 [${args.agentId}] 返回 ${result.length} 字符 (${Date.now() - start}ms)`)
      );
      console.log();
      return result;
    },
    coordinate_team: async (args) => {
      console.log();
      console.log(chalk.magenta(`📢 广播任务给整个团队`));
      console.log(chalk.gray(`   任务:${args.task}`));
      const start = Date.now();
      const result = await handlers.coordinate_team(args);
      console.log(
        chalk.magenta(`📥 团队汇总 ${result.length} 字符 (${Date.now() - start}ms)`)
      );
      console.log();
      return result;
    },
  };

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = () => new Promise((r) => rl.question(chalk.blue("> "), r));

  console.log(chalk.yellow("🤝 AI Agent - Team 模式"));
  console.log(chalk.gray("主 Agent 把任务交给团队 Agent(去中心化协作,共享消息总线)"));
  console.log(
    chalk.gray(
      `团队成员:${team.getAgents().map((a) => `${a.id}(${a.name})`).join("、")}`
    )
  );
  console.log(
    chalk.gray("命令:/exit 退出,/clear 重置,/agents 查看成员,/stats 查看统计,/messages 查看消息历史,/verbose 切换消息打印,/help 帮助")
  );
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
        team.reset();
        console.log(chalk.green("✨ 主对话和所有 Team Agent 已重置"));
        continue;
      }

      if (input === "/agents") {
        console.log(chalk.cyan(handlers.list_agents()));
        console.log();
        continue;
      }

      if (input === "/stats") {
        console.log(chalk.cyan(handlers.get_team_stats()));
        console.log();
        continue;
      }

      if (input === "/messages") {
        const history = team.messageBus.getHistory(undefined, 20);
        if (history.length === 0) {
          console.log(chalk.gray("(消息总线为空)"));
        } else {
          console.log(chalk.cyan(`📨 最近 ${history.length} 条消息:`));
          for (const m of history) {
            const preview = m.content.replace(/\s+/g, " ").slice(0, 80);
            console.log(
              chalk.gray(`  [${m.type}] ${m.from} → ${m.to}: ${preview}${m.content.length > 80 ? "..." : ""}`)
            );
          }
        }
        console.log();
        continue;
      }

      if (input === "/verbose") {
        team.setVerbose(!team.verbose);
        console.log(chalk.green(`📡 消息打印:${team.verbose ? "开" : "关"}`));
        continue;
      }

      if (input === "/help") {
        console.log(chalk.gray(`
命令列表:
  /exit      退出
  /clear     重置主对话和所有 Team Agent
  /agents    查看团队成员
  /stats     查看统计
  /messages  查看消息总线最近 20 条
  /verbose   切换:每次消息流过总线时打印一行(默认关)
  /help      帮助

试试:
  - 什么是 Agent Team?              (简单问答,不会调度团队)
  - 帮我看看这个项目结构              (单点 → call_agent explorer)
  - 分析一下 src/team/manager.js       (单点 → call_agent researcher)
  - 评估这个项目代码质量,给重构建议    (协同 → coordinate_team)
        `));
        continue;
      }

      if (!input.trim()) continue;

      conversation.addMessage("user", input);

      try {
        process.stdout.write(chalk.cyan("AI: "));
        const reply = await llm.chatWithCustomTools(
          conversation.getFormattedHistory(),
          teamTools,
          traced,
          { maxRounds: 8 }
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
