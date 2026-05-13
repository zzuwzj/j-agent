/**
 * MemoryMiddleware - 在对话前后自动织入记忆
 *
 * - beforeRequest:从用户画像 / 当前项目 / 最近知识中拼一段背景注入到 system 消息后
 * - afterRequest :落盘 user / assistant 消息,并尝试启发式提取偏好和决策
 *
 * 提取规则有意保持保守,目的是减少误记忆。需要 LLM 主动记的,直接走 memory tools 更可靠。
 */

const PREFERENCE_PATTERNS = [
  // 编程语言偏好:更喜欢 X / 偏好 X / 用 X / 选择 X 写
  { regex: /(?:更喜欢|偏好|喜欢用|选择用?|习惯用)\s*([A-Za-z0-9.+#-]{2,20})/, key: "preferredLanguage" },
  // 代码风格:codeStyle = ES6 / 用 ES Module / 函数式
  { regex: /(?:代码风格|风格)(?:是|用|偏好)?\s*([A-Za-z0-9 ]{2,30})/, key: "codeStyle" },
  // 沟通风格:回答简洁 / 用中文回答
  { regex: /(?:用|请用)\s*(中文|英文|English)\s*(?:回答|沟通)/, key: "communicationLanguage" },
];

const DECISION_PATTERNS = [
  /(?:我们)?决定[:：]?\s*([^\n。;；]{4,80})/,
  /(?:就用|就选|最终选择|最终用)\s*([^\n。;；]{2,80})/,
];

const PROJECT_PATTERNS = [
  /项目[:：]\s*([A-Za-z0-9_\-一-龥]{2,40})/,
  /(?:在做|开发)\s*(?:一个|个)?\s*([A-Za-z0-9_\-一-龥]{2,30})\s*(?:项目|应用|系统)/,
];

const sliceFirstMatch = (text, patterns) => {
  for (const item of patterns) {
    const m = text.match(item.regex || item);
    if (m && m[1]) return { match: m[1].trim(), key: item.key };
  }
  return null;
};

export class MemoryMiddleware {
  constructor(memoryManager) {
    if (!memoryManager) throw new Error("MemoryMiddleware 需要 MemoryManager 实例");
    this.memoryManager = memoryManager;
  }

  /**
   * 把记忆拼成一段 system 提示,插在原 system 之后
   * 返回新的 messages 数组,不修改原数组
   */
  async beforeRequest(messages = []) {
    const blocks = await this.buildContextBlocks();
    if (blocks.length === 0) return [...messages];

    const memoryNote = {
      role: "system",
      content: `以下是从持久化记忆中加载的背景信息(供你参考,不必逐条复述):\n\n${blocks.join("\n\n")}`,
    };

    // 插在原 system 消息之后,确保仍是 system 段落
    const out = [...messages];
    const firstNonSystem = out.findIndex((m) => m.role !== "system");
    if (firstNonSystem === -1) {
      out.push(memoryNote);
    } else {
      out.splice(firstNonSystem, 0, memoryNote);
    }
    return out;
  }

  /** 单独暴露,便于 REPL 在启动时打印背景摘要 */
  async buildContextBlocks() {
    const blocks = [];

    const profile = await this.memoryManager.getUserProfile();
    if (profile) {
      const prefs = profile.preferences || {};
      const prefLines = Object.entries(prefs).map(([k, v]) => `  - ${k}: ${v}`).join("\n");
      blocks.push(
        `【用户画像】\n` +
          `用户名:${profile.name || profile.userId}\n` +
          `偏好:\n${prefLines || "  (尚无偏好)"}`
      );
    }

    const project = await this.memoryManager.getProjectContext();
    if (project) {
      const decisions = (project.decisions || []).slice(-5);
      const decisionLines = decisions
        .map((d, i) => `  ${i + 1}. ${typeof d === "string" ? d : d.content}`)
        .join("\n");
      blocks.push(
        `【当前项目】\n` +
          `名称:${project.name}\n` +
          `描述:${project.description || "(无)"}\n` +
          `技术栈:${project.techStack?.join(", ") || "(无)"}\n` +
          `近 5 条决策:\n${decisionLines || "  (无)"}`
      );
    }

    return blocks;
  }

  /**
   * 落盘对话消息 + 尝试提取偏好/决策
   * 返回 { savedPreferences, savedDecisions } 让 REPL 可见
   */
  async afterRequest(userMessage, assistantMessage) {
    if (userMessage) await this.memoryManager.saveMessage("user", userMessage);
    if (assistantMessage) await this.memoryManager.saveMessage("assistant", assistantMessage);

    return this.extractAndSave(userMessage || "");
  }

  async extractAndSave(userMsg) {
    const savedPreferences = [];
    const savedDecisions = [];

    if (!userMsg) return { savedPreferences, savedDecisions };

    // 偏好
    for (const item of PREFERENCE_PATTERNS) {
      const m = userMsg.match(item.regex);
      if (m && m[1]) {
        const value = m[1].trim();
        await this.memoryManager.updateUserPreference(item.key, value);
        savedPreferences.push({ key: item.key, value });
      }
    }

    // 决策(只有当前项目存在才记录,否则容易误判)
    if (this.memoryManager.currentProjectId) {
      const decision = sliceFirstMatch(userMsg, DECISION_PATTERNS);
      if (decision) {
        await this.memoryManager.addProjectDecision(
          this.memoryManager.currentProjectId,
          decision.match
        );
        savedDecisions.push(decision.match);
      }
    }

    // 项目识别(轻量,只切换 currentProjectId,不主动写入项目元数据)
    if (!this.memoryManager.currentProjectId) {
      const projectHit = sliceFirstMatch(userMsg, PROJECT_PATTERNS);
      if (projectHit) {
        this.memoryManager.setCurrentProject(projectHit.match);
      }
    }

    return { savedPreferences, savedDecisions };
  }
}
