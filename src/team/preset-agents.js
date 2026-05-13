/**
 * 预定义 Team Agents
 * - Explorer:  搜索/探索,带文件系统工具
 * - Researcher: 深入读代码,带代码分析工具
 * - Advisor:    给建议/决策,纯推理无工具
 *
 * 工厂函数 createTeamAgents(messageBus) 每次返回一组新实例,
 * 同一 session 共享一个 messageBus,实例之间可互相通信。
 */

import { TeamAgent } from "./team-agent.js";
import { fileSystemTools, fileSystemToolHandlers } from "../tools/filesystem.js";
import { codeAnalysisTools, codeAnalysisToolHandlers } from "../tools/code-analysis.js";

/** Explorer:擅长搜索代码库结构,定位文件 */
export class ExplorerAgent extends TeamAgent {
  constructor(messageBus) {
    super(
      {
        id: "explorer",
        name: "Explorer",
        role: "代码库探索者",
        description: "搜索和探索代码库结构,擅长快速列出目录、定位关键文件、给出结构概览",
        systemPrompt: `你是代码库探索专家。当收到任务时:
1. 用 list_directory 看项目结构
2. 必要时用 read_file 取部分内容确认
3. 给出条目化的结构概览,每个文件配一句话用途说明
4. 不要深入代码细节,那是 Researcher 的活儿`,
        tools: fileSystemTools,
        handlers: fileSystemToolHandlers,
      },
      messageBus
    );
  }
}

/** Researcher:擅长深入分析代码逻辑 */
export class ResearcherAgent extends TeamAgent {
  constructor(messageBus) {
    super(
      {
        id: "researcher",
        name: "Researcher",
        role: "代码分析师",
        description: "深入阅读和理解代码逻辑,擅长读文件、搜关键词、解释函数与调用链",
        systemPrompt: `你是代码分析专家。当收到任务时:
1. 用 read_file / search_code 仔细看具体实现
2. 解释关键函数的用途、参数、返回值
3. 指出代码结构、数据流和潜在问题
4. 必要时引用具体文件路径和行号`,
        tools: codeAnalysisTools,
        handlers: codeAnalysisToolHandlers,
      },
      messageBus
    );
  }
}

/** Advisor:擅长给出技术建议和决策 */
export class AdvisorAgent extends TeamAgent {
  constructor(messageBus) {
    super(
      {
        id: "advisor",
        name: "Advisor",
        role: "技术顾问",
        description: "给出专业建议和决策支持,擅长权衡取舍、识别风险、按优先级输出方案",
        systemPrompt: `你是资深技术顾问。当收到任务时:
1. 基于已有信息(代码结构、问题清单等)做权衡分析
2. 识别风险和改进点,按优先级排序
3. 给出可执行的行动建议,包括预期收益和成本
4. 信息不足时直接说"需要 Explorer/Researcher 先做 XXX"`,
        tools: [],
        handlers: {},
      },
      messageBus
    );
  }
}

/**
 * 工厂:返回一组与同一 messageBus 绑定的 Team Agent 实例
 * @param {import('./message-bus.js').MessageBus} messageBus
 * @returns {TeamAgent[]}
 */
export function createTeamAgents(messageBus) {
  return [
    new ExplorerAgent(messageBus),
    new ResearcherAgent(messageBus),
    new AdvisorAgent(messageBus),
  ];
}

/** 不实例化,只返回元数据(给 list_agents 工具用) */
export function listTeamAgentsMeta() {
  return [
    { id: "explorer", name: "Explorer", role: "代码库探索者", description: "搜索和探索代码库结构" },
    { id: "researcher", name: "Researcher", role: "代码分析师", description: "深入阅读和理解代码逻辑" },
    { id: "advisor", name: "Advisor", role: "技术顾问", description: "给出专业建议和决策支持" },
  ];
}
