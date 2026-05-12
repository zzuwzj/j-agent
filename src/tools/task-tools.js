/**
 * 任务管理工具集
 * 提供任务创建、查询、状态更新等功能
 */

import { TaskManager } from '../tasks/task-manager.js';

// 创建任务管理器实例（单例）
const taskManager = new TaskManager();

/**
 * 任务管理工具定义
 */
export const taskTools = [
  {
    type: "function",
    function: {
      name: "create_tasks",
      description: "创建任务列表，将复杂任务分解为可执行的小任务。当用户提出复杂需求时，使用此工具将大任务拆分为多个小任务。",
      parameters: {
        type: "object",
        properties: {
          tasks: {
            type: "array",
            items: { type: "string" },
            description: "任务标题列表，每个元素是一个独立任务，按执行顺序排列",
          },
        },
        required: ["tasks"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_task_status",
      description: "获取当前所有任务的状态和进度统计。当用户询问进度、还有多少任务时使用。",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "start_task",
      description: "开始执行一个任务，将状态从 pending 改为 in_progress。每次只处理一个任务时调用。",
      parameters: {
        type: "object",
        properties: {
          taskId: {
            type: "string",
            description: "任务 ID",
          },
        },
        required: ["taskId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_task",
      description: "完成任务，将状态从 in_progress 改为 completed，并记录执行结果。",
      parameters: {
        type: "object",
        properties: {
          taskId: {
            type: "string",
            description: "任务 ID",
          },
          result: {
            type: "string",
            description: "任务执行结果或产出物描述",
          },
        },
        required: ["taskId", "result"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fail_task",
      description: "标记任务失败，记录失败原因。当任务执行遇到无法解决的问题时调用。",
      parameters: {
        type: "object",
        properties: {
          taskId: {
            type: "string",
            description: "任务 ID",
          },
          error: {
            type: "string",
            description: "失败原因详细描述",
          },
        },
        required: ["taskId", "error"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_task",
      description: "删除指定任务。当任务不再需要时使用。",
      parameters: {
        type: "object",
        properties: {
          taskId: {
            type: "string",
            description: "任务 ID",
          },
        },
        required: ["taskId"],
      },
    },
  },
];

/**
 * 工具执行处理函数映射
 */
export const taskToolHandlers = {
  create_tasks: ({ tasks }) => {
    const createdTasks = taskManager.createTasksFromList(tasks);
    return `✅ 已创建 ${createdTasks.length} 个任务：\n\n${taskManager.formatTaskList()}`;
  },

  get_task_status: () => {
    const stats = taskManager.getStats();
    const list = taskManager.formatTaskList();
    return `📊 任务统计：${stats.completed}/${stats.total} 完成\n\n${list}`;
  },

  start_task: ({ taskId }) => {
    const task = taskManager.updateTaskStatus(taskId, 'in_progress');
    if (!task) return `❌ 任务 ${taskId} 不存在`;
    return `🔄 任务已开始：[${task.status}] ${task.title}`;
  },

  complete_task: ({ taskId, result }) => {
    const task = taskManager.updateTaskStatus(taskId, 'completed', result);
    if (!task) return `❌ 任务 ${taskId} 不存在`;
    return `✅ 任务已完成：[${task.status}] ${task.title}\n📝 结果：${result}`;
  },

  fail_task: ({ taskId, error }) => {
    const task = taskManager.updateTaskStatus(taskId, 'failed', '', error);
    if (!task) return `❌ 任务 ${taskId} 不存在`;
    return `❌ 任务已标记为失败：[${task.status}] ${task.title}\n原因：${error}`;
  },

  delete_task: ({ taskId }) => {
    const success = taskManager.deleteTask(taskId);
    return success ? `🗑️ 任务已删除：${taskId}` : `❌ 任务 ${taskId} 不存在`;
  },
};

/**
 * 导出任务管理器实例（供其他模块使用）
 */
export { taskManager };