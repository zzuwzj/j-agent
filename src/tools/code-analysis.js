/**
 * Code Analysis 工具集(Function Call 版)
 * researcher SubAgent 用于深入分析代码:读文件 + 关键词搜索
 * 搜索实现基于 Node 原生,不依赖 ripgrep 等外部工具
 */

import fs from "fs/promises";
import path from "path";
import { readFile, listDirectory } from "./filesystem.js";

const rootPath = process.cwd();

/** 递归遍历文件,返回命中的文件与行号摘要 */
const walkFiles = async (dir, pattern, hits, maxHits = 50) => {
  if (hits.count >= maxHits) return;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const e of entries) {
    if (hits.count >= maxHits) return;
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const full = path.join(dir, e.name);

    if (e.isDirectory()) {
      await walkFiles(full, pattern, hits, maxHits);
      continue;
    }

    // 跳过二进制常见扩展
    if (/\.(png|jpg|jpeg|gif|ico|pdf|zip|lock)$/i.test(e.name)) continue;

    try {
      const content = await fs.readFile(full, "utf-8");
      const lines = content.split("\n");
      lines.forEach((line, idx) => {
        if (hits.count >= maxHits) return;
        if (pattern.test(line)) {
          const relPath = path.relative(rootPath, full);
          hits.matches.push(`${relPath}:${idx + 1}: ${line.trim().slice(0, 200)}`);
          hits.count++;
        }
      });
    } catch {
      // 跳过不可读文件
    }
  }
};

/**
 * 在项目里搜索关键词,返回 "路径:行号: 代码片段" 列表
 */
export const searchCode = async ({ query, dir = "." }) => {
  const start = path.resolve(rootPath, dir);
  if (!start.startsWith(rootPath)) {
    throw new Error(`访问拒绝:路径 ${dir} 超出工作目录范围`);
  }

  // 转义正则特殊字符
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(escaped, "i");

  const hits = { count: 0, matches: [] };
  await walkFiles(start, pattern, hits, 50);

  if (hits.count === 0) return `未找到 "${query}" 的任何命中`;
  const header = `🔍 共命中 ${hits.count} 处${hits.count >= 50 ? "(已截断为 50 条)" : ""}:\n`;
  return header + hits.matches.join("\n");
};

/**
 * 工具定义清单
 */
export const codeAnalysisTools = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "读取指定文件的全部内容,用于理解代码细节。",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "文件相对路径,例如 src/llm.js" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_directory",
      description: "列出目录下的文件与文件夹,用于定位要分析的代码位置。",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "目录相对路径" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_code",
      description: "在项目里按关键词搜索,返回文件路径 + 行号 + 代码片段。用于定位函数定义、引用、特定字符串。",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "要搜索的关键词或短字符串(会做大小写不敏感匹配)",
          },
          dir: {
            type: "string",
            description: "搜索起点目录,默认整个项目(.)",
          },
        },
        required: ["query"],
      },
    },
  },
];

export const codeAnalysisToolHandlers = {
  read_file: readFile,
  list_directory: listDirectory,
  search_code: searchCode,
};
