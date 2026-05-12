# Docker 技能知识库

## 核心概念

| 概念 | 说明 |
|------|------|
| Image(镜像) | 只读模板,容器的"安装包" |
| Container(容器) | 镜像的运行实例 |
| Dockerfile | 描述如何构建镜像的脚本 |
| Registry | 镜像仓库(Docker Hub、私有 registry) |
| Volume | 数据卷,容器外持久化 |
| Network | 容器间通信的虚拟网络 |

## 常用命令

### 镜像
```bash
docker images                         # 列出本地镜像
docker pull node:20-alpine            # 拉取镜像
docker rmi <image>                    # 删除镜像
docker build -t myapp:1.0 .           # 从 Dockerfile 构建
docker tag myapp:1.0 registry/myapp:1.0  # 打标签
docker push registry/myapp:1.0        # 推送
```

### 容器
```bash
docker ps                             # 运行中的容器
docker ps -a                          # 所有容器(含已停止)
docker run -d --name app -p 3000:3000 myapp:1.0
                                      # -d 后台,-p 端口映射
docker exec -it app sh                # 进入运行中的容器
docker logs -f app                    # 实时查看日志
docker stop app && docker rm app      # 停止并删除
docker restart app                    # 重启
```

### 清理
```bash
docker system prune                   # 清理停止的容器/未用的镜像和网络
docker system prune -a --volumes      # 彻底清理(危险)
docker container prune
docker image prune
```

## Dockerfile 示例(Node.js)

```dockerfile
# 多阶段构建:build 阶段装所有依赖,runtime 阶段只留生产依赖
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3000
USER node
CMD ["node", "dist/server.js"]
```

## 优化镜像体积的几招

1. **选小基础镜像**:`node:20-alpine` 比 `node:20` 小 10 倍
2. **多阶段构建**:build 产物 copy 到 runtime 镜像,丢掉编译器
3. **合并 RUN**:每条 `RUN` 都是一层,`&&` 串联减少层数
4. **用 .dockerignore**:别把 `node_modules`、`.git` 打进镜像
5. **缓存顺序**:先 COPY `package*.json` 再 `npm ci`,最后 COPY 源码,依赖没变时缓存命中

## 数据卷与端口

```bash
# 命名卷(推荐)
docker run -v mydata:/app/data myapp

# 宿主机挂载(开发调试)
docker run -v $(pwd):/app myapp

# 端口映射:宿主机:容器
docker run -p 8080:3000 myapp
```

## docker compose

`docker-compose.yml`:
```yaml
version: "3.9"
services:
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://db:5432/app
    depends_on:
      - db
    volumes:
      - ./logs:/app/logs

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: secret
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

命令:
```bash
docker compose up -d          # 后台启动所有服务
docker compose logs -f web    # 看某个服务日志
docker compose ps             # 查看状态
docker compose down           # 停止并删除容器(保留卷)
docker compose down -v        # 连卷一起删
```

## 常见问题

### 容器总是退出?
前台进程必须常驻:Node 服务不能 `npm start &` 后台,CMD 里直接跑主进程。

### 改了 Dockerfile 缓存没生效?
加 `--no-cache` 强制:`docker build --no-cache -t myapp .`

### 容器内没网络?
默认 bridge 网络应该有外网。排查:
- `docker network ls` 看当前网络
- 宿主机 `iptables -L` 看有没有防火墙规则拦截

### 镜像越堆越多?
`docker image prune -a` 清未被使用的;commit 前写好 `.dockerignore`。

## 安全建议
- ⚠️ 不要用 root 跑:`USER node` 显式降权
- ⚠️ 不要把密码写进 Dockerfile:用 `--env-file` 或 secrets
- ⚠️ 定期更新基础镜像,扫描 CVE(`docker scan <image>`)
- ✅ 生产环境用 `:固定版本` 而不是 `:latest`
