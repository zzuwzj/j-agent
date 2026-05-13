/**
 * MessageBus - Agent 消息总线
 * 负责 Agent 之间的松耦合通信:订阅/发布、单播/广播、消息历史
 *
 * 设计要点:
 * - subscribers 用 Map<agentId, Set<handler>> 存储,O(1) 查找
 * - 单播只发给目标 agent;广播会跳过发送者本人,避免自循环
 * - 内置消息历史用于调试和审计,默认保留最近 100 条
 * - 消息 ID 包含时间戳和随机串,便于追踪和去重
 */

/**
 * @typedef {'request' | 'response' | 'broadcast' | 'error'} MessageType
 */

/**
 * @typedef {Object} AgentMessage
 * @property {string} id           - 消息唯一 ID
 * @property {string} from         - 发送者 agent id
 * @property {string} to           - 接收者 agent id 或 'broadcast'
 * @property {MessageType} type    - 消息类型
 * @property {string} content      - 消息内容
 * @property {Date} timestamp      - 时间戳
 * @property {string} [correlationId] - 关联请求/响应的 ID
 * @property {number} [forwardCount]  - 转发次数(防止无限循环)
 */

export class MessageBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this.subscribers = new Map();
    /** @type {AgentMessage[]} */
    this.messageHistory = [];
    this.maxHistory = 100;
    // 防止广播无限循环:单条消息最多转发 3 次
    this.maxForward = 3;
  }

  /**
   * 订阅消息
   * @param {string} agentId
   * @param {Function} handler  - async (message) => void
   */
  subscribe(agentId, handler) {
    if (!this.subscribers.has(agentId)) {
      this.subscribers.set(agentId, new Set());
    }
    this.subscribers.get(agentId).add(handler);
  }

  /**
   * 取消订阅
   */
  unsubscribe(agentId, handler) {
    this.subscribers.get(agentId)?.delete(handler);
  }

  /**
   * 发布消息(底层 API)
   * @param {AgentMessage} message
   */
  async publish(message) {
    // 转发次数保护
    message.forwardCount = (message.forwardCount || 0) + 1;
    if (message.forwardCount > this.maxForward) {
      console.warn(`⚠️ 消息 ${message.id} 转发次数超限,丢弃`);
      return;
    }

    // 写入历史(滚动窗口)
    this.messageHistory.push(message);
    if (this.messageHistory.length > this.maxHistory) {
      this.messageHistory.shift();
    }

    if (message.to === "broadcast") {
      // 广播给所有订阅者(跳过自己)
      for (const [agentId, handlers] of this.subscribers.entries()) {
        if (agentId === message.from) continue;
        for (const handler of handlers) {
          await handler(message);
        }
      }
    } else {
      // 单播
      const handlers = this.subscribers.get(message.to);
      if (handlers) {
        for (const handler of handlers) {
          await handler(message);
        }
      }
    }
  }

  /**
   * 单播便捷方法
   * @param {string} from
   * @param {string} to
   * @param {string} content
   * @param {MessageType} [type='request']
   * @returns {Promise<AgentMessage>}
   */
  async send(from, to, content, type = "request") {
    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      from,
      to,
      type,
      content,
      timestamp: new Date(),
    };
    await this.publish(message);
    return message;
  }

  /**
   * 广播便捷方法
   */
  async broadcast(from, content) {
    return this.send(from, "broadcast", content, "broadcast");
  }

  /**
   * 获取历史消息(可按 agent 过滤)
   * @param {string} [agentId]
   * @param {number} [limit=20]
   * @returns {AgentMessage[]}
   */
  getHistory(agentId, limit = 20) {
    let messages = this.messageHistory;
    if (agentId) {
      messages = messages.filter(
        (m) => m.from === agentId || m.to === agentId
      );
    }
    return messages.slice(-limit);
  }

  /** 清空消息历史 */
  clearHistory() {
    this.messageHistory = [];
  }

  /** 统计 */
  getStats() {
    return {
      subscriberCount: this.subscribers.size,
      historySize: this.messageHistory.length,
      maxHistory: this.maxHistory,
    };
  }
}
