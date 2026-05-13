/**
 * Memory 工具集
 * 让 LLM 显式调用 remember_xxx / recall_memory 来主动记忆和召回
 *
 * 工厂模式:createMemoryHandlers(manager) 把 manager 闭包进 handlers,
 * 一次会话的所有工具调用共享同一份 manager 状态(currentProjectId 等)
 */

export const memoryTools = [
  {
    type: "function",
    function: {
      name: "remember_preference",
      description:
        "记住用户的某项偏好(如 preferredLanguage = TypeScript、codeStyle = 函数式)。当用户明确表达喜好时调用。",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string", description: "偏好键,推荐:preferredLanguage、codeStyle、communicationLanguage、framework" },
          value: { type: "string", description: "偏好值" },
        },
        required: ["key", "value"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remember_project",
      description:
        "记住一个项目的基础信息(名称、描述、技术栈),并把它设为当前项目,后续 remember_decision 会写到这个项目下。",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "项目唯一标识(英文短名,会用作文件名)" },
          name: { type: "string", description: "项目展示名" },
          description: { type: "string", description: "项目一句话描述" },
          techStack: {
            type: "array",
            items: { type: "string" },
            description: "技术栈数组,如 ['React','TypeScript','Vite']",
          },
        },
        required: ["projectId", "name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remember_decision",
      description:
        "把一项关键决策记入当前项目(必须先 remember_project 或 switch_project)。决策应该是简短可复述的一句话。",
      parameters: {
        type: "object",
        properties: {
          decision: { type: "string", description: "决策内容,简短一句" },
        },
        required: ["decision"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "switch_project",
      description: "切换当前活跃项目(已存在的 projectId)。切换后 remember_decision 等工具会作用到新项目上。",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "已存在的项目 ID" },
        },
        required: ["projectId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "recall_memory",
      description:
        "在持久化记忆中按关键词检索(用户偏好 / 项目信息 / 已学知识)。当用户问 “我们之前定的xxx”、“我之前提过xxx” 时调用。",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "搜索关键词" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_memory_stats",
      description: "返回记忆系统的统计:用户画像数、项目数、会话数、当前活跃项目等。",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
];

export const createMemoryHandlers = (manager) => ({
  remember_preference: async ({ key, value }) => {
    await manager.updateUserPreference(key, value);
    return `✅ 已记住偏好:${key} = ${value}`;
  },

  remember_project: async ({ projectId, name, description, techStack }) => {
    const ctx = await manager.saveProjectContext({
      projectId,
      name,
      description: description || "",
      techStack: techStack || [],
    });
    manager.setCurrentProject(ctx.projectId);
    return `✅ 已记住项目 "${ctx.name}"(${ctx.projectId})并设为当前项目;技术栈:${ctx.techStack.join(", ") || "(空)"}`;
  },

  remember_decision: async ({ decision }) => {
    if (!manager.currentProjectId) {
      return "❌ 当前没有活跃项目,请先调用 remember_project 或 switch_project";
    }
    await manager.addProjectDecision(manager.currentProjectId, decision);
    return `✅ 已记录决策(项目 ${manager.currentProjectId}):${decision}`;
  },

  switch_project: async ({ projectId }) => {
    const ctx = await manager.getProjectContext(projectId);
    if (!ctx) return `❌ 找不到项目 ${projectId}`;
    manager.setCurrentProject(ctx.projectId);
    return `✅ 已切换到项目 "${ctx.name}"(${ctx.projectId})`;
  },

  recall_memory: async ({ query }) => {
    const hits = await manager.searchMemories(query);
    if (hits.length === 0) return `🔍 没有找到与 "${query}" 相关的记忆`;
    const lines = hits.map((h, i) => `${i + 1}. [${h.type}] ${h.text}`);
    return `🔍 命中 ${hits.length} 条:\n${lines.join("\n")}`;
  },

  get_memory_stats: async () => {
    const s = await manager.getStats();
    return (
      `📊 记忆统计\n` +
      `- 用户画像:${s.userProfiles}\n` +
      `- 项目上下文:${s.projectContexts}\n` +
      `- 会话历史:${s.sessions}\n` +
      `- 学到的知识:${s.knowledgeItems}\n` +
      `- 当前用户:${s.currentUserId}\n` +
      `- 当前项目:${s.currentProjectId || "(未选择)"}\n` +
      `- 当前会话:${s.currentSessionId}`
    );
  },
});
