/**
 * Memory 模式
 * - 启动时读取 memory/ 下的画像与项目上下文,通过 MemoryMiddleware 注入 system 消息
 * - 每轮对话后落盘,并启发式提取偏好/决策
 * - LLM 也能主动调 memory tools 来更精确地存取
 */

import readline from "readline";
import path from "path";
import chalk from "chalk";

import { ConversationManager } from "../conversation.js";
import { LLMClient } from "../llm.js";
import { MemoryManager } from "../memory/manager.js";
import { MemoryMiddleware } from "../memory/middleware.js";
import { memoryTools, createMemoryHandlers } from "../tools/memory-tools.js";

const SYSTEM_PROMPT = `你是一个具备**长期记忆**的 AI 助手。

## 工作方式
1. 你的 system 消息中可能包含【用户画像】【当前项目】等持久化背景,优先尊重这些信息,但不要每次都复述。
2. 当用户**明确**表达偏好(如"我喜欢用 TypeScript")、介绍项目、或下决定时,主动调用对应的 memory 工具落盘:
   - remember_preference:偏好键值对
   - remember_project:首次提到项目时存入,会顺便切换为当前项目
   - remember_decision:必须先有当前项目,再记决策
3. 当用户问"我们之前怎么定的"、"我之前提过吗"时,调用 recall_memory 检索。
4. 闲聊或一次性问答**不要**乱写记忆,避免污染。
5. 如果背景信息和当前问题冲突,以用户**最新**说法为准,并用 remember_xxx 覆盖旧记忆。`;

export const chatWithMemory = async () => {
  const memoryDir = path.resolve(process.cwd(), "memory");
  const manager = new MemoryManager(memoryDir);
  await manager.initialize();

  const middleware = new MemoryMiddleware(manager);
  const handlers = createMemoryHandlers(manager);
  const conversation = new ConversationManager(SYSTEM_PROMPT);
  const llm = new LLMClient();

  // 在工具调用层加日志,让用户看到 LLM 主动写记忆
  const traced = Object.fromEntries(
    Object.entries(handlers).map(([name, fn]) => [
      name,
      async (args) => {
        const result = await fn(args);
        const argStr = Object.keys(args).length === 0 ? "" : ` ${JSON.stringify(args)}`;
        console.log(chalk.magenta(`\n🧠 ${name}${argStr}`));
        return result;
      },
    ])
  );

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = () => new Promise((r) => rl.question(chalk.blue("> "), r));

  console.log(chalk.yellow("🧠 AI Agent - Memory 模式"));
  console.log(chalk.gray(`记忆目录:${memoryDir}`));
  const stats = await manager.getStats();
  console.log(
    chalk.gray(
      `已存:${stats.userProfiles} 个用户画像 / ${stats.projectContexts} 个项目 / ${stats.sessions} 个会话 / ${stats.knowledgeItems} 条知识`
    )
  );

  const initBlocks = await middleware.buildContextBlocks();
  if (initBlocks.length > 0) {
    console.log(chalk.gray("已加载背景:"));
    for (const block of initBlocks) {
      console.log(chalk.gray(block.split("\n").map((l) => `  ${l}`).join("\n")));
    }
  } else {
    console.log(chalk.gray("当前没有持久化背景,从一张白纸开始。"));
  }

  console.log(
    chalk.gray(
      "命令:/exit /clear /memory /forget-project <id> /sessions /switch-user <id> /switch-project <id> /cleanup [days] /help"
    )
  );
  console.log();

  try {
    while (true) {
      const input = (await ask()).trim();
      if (!input) continue;

      if (input === "/exit" || input === "/quit") {
        console.log(chalk.green("👋 再见!记忆已落盘。"));
        break;
      }

      if (input === "/clear") {
        conversation.clear();
        console.log(chalk.green("✨ 对话历史已重置(磁盘上的记忆保留)"));
        continue;
      }

      if (input === "/memory") {
        const blocks = await middleware.buildContextBlocks();
        if (blocks.length === 0) {
          console.log(chalk.gray("(当前没有可注入的记忆背景)"));
        } else {
          console.log(chalk.cyan(blocks.join("\n\n")));
        }
        console.log();
        continue;
      }

      if (input === "/sessions") {
        const sessions = await manager.getRecentSessions(10);
        if (sessions.length === 0) {
          console.log(chalk.gray("(没有历史会话)"));
        } else {
          console.log(chalk.cyan("最近 10 个会话:"));
          for (const s of sessions) {
            const msgCount = s.messages?.length || 0;
            console.log(
              chalk.gray(
                `  - ${s.sessionId}  (${msgCount} 条消息,起始 ${s.startedAt}${s.projectId ? `,项目 ${s.projectId}` : ""})`
              )
            );
          }
        }
        console.log();
        continue;
      }

      if (input.startsWith("/switch-user")) {
        const newUser = input.replace("/switch-user", "").trim();
        if (!newUser) {
          console.log(chalk.yellow("用法:/switch-user <userId>"));
          continue;
        }
        manager.setCurrentUser(newUser);
        conversation.clear();
        console.log(chalk.green(`✅ 已切换到用户 ${manager.currentUserId},并重置对话历史`));
        continue;
      }

      if (input.startsWith("/switch-project")) {
        const pid = input.replace("/switch-project", "").trim();
        if (!pid) {
          console.log(chalk.yellow("用法:/switch-project <projectId>"));
          continue;
        }
        const ctx = await manager.getProjectContext(pid);
        if (!ctx) {
          console.log(chalk.red(`❌ 找不到项目 ${pid}(可用 /memory 查看现有项目)`));
          continue;
        }
        manager.setCurrentProject(ctx.projectId);
        console.log(chalk.green(`✅ 已切换到项目 ${ctx.name}(${ctx.projectId})`));
        continue;
      }

      if (input.startsWith("/forget-project")) {
        const pid = input.replace("/forget-project", "").trim();
        if (!pid) {
          console.log(chalk.yellow("用法:/forget-project <projectId>"));
          continue;
        }
        const ok = await manager.forgetProject(pid);
        console.log(ok ? chalk.green(`🗑️ 已删除项目 ${pid}`) : chalk.red(`❌ 找不到项目 ${pid}`));
        continue;
      }

      if (input.startsWith("/cleanup")) {
        const dayStr = input.replace("/cleanup", "").trim();
        const days = dayStr ? Math.max(1, parseInt(dayStr, 10) || 30) : 30;
        const removed = await manager.cleanupOldSessions(days);
        console.log(chalk.green(`🧹 已清理 ${removed} 个 ${days} 天前的会话`));
        continue;
      }

      if (input === "/help") {
        console.log(
          chalk.gray(`
命令:
  /exit                    退出
  /clear                   重置对话(不影响磁盘记忆)
  /memory                  查看当前注入到 system 的背景
  /sessions                列出最近 10 个会话
  /switch-user <id>        切换当前用户(每个用户独立画像)
  /switch-project <id>     切换当前项目
  /forget-project <id>     删除一个项目的所有上下文
  /cleanup [days]          清理 N 天前的会话历史(默认 30)
  /help                    帮助

提示:
  - 直接说 "我喜欢用 TypeScript" → AI 会主动 remember_preference
  - 直接说 "我在做一个 React 项目,叫 fe-shop" → AI 会主动 remember_project
  - 之后即使新会话也会带上这些背景
        `)
        );
        continue;
      }

      // 普通对话:注入记忆 → 调 LLM(带 memory tools) → 落盘
      conversation.addMessage("user", input);
      try {
        const enriched = await middleware.beforeRequest(conversation.getFormattedHistory());
        process.stdout.write(chalk.cyan("AI: "));
        const reply = await llm.chatWithCustomTools(enriched, memoryTools, traced, { maxRounds: 6 });
        console.log(reply + "\n");
        conversation.addMessage("assistant", reply);

        const extracted = await middleware.afterRequest(input, reply);
        if (extracted.savedPreferences.length > 0 || extracted.savedDecisions.length > 0) {
          const parts = [];
          if (extracted.savedPreferences.length > 0) {
            parts.push(
              `偏好 ${extracted.savedPreferences.map((p) => `${p.key}=${p.value}`).join(",")}`
            );
          }
          if (extracted.savedDecisions.length > 0) {
            parts.push(`决策 ${extracted.savedDecisions.length} 条`);
          }
          console.log(chalk.gray(`(自动提取并落盘:${parts.join(";")})\n`));
        }
      } catch (error) {
        console.log(chalk.red("\n❌ 请求失败:"), error.message);
      }
    }
  } finally {
    rl.close();
  }
};
