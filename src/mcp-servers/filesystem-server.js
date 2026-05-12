/**
 * FileSystem MCP Server
 * 提供文件读取和目录列表功能
 * 安全限制：只能访问 rootPath 目录下的文件
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import z from "zod";
import fs from "fs/promises";
import path from "path";

class FileSystemServer {
  constructor(rootPath = process.cwd()) {
    this.rootPath = path.resolve(rootPath);
    this.mcpServer = new McpServer({
      name: "filesystem-server",
      version: "1.0.0",
    });

    this.registerTools();
  }

  registerTools() {
    // 注册读取文件工具
    this.mcpServer.registerTool(
      "read_file",
      {
        description: "读取指定文件的全部内容。当用户需要查看文件内容、读取代码、查看配置时使用。",
        inputSchema: {
          path: z.string().describe("文件路径（相对于工作目录）"),
        },
      },
      async ({ path: filePath }) => {
        try {
          const fullPath = path.resolve(this.rootPath, filePath);
          if (!fullPath.startsWith(this.rootPath)) {
            return {
              content: [
                {
                  type: "text",
                  text: `错误：访问拒绝，路径超出工作目录范围`,
                },
              ],
              isError: true,
            };
          }

          const content = await fs.readFile(fullPath, "utf-8");
          return {
            content: [
              {
                type: "text",
                text: content,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `错误：${error.message}`,
              },
            ],
            isError: true,
          };
        }
      }
    );

    // 注册列出目录工具
    this.mcpServer.registerTool(
      "list_directory",
      {
        description: "列出目录下的所有文件和文件夹。当用户需要查看目录结构、查找文件时使用。",
        inputSchema: {
          path: z.string().describe("目录路径（相对于工作目录）"),
        },
      },
      async ({ path: dirPath }) => {
        try {
          const fullPath = path.resolve(this.rootPath, dirPath);
          if (!fullPath.startsWith(this.rootPath)) {
            return {
              content: [
                {
                  type: "text",
                  text: `错误：访问拒绝，路径超出工作目录范围`,
                },
              ],
              isError: true,
            };
          }

          const entries = await fs.readdir(fullPath, { withFileTypes: true });
          const result = entries
            .map((entry) => `${entry.isDirectory() ? "[DIR]" : "[FILE]"} ${entry.name}`)
            .join("\n");

          return {
            content: [
              {
                type: "text",
                text: result || "(空目录)",
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `错误：${error.message}`,
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.mcpServer.connect(transport);
    console.error("[MCP Server] FileSystem 已启动，工作目录:", this.rootPath);
  }
}

// 启动服务器
const rootPath = process.argv[2] || process.cwd();
const server = new FileSystemServer(rootPath);
server.start();