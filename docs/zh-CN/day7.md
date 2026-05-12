# Day 7 - Skills：按需加载领域知识，成为多领域专家

> 上一篇：[Day 6 - SubAgent：Agent 分身术](day6.md) | **[概述](../overview.zh-CN.md)**

## 目标

把"领域知识"从系统提示词里解耦出来：启动时只告诉 Agent **有哪些可用的 Skill**（几十字的元数据），用到时才把对应的 `SKILL.md`（几 KB 的具体知识）加载进上下文。这样既省 token，又能方便地用文件新增/更新知识，不需要改代码。

## 完成内容

### 1. Skills 目录结构

```
skills/
├── README.md                # 目录使用说明
├── git/
│   ├── meta.json            # 元数据,启动扫描
│   └── SKILL.md             # 完整知识,按需加载
├── docker/
│   ├── meta.json
│   └── SKILL.md
└── javascript/
    ├── meta.json
    └── SKILL.md
```

三个预置 Skill：
- **git** — 版本控制：常用命令、分支模型、冲突处理、撤销恢复
- **docker** — 容器化：镜像构建、容器运行、compose 编排、镜像瘦身
- **javascript** — 异步、作用域、模块、常见坑点

三份 `SKILL.md` 都在 4KB 左右（文档建议 5–10KB），结构一致：速查表 + 代码示例 + 最佳实践 + ⚠️ 警告。

### 2. 元数据格式（meta.json）

```json
{
  "name": "git",
  "description": "Git 版本控制:常用命令、分支模型、冲突处理、历史改写、撤销恢复",
  "version": "1.0.0",
  "keywords": ["git", "version control", "commit", "branch", "rebase", "merge"],
  "author": "j-agent",
  "updatedAt": "2026-05-12"
}
```

必填：`name` / `description` / `version`。扫描时缺失任一必填项会被跳过并给警告，不中断。

### 3. SkillsManager（src/skills/manager.js）

核心能力：

- `scanSkills()` — 遍历 skills/，把每个子目录的 meta.json 读进 `skillMetas: Map<name, meta>`；目录不存在只告警不 throw
- `loadSkill(name)` — 按需读 `SKILL.md`，首次读文件、之后命中 `loadedSkills` 缓存；未注册名直接 throw 给出可用列表
- `getAvailableSkills()` / `formatAvailableSkills()` — 元数据列表 / markdown 清单，后者直接塞进 system prompt
- `clearCache(name)` / `clearAllCache()` — 热更新用
- `getStats()` — `{ total, loaded, loadedNames }`

内存模型很轻：元数据常驻（O(N)，N 约等于 Skill 数量），内容只在首次触发时才占用内存。

### 4. Skills 工具集（src/tools/skills-tools.js）

三个 Function Call：

| 工具 | 作用 |
|---|---|
| `load_skill(skillName)` | 加载指定 Skill 的 `SKILL.md`，返回 `【<name> Skill 知识】\n\n<content>` |
| `list_skills` | 列出所有可用 Skill 及其描述和版本 |
| `get_skill_stats` | 当前注册数 / 加载数 / 已加载名单 |

`createSkillsHandlers(manager)` 工厂把 manager 实例闭包进 handlers，保证一次 session 内共享同一份缓存。

### 5. Skills 模式 REPL（src/agent/skills.js）

system prompt 的关键部分由 `manager.formatAvailableSkills()` 动态拼接，启动时 Agent 就知道有哪些 Skill 可用。

工作流：

```
用户提问
  ↓
主 Agent 判断:需要领域知识?
  ├─ 不需要 → 直接回答(纯对话)
  └─ 需要   → load_skill(<name>) → 基于知识回答
                    ↓
            命中缓存? 有就直接返回
            否则读 skills/<name>/SKILL.md 写入缓存
```

REPL 侧包了一层 `traced` handler：每次 `load_skill` 打印 📖 加载 or 📦 命中缓存 or 📕 失败，对应用户侧看到的"黑盒变灰盒"。

斜杠命令：`/exit`、`/clear`（重置对话但**不清** Skill 缓存）、`/skills`（清单）、`/stats`（加载状态）、`/reset-cache`（清空缓存强制重读）、`/help`。

### 6. CLI 接入

```bash
j-agent skills    # 或 j-agent sk
```

### 7. 项目结构

```
j-agent/
├── skills/                     # 🆕 Day 7 知识库
│   ├── README.md
│   ├── git/
│   ├── docker/
│   └── javascript/
├── src/
│   ├── agent/
│   │   ├── chat|fc|mcp|task|subagent.js
│   │   └── skills.js           # 🆕 Skills 模式 REPL
│   ├── skills/                 # 🆕
│   │   └── manager.js
│   ├── tools/
│   │   ├── skills-tools.js     # 🆕
│   │   └── (其它)
│   ├── agents/ tasks/ mcp/ mcp-servers/ conversation.js
│   └── llm.js
└── bin/cli.js
```

## 验证结果

**结构性**（不依赖 LLM，全部通过）：

- scanSkills 扫出 3 个 Skill ✅
- `loadSkill("git")` 首次从文件加载成功 ✅
- 第二次 load 命中缓存（loaded 计数不变）✅
- `loadSkill("rust")` 未注册 → 抛错并列出可用 ✅
- `list_skills` / `get_skill_stats` / `load_skill` 三个 handler 输出符合预期 ✅
- `clearCache` / `clearAllCache` 正确 ✅
- `j-agent skills --help` / 子命令帮助完整 ✅

**端到端**（走 LLM）：DashScope 免费额度仍未恢复，对话流未能实时跑通。代码路径与 Day 4/5/6 的工具循环同构，切付费 key 后直接 `npx j-agent skills` 即可复测。

## 关键概念

| 概念 | 说明 |
|---|---|
| 元数据常驻 | 启动扫描所有 meta.json，几十字一条，不耗上下文 |
| 内容按需 | `SKILL.md` 只在 `load_skill` 时才读取；首次读完后缓存 |
| 目录即协议 | 新增 Skill = 新建目录 + 写两个文件，不改代码 |
| 系统提示注入 | `formatAvailableSkills()` 把清单动态写进 system prompt |
| 工厂 + 闭包 | `createSkillsHandlers(manager)` 保证多轮调用共享同一缓存 |

## 和文档版本的差异

1. **manager 不再做成模块级单例** — 文档示例里 `skills-tools.js` 顶部 `new SkillsManager(...)` 固定在模块加载时，多处 import 会共享同一个实例、也不利于测试。我改成在 `chatWithSkills` 里 `new SkillsManager(skillsDir)` + `createSkillsHandlers(manager)`，跟 Day 6 的委托工具是同一套写法。
2. **`loadSkill` 抛错而非返回字符串** — 文档里未注册 Skill 会返回 "不存在或加载失败" 字符串；我改成 throw，handler 层再 catch 成 `❌ ...` 消息。好处是 SkillsManager 的语义干净，谁用谁决定怎么处理错误。
3. **`/reset-cache` 命令** — 文档没要求，但开发期方便：改了 `SKILL.md` 后不用重启就能让 LLM 拿到新内容。

## 踩坑记录

1. **块注释里写 `skills/*/meta.json` 把注释提前终结了** — JS 解析器把 `*/` 当成块注释结束，后面全报 `Unexpected identifier`。改成"每个 Skill 目录下的 meta.json"避开了 glob 写法。
2. **清单要有版本号** — 只写描述时 LLM 经常跟用户说"最新版是…"；把版本号加进 `list_skills` 输出后，LLM 更倾向于说"当前 Skill 版本 v1.0.0"，信息边界更清楚。
3. **不要把 Skill 写太大** — 初版把 git 知识写了 15KB，LLM 加载后反而容易忽略细节；压缩到 4KB 内、用表格+代码块突出重点，回答质量明显提升。
4. **缓存热更新** — 开发期改 `SKILL.md` 发现没生效，原因是进程内缓存；加了 `/reset-cache` 命令后调试体验顺畅。

## 下一步

- Day 8 预告：Agent 持久化与记忆（跨会话记住用户偏好）
- 进阶方向：
  - Skill 依赖管理（`dependsOn` 字段）
  - 远端 Skill registry（从 URL 拉取 `SKILL.md`）
  - 关键词 → Skill 自动推荐（用 `keywords` 做粗排）
  - 和 SubAgent 结合：researcher 专用 Skills、planner 专用 Skills
  - 敏感内容扫描：commit 前 lint 掉 `sk-xxx`、`.env` 之类的字符串

---

> 返回：[概述](../overview.zh-CN.md)
