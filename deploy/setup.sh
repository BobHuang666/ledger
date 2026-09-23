#!/usr/bin/env bash
# 服务器一键部署脚本：装 Docker → 配置镜像加速 → 构建镜像 → 启动容器 → 健康检查
#
# 用法：
#   bash deploy/setup.sh          # 自动判断是否走国内镜像源
#   CN=1 bash deploy/setup.sh     # 强制国内源（腾讯云境内服务器推荐）
#   CN=0 bash deploy/setup.sh     # 强制官方源（境外服务器）
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

# 确保 curl 存在：部分精简系统镜像未预装，否则下面探测网络会误判为境外
if ! command -v curl >/dev/null 2>&1; then
  echo "==> 安装 curl"
  apt-get update -qq && apt-get install -y -qq curl ca-certificates
fi

# ---------- 0. 选择镜像源 ----------
if [ -z "${CN:-}" ]; then
  if curl -s -m 4 -o /dev/null https://mirrors.cloud.tencent.com; then CN=1; else CN=0; fi
fi
if [ "$CN" = "1" ]; then
  NPM_REGISTRY=https://registry.npmmirror.com
  PIP_INDEX_URL=https://mirrors.cloud.tencent.com/pypi/simple
  echo "==> 使用国内镜像源（npmmirror / 腾讯云 pypi）"
else
  NPM_REGISTRY=https://registry.npmjs.org
  PIP_INDEX_URL=https://pypi.org/simple
  echo "==> 使用官方镜像源"
fi

# ---------- 1. 安装 Docker ----------
echo "==> [1/5] 检查 Docker"
if ! command -v docker >/dev/null 2>&1; then
  echo "未检测到 Docker，开始安装..."
  if [ "$CN" = "1" ]; then
    # 境内走腾讯云 docker-ce 镜像源，避免 get.docker.com 超时
    . /etc/os-release
    apt-get update
    apt-get install -y ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL "https://mirrors.cloud.tencent.com/docker-ce/linux/${ID}/gpg" \
      | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://mirrors.cloud.tencent.com/docker-ce/linux/${ID} ${VERSION_CODENAME} stable" \
      > /etc/apt/sources.list.d/docker.list
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  else
    curl -fsSL https://get.docker.com | sh
  fi
  systemctl enable --now docker
else
  echo "Docker 已安装：$(docker --version)"
fi

# ---------- 2. 配置 Docker 镜像加速（境内拉取基础镜像必需） ----------
if [ "$CN" = "1" ] && [ ! -f /etc/docker/daemon.json ]; then
  echo "==> [2/5] 配置 Docker 镜像加速"
  mkdir -p /etc/docker
  cat > /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": ["https://mirror.ccs.tencentyun.com"]
}
EOF
  systemctl restart docker
  echo "已配置腾讯云镜像加速器"
else
  echo "==> [2/5] 跳过镜像加速配置"
fi

# ---------- 3. Swap（2G 内存机器构建前端时防 OOM） ----------
echo "==> [3/5] 准备 Swap"
if [ ! -f /swapfile ] && [ "$(id -u)" = "0" ]; then
  if fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none; then
    chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
    grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "已启用 2G Swap"
  else
    echo "无法创建 Swap（可忽略，继续尝试构建）"
  fi
else
  echo "Swap 已存在或跳过"
fi

# ---------- 4. 构建并启动 ----------
echo "==> [4/5] 构建镜像并启动容器（首次约 3-6 分钟）"
docker compose build \
  --build-arg NPM_REGISTRY="$NPM_REGISTRY" \
  --build-arg PIP_INDEX_URL="$PIP_INDEX_URL"
docker compose up -d

# ---------- 5. 健康检查 ----------
echo "==> [5/5] 等待健康检查通过"
for i in $(seq 1 40); do
  status="$(docker inspect -f '{{.State.Health.Status}}' ledger 2>/dev/null || echo missing)"
  if [ "$status" = "healthy" ]; then
    echo
    echo "服务已就绪："
    curl -s http://127.0.0.1:8000/health
    echo
    echo "本机验证：curl http://127.0.0.1:8000/health"
    echo "下一步：绑定域名（境内服务器需先完成 ICP 备案），配置 deploy/Caddyfile 后即可外网访问"
    echo "可选：开启代码自动更新（cron 每 5 分钟检查远端并自动重建），见 docs/DEPLOY.md"
    exit 0
  fi
  printf '.'
  sleep 3
done

echo
echo "健康检查超时，查看日志排查：docker compose logs -f"
exit 1
