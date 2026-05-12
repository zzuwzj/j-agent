/**
 * SkillsManager - 按需加载的领域知识管理器
 * - 启动时扫描每个 Skill 目录下的 meta.json(元数据常驻)
 * - 运行时按需读取 skills/<name>/SKILL.md(完整内容)
 * - 首次加载后缓存,后续命中直接返回
 */

import fs from "fs/promises";
import path from "path";

/**
 * @typedef {Object} SkillMeta
 * @property {string} name
 * @property {string} description
 * @property {string} version
 * @property {string[]} [keywords]
 * @property {string} [author]
 * @property {string} [updatedAt]
 */

/**
 * @typedef {Object} Skill
 * @property {SkillMeta} meta
 * @property {string} content
 */

export class SkillsManager {
  /**
   * @param {string} skillsDir - Skills 根目录(绝对或相对路径)
   */
  constructor(skillsDir = "./skills") {
    this.skillsDir = skillsDir;
    /** @type {Map<string, SkillMeta>} */
    this.skillMetas = new Map();
    /** @type {Map<string, Skill>} */
    this.loadedSkills = new Map();
    this.scanned = false;
  }

  /**
   * 扫描 Skills 目录,加载所有 meta.json
   * @returns {Promise<SkillMeta[]>}
   */
  async scanSkills() {
    let entries;
    try {
      entries = await fs.readdir(this.skillsDir, { withFileTypes: true });
    } catch (error) {
      console.warn(`⚠️ 未找到 skills 目录 ${this.skillsDir},Skills 功能将不可用`);
      this.scanned = true;
      return [];
    }

    const metas = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const metaPath = path.join(this.skillsDir, entry.name, "meta.json");
      try {
        const raw = await fs.readFile(metaPath, "utf-8");
        const meta = JSON.parse(raw);
        if (!meta.name || !meta.description || !meta.version) {
          console.warn(`⚠️ skills/${entry.name}/meta.json 缺少必填字段,跳过`);
          continue;
        }
        this.skillMetas.set(meta.name, meta);
        metas.push(meta);
      } catch (e) {
        console.warn(`⚠️ 读取 skills/${entry.name}/meta.json 失败:${e.message},跳过`);
      }
    }

    this.scanned = true;
    const names = metas.map((m) => m.name).join(", ") || "(无)";
    console.log(`📚 已扫描到 ${metas.length} 个 Skills:${names}`);
    return metas;
  }

  /**
   * 按需加载 Skill 完整内容,带缓存
   * @param {string} skillName
   * @returns {Promise<string>}
   */
  async loadSkill(skillName) {
    if (!this.scanned) {
      await this.scanSkills();
    }

    // 缓存命中
    if (this.loadedSkills.has(skillName)) {
      return this.loadedSkills.get(skillName).content;
    }

    // 未注册的 Skill
    if (!this.skillMetas.has(skillName)) {
      const available = Array.from(this.skillMetas.keys()).join(", ") || "(无)";
      throw new Error(`Skill "${skillName}" 不存在。可用:${available}`);
    }

    const skillPath = path.join(this.skillsDir, skillName, "SKILL.md");
    const content = await fs.readFile(skillPath, "utf-8");

    this.loadedSkills.set(skillName, {
      meta: this.skillMetas.get(skillName),
      content,
    });
    return content;
  }

  /** 返回所有已注册 Skill 的元数据数组 */
  getAvailableSkills() {
    return Array.from(this.skillMetas.values());
  }

  /** 返回单个 Skill 的元数据 */
  getSkillMeta(skillName) {
    return this.skillMetas.get(skillName);
  }

  /** 格式化为 markdown 清单,可直接塞进 system prompt */
  formatAvailableSkills() {
    const skills = this.getAvailableSkills();
    if (skills.length === 0) return "(暂无可用 Skills)";
    return skills
      .map((s) => `- **${s.name}**: ${s.description}`)
      .join("\n");
  }

  /** 清除单个 Skill 的缓存(热更新用) */
  clearCache(skillName) {
    this.loadedSkills.delete(skillName);
  }

  /** 清除所有缓存 */
  clearAllCache() {
    this.loadedSkills.clear();
  }

  /** 统计:总数、已加载数、已加载列表 */
  getStats() {
    return {
      total: this.skillMetas.size,
      loaded: this.loadedSkills.size,
      loadedNames: Array.from(this.loadedSkills.keys()),
    };
  }
}
