# 部署文档（腾讯云轻量应用服务器 + 自定义域名）

面向**境内腾讯云轻量服务器**的完整部署说明。境外服务器（香港/新加坡）同样适用，
只是少了备案环节，操作完全一致。

---

## 一、部署前必读：境内服务器的两个硬约束

### 1. 域名必须完成 ICP 备案

服务器在**中国内地**，域名要解析过来并对外提供服务，**必须备案**。这是工信部要求，不是平台限制。

| 情形 | 结果 |
| --- | --- |
| 域名未备案 + 解析到境内服务器 | 80/443 访问会被拦截，站点打不开 |
| 域名已备案（在任何接入商备案均可） | 正常访问 |
| 服务器在香港/新加坡 | **不需要备案**，解析即可用 |

- 腾讯云提供免费备案服务（控制台 → 备案），材料为身份证 + 域名证书 + 人脸核验，
  通常 **7–20 个工作日**通过
- 域名是在别家买的也能在腾讯云备案，无需转出
- **备案期间怎么办**：容器默认只监听 `127.0.0.1:8000`，外网访问不到。两种临时方案：
  1. **SSH 隧道**（推荐，不用改配置、不额外开放端口）：见第 6 步
  2. 临时把 `docker-compose.yml` 的 `127.0.0.1:8000:8000` 改成 `8000:8000`，
     防火墙放行 8000，用 `http://服务器IP:8000` 访问；备案通过后**务必改回并关闭该端口**

### 2. 境内网络下载依赖必须走国内源

`npmjs.org`、`pypi.org`、`docker.io` 在境内服务器上会非常慢或直接超时。
`deploy/setup.sh` 已内置自动处理：

| 环节 | 官方源 | 境内自动改用 |
| --- | --- | --- |
| 安装 Docker | get.docker.com | 腾讯云 docker-ce 镜像源 |
| 拉取基础镜像 | docker.io | `mirror.ccs.tencentyun.com` 加速器 |
| npm 装包 | registry.npmjs.org | registry.npmmirror.com |
| pip 装包 | pypi.org | 腾讯云 pypi 镜像 |

---

## 二、这些文件都是干什么的

### A. 配置文件（放在仓库里，构建/启动时被自动读取）

| 文件 | 何时生效 | 作用 |
| --- | --- | --- |
| `Dockerfile` | `docker build` 时 | 构建蓝图：阶段1 用 Node 20 构建前端；阶段2 用 Python 3.11-slim 装依赖、放代码、托管 `frontend/dist` |
| `docker-compose.yml` | `docker compose up` 时 | 编排参数：容器名、开机自启、端口映射、`--build-arg` 默认值 |
| `.dockerignore` | `docker build` 时 | 排除 `node_modules`、`frontend/dist`、`.git`，否则 7680 个文件会拖慢构建 |
| `backend/requirements.txt` | 构建阶段2 | Python 依赖清单（fastapi / uvicorn / pandas / openpyxl） |
| `frontend/package.json` `package-lock.json` | 构建阶段1 | 前端依赖清单 |

### B. 服务器操作文件（不参与构建，是给人用的脚本和模板）

| 文件 | 怎么用 | 说明 |
| --- | --- | --- |
| `deploy/setup.sh` | **在服务器上执行** `bash deploy/setup.sh` | 一键脚本：装 Docker → 配镜像加速 → 加 Swap → 构建 → 启动 → 健康检查 |
| `deploy/Caddyfile` | **复制到 `/etc/caddy/Caddyfile`** | 反向代理模板。放项目目录里**不会生效**，只是给你复制用的样例 |

### C. 运行时代码（会被打进镜像）

`backend/main.py`、`backend/analytics_service.py`、`backend/data/people.csv`、
`frontend/src/**`（构建成 `frontend/dist`）

### 一张图理解分工

```
你的电脑                          服务器
--------                          --------
Dockerfile          ──git push──▶  git clone
docker-compose.yml  ─────────────▶ docker compose build  → 镜像
.dockerignore                          │
backend/ + frontend/                   ▼
                                   容器(ledger):8000  ← 只监听本机
deploy/setup.sh     ─────────────▶ 执行它完成上面全部步骤
deploy/Caddyfile    ─────────────▶ cp 到 /etc/caddy/ → Caddy:443 对外 + HTTPS
```

### 是的，这些文件就够了

整条链路是完整的：拉代码 → 跑一个脚本 → 服务就起来了；再复制一个配置到 Caddy → 域名 + HTTPS 就有了。
你需要自己做的只有三件事：**买服务器、买/备好域名、域名备案**。剩下的全部由脚本完成。

---

## 三、完整操作步骤

### 第 1 步：本地提交推送（PowerShell）

```powershell
cd c:\Users\22956\Desktop\ledger
git add .
git commit -m "chore: 添加 Docker 部署配置"
git push origin main
```

私有仓库需要 token：GitHub → Settings → Developer settings → Personal access tokens → 勾选 `repo`。

### 第 2 步：购买腾讯云轻量应用服务器

| 选项 | 建议 |
| --- | --- |
| 地域 | **境内**：上海 / 广州 / 北京（离用户近，延迟 10–30ms）；不想备案就选香港/新加坡 |
| 配置 | 2核2G 起（服务常驻内存约 200–300MB）；活动机常有 2C2G ¥100–200/年 |
| 镜像 | Ubuntu 22.04 或 Debian 12 |
| 带宽 | 轻量套餐标明"峰值带宽"，3–5Mbps 即可（首屏 gzip 后约 450KB，约 1 秒） |

### 第 3 步：防火墙放行端口

腾讯云轻量控制台 → 服务器 → **防火墙** → 添加规则：

| 端口 | 用途 |
| --- | --- |
| 22 | SSH |
| 80 | HTTP（Caddy 签发证书要用，必开） |
| 443 | HTTPS |
| 8000 | 仅备案期间临时访问用，备案通过后删掉 |

### 第 4 步：SSH 登录并拉代码

```powershell
ssh root@你的服务器IP
```

服务器上执行：

```bash
apt update && apt install -y git curl

# 公开仓库
git clone https://github.com/你的用户名/ledger.git /root/ledger
# 私有仓库：把 TOKEN 换成第 1 步生成的 token
git clone https://你的用户名:TOKEN@github.com/你的用户名/ledger.git /root/ledger

cd /root/ledger
```

> 不想用 Git：本地把项目打成 zip，`scp ledger.zip root@IP:/root/` 上传后 `unzip` 即可。

### 第 5 步：一键部署

```bash
bash deploy/setup.sh          # 自动判断国内源
# 或明确指定：CN=1 bash deploy/setup.sh
```

脚本会：装 Docker（腾讯云源）→ 配镜像加速 → 加 2G Swap → 构建镜像 → 启动 → 健康检查。
**首次约 3–6 分钟**，成功输出：

```
服务已就绪：
{"status":"ok","rows":8005}
```

### 第 6 步：验证（备案完成前）

```bash
curl http://127.0.0.1:8000/health          # 服务器上验证，应返回 rows:8005
```

想在本地浏览器看，用 SSH 隧道（**在你电脑新开一个 PowerShell 窗口**，不用开防火墙）：

```powershell
ssh -L 8000:127.0.0.1:8000 root@你的服务器IP
```

窗口保持开着，浏览器访问 `http://localhost:8000`。

### 第 7 步：域名解析 + 备案

1. 域名控制台添加 **A 记录**：`@` 和 `www` → 指向服务器公网 IP
2. 腾讯云控制台 → **备案** → 按引导提交（身份证、域名证书、人脸核验），等 7–20 天
3. 备案通过后，80/443 才会放行

> 域名若用 Cloudflare 做 DNS，请把代理小黄云**关掉**（灰色纯 DNS），否则国内访问会绕路变慢。

### 第 8 步：配置 HTTPS（Caddy 自动证书）

> **前提**：DNS 已解析到本机（`ping 你的域名` 返回服务器 IP）且**备案已通过**。
> 否则 Caddy 申请证书会反复失败，`journalctl -u caddy -f` 中会持续刷错误。

```bash
apt install -y caddy

sed -i 's/ledger.example.com/你的域名/g' deploy/Caddyfile
cp deploy/Caddyfile /etc/caddy/Caddyfile
systemctl reload caddy
```

访问 `https://你的域名` 即可。证书由 Let's Encrypt 自动签发，**到期自动续期，无需人工干预**。

> 若 `apt install caddy` 版本过旧，用官方源：
> ```bash
> curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
> curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
> apt update && apt install -y caddy
> ```

---

## 四、日常运维

```bash
cd /root/ledger

git pull && docker compose up -d --build   # 更新代码并重建
docker compose logs -f                     # 看日志
docker compose ps                          # 看状态（healthy 为正常）
docker compose restart                     # 重启
docker compose down                        # 停止并移除
docker stats ledger                        # 看内存（预期 200-300MB）
```

### 加第二个服务

1. `docker-compose.yml` 里加一个服务，映射到 `127.0.0.1:8001`
2. `/etc/caddy/Caddyfile` 追加一段（`deploy/Caddyfile` 末尾有模板）：
   ```
   another.example.com {
       encode gzip
       reverse_proxy 127.0.0.1:8001
   }
   ```
3. `systemctl reload caddy`

2核2G 跑 3–5 个这类轻量服务没问题；更多就升到 2核4G。

---

## 五、代码自动更新

代码 push 后，服务器可以自动拉取并重建。三种方案，按需要选一种即可。

### 方案 1：服务器定时自检（推荐，零外部依赖）

`deploy/autoupdate.sh` 会检查远端是否有新提交，有则拉取 → 构建 → 替换容器 → 健康检查。

```bash
chmod +x /root/ledger/deploy/*.sh
(crontab -l 2>/dev/null; echo "*/5 * * * * /root/ledger/deploy/autoupdate.sh >> /var/log/ledger-autoupdate.log 2>&1") | crontab -
crontab -l        # 确认已写入
```

- 无更新时**静默退出**，不写日志、不消耗资源
- **构建失败不会中断服务**：`docker compose build` 失败时旧容器照常运行，只有构建成功才切换
- 只有 `up -d` 那几秒在切换，且必须通过健康检查
- 最长延迟 5 分钟；构建在服务器上跑（约 3–6 分钟，期间旧版本正常对外服务）
- 分支不是 `main` 时，在 cron 里加环境变量：`BRANCH=dev /root/ledger/deploy/autoupdate.sh`

```bash
tail -f /var/log/ledger-autoupdate.log        # 查看更新记录
crontab -l | grep -v autoupdate | crontab -   # 关闭自动更新
```

### 方案 2：手动触发（最可控）

```bash
cd /root/ledger && git pull && docker compose up -d --build
```

### 方案 3：push 后即时触发（GitHub Actions 远程 SSH）

push 到 `main` 后 1 分钟内生效，适合不想等 5 分钟的场景。
在仓库添加 `.github/workflows/deploy.yml`：

```yaml
name: deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: SSH 到服务器执行更新
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_KEY }}
          script: cd /root/ledger && git pull && docker compose up -d --build
```

在仓库 Settings → Secrets 添加 `SSH_HOST`（服务器 IP）、`SSH_USER`（root）、`SSH_KEY`（服务器私钥）。

> 与方案 1 二选一，同时开启会重复触发（脚本有锁，不会冲突，但没必要）。

---

## 六、故障排查

| 现象 | 原因 / 处理 |
| --- | --- |
| 构建时卡在拉取基础镜像 | Docker 镜像加速没生效，检查 `cat /etc/docker/daemon.json`，或去腾讯云容器服务控制台获取专属加速器地址 |
| 构建报 OOM / Killed | 脚本已自动加 Swap；仍失败就临时升配到 2C4G 构建一次再降回来 |
| `502 Bad Gateway` | 容器还没起来（首次约 30 秒），看 `docker compose logs -f` |
| Caddy 起不来 | 80/443 被占用：`ss -lntp \| grep -E ':80\|:443'`；证书签发失败多半是**备案未完成**导致 80 不可达 |
| 域名能解析但打不开 | 先确认备案状态；再确认防火墙 80/443 已放行 |
| 页面能开、接口 404 | 确认访问的是根路径，看容器日志里请求是否到达 |
