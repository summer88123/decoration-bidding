# Kubernetes 目录结构说明
# infra/k8s/
# ├── base/                    # 基础配置（所有环境共用）
# │   ├── namespace.yaml
# │   ├── gateway/
# │   ├── web/
# │   ├── user-service/
# │   ├── tender-service/
# │   ├── bid-service/
# │   ├── scraper-service/
# │   ├── ai-agent-service/
# │   ├── bim-service/
# │   ├── notify-service/
# │   └── voice-service/
# └── overlays/
#     ├── staging/             # Staging 环境覆盖
#     └── production/          # 生产环境覆盖
#
# 每个服务目录包含：
#   deployment.yaml
#   service.yaml
#   hpa.yaml (可选)
#
# 使用 Kustomize 管理多环境差异
