/**
 * 预定义的 3 个 SubAgent
 * - explorer:  快速了解项目结构
 * - researcher: 深入分析代码
 * - planner:    产出实施计划(无工具,纯推理)
 *
 * 工厂函数 createXxxAgent() 每次返回新实例,避免跨 session 共享对话历史
 */

import { SubAgent } from "./sub-agent.js";
import { fileSystemTools, fileSystemToolHandlers } from "../tools/filesystem.js";
import { codeAnalysisTools, codeAnalysisToolHandlers } from "../tools/code-analysis.js";

/** Explorer:搜索代码库结构 */
export const createExplorerAgent = () =>
  new SubAgent({
    name: "explorer",
    description: "搜索和探索代码库结构。擅长快速列出目录、定位相关文件、给出结构概览",
    systemPrompt: `你是代码库探索专家。职责:
1. 列出项目目录结构(使用 list_directory)
2. 定位与任务相关的关键文件
3. 给出结构概览,不要深入代码细节

回答要简洁,用条目化结构列出文件清单,每个文件配一句话用途说明。`,
    tools: fileSystemTools,
    handlers: fileSystemToolHandlers,
    maxRounds: 6,
  });

/** Researcher:深入阅读代码 */
export const createResearcherAgent = () =>
  new SubAgent({
    name: "researcher",
    description: "深入阅读和理解代码逻辑。擅长读文件、搜关键词、解释函数与调用链",
    systemPrompt: `你是代码分析专家。职责:
1. 仔细阅读指定文件(read_file)
2. 通过关键词搜索定位相关代码(search_code)
3. 解释关键函数的用途、参数、返回值
4. 指出代码的结构、数据流与潜在问题

回答要有深度,必要时引用具体代码行号。`,
    tools: codeAnalysisTools,
    handlers: codeAnalysisToolHandlers,
    maxRounds: 8,
  });

/** Planner:无工具,纯推理产出方案 */
export const createPlannerAgent = () =>
  new SubAgent({
    name: "planner",
    description: "根据已有信息制定实施计划。擅长分析问题、识别改进点、给出可执行的行动步骤",
    systemPrompt: `你是技术规划专家。职责:
1. 基于给定的分析结果(代码结构、问题清单等)制定方案
2. 识别问题和改进点,按优先级排序
3. 产出清晰、可执行的实施计划,包含预期结果和验收标准
4. 如果信息不足,明确指出还需要什么额外信息

不要凭空想象代码,只基于用户给你的上下文推理。`,
    tools: [], // 纯推理,无需工具
    handlers: {},
    maxRounds: 1,
  });

/**
 * SubAgent 注册表
 * 单次 SubAgent 模式 session 使用同一组实例,对话历史可以在多次 delegate 间累积
 */
export const createSubAgentRegistry = () => ({
  explorer: createExplorerAgent(),
  researcher: createResearcherAgent(),
  planner: createPlannerAgent(),
});

/** 返回可用 SubAgent 的 name + description 列表(不实例化) */
export const listSubAgentsMeta = () => [
  { name: "explorer", description: "搜索和探索代码库结构" },
  { name: "researcher", description: "深入阅读和理解代码逻辑" },
  { name: "planner", description: "分析信息并产出实施计划" },
];
