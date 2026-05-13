/**
 * MemoryManager - 持久化记忆管理器
 *
 * 在 memory/ 目录下分类存储:
 * - user_profiles/{userId}.json     用户画像与偏好
 * - project_contexts/{projectId}.json  项目背景与历史决策
 * - conversation_history/{sessionId}.json  对话历史
 * - learned_knowledge/knowledge.json  AI 学到的零散知识
 *
 * 设计要点:
 * - 所有写入都走 atomic 写法(先写到 .tmp 再 rename),避免半截文件
 * - 时间戳统一用 ISO 字符串,跨进程读出来仍是字符串,加载侧不要假设是 Date
 * - 文件名用 sanitizeId() 清洗,防止用户输入 ../ 之类越权
 */

import fs from "fs/promises";
import path from "path";

const SUBDIRS = ["user_profiles", "project_contexts", "conversation_history", "learned_knowledge"];

const DEFAULT_USER_ID = "default";

// 仅允许 [a-zA-Z0-9._-],其他一律替换成 _,并把连续点号(..)折成单点,防止路径注入和文件名歧义
const sanitizeId = (id) => {
  const cleaned = String(id || "").replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.{2,}/g, ".");
  return cleaned.replace(/^\.+/, "") || "default";
};

const nowIso = () => new Date().toISOString();

const writeJsonAtomic = async (filePath, data) => {
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
  await fs.rename(tmp, filePath);
};

const readJsonOrNull = async (filePath) => {
  try {
    const text = await fs.readFile(filePath, "utf-8");
    return JSON.parse(text);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    if (error instanceof SyntaxError) {
      console.warn(`⚠️  记忆文件损坏,已忽略:${filePath}`);
      return null;
    }
    throw error;
  }
};

export class MemoryManager {
  constructor(memoryDir = path.resolve(process.cwd(), "memory")) {
    this.memoryDir = memoryDir;
    this.currentUserId = DEFAULT_USER_ID;
    this.currentProjectId = null;
    this.currentSessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /** 创建必要的子目录结构 */
  async initialize() {
    await fs.mkdir(this.memoryDir, { recursive: true });
    await Promise.all(
      SUBDIRS.map((d) => fs.mkdir(path.join(this.memoryDir, d), { recursive: true }))
    );
  }

  // ---------- 上下文切换 ----------

  setCurrentUser(userId) {
    this.currentUserId = sanitizeId(userId);
  }

  setCurrentProject(projectId) {
    this.currentProjectId = projectId ? sanitizeId(projectId) : null;
  }

  setCurrentSession(sessionId) {
    this.currentSessionId = sanitizeId(sessionId);
  }

  // ---------- 用户画像 ----------

  _userProfilePath(userId = this.currentUserId) {
    return path.join(this.memoryDir, "user_profiles", `${sanitizeId(userId)}.json`);
  }

  async getUserProfile(userId = this.currentUserId) {
    return readJsonOrNull(this._userProfilePath(userId));
  }

  async saveUserProfile(profile = {}) {
    const existing = (await this.getUserProfile()) || {};
    const merged = {
      userId: this.currentUserId,
      name: profile.name ?? existing.name ?? null,
      preferences: { ...(existing.preferences || {}), ...(profile.preferences || {}) },
      projects: profile.projects ?? existing.projects ?? [],
      createdAt: existing.createdAt || nowIso(),
      updatedAt: nowIso(),
    };
    await writeJsonAtomic(this._userProfilePath(), merged);
    return merged;
  }

  async updateUserPreference(key, value) {
    const existing = (await this.getUserProfile()) || {
      userId: this.currentUserId,
      preferences: {},
      projects: [],
      createdAt: nowIso(),
    };
    existing.preferences = { ...(existing.preferences || {}), [key]: value };
    existing.updatedAt = nowIso();
    await writeJsonAtomic(this._userProfilePath(), existing);
    return existing;
  }

  // ---------- 项目上下文 ----------

  _projectContextPath(projectId) {
    return path.join(this.memoryDir, "project_contexts", `${sanitizeId(projectId)}.json`);
  }

  async getProjectContext(projectId = this.currentProjectId) {
    if (!projectId) return null;
    return readJsonOrNull(this._projectContextPath(projectId));
  }

  async saveProjectContext(context) {
    if (!context?.projectId) {
      throw new Error("saveProjectContext 需要 projectId");
    }
    const existing = (await this.getProjectContext(context.projectId)) || {};
    const merged = {
      projectId: sanitizeId(context.projectId),
      name: context.name ?? existing.name ?? context.projectId,
      description: context.description ?? existing.description ?? "",
      techStack: context.techStack ?? existing.techStack ?? [],
      structure: context.structure ?? existing.structure ?? null,
      keyFiles: context.keyFiles ?? existing.keyFiles ?? [],
      decisions: context.decisions ?? existing.decisions ?? [],
      createdAt: existing.createdAt || nowIso(),
      lastSession: nowIso(),
    };
    await writeJsonAtomic(this._projectContextPath(context.projectId), merged);
    return merged;
  }

  async addProjectDecision(projectId, decision) {
    const pid = projectId || this.currentProjectId;
    if (!pid) throw new Error("addProjectDecision 需要 projectId");

    const existing = (await this.getProjectContext(pid)) || {
      projectId: sanitizeId(pid),
      name: pid,
      description: "",
      techStack: [],
      decisions: [],
      createdAt: nowIso(),
    };
    existing.decisions = [
      ...(existing.decisions || []),
      { content: decision, createdAt: nowIso() },
    ];
    existing.lastSession = nowIso();
    await writeJsonAtomic(this._projectContextPath(pid), existing);
    return existing;
  }

  // ---------- 对话历史 ----------

  _sessionPath(sessionId = this.currentSessionId) {
    return path.join(this.memoryDir, "conversation_history", `${sanitizeId(sessionId)}.json`);
  }

  async saveMessage(role, content) {
    const filePath = this._sessionPath();
    let history = await readJsonOrNull(filePath);
    if (!history) {
      history = {
        sessionId: this.currentSessionId,
        userId: this.currentUserId,
        projectId: this.currentProjectId,
        messages: [],
        startedAt: nowIso(),
      };
    }
    history.messages.push({ role, content, timestamp: nowIso() });
    history.endedAt = nowIso();
    await writeJsonAtomic(filePath, history);
  }

  async getConversationHistory(sessionId = this.currentSessionId, limit = 50) {
    const history = await readJsonOrNull(this._sessionPath(sessionId));
    if (!history) return null;
    if (limit > 0 && history.messages?.length > limit) {
      history.messages = history.messages.slice(-limit);
    }
    return history;
  }

  async getRecentSessions(limit = 10) {
    const dir = path.join(this.memoryDir, "conversation_history");
    let files;
    try {
      files = await fs.readdir(dir);
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }

    const sessions = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const data = await readJsonOrNull(path.join(dir, file));
      if (data) sessions.push(data);
    }

    sessions.sort((a, b) => {
      const ta = new Date(a.startedAt || 0).getTime();
      const tb = new Date(b.startedAt || 0).getTime();
      return tb - ta;
    });
    return sessions.slice(0, limit);
  }

  // ---------- 知识 ----------

  _knowledgePath() {
    return path.join(this.memoryDir, "learned_knowledge", "knowledge.json");
  }

  async _readKnowledge() {
    return (await readJsonOrNull(this._knowledgePath())) || { items: [] };
  }

  async addKnowledge({ category, content, source = "user", confidence = 0.8 }) {
    const store = await this._readKnowledge();
    const item = {
      id: `kn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      category: category || "general",
      content,
      source,
      confidence,
      createdAt: nowIso(),
    };
    store.items.push(item);
    await writeJsonAtomic(this._knowledgePath(), store);
    return item;
  }

  // ---------- 搜索 ----------

  /**
   * 跨用户画像 / 项目 / 知识三类记忆做关键字匹配,返回带类型的命中结果
   */
  async searchMemories(query) {
    if (!query) return [];
    const q = String(query).toLowerCase();
    const hits = [];

    const profile = await this.getUserProfile();
    if (profile && JSON.stringify(profile).toLowerCase().includes(q)) {
      const prefStr = Object.entries(profile.preferences || {})
        .map(([k, v]) => `${k}=${v}`)
        .join(", ");
      hits.push({ type: "profile", text: `用户偏好:${prefStr || "(空)"}` });
    }

    const projectDir = path.join(this.memoryDir, "project_contexts");
    try {
      const files = await fs.readdir(projectDir);
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const ctx = await readJsonOrNull(path.join(projectDir, file));
        if (!ctx) continue;
        if (JSON.stringify(ctx).toLowerCase().includes(q)) {
          hits.push({
            type: "project",
            text: `项目 ${ctx.name}(${ctx.projectId}):${ctx.description || "(无描述)"} | 技术栈 ${ctx.techStack?.join(", ") || "(无)"}`,
          });
        }
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }

    const store = await this._readKnowledge();
    for (const item of store.items) {
      if (`${item.category} ${item.content}`.toLowerCase().includes(q)) {
        hits.push({ type: "knowledge", text: `[${item.category}] ${item.content}` });
      }
    }

    return hits;
  }

  // ---------- 统计与维护 ----------

  async _countFiles(dir) {
    try {
      const files = await fs.readdir(dir);
      return files.filter((f) => f.endsWith(".json")).length;
    } catch (error) {
      if (error.code === "ENOENT") return 0;
      throw error;
    }
  }

  async getStats() {
    const [userProfiles, projectContexts, sessions] = await Promise.all([
      this._countFiles(path.join(this.memoryDir, "user_profiles")),
      this._countFiles(path.join(this.memoryDir, "project_contexts")),
      this._countFiles(path.join(this.memoryDir, "conversation_history")),
    ]);
    const knowledge = await this._readKnowledge();
    return {
      userProfiles,
      projectContexts,
      sessions,
      knowledgeItems: knowledge.items.length,
      currentUserId: this.currentUserId,
      currentProjectId: this.currentProjectId,
      currentSessionId: this.currentSessionId,
    };
  }

  /**
   * 清理 olderThanDays 之前的对话历史
   * 项目和用户画像不会被清理 - 这些是显式记忆,需要用户主动删除
   */
  async cleanupOldSessions(olderThanDays = 30) {
    const dir = path.join(this.memoryDir, "conversation_history");
    let files;
    try {
      files = await fs.readdir(dir);
    } catch (error) {
      if (error.code === "ENOENT") return 0;
      throw error;
    }

    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    let removed = 0;
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const filePath = path.join(dir, file);
      const history = await readJsonOrNull(filePath);
      if (!history) continue;
      const startedAt = new Date(history.startedAt || 0).getTime();
      if (startedAt && startedAt < cutoff) {
        await fs.unlink(filePath);
        removed += 1;
      }
    }
    return removed;
  }

  /** 删除某个项目的全部上下文(包含决策记录) */
  async forgetProject(projectId) {
    const filePath = this._projectContextPath(projectId);
    try {
      await fs.unlink(filePath);
      if (sanitizeId(projectId) === this.currentProjectId) this.currentProjectId = null;
      return true;
    } catch (error) {
      if (error.code === "ENOENT") return false;
      throw error;
    }
  }
}
