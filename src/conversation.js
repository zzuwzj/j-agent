/**
 * ConversationManager - 管理多轮对话历史
 * 负责维护对话上下文，确保 AI 能理解之前的交流内容
 */
export class ConversationManager {
  constructor(systemPrompt = "你是一个有帮助的 AI 助手") {
    // 初始化消息列表，system 消息定义 AI 的行为角色
    this.messages = [
      { role: "system", content: systemPrompt }
    ];
    // 最多保留 50 条消息，防止 token 超限
    this.maxHistoryLength = 50;
  }

  /**
   * 添加消息到对话历史
   * @param {string} role - 角色：user（用户）、assistant（AI）、system（系统）
   * @param {string} content - 消息内容
   */
  addMessage(role, content) {
    this.messages.push({ role, content });

    // 消息过多时从索引 1 开始删除，保留 system 提示
    while (this.messages.length > this.maxHistoryLength) {
      this.messages.splice(1, 1);
    }
  }

  /**
   * 获取格式化的对话历史，用于发送给 LLM
   * 返回浅拷贝，避免外部修改影响内部状态
   */
  getFormattedHistory() {
    return this.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }

  /** 清空对话历史，仅保留系统提示 */
  clear() {
    this.messages = this.messages.slice(0, 1);
  }

  /** 获取消息数量（不包含 system 消息） */
  getMessageCount() {
    return this.messages.length - 1;
  }
}