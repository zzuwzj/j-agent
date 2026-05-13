/**
 * TeamAgent - 团队 Agent 基类
 *
 * 与 SubAgent 的不同:SubAgent 走主从委托链,TeamAgent 通过共享消息总线
 * 进行去中心化协作,任何 Agent 都可以主动给其他 Agent 发消息或广播。
 *
 * 子类需要重写 processRequest(content) 提供专业能力,默认实现是走 LLM 普通对话。
 */

import { LLMClient } from "../llm.js";
import { ConversationManager } from "../conversation.js";

/**
 * @typedef {Object} TeamAgentConfig
 * @property {string} id            - Agent 唯一标识
 * @property {string} name          - 展示名称
 * @property {string} role          - 角色简述
 * @property {string} description   - 详细说明
 * @property {string} systemPrompt  - 系统提示词
 * @property {Array}  [tools]       - 可选 Function Call 工具定义
 * @property {Object} [handlers]    - 可选 工具名 → 处理函数
 */

export class TeamAgent {
  /**
   * @param {TeamAgentConfig} config
   * @param {import('./message-bus.js').MessageBus} messageBus
   */
  constructor(config, messageBus) {
    this.id = config.id;
    this.name = config.name;
    this.role = config.role;
    this.description = config.description;
    this.systemPrompt = config.systemPrompt;
    this.tools = Array.isArray(config.tools) ? [...config.tools] : [];
    this.handlers = { ...(config.handlers || {}) };

    this.messageBus = messageBus;
    this.llmClient = new LLMClient();
    this.conversation = new ConversationManager(this.buildSystemPrompt());
  }

  /** 拼接角色信息到系统提示 */
  buildSystemPrompt() {
    return `${this.systemPrompt}

## 你的角色
- 名字:${this.name}
- 角色:${this.role}
- 描述:${this.description}

## 团队协作
你是团队的一员,可以通过消息总线与其他 Agent 交流。
当你需要别的 Agent 协助时,可以发请求消息给他们;收到请求时给出你专业范围内的回答。
`;
  }

  /** 注册一个工具 */
  registerTool(tool, handler) {
    this.tools.push(tool);
    this.handlers[tool.function.name] = handler;
  }

  /**
   * 订阅自己的消息流。Manager 会调用这个方法把消息分发到 handleMessage。
   */
  onMessage(handler) {
    this.messageBus.subscribe(this.id, handler);
  }

  /** 发消息给特定 Agent */
  async sendTo(agentId, content, type = "request") {
    return this.messageBus.send(this.id, agentId, content, type);
  }

  /** 广播给所有 Agent */
  async broadcast(content) {
    return this.messageBus.broadcast(this.id, content);
  }

  /**
   * 处理收到的消息(默认行为:request 走 processRequest 然后回复 response)
   * 子类可以重写以扩展行为(比如响应广播、合作链路等)
   * @param {import('./message-bus.js').AgentMessage} message
   */
  async handleMessage(message) {
    // 自己发的消息别再处理一遍(订阅时如果不过滤会回环)
    if (message.from === this.id) return;

    if (message.type === "request" || message.type === "broadcast") {
      try {
        const reply = await this.processRequest(message.content);
        // 广播来源也回单播,让协调者能在 history 里取到结果
        await this.messageBus.send(this.id, message.from, reply, "response");
      } catch (error) {
        await this.messageBus.send(
          this.id,
          message.from,
          `❌ ${this.name} 处理失败:${error.message}`,
          "error"
        );
      }
    }
  }

  /**
   * 处理具体请求(子类重写或基于 LLM 的默认实现)
   * @param {string} content
   * @returns {Promise<string>}
   */
  async processRequest(content) {
    this.conversation.addMessage("user", content);

    let reply;
    if (this.tools.length > 0) {
      reply = await this.llmClient.chatWithCustomTools(
        this.conversation.getFormattedHistory(),
        this.tools,
        this.handlers,
        { maxRounds: 4 }
      );
    } else {
      reply = await this.llmClient.chatCompletion(
        this.conversation.getFormattedHistory()
      );
    }

    this.conversation.addMessage("assistant", reply);
    return reply;
  }

  /** 直接执行任务(不走消息总线,Manager 在 callAgent 时用) */
  async run(task) {
    return this.processRequest(task);
  }

  /** 重置对话历史 */
  reset() {
    this.conversation.clear();
  }

  /** 统计 */
  getStats() {
    return {
      id: this.id,
      name: this.name,
      messageCount: this.conversation.getMessageCount(),
      toolCount: this.tools.length,
    };
  }
}
