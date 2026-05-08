import { tools as weatherTools, getCurrentWeather } from "./weather.js";

/**
 * 合并所有工具定义
 * 新增工具时在此处添加对应的 tools 数组
 */
export const allTools = [
  ...weatherTools,
];

/**
 * 工具执行分发器
 * 根据函数名路由到对应的工具实现
 * @param {string} functionName - 工具名称
 * @param {Object} args - 工具参数
 * @returns {Promise<any>} 工具执行结果
 */
export const executeTool = async (functionName, args) => {
  switch (functionName) {
    case "getCurrentWeather":
      return await getCurrentWeather(args.location);
    default:
      throw new Error(`未知工具：${functionName}`);
  }
};