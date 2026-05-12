import OpenAI from "openai";
import "dotenv/config";
import { allTools, executeTool } from "./tools/index.js";
import { MCPClient } from "./mcp/client.js";

/**
 * LLMClient - 与大语言模型交互的客户端
 * 支持 OpenAI 及兼容 API（如阿里云 DashScope）
 * 支持流式对话、工具调用（Function Call）和 MCP
 */
export class LLMClient {
  constructor() {
    this.client = new OpenAI({
      baseURL: process.env.OPENAI_BASE_URL,
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.model = process.env.MODEL || "gpt-4";
    this.mcpClient = new MCPClient();
    this.mcpTools = []; // 缓存 MCP 工具描述
    this.mcpInitialized = false;
  }

  /**
   * 初始化 MCP 连接
   */
  async initMCP() {
    if (this.mcpInitialized) return;

    // 连接文件系统 MCP Server
    await this.mcpClient.connectServer(
      "filesystem",
      "node",
      ["src/mcp-servers/filesystem-server.js", process.cwd()]
    );

    // 获取工具列表并缓存
    const tools = await this.mcpClient.listTools("filesystem");
    this.mcpTools = tools.map((tool) => ({
      type: "function",
      function: {
        name: `filesystem:${tool.name}`, // 格式：serverName:toolName
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));

    console.log(`✓ 已加载 ${this.mcpTools.length} 个 MCP 工具`);
    this.mcpInitialized = true;
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
        stream: true,
        temperature: 0.7,
        max_tokens: 2048,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          yield content;
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
      tools: allTools,
      tool_choice: "auto",
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
        result = { error: `工具执行失败：${error.message}` };
      }

      // ========== 将工具结果加入对话历史 ==========
      messages.push(message);
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

  /**
   * 使用 MCP 工具进行对话
   * 支持多轮工具调用：LLM 可根据上一轮结果继续调用工具，循环直到无新工具调用
   * 流程：
   * 1. 请求 LLM，带上所有 MCP 工具定义
   * 2. 若返回 tool_calls：把 assistant(含 tool_calls) 和每个 tool 消息依次追加到历史
   * 3. 重复第 1 步，直到 LLM 不再调用工具为止，返回自然语言回复
   * @param {Array} messages - 对话历史（会被追加工具调用消息）
   * @returns {Promise<string>} AI 最终回复
   */
  async chatWithMCPTools(messages) {
    if (!this.mcpInitialized) {
      await this.initMCP();
    }

    const startTime = Date.now();
    const MAX_ROUNDS = 5;

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages,
        tools: this.mcpTools,
        tool_choice: "auto",
        max_tokens: 4096,
      });

      const message = response.choices[0].message;
      const toolCalls = message.tool_calls || [];

      // 无工具调用，本次就是最终回复
      if (toolCalls.length === 0) {
        const elapsed = Date.now() - startTime;
        console.log(`✓ 请求完成，耗时：${elapsed}ms，经历 ${round + 1} 轮对话`);
        return message.content || "";
      }

      console.log(`⚙️ 第 ${round + 1} 轮：执行 ${toolCalls.length} 个 MCP 工具调用...`);

      // 先把 assistant 的 tool_calls 消息整体加入历史（只加一次）
      messages.push(message);

      // 依次执行每个工具，追加对应的 tool 消息
      for (const toolCall of toolCalls) {
        const [serverName, toolName] = toolCall.function.name.split(":");
        let args = {};
        try {
          args = JSON.parse(toolCall.function.arguments || "{}");
        } catch (error) {
          messages.push({
            role: "tool",
            content: `参数解析失败:${error.message}`,
            tool_call_id: toolCall.id,
          });
          continue;
        }

        console.log(`   → ${serverName}:${toolName}`, args);

        try {
          const result = await this.mcpClient.callTool(serverName, toolName, args);
          messages.push({
            role: "tool",
            content: result,
            tool_call_id: toolCall.id,
          });
        } catch (error) {
          messages.push({
            role: "tool",
            content: `工具调用失败:${error.message}`,
            tool_call_id: toolCall.id,
          });
        }
      }
    }

    console.warn(`⚠️ 达到最大工具调用轮数(${MAX_ROUNDS}),提前结束`);
    return "(达到最大工具调用轮数，未能生成最终回复)";
  }

  /**
   * 断开所有 MCP 连接
   */
  async disconnectMCP() {
    if (this.mcpClient) {
      await this.mcpClient.disconnectAll();
      this.mcpInitialized = false;
    }
  }
}