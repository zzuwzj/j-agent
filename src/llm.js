import OpenAI from "openai";
import "dotenv/config"; // 自动加载 .env 文件中的环境变量

/**
 * LLMClient - 与大语言模型交互的客户端
 * 支持 OpenAI 及兼容 API（如阿里云 DashScope）
 */
export class LLMClient {
  constructor() {
    this.client = new OpenAI({
      baseURL: process.env.OPENAI_BASE_URL,
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.model = process.env.MODEL || "gpt-4";
  }

  /**
   * 流式对话完成 - 使用 async generator 实现打字机效果
   * 逐个 token 返回，用户无需等待完整回复
   * @param {Array} messages - 对话历史
   * @yields {string} 逐个返回生成的 token
   */
  async *streamChatCompletion(messages) {
    try {
      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages,
        stream: true,        // 启用流式输出
        temperature: 0.7,    // 控制创造性（0-1，越高越随机）
        max_tokens: 2048,    // 单次回复最大 token 数
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          yield content; // 逐个 token 输出
        }
      }
    } catch (error) {
      console.error("LLM 请求失败:", error.message);
      throw error;
    }
  }

  /**
   * 普通对话完成（非流式）- 等待完整回复后一次返回
   * 适合后续工具调用等需要完整响应的场景
   * @param {Array} messages - 对话历史
   * @returns {Promise<string>} AI 完整回复
   */
  async chatCompletion(messages) {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      temperature: 0.7,
      max_tokens: 2048,
    });

    return response.choices[0]?.message?.content || "";
  }
}