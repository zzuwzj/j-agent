# Skills 目录

按需加载的领域知识库,每个 Skill 是一个独立子目录:

```
skills/
├── <skill-name>/
│   ├── meta.json    # 元数据,启动时扫描
│   └── SKILL.md     # 完整知识,被 load_skill 工具按需加载
```

## 当前预置

| Skill | 描述 |
|-------|------|
| git | 版本控制常用命令、分支模型、冲突处理、撤销恢复 |
| docker | 容器化:镜像构建、运行、数据卷、compose 编排 |
| javascript | 现代 JS:异步、作用域、模块、常见坑点 |

## 新增 Skill

1. 新建目录 `skills/<name>/`
2. 写 `meta.json`(必填 `name` / `description` / `version`,推荐 `keywords`)
3. 写 `SKILL.md`,控制在 5–10KB,结构清晰、代码块包裹示例
4. 重启 `j-agent skills` 即可生效

## 约束

- ⚠️ 不要写入 API Key、密码、商业机密等敏感信息
- ⚠️ 单个文件别超过 10KB,太大会拖慢加载并稀释 LLM 上下文
- ✅ 如果一个领域知识很大,拆成多个 Skill(如 `react-basics` + `react-advanced`)
