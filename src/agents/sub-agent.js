/**
 * SubAgent - 子代理基类
 * 每个 SubAgent 有独立的系统提示、工具集和对话历史
 * 与主 Agent 解耦,可被组合调用
 */

import { LLMClient } from "../llm.js";
import { ConversationManager } from "../conversation.js";

/**
 * @typedef {Object} SubAgentConfig
 * @property {string} name - Agent 名称
 * @property {string} description - 一句话描述,用于 delegate_task 列表
 * @property {string} systemPrompt - 专属系统提示
 * @property {Array}  [tools] - OpenAI Function Call 工具定义
 * @property {Object} [handlers] - 工具名 → 处理函数
 * @property {number} [maxRounds=8] - 单次执行允许的工具调用轮次上限
 */

export class SubAgent {
  /**
   * @param {SubAgentConfig} config
   */
  constructor(config) {
    this.name = config.name;
    this.description = config.description;
    this.systemPrompt = config.systemPrompt;
    this.tools = Array.isArray(config.tools) ? [...config.tools] : [];
    this.handlers = { ...(config.handlers || {}) };
    this.maxRounds = config.maxRounds ?? 8;

    this.llmClient = new LLMClient();
    // 每个 SubAgent 拥有完全独立的对话历史,互不干扰
    this.conversation = new ConversationManager(this.systemPrompt);
  }

  /**
   * 动态注册一个工具
   * @param {Object} tool - Function Call 工具定义
   * @param {Function} handler - 对应处理函数
   */
  registerTool(tool, handler) {
    this.tools.push(tool);
    this.handlers[tool.function.name] = handler;
  }

  /**
   * 执行一次任务
   * @param {string} task - 任务描述
   * @param {Object} [options]
   * @returns {Promise<string>} 执行结果
   */
  async run(task, options = {}) {
    this.conversation.addMessage("user", task);

    try {
      let reply;
      if (this.tools.length > 0) {
        reply = await this.llmClient.chatWithCustomTools(
          this.conversation.getFormattedHistory(),
          this.tools,
          this.handlers,
          { maxRounds: this.maxRounds }
        );
      } else {
        reply = await this.llmClient.chatCompletion(
          this.conversation.getFormattedHistory()
        );
      }
      this.conversation.addMessage("assistant", reply);
      return reply;
    } catch (error) {
      const msg = `SubAgent ${this.name} 执行失败:${error.message}`;
      console.error(msg);
      return msg;
    }
  }

  /** 清空对话历史,仅保留 system 提示 */
  reset() {
    this.conversation.clear();
  }

  /** 返回对话消息数(不含 system) */
  getStats() {
    return {
      name: this.name,
      messageCount: this.conversation.getMessageCount(),
      toolCount: this.tools.length,
    };
  }
}
