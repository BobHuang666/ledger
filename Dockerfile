# ============ 阶段 1：构建前端静态产物（frontend/dist） ============
FROM node:20-alpine AS frontend-build

# npm 镜像源：国内机器构建时可改为 https://registry.npmmirror.com
ARG NPM_REGISTRY=https://registry.npmjs.org
# 限制 Node 堆内存，避免 2G 内存的小机器构建时 OOM
ENV NODE_OPTIONS=--max-old-space-size=1536

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --registry=$NPM_REGISTRY
COPY frontend/ ./
RUN npm run build

# ============ 阶段 2：运行 FastAPI，并同源托管前端产物 ============
FROM python:3.11-slim

# pip 镜像源：国内机器可改为 https://mirrors.cloud.tencent.com/pypi/simple
ARG PIP_INDEX_URL=https://pypi.org/simple

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app/backend \
    PORT=8000

WORKDIR /app

# 先单独复制依赖清单，最大化 Docker 层缓存（改代码不会重装 pandas）
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -i $PIP_INDEX_URL -r backend/requirements.txt

# 后端代码（含 data/people.csv）
COPY backend/ ./backend/
# 前端构建产物（main.py 会读取 ../frontend/dist 并托管）
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

WORKDIR /app/backend

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:'+os.environ.get('PORT','8000')+'/health').read()"

# 单 worker：数据只有 8005 行、只读共享，多进程反而成倍占用内存
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT} --workers 1"]
