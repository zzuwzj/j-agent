/**
 * SubAgent 委托工具
 * 主 Agent 通过这两个 Function Call 调用预设的 SubAgent:
 *  - delegate_task:  把子任务交给某个 SubAgent
 *  - list_sub_agents: 查看可用 SubAgent 清单
 *
 * createDelegateTools(registry) 每次绑定一个 registry,
 * 这样同一个 SubAgent 实例在一次主 Agent session 内被多次调用时,
 * 对话历史得以累积(探索阶段积累的结构信息可以在后续轮次复用)
 */

import { listSubAgentsMeta } from "../agents/preset-agents.js";

/**
 * 工具定义清单(OpenAI Function Call 格式)
 */
export const delegateTools = [
  {
    type: "function",
    function: {
      name: "delegate_task",
      description:
        "把子任务委托给专门的 SubAgent 执行。可选 agent:explorer(搜索结构)、researcher(读代码)、planner(制定计划)。" +
        "当任务需要专业能力或独立上下文时使用。",
      parameters: {
        type: "object",
        properties: {
          agentName: {
            type: "string",
            enum: ["explorer", "researcher", "planner"],
            description: "SubAgent 名称",
          },
          task: {
            type: "string",
            description: "委托给 SubAgent 的任务描述,要具体、可执行",
          },
          context: {
            type: "string",
            description: "可选。前序 SubAgent 产出的关键信息,让后续 SubAgent 接力推进",
          },
        },
        required: ["agentName", "task"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_sub_agents",
      description: "列出所有可用的 SubAgent 及其描述。在不确定用哪个 SubAgent 时调用。",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
];

/**
 * 把 registry 绑定到 handlers,返回 { handlers, logs }
 * logs 是每次委托的轨迹,便于主 REPL 展示
 */
export const createDelegateHandlers = (registry) => {
  const logs = [];

  const handlers = {
    delegate_task: async ({ agentName, task, context }) => {
      const agent = registry[agentName];
      if (!agent) {
        return `❌ SubAgent ${agentName} 不存在,可选:${Object.keys(registry).join(", ")}`;
      }

      const fullTask = context ? `${task}\n\n## 上下文信息\n${context}` : task;

      const start = Date.now();
      logs.push({ agent: agentName, task, context, status: "running" });

      try {
        const result = await agent.run(fullTask);
        const elapsed = Date.now() - start;
        logs[logs.length - 1] = {
          agent: agentName,
          task,
          context,
          status: "done",
          elapsed,
          result,
        };
        return result;
      } catch (error) {
        logs[logs.length - 1] = {
          agent: agentName,
          task,
          context,
          status: "failed",
          error: error.message,
        };
        return `❌ SubAgent ${agentName} 执行失败:${error.message}`;
      }
    },

    list_sub_agents: () => {
      const lines = listSubAgentsMeta().map(
        (a) => `- **${a.name}**: ${a.description}`
      );
      return "📋 可用的 SubAgent:\n\n" + lines.join("\n");
    },
  };

  return { handlers, logs };
};
