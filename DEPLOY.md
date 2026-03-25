# 标注校验工具 - 部署文档

## 项目说明

这是一个纯前端应用，用于校验 2D 图像标注结果。支持以下标注类型：
- 矩形框 (bbox)
- 多边形 (polygon)
- 折线 (polyline)
- 点 (point)
- 语义分割 (segmentation)

**资源消耗说明：** 图片和标注数据在用户浏览器本地处理，不经过服务器，服务器仅托管静态文件。

---

## 环境要求

### Docker 部署
- Docker 20.10+
- Docker Compose 2.0+（可选）

### 手动构建部署
- Node.js 18+
- npm 9+
- Web 服务器（nginx/apache/caddy 等）

---

## 方式一：Docker 部署（推荐）

### 1. 使用 Docker Compose

```bash
# 克隆项目
git clone <repository-url>
cd annotation-validator

# 构建并启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

访问地址：`http://localhost:3000`

### 2. 使用 Docker 命令

```bash
# 构建镜像
docker build -t annotation-validator:latest .

# 运行容器
docker run -d \
  --name annotation-validator \
  -p 3000:80 \
  --restart unless-stopped \
  -e TZ=Asia/Shanghai \
  annotation-validator:latest

# 查看日志
docker logs -f annotation-validator

# 停止容器
docker stop annotation-validator
docker rm annotation-validator
```

### 3. 自定义端口

修改 `docker-compose.yml` 中的端口映射：

```yaml
ports:
  - "8080:80"  # 将 8080 改为你需要的端口
```

---

## 方式二：手动构建部署

### 1. 构建项目

```bash
# 安装依赖
npm install

# 构建生产版本
npm run build
```

构建产物位于 `dist/` 目录。

### 2. 部署到 Web 服务器

#### Nginx 配置示例

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/annotation-validator;
    index index.html;

    # gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;

    # 处理 SPA 路由
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
}
```

#### 部署步骤

```bash
# 1. 将 dist 目录复制到服务器
scp -r dist/* user@server:/var/www/annotation-validator/

# 2. 复制 nginx 配置
sudo cp nginx.conf /etc/nginx/sites-available/annotation-validator
sudo ln -s /etc/nginx/sites-available/annotation-validator /etc/nginx/sites-enabled/

# 3. 测试并重载 nginx
sudo nginx -t
sudo nginx -s reload
```

---

## 方式三：静态托管平台

### Vercel

```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署
vercel --prod
```

### Netlify

1. 连接 GitHub 仓库
2. 构建命令：`npm run build`
3. 发布目录：`dist`

### GitHub Pages

1. 修改 `vite.config.ts`：
   ```typescript
   export default defineConfig({
     base: '/your-repo-name/',
     // ...
   })
   ```

2. 构建并推送到 gh-pages 分支

---

## HTTPS 配置（推荐）

### 使用 Let's Encrypt

```bash
# 安装 certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

### Docker + HTTPS

使用反向代理（如 Traefik、Caddy）自动管理 HTTPS：

```yaml
# docker-compose.yml with Caddy
version: '3.8'

services:
  annotation-validator:
    build: .
    labels:
      - "caddy=your-domain.com"
      - "caddy.reverse_proxy={{upstreams 80}}"
    
  caddy:
    image: caddy:2
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - caddy_data:/data
      - caddy_config:/config

volumes:
  caddy_data:
  caddy_config:
```

---

## 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| TZ | 时区 | Asia/Shanghai |

---

## 常见问题

### 1. 页面空白或刷新 404

确保服务器配置了 SPA 路由回退（所有路由返回 index.html）。

Nginx 配置：
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

### 2. 静态资源加载失败

检查 `vite.config.ts` 中的 `base` 配置是否正确。

### 3. 大文件处理慢

这是纯前端应用，处理速度取决于用户浏览器性能和内存：
- Chrome/Edge：推荐
- Firefox：正常
- Safari：部分功能可能受限

建议用户使用现代浏览器。

### 4. Docker 构建失败

确保 Docker 有足够的内存（至少 2GB）：
```bash
# 查看 Docker 资源
docker info | grep Memory
```

---

## 版本更新

```bash
# 拉取最新代码
git pull

# Docker 方式
docker-compose up -d --build

# 手动方式
npm install
npm run build
# 然后将 dist 目录部署到服务器
```

---

## 架构说明

```
┌─────────────────────────────────────────────────────┐
│                    用户浏览器                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │   图片加载   │  │  JSON解析   │  │ Canvas绘制  │  │
│  │  (本地内存)  │  │  (本地CPU)  │  │  (本地GPU)  │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────┘
                         │
                         │ 仅下载静态文件
                         ▼
┌─────────────────────────────────────────────────────┐
│                    服务器                            │
│  ┌─────────────────────────────────────────────┐    │
│  │  Nginx (托管 HTML/CSS/JS 静态文件)          │    │
│  │  - 极低 CPU 消耗                            │    │
│  │  - 极低内存消耗                             │    │
│  │  - 主要带宽消耗                             │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

**优点：**
- 服务器压力小
- 用户数据不离开本地
- 支持处理大文件

**限制：**
- 处理能力受用户设备限制
- 无法进行服务端计算
