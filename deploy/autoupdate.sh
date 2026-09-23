#!/usr/bin/env bash
# 自动更新：检查远端是否有新提交 → 有则拉取并重建 → 健康检查通过才算更新成功
# 通常配合 cron 使用（每 5 分钟执行一次），也可手动运行：bash deploy/autoupdate.sh
set -uo pipefail

export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

BRANCH="${BRANCH:-main}"
LOG_TAG="[autoupdate $(date '+%F %T')]"

# 防止上一次还没跑完，cron 又启动一次
LOCK=/tmp/ledger-autoupdate.lock
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "$LOG_TAG 上一次更新尚未结束，本次跳过"
  exit 0
fi

# 镜像源（与 setup.sh 保持一致）
if [ -z "${CN:-}" ]; then
  if curl -s -m 4 -o /dev/null https://mirrors.cloud.tencent.com; then CN=1; else CN=0; fi
fi
if [ "$CN" = "1" ]; then
  NPM_REGISTRY=https://registry.npmmirror.com
  PIP_INDEX_URL=https://mirrors.cloud.tencent.com/pypi/simple
else
  NPM_REGISTRY=https://registry.npmjs.org
  PIP_INDEX_URL=https://pypi.org/simple
fi

# ---------- 1. 检查远端是否有新提交 ----------
if ! git fetch --quiet origin "$BRANCH"; then
  echo "$LOG_TAG git fetch 失败（多半是网络波动），跳过本次"
  exit 0
fi

LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse "origin/$BRANCH")"
if [ "$LOCAL" = "$REMOTE" ]; then
  exit 0    # 无更新，静默退出，不写日志
fi
echo "$LOG_TAG 发现新提交 $REMOTE，开始更新"

# ---------- 2. 先构建，失败则保留现有版本继续运行 ----------
# 关键点：docker compose build 失败时不会触碰正在运行的容器，服务不受影响
if ! docker compose build --build-arg NPM_REGISTRY="$NPM_REGISTRY" --build-arg PIP_INDEX_URL="$PIP_INDEX_URL"; then
  echo "$LOG_TAG 构建失败，保留当前版本继续运行，请手动排查"
  exit 1
fi

# ---------- 3. 拉取代码并替换容器 ----------
if ! git pull --ff-only origin "$BRANCH"; then
  echo "$LOG_TAG git pull 失败（本地有未提交改动？），已构建但未切换"
  exit 1
fi

docker compose up -d

# ---------- 4. 等待健康检查 ----------
for i in $(seq 1 30); do
  status="$(docker inspect -f '{{.State.Health.Status}}' ledger 2>/dev/null || echo missing)"
  if [ "$status" = "healthy" ]; then
    echo "$LOG_TAG 更新完成，新版本已上线（$REMOTE）"
    # 清理悬空镜像，避免磁盘被旧镜像占满
    docker image prune -f >/dev/null 2>&1 || true
    exit 0
  fi
  sleep 3
done

echo "$LOG_TAG 新容器健康检查超时，查看日志：docker compose logs -f"
exit 1
