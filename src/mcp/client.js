/**
 * MCP Client - 用于连接和管理多个 MCP Server
 * 基于 @modelcontextprotocol/sdk 的高层 API 封装
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export class MCPClient {
  constructor() {
    /** 每个 Server 对应一个 Client，按名称索引 */
    this.clients = new Map();
    /** 缓存每个 Server 的工具列表，避免重复请求 */
    this.toolsCache = new Map();
  }

  /**
   * 连接 MCP Server
   * @param {string} name - Server 名称（用于标识）
   * @param {string} command - 启动命令（如：node）
   * @param {string[]} args - 启动参数
   * @returns {Promise<Client>} 已连接的 MCP Client 实例
   */
  async connectServer(name, command, args = []) {
    if (this.clients.has(name)) {
      return this.clients.get(name);
    }

    const transport = new StdioClientTransport({ command, args });

    const client = new Client(
      { name: `j-agent-${name}-client`, version: "1.0.0" },
      { capabilities: { tools: {} } }
    );

    await client.connect(transport);
    this.clients.set(name, client);
    console.log(`✓ MCP Server 已连接：${name}`);
    return client;
  }

  /**
   * 获取指定 Server 的工具列表（带缓存）
   * @param {string} serverName - Server 名称
   * @returns {Promise<Array>} 工具列表
   */
  async listTools(serverName) {
    if (this.toolsCache.has(serverName)) {
      return this.toolsCache.get(serverName);
    }

    const client = this.clients.get(serverName);
    if (!client) throw new Error(`Server ${serverName} not connected`);

    const response = await client.listTools();
    this.toolsCache.set(serverName, response.tools);
    return response.tools;
  }

  /**
   * 获取所有 Server 的工具列表（带服务器标识）
   * @returns {Promise<Array<{serverName, tool}>>}
   */
  async listAllTools() {
    const all = [];
    for (const serverName of this.clients.keys()) {
      const tools = await this.listTools(serverName);
      for (const tool of tools) {
        all.push({ serverName, tool });
      }
    }
    return all;
  }

  /**
   * 调用工具
   * @param {string} serverName - Server 名称
   * @param {string} toolName - 工具名称
   * @param {object} args - 工具参数
   * @returns {Promise<string>} 工具返回的文本内容
   */
  async callTool(serverName, toolName, args) {
    const client = this.clients.get(serverName);
    if (!client) throw new Error(`Server ${serverName} not connected`);

    const result = await client.callTool({
      name: toolName,
      arguments: args,
    });

    // MCP 返回的 content 是数组，统一展平为文本
    const textParts = (result.content || [])
      .filter((item) => item.type === "text")
      .map((item) => item.text);

    const text = textParts.join("\n");

    if (result.isError) {
      throw new Error(text || "工具执行失败");
    }

    return text;
  }

  /**
   * 断开所有 Server 连接
   */
  async disconnectAll() {
    for (const [name, client] of this.clients.entries()) {
      try {
        await client.close();
        console.log(`✓ 已断开 MCP Server：${name}`);
      } catch (error) {
        console.error(`断开 ${name} 失败：`, error.message);
      }
    }
    this.clients.clear();
    this.toolsCache.clear();
  }
}
