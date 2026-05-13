/**
 * AgentTeam - Agent 团队管理器
 * - 创建并初始化所有 Team Agent
 * - 把 Agent 接入消息总线
 * - 提供 coordinate / callAgent 两种调用方式
 *
 * 设计要点:
 * - coordinate 利用 broadcast 同步等待所有订阅者处理完(publish 内部 await),
 *   不需要 setTimeout,响应顺序天然由消息总线保证
 * - callAgent 走 agent.run(),不经过消息总线,适合用户直接点名某个 Agent
 */

import chalk from "chalk";
import { MessageBus } from "./message-bus.js";
import { createTeamAgents, listTeamAgentsMeta } from "./preset-agents.js";

const COORDINATOR_ID = "coordinator";

export class AgentTeam {
  constructor() {
    this.messageBus = new MessageBus();
    /** @type {Map<string, import('./team-agent.js').TeamAgent>} */
    this.agents = new Map();
    this.initialized = false;
    /** @type {boolean} 是否在 console 上打印消息流 */
    this.verbose = false;
  }

  /** 初始化:创建预设 Agent,接入消息总线 */
  async initialize() {
    if (this.initialized) return;

    const agents = createTeamAgents(this.messageBus);
    for (const agent of agents) {
      this.agents.set(agent.id, agent);
      // 让 Agent 处理收给自己的消息,以及来自 coordinator 的广播
      agent.onMessage(async (message) => {
        if (message.to === agent.id || message.to === "broadcast") {
          if (this.verbose) {
            console.log(
              chalk.gray(
                `📨 [${message.from} → ${message.to}] ${message.content.slice(0, 60)}...`
              )
            );
          }
          await agent.handleMessage(message);
        }
      });
    }

    this.initialized = true;
    console.log(
      `🤖 Agent Team 已启动:${agents.map((a) => a.name).join(", ")}`
    );
  }

  /** 获取所有 Agent */
  getAgents() {
    return Array.from(this.agents.values());
  }

  /** 按 id 取 Agent */
  getAgent(agentId) {
    return this.agents.get(agentId);
  }

  /**
   * 协调团队完成一个复杂任务:广播任务,等所有 Agent 响应,然后汇总
   * @param {string} task
   * @returns {Promise<string>} 汇总文本
   */
  async coordinate(task) {
    if (!this.initialized) await this.initialize();

    // 标记一下,只采集本次广播之后的 response
    const startIndex = this.messageBus.messageHistory.length;

    // 广播任务(messageBus.publish 内部 await 所有 handler,等价于"所有响应都到位")
    await this.messageBus.broadcast(
      COORDINATOR_ID,
      `新任务:${task}\n请你以专业能力对这个任务给出输出。`
    );

    // 收集本次广播之后的所有响应
    const newMessages = this.messageBus.messageHistory.slice(startIndex);
    const responses = newMessages.filter(
      (m) => m.type === "response" && m.to === COORDINATOR_ID
    );

    if (responses.length === 0) {
      return `【任务】${task}\n\n(没有 Agent 响应,请检查初始化)`;
    }

    let summary = `【任务】${task}\n\n【团队协作结果】\n\n`;
    for (const resp of responses) {
      const agent = this.agents.get(resp.from);
      const name = agent ? agent.name : resp.from;
      summary += `📌 ${name}:\n${resp.content}\n\n`;
    }
    return summary.trimEnd();
  }

  /**
   * 直接调用某个 Agent(不经消息总线)
   * @param {string} agentId
   * @param {string} task
   * @returns {Promise<string>}
   */
  async callAgent(agentId, task) {
    if (!this.initialized) await this.initialize();
    const agent = this.agents.get(agentId);
    if (!agent) {
      return `❌ Agent "${agentId}" 不存在,可选:${Array.from(this.agents.keys()).join(", ")}`;
    }
    return agent.run(task);
  }

  /** 重置:清空所有 Agent 对话历史和消息总线历史 */
  reset() {
    for (const agent of this.agents.values()) agent.reset();
    this.messageBus.clearHistory();
  }

  /** 设置消息打印开关 */
  setVerbose(v) {
    this.verbose = !!v;
  }

  /** 团队统计 */
  getStats() {
    return {
      agentCount: this.agents.size,
      agents: this.getAgents().map((a) => ({
        id: a.id,
        name: a.name,
        role: a.role,
        ...a.getStats(),
      })),
      messageBus: this.messageBus.getStats(),
    };
  }

  /** 静态:返回元数据(不实例化) */
  static listMeta() {
    return listTeamAgentsMeta();
  }
}
