# 项目分析与待办清单

本文档记录对「汕头存心善堂二十世纪四十年代收客记录系统」的结构、功能、样式与部署分析，以及按优先级排列的待办清单。

分析环境：Python 3.12.10 / Node 20.19.0 / 数据 8005 条记录（`backend/data/people.csv`，1.18 MB）。

---

## 一、总体结论

项目是功能闭环、代码可读、样式统一度较高的中小型系统：后端单文件 FastAPI + Pandas，前端 3 个页面 + ECharts 可视化，本地可正常启动。

主要问题集中在 **部署就绪度** 与 **少量健壮性缺陷**，而非架构错误：

| 维度 | 评价 |
| --- | --- |
| 功能正确性 | 主体正确；存在 1 个可复现的 500 错误、若干边界问题 |
| 功能完善度 | 搜索/统计/可视化三件套齐全；缺全量浏览、排序、字段接口化 |
| 样式 | CSS 变量体系完整、响应式断点齐全；1 处无效 CSS，可视化页内联样式过多 |
| 代码结构 | 重复代码约 200 行（分页组件、字段常量、工具函数），可视化页 609 行待拆 |
| 文件结构 | 缺 `.gitignore`、`requirements.txt` 等部署必需文件；README 与现状不符 |
| 部署 | 改造前不可直接部署，需 3~4 处小改 |

---

## 二、功能正确性

### 严重：搜索输入含正则元字符导致 500（已实测复现）

`backend/main.py` 中 `str.contains(condition.value)` 默认按正则解析。实测 `POST /search` 传入 `姓名 包含 "("` 返回 **HTTP 500**，前端仅提示"搜索失败"。`[`、`*`、`+`、`?`、`\` 同理会崩溃或误匹配。

### 其他健壮性问题

1. **导出响应头中文名乱码**：`Content-Disposition: filename="搜索结果.xlsx"` 非 ASCII，不符合 RFC 6266，直接访问接口下载会乱码。
2. **无全量浏览能力**：无搜索条件时接口返回空表，前端也强制至少一个条件，用户无法翻看全部记录。
3. **可视化 KPI 取数不稳**：`totalRecords` 取自 `/stats` 的 `valueTotal`，异常时显示 0；`genderCategories` 定义后从未渲染（死字段）。
4. **翻页竞态**：`useEffect([page, pageSize])` 无请求取消，快速连点页码可能后发先至。
5. **404 与深链**：无 `path="*"` 兜底路由；部署后刷新 `/stats` 会 404。
6. **错误语义**：`/analytics/overview` 异常时返回 HTTP 200 + error 字段，网关无法感知故障（保留该行为以保证前端能展示具体错误，见待办 P3）。

### 性能

`/analytics/overview` 每次请求全量重算（两次 `iterrows` 遍历 8005 行）：冷首次 2483 ms，热请求 340 ms（实测）。数据静态，可缓存。

---

## 三、功能完善度

| 优先级 | 建议 | 改动量 | 状态 |
| --- | --- | --- | --- |
| ★★★ | `GET /fields` 接口化字段，前端不再硬编码 | 后端 10 行 | 待办 P2 |
| ★★★ | 无条件返回全量 + 前端"浏览全部" | 后端 1 行 + 前端 5 行 | 已修复 |
| ★★☆ | 结果排序、列显示/隐藏 | 前端 30 行 | 待办 P3 |
| ★★☆ | analytics 结果缓存 | 3 行 | 已修复 |
| ★☆☆ | 导出 CSV | 后端 5 行 | 待办 P3 |
| ★☆☆ | `GET /health` 健康检查 | 3 行 | 已修复 |

不建议现在做：CRUD 增删改（只读史料数据会被污染且需鉴权）、登录鉴权（公开史料，增加部署复杂度）。

---

## 四、样式优化

**现有优点**：`src/index.css` 已建立完整 CSS 变量体系（颜色/圆角/间距/阴影/过渡），响应式断点（768/480）齐全，粘性头部 + 毛玻璃导航 + 骨架屏。

**已修复**

- 删除 `tbody tr:nth-child(every)` 无效规则（构建时 esbuild 告警，且 `odd/even` 规则已覆盖）。
- 可视化页大量内联样式抽取为 `.kpi-grid` / `.kpi-card` / `.chart-title` / `.chart-tab` / `.chart-grid-2` 等类。
- `index.html`：`lang="zh-CN"`、补充 `meta description`。

**待办 P3**

- 表格滚动时表头吸附（`.table-wrapper` 加 `max-height` + `th` sticky，会改变滚动交互，需评估）。
- 暗色模式（CSS 变量已就位，加一段 `prefers-color-scheme` 覆盖即可）。
- `alert()` 改为内联提示条；搜索页补骨架屏；空状态区分"未搜索"与"无结果"。
- 替换 `vite.svg` 默认图标为项目自有 favicon。

---

## 五、代码编排与文件结构

### 重复代码（约 200 行，已抽取）

| 重复内容 | 原位置 | 现方案 |
| --- | --- | --- |
| `Pagination` 组件（约 90 行 ×2） | SearchPage / StatsPage | `src/components/Pagination.tsx` |
| `getPageNumbers()` 页码算法 | 同上 | 随组件抽取 |
| `sanitizeFileName()` + 下载逻辑 | 同上 | `src/utils/download.ts` |
| `FIELDS` 字段常量（3 处） | SearchPage / StatsPage / 可视化页 | `src/constants/fields.ts` |

### 其他结构性问题

- `VisualizationPage.tsx` 609 行过长：已改为路由级懒加载（`React.lazy`），图表 option 后续可拆为 `charts/` 工厂函数。
- 类型过宽：`results: any[]`、`option` 大量 `as any`，后续可定义 `RecordItem = Record<string, string>`。
- `BASE_URL` 硬编码 `http://localhost:8000` → 部署即失效，已改为 `import.meta.env.VITE_API_BASE_URL`。
- `package.json` 的 `"type": "commonjs"` 与 ESM 源码冲突，已移除。
- 打包体积（修复前实测）：`index.js` 1340 KB（gzip 444 KB），主因是全量引入 echarts。已通过路由懒加载 + `manualChunks` 拆包。

### 目录结构（调整后）

```text
STv3/
├── .gitignore               新增
├── README.md                已修正（删除与现状不符的章节，补充部署说明）
├── docs/ANALYSIS.md         本文件
├── backend/
│   ├── main.py
│   ├── analytics_service.py
│   ├── requirements.txt     新增
│   └── data/people.csv
└── frontend/
    ├── .env.example         新增
    └── src/
        ├── api/api.ts
        ├── components/      SearchPage / StatsPage / VisualizationPage / Pagination
        ├── constants/fields.ts
        └── utils/download.ts
```

---

## 六、待办清单（按优先级）

### P0 部署必需

- [x] `.gitignore`（避免 `node_modules`、`__pycache__`、`dist` 入库）
- [x] `backend/requirements.txt`
- [x] `frontend/.env.example`
- [x] API 地址环境变量化 + 开发代理
- [x] 后端托管 `frontend/dist` + SPA 兜底路由
- [x] 启动端口支持 `$PORT`

### P1 正确性

- [x] `str.contains(..., regex=False)` 修复 500
- [x] 无条件搜索返回全量（浏览模式）
- [x] `/analytics/overview` 结果缓存
- [x] 导出文件名按 RFC 6266 编码
- [x] 新增 `/health`
- [x] 可视化 KPI 改用 `analyticsResult.total`，移除死字段

### P2 结构与体验

- [x] 抽取 `Pagination` / `fields` / `download` 公共模块
- [x] 路由兜底 `path="*"` + 可视化页懒加载
- [x] 构建拆包（`manualChunks`）
- [x] 修复 `npm run lint`（`type: commonjs` → `type: module`，并清理 10 处 lint 报错）
- [x] `GET /fields` 接口化字段（前端改用接口 + 常量兜底）
- [x] 请求竞态处理（请求序号，忽略过期响应）

### P3 锦上添花

- [ ] 搜索结果排序、列显示/隐藏
- [x] `alert()` 改为内联提示条；搜索页骨架屏
- [x] 替换 favicon 为项目图标
- [x] `/analytics/overview` 异常结果不入缓存（保留 200 + error 语义，前端无需改动）
- [ ] `/analytics/overview` 异常改为 5xx（需同步前端错误处理）

---

## 七、部署方案

### 上传 GitHub

```powershell
cd <项目根目录>
git init
git branch -M main
git remote add origin https://github.com/<账号>/STv3.git
git add .
git commit -m "feat: 汕头存心善堂收客记录系统"
git push -u origin main
```

`people.csv` 仅 1.18 MB，无需 Git LFS；建议 README 注明数据来源与授权。

### 方案对比

| 方案 | 成本 | 冷启动 | 改动量 | 说明 |
| --- | --- | --- | --- | --- |
| **A. 单服务同源（推荐）** | 免费 | 有（30~50 s） | 小 | 后端托管前端 dist，只部署 1 个服务 |
| B. 前后端分离 | 免费 | 前端无 | 小 | 前端 Vercel/Netlify + 后端 Render |
| C. 纯静态 Pages | 免费 | 无 | 大 | CSV 转 JSON 放前端，浏览器内检索 |
| D. 国内轻量云 | ~100 元/年 | 无 | 中 | 腾讯云/阿里云轻量 2C2G + nginx |

### 方案 A（推荐）：FastAPI 同时托管前端

1. 构建前端：`cd frontend && npm run build`
2. 启动后端（工作目录为 `backend/`）：
   ```
   uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
3. 访问 `http://<host>:<port>/` 即可，API 与前端同源，无需配置跨域与 API 地址。

推荐免费平台：Koyeb / Leapcell / Render。Render 免费档 15 分钟无访问会休眠，首次访问需等待 30~50 秒（analytics 缓存已降低二次访问耗时）。

### 方案 B：前后端分离

- 前端 Vercel/Netlify 部署 `frontend`（框架预设 Vite，需开启 SPA rewrite）。
- 后端部署 `backend/`，前端构建时注入 `VITE_API_BASE_URL=https://<后端域名>`。
- CORS 已 `allow_origins=["*"]`，无需改动。

### 方案 C：纯静态 GitHub Pages

将 CSV 转为 JSON（gzip 后约 300 KB）放入 `frontend/public/`，前端用 Papaparse 等在浏览器内完成检索与统计，彻底无后端、不休眠；但需重写数据层（约 200 行），首屏需下载全量数据。

---

## 八、本地运行

```powershell
# 后端
cd backend
python -m pip install -r requirements.txt
python main.py            # http://localhost:8000

# 前端（开发模式，已配置 /search /stats /analytics 代理）
cd frontend
npm install
npm run dev               # http://localhost:5173
```

生产同源模式：先 `npm run build`，再启动后端即可访问 `http://localhost:8000/`。

---

## 九、修复验证记录

| 项目 | 修复前 | 修复后（实测） |
| --- | --- | --- |
| 搜索关键词 `(` | HTTP 500 | HTTP 200（`total: 0`） |
| 无条件搜索 | 返回空表 | `total: 8005`，2669 页 |
| `/analytics/overview` | 每次全量重算 340 ms | 首次计算后缓存，命中 7 ms（42 KB） |
| 导出响应头 | 非 ASCII 文件名 | `filename="export.xlsx"; filename*=UTF-8''...` |
| 静态托管 | 无 | `/`、`/visualization`、未知路径均返回 `index.html`（HTTP 200） |
| 主包体积 | 1340 KB（gzip 444 KB） | 227 KB（gzip 75 KB），echarts 1053 KB 拆为按需加载的异步块 |
| `npm run lint` | 报 `Cannot use import statement outside a module` | 可正常执行（移除 `type: commonjs`） |
| 开发代理 | 无 | `http://127.0.0.1:5173/health`、`/fields` 均正确代理到后端 |
| 分析缓存缺陷 | 错误结果被永久缓存 | 仅成功时写缓存，故障可自愈（保留 200 + error 语义） |
| 错误提示 | 浏览器 `alert()` 弹窗 | 页内 `.alert` 提示条（可关闭），搜索/统计页共 9 处替换 |
| 加载占位 | 仅统计页有骨架屏 | 抽取 `TableSkeleton`，搜索/统计页共用 |
| favicon | Vite 默认图标 | 生成蓝底白色线装账本印章图标（`favicon.png` 25KB + 多尺寸 `favicon.ico`） |

说明：`vite` 默认绑定 `localhost`，若通过 `127.0.0.1` 访问不通，启动时加 `--host 127.0.0.1`。
