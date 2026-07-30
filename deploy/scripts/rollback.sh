#!/usr/bin/env bash
# Rollback deployment to the previous SHA saved by deploy-ghcr.sh
# Usage: bash rollback.sh [services...]
#   CHANGED_SERVICES=gateway,auth ./rollback.sh  (rollback specific services)
#   ./rollback.sh                                 (rollback all)
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/1111}"
ENV_FILE="$APP_DIR/current/.env"

# Source .env if it exists to get GHCR_PAT, GITHUB_ACTOR, IMAGE_PREFIX
if [ -f "$ENV_FILE" ]; then
  set -o allexport
  source "$ENV_FILE"
  set +o allexport
fi

GHCR_PAT="${GHCR_PAT:?GHCR_PAT is required (set in .env or as env var)}"
GITHUB_ACTOR="${GITHUB_ACTOR:?GITHUB_ACTOR is required (set in .env or as env var)}"
IMAGE_PREFIX="${IMAGE_PREFIX:-ghcr.io/galylioai/1111}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.staging.yml}"

SERVICES=(
  gateway auth user retail para alimentation fashion
  mailer-api engagement web-control mailer frontend
)

if [ ! -f "$APP_DIR/current/.previous-sha" ]; then
  echo "ERROR: No .previous-sha found at $APP_DIR/current/.previous-sha"
  echo "Nothing to rollback to. A deploy must complete first."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  DOCKER="sudo docker"
else
  DOCKER="docker"
fi

PREVIOUS_SHA=$(cat "$APP_DIR/current/.previous-sha")
echo "========================================"
echo "Rolling back to SHA: $PREVIOUS_SHA"
echo "========================================"

cd "$APP_DIR/current"

echo "Logging into GHCR..."
echo "$GHCR_PAT" | $DOCKER login ghcr.io -u "$GITHUB_ACTOR" --password-stdin

# Save current SHA as another rollback point (so you can revert the rollback)
CURRENT_SHA=$($DOCKER inspect --format='{{index .Config.Labels "org.opencontainers.image.revision"}}' "${IMAGE_PREFIX}-gateway:latest" 2>/dev/null || echo "none")
if [ "$CURRENT_SHA" != "none" ] && [ "$CURRENT_SHA" != "$PREVIOUS_SHA" ]; then
  echo "$CURRENT_SHA" > "$APP_DIR/current/.rollback-sha"
  echo "Saved current SHA for re-rollback: $CURRENT_SHA"
fi

# Only pull services that changed (or all)
CHANGED_SERVICES="${CHANGED_SERVICES:-all}"
if [ "$CHANGED_SERVICES" = "all" ]; then
  DEPLOY_SERVICES=("${SERVICES[@]}")
  echo "Rolling back ALL services"
else
  IFS=',' read -ra DEPLOY_SERVICES <<< "$CHANGED_SERVICES"
  echo "Rolling back only: ${DEPLOY_SERVICES[*]}"
fi

# Pull images in parallel
echo "Pulling previous images in parallel..."
for service in "${DEPLOY_SERVICES[@]}"; do
  (
    IMAGE="${IMAGE_PREFIX}-${service}:sha-${PREVIOUS_SHA}"
    echo "Pulling: $IMAGE"
    if $DOCKER pull "$IMAGE" 2>/dev/null; then
      $DOCKER tag "$IMAGE" "${IMAGE_PREFIX}-${service}:latest"
      echo "  OK: $service → sha-${PREVIOUS_SHA}"
    else
      echo "  WARN: sha-${PREVIOUS_SHA} not found for $service — keeping existing :latest"
    fi
  ) &
done
wait
echo "Image pulls complete"

# Update .previous-sha to this SHA so another rollback can happen
echo "$PREVIOUS_SHA" > "$APP_DIR/current/.previous-sha"

echo "Restarting application stack..."
$DOCKER compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --remove-orphans

echo "Running health checks..."
HEALTH_OK=false
for attempt in {1..30}; do
  if curl -fsS http://127.0.0.1:3000/health >/dev/null 2>&1 && curl -fsS http://127.0.0.1:3001/ >/dev/null 2>&1; then
    echo "Health checks passed!"
    HEALTH_OK=true
    break
  fi
  echo "Health check attempt $attempt/30..."
  sleep 5
done

$DOCKER compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

if [ "$HEALTH_OK" = true ]; then
  echo "========================================"
  echo "Rollback to $PREVIOUS_SHA completed successfully."
  echo "========================================"
  exit 0
else
  echo "========================================"
  echo "WARNING: Health checks failed after rollback."
  echo "Services may still be starting. Run check-containers.sh for details."
  echo "To revert: bash deploy/scripts/rollback.sh"
  echo "========================================"
  exit 0
fi
