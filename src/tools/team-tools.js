/**
 * Team 工具集
 * 让主 Agent 通过 Function Call 调度 Agent Team
 *
 * createTeamHandlers(team) 工厂:把 AgentTeam 实例闭包进 handlers,
 * 一次 session 内同一组 Agent 共享对话历史和消息总线状态。
 */

import { AgentTeam } from "../team/manager.js";

/** 工具定义清单(OpenAI Function Call 格式) */
export const teamTools = [
  {
    type: "function",
    function: {
      name: "call_agent",
      description:
        "直接调用团队中某一个 Agent 完成任务。当你能确定哪类专家最合适时使用。" +
        "可选 agent:explorer(搜索结构)、researcher(读代码)、advisor(给建议)。",
      parameters: {
        type: "object",
        properties: {
          agentId: {
            type: "string",
            enum: ["explorer", "researcher", "advisor"],
            description: "Agent 的 id",
          },
          task: {
            type: "string",
            description: "交给该 Agent 的具体任务,要清晰可执行",
          },
        },
        required: ["agentId", "task"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "coordinate_team",
      description:
        "广播任务给整个团队,让多个 Agent 各自从专业角度给出输出,然后汇总。" +
        "适合需要多视角协同的复杂任务(如代码评审、项目体检等)。",
      parameters: {
        type: "object",
        properties: {
          task: {
            type: "string",
            description: "要广播给整个团队的任务描述",
          },
        },
        required: ["task"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_agents",
      description: "列出团队所有可用 Agent 及其描述。不确定调用谁时先用这个。",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_team_stats",
      description: "查看团队统计信息,包括各 Agent 的对话计数和消息总线状态。",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
];

/**
 * 生成绑定到 team 的 handlers
 * @param {AgentTeam} team
 */
export function createTeamHandlers(team) {
  return {
    call_agent: async ({ agentId, task }) => {
      return team.callAgent(agentId, task);
    },

    coordinate_team: async ({ task }) => {
      return team.coordinate(task);
    },

    list_agents: () => {
      const agents = team.getAgents();
      if (agents.length === 0) {
        return "🤖 团队还没有任何 Agent。";
      }
      const lines = agents.map(
        (a) => `- **${a.id}** (${a.name},${a.role}):${a.description}`
      );
      return "🤖 团队成员:\n\n" + lines.join("\n");
    },

    get_team_stats: () => {
      const stats = team.getStats();
      const agentLines = stats.agents
        .map((a) => `- ${a.name}(${a.role}):消息 ${a.messageCount} 条,工具 ${a.toolCount} 个`)
        .join("\n");
      return (
        `📊 Team 统计\n` +
        `- Agent 数量:${stats.agentCount}\n` +
        `- 消息历史:${stats.messageBus.historySize}/${stats.messageBus.maxHistory}\n` +
        `\n${agentLines}`
      );
    },
  };
}
