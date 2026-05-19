#!/usr/bin/env bash
# dev.sh — 一键启动 / 停止所有开发服务
# 用法：
#   ./dev.sh start   启动所有服务（默认）
#   ./dev.sh stop    停止所有服务
#   ./dev.sh restart 重启所有服务
#   ./dev.sh logs    实时查看所有服务日志
#   ./dev.sh status  查看各服务健康状态

set -uo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
LOGS="$ROOT/logs"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[dev]${NC} $*"; }
warn()  { echo -e "${YELLOW}[dev]${NC} $*"; }

port_of() {
  case "$1" in
    web)              echo 3000 ;;
    core-service)     echo 8080 ;;
    ai-agent-service) echo 3005 ;;
    bim-service)      echo 3008 ;;
    *)                echo 0 ;;
  esac
}

stop_all() {
  info "停止所有服务..."

  # 1. 先 kill pnpm/npm 父进程（避免 watch 模式自动重启子进程）
  pkill -9 -f "pnpm.*dev" 2>/dev/null || true
  pkill -9 -f "npm.*dev"  2>/dev/null || true
  # 2. kill tsx / next 进程
  pkill -9 -f "tsx" 2>/dev/null || true
  pkill -9 -f "next" 2>/dev/null || true
  # 3. kill uvicorn（bim-service）
  pkill -9 -f "uvicorn" 2>/dev/null || true

  sleep 2

  # 4. 按端口兜底：kill 所有仍占用端口的进程（含子进程）
  for port in 3000 3005 3008 8080; do
    # lsof -ti 可能返回多个 PID（如父子进程），逐个 kill
    pids=$(lsof -ti ":$port" 2>/dev/null || true)
    if [[ -n "$pids" ]]; then
      warn "端口 $port 仍被占用 (PID $pids)，强制释放..."
      echo "$pids" | xargs kill -9 2>/dev/null || true
    fi
  done

  sleep 1
  info "全部服务已停止"
}

start_infra() {
  info "启动基础设施（postgres / redis / minio）..."
  # 移除无 compose 标签的孤立同名容器，避免 container_name 冲突
  for cname in db-postgres db-redis db-minio; do
    if docker inspect "$cname" &>/dev/null; then
      project_label=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$cname" 2>/dev/null || true)
      if [[ -z "$project_label" ]]; then
        warn "发现孤立容器 ${cname}（无 compose 标签），自动移除..."
        docker rm -f "${cname}" 2>/dev/null || true
      fi
    fi
  done
  docker compose -f "$ROOT/docker-compose.infra.yml" up -d --remove-orphans
  info "等待数据库就绪..."
  sleep 3
  # 初始化 schema 并写入演示种子数据
  (cd "$ROOT/packages/database" && pnpm db:push --skip-generate 2>&1 | tail -2) || true
  TSX=$(find "$ROOT" -path "*/node_modules/.bin/tsx" | head -1)
  if [[ -n "$TSX" ]]; then
    (cd "$ROOT/packages/database" && "$TSX" prisma/seed.ts 2>&1) || true
  fi
}

start_all() {
  start_infra
  mkdir -p "$LOGS"
  info "启动 web (port 3000)..."
  nohup pnpm --filter web dev > "$LOGS/web.log" 2>&1 &
  info "启动 core-service (port 8080)..."
  nohup pnpm --filter @decoration-bidding/core-service dev > "$LOGS/core-service.log" 2>&1 &
  info "启动 ai-agent-service (port 3005)..."
  nohup pnpm --filter ai-agent-service dev > "$LOGS/ai-agent-service.log" 2>&1 &
  info "启动 bim-service (port 3008)..."
  (cd "$ROOT/apps/bim-service" && nohup .venv/bin/uvicorn src.app:app \
    --host 0.0.0.0 --port 3008 --reload --log-level info \
    > "$LOGS/bim-service.log" 2>&1) &
  info "等待服务就绪..."
  sleep 8
  status_all
}

status_all() {
  echo ""
  echo "  服务健康状态："
  echo "  ─────────────────────────────────────────"
  for entry in \
    "web|http://localhost:3000" \
    "core-service|http://localhost:8080/health" \
    "ai-agent-service|http://localhost:3005/health" \
    "bim-service|http://localhost:3008/health"
  do
    name="${entry%%|*}"
    url="${entry##*|}"
    port=$(port_of "$name")
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "$url" 2>/dev/null || echo "000")
    if [[ "$code" == "200" ]]; then
      echo -e "  ${GREEN}✓${NC} $name (port $port)"
    else
      echo -e "  ${RED}✗${NC} $name (port $port) — HTTP $code"
    fi
  done
  echo "  ─────────────────────────────────────────"
  echo "  日志目录: $LOGS/"
  echo ""
}

show_logs() {
  info "实时查看所有服务日志（Ctrl+C 退出）..."
  tail -f \
    "$LOGS/web.log" \
    "$LOGS/core-service.log" \
    "$LOGS/ai-agent-service.log" \
    "$LOGS/bim-service.log" \
    2>/dev/null
}

CMD="${1:-start}"
case "$CMD" in
  start)   start_all ;;
  stop)    stop_all ;;
  restart) stop_all; sleep 1; start_all ;;
  logs)    show_logs ;;
  status)  status_all ;;
  *)
    echo "用法: $0 {start|stop|restart|logs|status}"
    exit 1
    ;;
esac
