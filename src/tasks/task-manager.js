/**
 * TaskManager - 任务管理器
 * 负责任务的创建、更新、查询和状态管理
 */

/**
 * 任务状态枚举
 * @typedef {'pending' | 'in_progress' | 'completed' | 'failed'} TaskStatus
 */

/**
 * 任务对象
 * @typedef {Object} Task
 * @property {string} id - 任务唯一 ID
 * @property {string} title - 任务标题
 * @property {string} [description] - 任务描述
 * @property {TaskStatus} status - 任务状态
 * @property {Date} createdAt - 创建时间
 * @property {Date} updatedAt - 更新时间
 * @property {string} [result] - 任务执行结果
 * @property {string} [error] - 任务失败原因
 */

export class TaskManager {
  constructor() {
    /** @private @type {Map<string, Task>} */
    this.tasks = new Map();
  }

  /**
   * 创建单个任务
   * @param {string} title - 任务标题
   * @param {string} [description] - 任务描述
   * @returns {Task} 创建的任务对象
   */
  createTask(title, description = '') {
    const task = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      description,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.tasks.set(task.id, task);
    return task;
  }

  /**
   * 批量创建任务
   * @param {string[]} titles - 任务标题列表
   * @returns {Task[]} 创建的任务数组
   */
  createTasksFromList(titles) {
    return titles.map(title => this.createTask(title));
  }

  /**
   * 更新任务状态
   * @param {string} taskId - 任务 ID
   * @param {TaskStatus} status - 新状态
   * @param {string} [result] - 执行结果
   * @param {string} [error] - 错误信息
   * @returns {Task|null} 更新后的任务，不存在则返回 null
   */
  updateTaskStatus(taskId, status, result = '', error = '') {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    task.status = status;
    task.updatedAt = new Date();

    if (result) task.result = result;
    if (error) task.error = error;

    return task;
  }

  /**
   * 获取所有任务
   * @returns {Task[]} 所有任务数组
   */
  getAllTasks() {
    return Array.from(this.tasks.values());
  }

  /**
   * 获取指定状态的任务
   * @param {TaskStatus} status - 任务状态
   * @returns {Task[]} 符合条件的任务数组
   */
  getTasksByStatus(status) {
    return this.getAllTasks().filter(task => task.status === status);
  }

  /**
   * 获取任务统计信息
   * @returns {Object} 统计数据
   */
  getStats() {
    const tasks = this.getAllTasks();
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
    };
  }

  /**
   * 格式化任务列表（供 AI 使用）
   * @returns {string} 格式化的任务列表
   */
  formatTaskList() {
    const tasks = this.getAllTasks();
    if (tasks.length === 0) return '暂无任务';

    const statusIcon = {
      pending: '⏳',
      in_progress: '🔄',
      completed: '✅',
      failed: '❌',
    };

    return tasks.map(task => {
      const icon = statusIcon[task.status] || '❓';
      return `${icon} [${task.status}] ${task.title} (id: ${task.id})`;
    }).join('\n');
  }

  /**
   * 获取单个任务
   * @param {string} taskId - 任务 ID
   * @returns {Task|undefined} 任务对象
   */
  getTask(taskId) {
    return this.tasks.get(taskId);
  }

  /**
   * 删除任务
   * @param {string} taskId - 任务 ID
   * @returns {boolean} 是否删除成功
   */
  deleteTask(taskId) {
    return this.tasks.delete(taskId);
  }

  /**
   * 清空所有任务
   */
  clearAllTasks() {
    this.tasks.clear();
  }

  /**
   * 保存任务到文件（持久化）
   * @param {string} filePath - 文件路径
   */
  async saveToFile(filePath) {
    const fs = await import('fs/promises');
    const data = JSON.stringify(
      Array.from(this.tasks.entries()),
      null,
      2
    );
    await fs.writeFile(filePath, data, 'utf-8');
  }

  /**
   * 从文件加载任务
   * @param {string} filePath - 文件路径
   */
  async loadFromFile(filePath) {
    const fs = await import('fs/promises');
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const entries = JSON.parse(data);
      this.tasks = new Map(entries);
      // 恢复 Date 对象
      for (const [, task] of this.tasks) {
        task.createdAt = new Date(task.createdAt);
        task.updatedAt = new Date(task.updatedAt);
      }
    } catch (error) {
      console.error('加载任务失败:', error.message);
    }
  }
}