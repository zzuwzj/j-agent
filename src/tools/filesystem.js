/**
 * FileSystem 工具集（Function Call 版）
 * 提供 read_file / list_directory,供 SubAgent 直接使用,不依赖 MCP
 * 安全限制:路径校验严格限制在 rootPath 之内
 */

import fs from "fs/promises";
import path from "path";

const rootPath = process.cwd();

/**
 * 解析并校验路径,防止越界
 * @param {string} inputPath - 相对于 rootPath 的路径
 * @returns {string} 安全的绝对路径
 */
const resolveSafe = (inputPath) => {
  const full = path.resolve(rootPath, inputPath || ".");
  if (!full.startsWith(rootPath)) {
    throw new Error(`访问拒绝:路径 ${inputPath} 超出工作目录范围`);
  }
  return full;
};

/** 读取文件内容 */
export const readFile = async ({ path: filePath }) => {
  const full = resolveSafe(filePath);
  const content = await fs.readFile(full, "utf-8");
  return content;
};

/** 列出目录,返回每项前缀 [DIR]/[FILE] */
export const listDirectory = async ({ path: dirPath }) => {
  const full = resolveSafe(dirPath);
  const entries = await fs.readdir(full, { withFileTypes: true });
  if (entries.length === 0) return "(空目录)";
  return entries
    .filter((e) => !e.name.startsWith(".") && e.name !== "node_modules")
    .map((e) => `${e.isDirectory() ? "[DIR]" : "[FILE]"} ${e.name}`)
    .join("\n");
};

/**
 * 工具定义清单(OpenAI Function Call 格式)
 */
export const fileSystemTools = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "读取指定文件的全部内容。用于查看代码、配置、文档等文本文件。",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "文件的相对路径,例如 src/llm.js",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_directory",
      description: "列出指定目录下的文件和文件夹,用于了解项目结构。会自动过滤隐藏目录和 node_modules。",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "目录的相对路径,例如 src 或 . (当前目录)",
          },
        },
        required: ["path"],
      },
    },
  },
];

/**
 * 工具处理函数
 */
export const fileSystemToolHandlers = {
  read_file: readFile,
  list_directory: listDirectory,
};
