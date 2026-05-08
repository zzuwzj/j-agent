import OpenAI from "openai";
import "dotenv/config"; // 自动加载 .env 文件中的环境变量
import { allTools, executeTool } from "./tools/index.js";

/**
 * LLMClient - 与大语言模型交互的客户端
 * 支持 OpenAI 及兼容 API（如阿里云 DashScope）
 * 支持流式对话和工具调用（Function Call）
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
   * 流式对话完成（纯聊天，不调用工具）
   * 逐个 token 返回，实现打字机效果
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

  /**
   * 对话 + 工具调用（Function Call）
   * AI 自动判断是否需要调用工具，完整流程：
   * 1. 第一次请求：AI 判断是否调用工具
   * 2. 执行工具：调用实际函数获取结果
   * 3. 第二次请求：AI 根据工具结果生成自然语言回复
   * @param {Array} messages - 对话历史（会被修改，加入工具调用记录）
   * @returns {Promise<string>} AI 最终回复
   */
  async chatWithTools(messages) {
    // ========== 第一次请求：判断是否调用工具 ==========
    const initialResponse = await this.client.chat.completions.create({
      model: this.model,
      messages,
      tools: allTools,       // 传入工具定义
      tool_choice: "auto",   // AI 自动决定是否调用
    });

    const message = initialResponse.choices[0].message;
    const willInvokeTool = initialResponse.choices[0].finish_reason === "tool_calls";

    if (willInvokeTool && message.tool_calls) {
      // ========== 执行工具调用 ==========
      const toolCall = message.tool_calls[0];
      const functionName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments);

      console.log(`🔧 调用工具：${functionName}`, args);

      // 根据函数名执行对应的工具
      let result;
      try {
        result = await executeTool(functionName, args);
      } catch (error) {
        // 工具执行失败也要将错误信息返回给 AI
        result = { error: `工具执行失败：${error.message}` };
      }

      // ========== 将工具结果加入对话历史 ==========
      messages.push(message); // AI 的工具调用请求
      messages.push({
        role: "tool",
        content: JSON.stringify(result, null, 2),
        tool_call_id: toolCall.id,
      });

      // ========== 第二次请求：生成最终回复 ==========
      const finalResponse = await this.client.chat.completions.create({
        model: this.model,
        messages,
      });

      return finalResponse.choices[0]?.message?.content || "";
    }

    // 没有工具调用，直接返回 AI 回复
    return message.content || "";
  }
}