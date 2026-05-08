/**
 * 天气查询工具
 * 提供获取城市当前天气的能力
 * TODO: 实际项目中替换为真实天气 API（如和风天气、OpenWeather）
 */

/**
 * 获取指定城市的当前天气信息
 * @param {string} location - 城市名称
 * @returns {Promise<Object>} 天气信息
 */
export const getCurrentWeather = async (location) => {
  // 演示用模拟数据，实际项目应调用真实天气 API
  return {
    location,
    temperature: "22℃",
    condition: "晴天",
    humidity: "45%",
    windSpeed: "3 级",
    updatedAt: new Date().toISOString(),
  };
};

/**
 * 工具定义清单
 * 传递给 LLM，让它知道可以调用哪些工具
 * description 越详细，AI 判断何时调用越准确
 */
export const tools = [
  {
    type: "function",
    function: {
      name: "getCurrentWeather",
      description: "获取指定城市的当前天气信息。当用户询问天气、温度、气候、下雨、升温等天气相关问题时使用此工具。",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "城市名称，例如：北京、上海、广州市",
          },
        },
        required: ["location"],
      },
    },
  },
];