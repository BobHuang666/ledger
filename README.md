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
└── docs/ANALYSIS.md            # 项目分析与待办清单
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

### 方式一：同源部署（推荐，单个服务）

后端在启动时会自动托管 `frontend/dist`，API 与前端同源，无需配置跨域与接口地址。

```powershell
cd frontend && npm install && npm run build
cd ../backend
uvicorn main:app --host 0.0.0.0 --port $PORT
```

访问 `http://<host>:<port>/` 即可。适用于 Render / Koyeb / Leapcell / Railway 等平台（构建命令装依赖，启动命令如上）。

### 方式二：前后端分离

- 前端部署到 Vercel / Netlify（框架预设 Vite，开启 SPA rewrite），构建时设置环境变量：
  ```
  VITE_API_BASE_URL=https://<后端域名>
  ```
- 后端单独部署 `backend/`，后端已开启 CORS，无需额外配置。

## 数据来源与说明

数据为汕头存心善堂二十世纪四十年代收客历史记录，仅用于检索与统计展示，系统当前为只读。

分析与后续优化计划见 [docs/ANALYSIS.md](docs/ANALYSIS.md)。
