#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/1111}"
GITHUB_SHA="${GITHUB_SHA:?GITHUB_SHA is required}"
GHCR_PAT="${GHCR_PAT:?GHCR_PAT is required}"
GITHUB_ACTOR="${GITHUB_ACTOR:?GITHUB_ACTOR is required}"
IMAGE_PREFIX="${IMAGE_PREFIX:-ghcr.io/galylioai/1111}"
COMPOSE_FILES=(-f "${COMPOSE_FILE:-docker-compose.yml}")
COMPOSE_MONITORING=(-f docker-compose.monitoring.yml)
ENV_FILE=".env"

SERVICES=(
  gateway auth user retail para alimentation fashion
  mailer-api engagement web-control mailer frontend
)

echo "Starting deployment (commit: ${GITHUB_SHA})..."

echo "Checking host dependencies..."

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker not found. Installing..."
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
  echo "Docker installed. Group membership won't be active until a new SSH session."
else
  echo "Docker already present: $(docker --version)"
fi

if docker info >/dev/null 2>&1; then
  DOCKER="docker"
else
  echo "Using sudo for docker commands this run."
  DOCKER="sudo docker"
fi

if ! $DOCKER compose version >/dev/null 2>&1; then
  echo "Docker Compose plugin not found. Installing..."
  sudo apt-get update -y
  sudo apt-get install -y docker-compose-plugin
else
  echo "Docker Compose plugin already present: $($DOCKER compose version)"
fi

if ! command -v nginx >/dev/null 2>&1; then
  echo "Nginx not found. Installing..."
  sudo apt-get update -y
  sudo apt-get install -y nginx
  sudo systemctl enable nginx
else
  echo "Nginx already present: $(nginx -v 2>&1)"
fi

echo "Checking Docker storage backend (cAdvisor compatibility)..."
NEEDS_DOCKER_RESTART=false
DAEMON_JSON="/etc/docker/daemon.json"

if $DOCKER info --format '{{json .DriverStatus}}' 2>/dev/null | grep -q "io.containerd.snapshotter"; then
  echo "containerd-snapshotter is active — disabling for cAdvisor compatibility..."

  if ! command -v jq >/dev/null 2>&1; then
    sudo apt-get update -y
    sudo apt-get install -y jq
  fi

  if [ -f "$DAEMON_JSON" ]; then
    sudo cp "$DAEMON_JSON" "${DAEMON_JSON}.bak.$(date +%s)"
    EXISTING_JSON="$(sudo cat "$DAEMON_JSON")"
    if [ -z "$(echo "$EXISTING_JSON" | tr -d '[:space:]')" ]; then
      EXISTING_JSON="{}"
    fi
  else
    EXISTING_JSON="{}"
  fi

  MERGED_JSON="$(echo "$EXISTING_JSON" | jq '.features["containerd-snapshotter"] = false')"
  sudo mkdir -p "$(dirname "$DAEMON_JSON")"
  echo "$MERGED_JSON" | sudo tee "$DAEMON_JSON" >/dev/null
  NEEDS_DOCKER_RESTART=true
else
  echo "Docker storage backend already cAdvisor-compatible."
fi

if [[ "$NEEDS_DOCKER_RESTART" == true ]]; then
  echo "Restarting Docker..."
  sudo systemctl restart docker
  for attempt in {1..30}; do
    if docker info >/dev/null 2>&1; then
      break
    fi
    sleep 2
  done
  if docker info >/dev/null 2>&1; then
    DOCKER="docker"
  else
    DOCKER="sudo docker"
  fi
fi

if [ -e /etc/nginx/sites-enabled/default ]; then
  sudo rm -f /etc/nginx/sites-enabled/default
fi

mkdir -p "$APP_DIR/current"
cd "$APP_DIR/current"

if [ -f /tmp/docker-compose.yml ]; then
  install -m 0644 /tmp/docker-compose.yml "$APP_DIR/current/docker-compose.yml"
  rm -f /tmp/docker-compose.yml
fi

if [ -f /tmp/docker-compose.staging.yml ]; then
  install -m 0644 /tmp/docker-compose.staging.yml "$APP_DIR/current/docker-compose.staging.yml"
  rm -f /tmp/docker-compose.staging.yml
fi

if [ -f /tmp/docker-compose.prod.yml ]; then
  install -m 0644 /tmp/docker-compose.prod.yml "$APP_DIR/current/docker-compose.prod.yml"
  rm -f /tmp/docker-compose.prod.yml
fi

if [ -f /tmp/docker-compose.monitoring.yml ]; then
  install -m 0644 /tmp/docker-compose.monitoring.yml "$APP_DIR/current/docker-compose.monitoring.yml"
  rm -f /tmp/docker-compose.monitoring.yml
fi

if [ -d /tmp/deploy/monitoring ]; then
  mkdir -p "$APP_DIR/current/deploy/monitoring"
  cp -a /tmp/deploy/monitoring/. "$APP_DIR/current/deploy/monitoring/"
  rm -rf /tmp/deploy/monitoring
fi

if [ -f /tmp/check-containers.sh ]; then
  mkdir -p "$APP_DIR/current/deploy/scripts"
  install -m 0755 /tmp/check-containers.sh "$APP_DIR/current/deploy/scripts/check-containers.sh"
  rm -f /tmp/check-containers.sh
fi

if [ -e /etc/nginx/sites-enabled/1111.tn ] || [ -e /etc/nginx/sites-available/1111.tn ]; then
  echo "Removing stale legacy 1111.tn nginx site..."
  sudo rm -f /etc/nginx/sites-enabled/1111.tn
  sudo rm -f /etc/nginx/sites-available/1111.tn
fi

if [ -f /tmp/staging.1111.tn.conf ]; then
  sudo install -m 0644 /tmp/staging.1111.tn.conf /etc/nginx/sites-available/staging.1111.tn
  sudo ln -sfn /etc/nginx/sites-available/staging.1111.tn /etc/nginx/sites-enabled/staging.1111.tn
  rm -f /tmp/staging.1111.tn.conf
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE. The deploy workflow must write it before running this script."
  exit 1
fi
chmod 600 "$ENV_FILE"

# Check if this SHA is already deployed (skip if nothing changed)
CURRENT_SHA=$($DOCKER inspect --format='{{index .Config.Labels "org.opencontainers.image.revision"}}' "${IMAGE_PREFIX}-gateway:latest" 2>/dev/null || echo "none")
if [ "$CURRENT_SHA" = "$GITHUB_SHA" ]; then
  echo "Already running $GITHUB_SHA — skipping deploy"
  $DOCKER compose --env-file "$ENV_FILE" "${COMPOSE_FILES[@]}" ps
  exit 0
fi
echo "Current SHA: $CURRENT_SHA → Deploying: $GITHUB_SHA"

# Save previous SHA for rollback
if [ "$CURRENT_SHA" != "none" ] && [ "$CURRENT_SHA" != "$GITHUB_SHA" ]; then
  echo "$CURRENT_SHA" > "$APP_DIR/current/.previous-sha"
  echo "Saved previous SHA for rollback: $CURRENT_SHA"
fi

echo "Logging into GHCR..."
echo "$GHCR_PAT" | $DOCKER login ghcr.io -u "$GITHUB_ACTOR" --password-stdin

export TAG="latest"

# Only pull services that changed (or all if CHANGED_SERVICES=all/empty)
CHANGED_SERVICES="${CHANGED_SERVICES:-all}"
if [ "$CHANGED_SERVICES" = "all" ] || [ "$CHANGED_SERVICES" = "none" ]; then
  DEPLOY_SERVICES=("${SERVICES[@]}")
  echo "Deploying ALL services"
else
  IFS=',' read -ra DEPLOY_SERVICES <<< "$CHANGED_SERVICES"
  echo "Deploying only changed services: ${DEPLOY_SERVICES[*]}"
fi

# Pull images in parallel
echo "Pulling images (parallel)..."
for service in "${DEPLOY_SERVICES[@]}"; do
  (
    IMAGE_FULL_NAME="${IMAGE_PREFIX}-${service}:sha-${GITHUB_SHA}"
    echo "Pulling: $IMAGE_FULL_NAME"
    if $DOCKER pull "$IMAGE_FULL_NAME" 2>/dev/null; then
      $DOCKER tag "$IMAGE_FULL_NAME" "${IMAGE_PREFIX}-${service}:latest"
    else
      echo "WARNING: Could not pull $IMAGE_FULL_NAME — using existing :latest"
      exit 1
    fi
  ) &
done

PULL_RESULTS=()
for job in $(jobs -p); do
  wait "$job" && PULL_RESULTS+=("ok") || PULL_RESULTS+=("fail")
done

FAIL_COUNT=$(printf '%s\n' "${PULL_RESULTS[@]}" | grep -c "fail" || true)
if [ "$FAIL_COUNT" -gt 0 ]; then
  echo "WARNING: $FAIL_COUNT image pull(s) failed — those services will use existing :latest images"
fi
echo "Image pulls complete"

sudo nginx -t
sudo systemctl reload nginx

$DOCKER volume create backend_postgres_data >/dev/null || true
$DOCKER volume create 1111_retail_postgres_data >/dev/null || true
$DOCKER volume create 1111_para_postgres_data >/dev/null || true
$DOCKER volume create 1111_alimentation_postgres_data >/dev/null || true
$DOCKER volume create 1111_fashion_postgres_data >/dev/null || true
$DOCKER volume create 1111_catalog_postgres_data >/dev/null || true
$DOCKER volume create 1111_rabbitmq_data >/dev/null || true
$DOCKER volume create 1111_uploads >/dev/null || true

echo "Bringing up application stack..."
$DOCKER compose --env-file "$ENV_FILE" "${COMPOSE_FILES[@]}" up -d --remove-orphans

if [ -f "$APP_DIR/current/docker-compose.monitoring.yml" ]; then
  echo "Bringing up monitoring stack..."
  $DOCKER compose --env-file "$ENV_FILE" "${COMPOSE_MONITORING[@]}" up -d --remove-orphans

  MONITORING_READY=false
  for attempt in {1..36}; do
    PROMETHEUS_OK=false
    GRAFANA_OK=false
    curl -fsS http://127.0.0.1:9090/-/healthy >/dev/null 2>&1 && PROMETHEUS_OK=true
    curl -fsS http://127.0.0.1:3030/api/health >/dev/null 2>&1 && GRAFANA_OK=true
    if [[ "$PROMETHEUS_OK" == true && "$GRAFANA_OK" == true ]]; then
      MONITORING_READY=true
      break
    fi
    echo "Monitoring not ready (attempt $attempt/36)"
    sleep 5
  done

  if [[ "$MONITORING_READY" != true ]]; then
    echo "Monitoring stack failed to become ready."
    $DOCKER compose --env-file "$ENV_FILE" "${COMPOSE_MONITORING[@]}" ps
    $DOCKER compose --env-file "$ENV_FILE" "${COMPOSE_MONITORING[@]}" logs --tail=80 grafana prometheus
    exit 1
  fi
fi

WATCHDOG_SCRIPT="$APP_DIR/current/deploy/scripts/check-containers.sh"
WATCHDOG_CRON="*/5 * * * * /bin/bash $WATCHDOG_SCRIPT --strict >> /var/log/1111-container-watchdog.log 2>&1 # 1111-container-watchdog"
if [ -f "$WATCHDOG_SCRIPT" ]; then
  if ! crontab -l 2>/dev/null | grep -Fq '1111-container-watchdog'; then
    echo "Installing container watchdog cron job..."
    (crontab -l 2>/dev/null || true; echo "$WATCHDOG_CRON") | crontab -
  fi
fi

echo "Running health checks..."
HEALTH_OK=false
for attempt in {1..30}; do
  if curl -fsS http://127.0.0.1:3000/health >/dev/null 2>&1 && curl -fsS http://127.0.0.1:3001/ >/dev/null 2>&1; then
    echo "Health checks passed!"
    HEALTH_OK=true
    break
  fi
  echo "Health checks failed on attempt $attempt, retrying..."
  sleep 5
done

$DOCKER compose --env-file "$ENV_FILE" "${COMPOSE_FILES[@]}" ps

if [ "$HEALTH_OK" = true ]; then
  if [ -f "$WATCHDOG_SCRIPT" ]; then
    bash "$WATCHDOG_SCRIPT" --strict
  fi
  exit 0
else
  echo "WARNING: Some health checks failed. Services may still be starting."
  $DOCKER compose --env-file "$ENV_FILE" "${COMPOSE_FILES[@]}" logs --tail=120 \
    gateway frontend auth user retail para alimentation fashion mailer-api engagement web-control
  exit 0
fi
