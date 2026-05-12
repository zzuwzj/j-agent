/**
 * Skills 工具集
 * 让 LLM 按需加载领域知识
 *
 * createSkillsHandlers(manager) 工厂:把 manager 实例闭包进 handlers,
 * 主 Agent session 始终使用同一份缓存
 */

/**
 * 工具定义(OpenAI Function Call 格式)
 */
export const skillsTools = [
  {
    type: "function",
    function: {
      name: "load_skill",
      description:
        "加载指定 Skill 的完整知识内容。当问题需要特定领域的专业知识时使用(如 git 操作、docker 用法、js 语言特性)。返回该 Skill 的 markdown 知识文本,你应基于它回答。",
      parameters: {
        type: "object",
        properties: {
          skillName: {
            type: "string",
            description: "Skill 名称,必须是 list_skills 返回的名称之一",
          },
        },
        required: ["skillName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_skills",
      description: "列出所有可用的 Skills 及其一句话描述。不确定问题属于哪个领域时先调这个。",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_skill_stats",
      description: "查看当前已注册/已加载的 Skills 统计信息。",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
];

/**
 * 生成绑定到 manager 的 handlers
 * @param {import("../skills/manager.js").SkillsManager} manager
 */
export const createSkillsHandlers = (manager) => ({
  load_skill: async ({ skillName }) => {
    try {
      const content = await manager.loadSkill(skillName);
      return `【${skillName} Skill 知识】\n\n${content}`;
    } catch (error) {
      return `❌ ${error.message}`;
    }
  },

  list_skills: () => {
    const skills = manager.getAvailableSkills();
    if (skills.length === 0) {
      return "📚 当前没有可用的 Skills。";
    }
    const lines = skills.map(
      (s) => `- **${s.name}** (v${s.version}): ${s.description}`
    );
    return "📚 可用的 Skills:\n\n" + lines.join("\n");
  },

  get_skill_stats: () => {
    const stats = manager.getStats();
    return (
      `📊 Skills 统计\n` +
      `- 已注册:${stats.total}\n` +
      `- 已加载:${stats.loaded}\n` +
      `- 已加载列表:${stats.loadedNames.join(", ") || "(无)"}`
    );
  },
});
