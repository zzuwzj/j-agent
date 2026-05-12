# Git 技能知识库

## 常用命令速查

### 基本操作
| 命令 | 说明 |
|------|------|
| `git init` | 初始化仓库 |
| `git clone <url>` | 克隆仓库 |
| `git add <file>` / `git add .` | 暂存文件 |
| `git commit -m "msg"` | 提交 |
| `git commit --amend` | 修改最后一次提交 |
| `git push` / `git pull` | 推送 / 拉取 |
| `git fetch` | 只拉取远端引用,不合并 |

### 分支操作
| 命令 | 说明 |
|------|------|
| `git branch` | 列出本地分支 |
| `git branch -a` | 列出所有分支(含远端) |
| `git checkout -b feat/x` | 创建并切到新分支 |
| `git switch <branch>` | 切换分支(新语法) |
| `git merge <branch>` | 合并分支到当前分支 |
| `git rebase <base>` | 把当前分支变基到 base 上 |
| `git branch -d <name>` | 删除已合并分支 |
| `git branch -D <name>` | 强制删除(未合并也删) |

### 查看历史
| 命令 | 说明 |
|------|------|
| `git log --oneline -20` | 最近 20 条提交(单行) |
| `git log --graph --oneline --all` | 图形化查看所有分支 |
| `git diff` | 工作区相对暂存区的改动 |
| `git diff --staged` | 暂存区相对 HEAD 的改动 |
| `git show <sha>` | 查看某次提交的完整变更 |
| `git blame <file>` | 逐行查看谁在什么时候改的 |

## 合并策略:merge vs rebase

**merge**:保留完整合并图,公共分支首选
```bash
git checkout main
git merge feat/login         # 产生合并提交
```

**rebase**:线性历史,个人分支首选
```bash
git checkout feat/login
git rebase main              # 把 feat/login 的提交"搬到"最新 main 之后
```

团队约定:
- 主分支(main/master):只用 merge,不 rebase
- 个人分支:开发中可随时 rebase 到最新主干
- 合并进主分支前:用 rebase 整理一下再 merge

## 撤销与恢复

### 撤销工作区 / 暂存区
```bash
git restore <file>            # 丢弃工作区改动
git restore --staged <file>   # 取消暂存
git checkout -- <file>        # (老语法)丢弃改动
```

### 撤销提交
```bash
git reset --soft HEAD~1       # 撤销最后一次提交,保留改动到暂存区
git reset --mixed HEAD~1      # (默认)撤销提交,改动留在工作区
git reset --hard HEAD~1       # 危险:彻底丢弃
git revert <sha>              # 生成一个"反向提交",安全
```

### 找回误删
```bash
git reflog                    # 看所有 HEAD 移动记录
git reset --hard <sha>        # 恢复到任意历史点
```

## 解决冲突

1. `git merge` / `git rebase` 报冲突后,编辑文件处理 `<<<<<<<` `=======` `>>>>>>>`
2. `git add <file>` 标记已解决
3. `git commit` 完成合并(rebase 用 `git rebase --continue`)
4. 想放弃:`git merge --abort` 或 `git rebase --abort`

## Stash:临时保存未提交改动
```bash
git stash                     # 保存到栈
git stash list                # 查看
git stash pop                 # 取出并删除
git stash apply               # 取出不删除
git stash drop                # 删除
```

## 远端管理
```bash
git remote -v                 # 查看远端地址
git remote add origin <url>   # 添加远端
git remote set-url origin <new-url>
git push -u origin main       # 首次推送并关联跟踪
```

## 最佳实践

1. 一次功能一个分支,从最新 main 创建:`git switch -c feat/x main`
2. 提交信息写清 "为什么" 而非 "改了什么"
3. 频繁提交,不攒大包
4. 推送前:`git pull --rebase` 拉最新主干,避免无意义 merge commit
5. 强制推送前先想想分支是否公共:公共分支用 `--force-with-lease` 替代 `--force`

## 注意事项
- ⚠️ `git push --force` 会覆盖远程历史,公共分支严禁
- ⚠️ `git reset --hard` 会丢失未提交改动,不可逆
- ⚠️ 已推送的 commit 不要 `git commit --amend`,会导致他人 pull 冲突
- ✅ 不确定时用 `git stash` + `git reflog` 保命
