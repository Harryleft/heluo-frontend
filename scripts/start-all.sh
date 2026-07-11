#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FIGURES_DIR="$(cd "$FRONTEND_DIR/../heluo-history-famous-figures" 2>/dev/null && pwd || true)"
PYTHON_BIN="${PYTHON_BIN:-python3}"
PY_VENV="$FRONTEND_DIR/server/embedding-service/.venv"
PIP="$PY_VENV/bin/pip"
PYTHON="$PY_VENV/bin/python"
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmmirror.com}"
PIP_INDEX_URL="${PIP_INDEX_URL:-https://pypi.tuna.tsinghua.edu.cn/simple}"
PIP_TRUSTED_HOST="${PIP_TRUSTED_HOST:-pypi.tuna.tsinghua.edu.cn}"
HF_ENDPOINT="${HF_ENDPOINT:-https://hf-mirror.com}"
PLAYWRIGHT_DOWNLOAD_HOST="${PLAYWRIGHT_DOWNLOAD_HOST:-https://npmmirror.com/mirrors/playwright}"
HTTP_PROXY="${HTTP_PROXY:-${http_proxy:-}}"
HTTPS_PROXY="${HTTPS_PROXY:-${https_proxy:-}}"
NO_PROXY="${NO_PROXY:-${no_proxy:-127.0.0.1,localhost}}"

INSTALL_DEPS=1
START_DOCKER=0
START_LLM=0
RUN_HEALTH=1
USE_MIRRORS=1
INSTALL_BROWSER=0

usage() {
  cat <<'EOF'
用法: scripts/start-all.sh [选项]

默认会安装依赖、生成本地配置，并启动后端、前端、Embedding 服务。

选项:
  --no-install       跳过依赖安装
  --no-mirror        不使用国内 npm/pip/HuggingFace/Playwright 镜像
  --with-browser     安装 Playwright Chromium 浏览器
  --with-docker      同时启动 heluo-history-famous-figures/docker-compose.yml
  --with-llm         同时启动本地 LLM 服务
  --no-health        跳过启动后的端到端健康检查
  -h, --help         显示帮助
EOF
}

for arg in "$@"; do
  case "$arg" in
    --no-install) INSTALL_DEPS=0 ;;
    --no-mirror) USE_MIRRORS=0 ;;
    --with-browser) INSTALL_BROWSER=1 ;;
    --with-docker) START_DOCKER=1 ;;
    --with-llm) START_LLM=1 ;;
    --no-health) RUN_HEALTH=0 ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "未知选项: $arg" >&2
      usage
      exit 1
      ;;
  esac
done

ensure_env() {
  if [[ ! -f "$FRONTEND_DIR/.env" ]]; then
    cp "$FRONTEND_DIR/.env.example" "$FRONTEND_DIR/.env"
    echo "已生成 .env"
  fi

  if [[ ! -f "$FRONTEND_DIR/server/.env" ]]; then
    cp "$FRONTEND_DIR/.env.example" "$FRONTEND_DIR/server/.env"
    echo "已生成 server/.env"
  fi
}

load_local_env() {
  set -a
  # shellcheck disable=SC1091
  source "$FRONTEND_DIR/.env"
  set +a
}

setup_mirrors() {
  if [[ "$USE_MIRRORS" != "1" ]]; then
    return
  fi
  export npm_config_registry="$NPM_REGISTRY"
  export PIP_INDEX_URL
  export PIP_TRUSTED_HOST
  export HF_ENDPOINT
  export PLAYWRIGHT_DOWNLOAD_HOST
  echo "使用国内镜像: npm=$NPM_REGISTRY, pip=$PIP_INDEX_URL, HF_ENDPOINT=$HF_ENDPOINT"
}

setup_proxy() {
  if [[ -z "$HTTP_PROXY" && -z "$HTTPS_PROXY" ]]; then
    return
  fi
  export http_proxy="${HTTP_PROXY:-$HTTPS_PROXY}"
  export https_proxy="${HTTPS_PROXY:-$HTTP_PROXY}"
  export HTTP_PROXY="$http_proxy"
  export HTTPS_PROXY="$https_proxy"
  export no_proxy="$NO_PROXY"
  export NO_PROXY="$NO_PROXY"
  export npm_config_proxy="$http_proxy"
  export npm_config_https_proxy="$https_proxy"
  echo "使用代理: http_proxy=$http_proxy, https_proxy=$https_proxy"
}

install_deps() {
  echo "安装 Node 依赖..."
  cd "$FRONTEND_DIR"
  if [[ -f package-lock.json ]]; then
    npm ci
  else
    npm install
  fi

  if [[ "$INSTALL_BROWSER" == "1" ]]; then
    echo "安装 Playwright Chromium..."
    npx -y playwright@latest install chromium
  fi

  echo "安装 Python 依赖..."
  if [[ ! -x "$PYTHON" ]]; then
    "$PYTHON_BIN" -m venv "$PY_VENV"
  fi
  "$PIP" install --upgrade pip
  "$PIP" install -r "$FRONTEND_DIR/server/embedding-service/requirements.txt"
}

start_docker() {
  if [[ "$START_DOCKER" != "1" ]]; then
    return
  fi
  if [[ -z "$FIGURES_DIR" || ! -f "$FIGURES_DIR/docker-compose.yml" ]]; then
    echo "未找到 heluo-history-famous-figures/docker-compose.yml，跳过 Docker。"
    return
  fi
  echo "启动 Docker 服务..."
  docker compose -f "$FIGURES_DIR/docker-compose.yml" pull --ignore-buildable || true
  docker compose -f "$FIGURES_DIR/docker-compose.yml" up -d
}

preflight_check() {
  command -v node >/dev/null || { echo "缺少 node" >&2; exit 1; }
  command -v npm >/dev/null || { echo "缺少 npm" >&2; exit 1; }
  "$PYTHON_BIN" --version >/dev/null || { echo "缺少 python" >&2; exit 1; }

  if [[ "$INSTALL_DEPS" == "0" ]]; then
    [[ -x "$FRONTEND_DIR/node_modules/.bin/concurrently" ]] || {
      echo "Node 依赖未安装，请先运行 npm run bootstrap" >&2
      exit 1
    }
    [[ -x "$PYTHON" ]] || {
      echo "Embedding Python 环境未安装，请先运行 npm run bootstrap" >&2
      exit 1
    }
  fi
}

ensure_env
load_local_env
setup_mirrors
setup_proxy
preflight_check

if [[ "$INSTALL_DEPS" == "1" ]]; then
  install_deps
fi

start_docker

commands=(
  "npm run dev:server"
  "npm run dev:frontend"
  "npm run dev:embedding"
)
names="server,frontend,embedding"
colors="blue,green,yellow"

if [[ "$START_LLM" == "1" ]]; then
  commands+=("npm run dev:llm")
  names="$names,llm"
  colors="$colors,magenta"
fi

echo "启动服务..."
cd "$FRONTEND_DIR"
npx concurrently -n "$names" -c "$colors" "${commands[@]}" &
SERVICE_PID=$!

cleanup() {
  if kill -0 "$SERVICE_PID" 2>/dev/null; then
    kill "$SERVICE_PID" 2>/dev/null || true
    wait "$SERVICE_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT
trap 'cleanup; exit 130' INT
trap 'cleanup; exit 143' TERM

if [[ "$RUN_HEALTH" == "1" ]]; then
  echo "等待全部服务通过端到端健康检查..."
  SMOKE_RETRIES="${SMOKE_RETRIES:-60}" \
  SMOKE_RETRY_DELAY_MS="${SMOKE_RETRY_DELAY_MS:-5000}" \
    node "$FRONTEND_DIR/scripts/smoke-check.mjs"
  echo "服务已就绪: http://127.0.0.1:3000"
fi

if wait "$SERVICE_PID"; then
  SERVICE_STATUS=0
else
  SERVICE_STATUS=$?
fi
trap - EXIT INT TERM
exit "$SERVICE_STATUS"
