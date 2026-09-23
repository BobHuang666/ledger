# 汕头存心善堂二十世纪四十年代收客记录系统

用于管理、搜索、统计与可视化收客记录的数据管理系统。共收录 8005 条记录，包含 17 个字段。

## 技术栈

**后端：** FastAPI（Python Web 框架）、Pandas（数据处理）、OpenPyXL（Excel 导出）、CORS 中间件。

**前端：** React 19 + TypeScript、Vite、React Router DOM、Axios、ECharts。

## 目录结构

```text
STv3/
├── backend/                    # 后端服务
│   ├── main.py                # FastAPI 主程序（API + 静态文件托管）
│   ├── analytics_service.py   # 数据分析聚合逻辑
│   ├── requirements.txt       # Python 依赖
│   └── data/people.csv        # 收客记录数据
│
├── frontend/                   # 前端应用
│   ├── src/
│   │   ├── App.tsx            # 主应用（路由配置）
│   │   ├── api/api.ts         # API 接口封装
│   │   ├── components/        # SearchPage / StatsPage / VisualizationPage / Pagination
│   │   ├── constants/         # 字段常量
│   │   └── utils/             # 下载工具
│   ├── .env.example           # 环境变量示例
│   └── dist/                  # 构建输出（git 忽略）
│
├── deploy/                     # 部署相关（不参与构建）
│   ├── setup.sh               # 服务器一键部署脚本
│   ├── autoupdate.sh          # 代码自动更新脚本（配合 cron，每 5 分钟自检）
│   └── Caddyfile              # 反向代理配置模板（需复制到 /etc/caddy/Caddyfile）
│
├── Dockerfile                  # 多阶段构建：前端构建 + 后端运行
├── docker-compose.yml          # 容器编排
├── .dockerignore               # 构建上下文排除规则
├── .gitattributes              # 强制脚本使用 LF 换行（服务器执行必需）
│
└── docs/
    ├── ANALYSIS.md            # 项目分析与待办清单
    └── DEPLOY.md              # 部署文档（腾讯云轻量 + 域名 + HTTPS）
```

## 核心功能

### 1. 高级搜索（SearchPage）

- 多字段组合搜索，支持"全部满足（AND）"与"任意满足（OR）"
- 匹配模式：包含（模糊，按普通文本匹配）/ 精确
- 分页：每页 10/20/50/100 条，支持首页/末页/跳转
- **浏览全部**：不设条件直接查看全部记录
- 结果导出 Excel（文件名按搜索条件自动生成）

### 2. 多条件统计（StatsPage）

- 多字段组合统计，显示数量与占比进度条
- 分页浏览、Excel 导出
- 字段列表由 `GET /fields` 下发，随数据文件自动适配

### 3. 数据可视化（VisualizationPage）

- KPI 总览：总记录数、籍贯/病状/墓地类别数
- 性别分布饼图、年龄段柱状图、死亡月份折线图
- 按年份切换的死亡日期趋势曲线
- 籍贯 → 住址 桑基图

### 4. 后端 API

| 接口 | 方法 | 说明 |
| --- | --- | --- |
| `/search` | POST | 多条件组合搜索，支持 `page`、`pageSize`；无 `conditions` 时返回全部 |
| `/search/export` | POST | 搜索结果导出 Excel |
| `/stats` | GET | 多字段组合统计，参数 `fields`（可多个）、`page`、`pageSize` |
| `/stats/export` | GET | 统计结果导出 Excel |
| `/analytics/overview` | GET | 可视化概览数据（首次计算后缓存） |
| `/fields` | GET | 返回数据文件字段列表 |
| `/health` | GET | 健康检查 |

## 数据字段

姓名、性别、年龄、籍贯、住址、病状、认家、死亡月份、死亡日期、墓地陇名、墓字编号（千字文）、墓地编号（数字）、仙衣棺木类别、工友轮流工作、附记、页码、册数。

## 快速开始

### 后端

```powershell
cd backend
python -m pip install -r requirements.txt
python main.py            # http://localhost:8000，接口文档 /docs
```

### 前端（开发模式）

```powershell
cd frontend
npm install
npm run dev               # http://localhost:5173，接口已配置代理到 8000
```

## 生产部署

单个容器同时提供 API 与前端页面：容器内先构建 `frontend/dist`，再由 FastAPI 托管，
API 与页面同源，无需配置跨域与接口地址。

**完整步骤见 [docs/DEPLOY.md](docs/DEPLOY.md)**（含腾讯云境内服务器、域名备案、HTTPS 配置与故障排查）。

> ⚠️ 服务器在中国内地时，域名**必须先完成 ICP 备案**才能对外访问（香港/新加坡免备案）。

### 最快上手

```bash
git clone <仓库地址> ledger && cd ledger
bash deploy/setup.sh          # 装 Docker → 镜像加速 → 构建 → 启动 → 健康检查，约 3-6 分钟
curl http://127.0.0.1:8000/health
```

脚本会自动识别国内网络并切换 npm / pip / Docker 镜像源（也可 `CN=1` 强制指定）。

### 绑定域名与 HTTPS

```bash
apt install -y caddy
sed -i 's/ledger.example.com/你的域名/g' deploy/Caddyfile
cp deploy/Caddyfile /etc/caddy/Caddyfile
systemctl reload caddy
```

证书由 Caddy 自动申请与续期，之后访问 `https://你的域名`。

### 部署文件说明

| 文件 | 类型 | 说明 |
| --- | --- | --- |
| `Dockerfile` | 构建配置 | 多阶段：Node 20 构建前端 → Python 3.11-slim 运行后端并托管 dist |
| `docker-compose.yml` | 构建配置 | 容器编排，端口只监听 `127.0.0.1:8000`，外网由 Caddy 反代 |
| `.dockerignore` | 构建配置 | 排除 `node_modules`、`dist`、`.git` |
| `deploy/setup.sh` | 服务器执行 | 一键部署脚本（在服务器上 `bash deploy/setup.sh`） |
| `deploy/Caddyfile` | 配置模板 | 需复制到 `/etc/caddy/Caddyfile` 才生效 |

### 更新与运维

```bash
git pull && docker compose up -d --build   # 更新代码并重新构建
docker compose logs -f                     # 查看日志
docker compose ps                          # healthy 为正常
docker stats ledger                        # 内存占用（约 200-300MB）
```

同一台机器上新增服务：在 `docker-compose.yml` 加一个服务映射到 `127.0.0.1:8001`，
再在 Caddyfile 加一段 `reverse_proxy 127.0.0.1:8001`，按域名自动分流。

### 代码自动更新

`deploy/autoupdate.sh` 配合 cron，可实现 push 后 5 分钟内自动拉取构建（构建失败不影响线上服务）：

```bash
chmod +x deploy/*.sh
(crontab -l 2>/dev/null; echo "*/5 * * * * /root/ledger/deploy/autoupdate.sh >> /var/log/ledger-autoupdate.log 2>&1") | crontab -
```

详见 [docs/DEPLOY.md](docs/DEPLOY.md)（含 GitHub Actions 即时触发方案）。
