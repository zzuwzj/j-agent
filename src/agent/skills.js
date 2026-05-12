/**
 * Skills 模式
 * LLM 面对领域问题时,主动调用 load_skill 拉取对应知识,再基于知识回答
 */

import readline from "readline";
import chalk from "chalk";
import path from "path";
import { ConversationManager } from "../conversation.js";
import { LLMClient } from "../llm.js";
import { SkillsManager } from "../skills/manager.js";
import { skillsTools, createSkillsHandlers } from "../tools/skills-tools.js";

const buildSystemPrompt = (manager) => `你是一个能按需调用 Skills 的 AI 助手。

## 可用 Skills
${manager.formatAvailableSkills()}

## 工作方式
1. 用户提问时,先判断是否需要特定领域知识
2. 需要 ⇒ 调 load_skill(skillName) 加载知识,然后**基于加载的内容**作答,不要脱离知识瞎编
3. 不确定属于哪个领域 ⇒ 先调 list_skills 看清单
4. 同一 Skill 在一次会话里有缓存,重复问同领域可以直接用已加载的知识
5. 如果加载的 Skill 里也找不到答案,**诚实告知**并给出通用建议,不要编造

## 约束
- 每次只加载你确实需要的 1-2 个 Skill,不要一股脑全加载
- 加载后要直接拿来用,不能只说"我加载了 git skill"而不给答案
- 日常闲聊、简单概念问答不需要加载 Skill`;

export const chatWithSkills = async () => {
  // 以项目根目录下的 skills/ 为源
  const skillsDir = path.resolve(process.cwd(), "skills");
  const manager = new SkillsManager(skillsDir);
  await manager.scanSkills();

  const handlers = createSkillsHandlers(manager);
  const conversation = new ConversationManager(buildSystemPrompt(manager));
  const llm = new LLMClient();

  // REPL 侧加日志,让用户看到 Skill 的加载/缓存
  const traced = {
    ...handlers,
    load_skill: async (args) => {
      const cachedBefore = manager.getStats().loadedNames.includes(args.skillName);
      const result = await handlers.load_skill(args);
      if (result.startsWith("❌")) {
        console.log(chalk.red(`\n📕 Skill 加载失败:${args.skillName}`));
      } else if (cachedBefore) {
        console.log(chalk.gray(`\n📦 命中缓存:${args.skillName}`));
      } else {
        console.log(chalk.magenta(`\n📖 加载 Skill:${args.skillName}`));
      }
      return result;
    },
  };

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = () => new Promise((r) => rl.question(chalk.blue("> "), r));

  console.log(chalk.yellow("📚 AI Agent - Skills 模式"));
  console.log(
    chalk.gray(`按需加载领域知识。可用 Skills:${manager.getAvailableSkills().map((s) => s.name).join(", ") || "(无)"}`)
  );
  console.log(chalk.gray("输入 /exit 退出,/clear 重置对话,/skills 查看清单,/stats 查看加载状态,/reset-cache 清空缓存,/help 帮助"));
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
        console.log(chalk.green("✨ 对话历史已重置"));
        continue;
      }

      if (input === "/skills") {
        console.log(chalk.cyan(handlers.list_skills()));
        console.log();
        continue;
      }

      if (input === "/stats") {
        console.log(chalk.cyan(handlers.get_skill_stats()));
        console.log();
        continue;
      }

      if (input === "/reset-cache") {
        manager.clearAllCache();
        console.log(chalk.green("🗑️ 已清空所有 Skill 缓存(元数据保留)"));
        continue;
      }

      if (input === "/help") {
        console.log(chalk.gray(`
命令:
  /exit         退出
  /clear        重置对话历史(不影响 Skill 缓存)
  /skills       列出可用 Skills
  /stats        查看已注册/已加载统计
  /reset-cache  清空 Skill 缓存(强制下次重新读文件)
  /help         帮助

试试:
  - git rebase 和 merge 有什么区别?        (→ 会 load_skill git)
  - docker compose 里数据卷怎么写?          (→ 会 load_skill docker)
  - forEach 里的 await 为什么不起作用?       (→ 会 load_skill javascript)
  - 你好                                      (→ 简单问答,不会加载 Skill)
        `));
        continue;
      }

      if (!input.trim()) continue;

      conversation.addMessage("user", input);
      try {
        process.stdout.write(chalk.cyan("AI: "));
        const reply = await llm.chatWithCustomTools(
          conversation.getFormattedHistory(),
          skillsTools,
          traced,
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
