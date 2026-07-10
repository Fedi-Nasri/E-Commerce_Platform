#!/usr/bin/env bash
# Verify all 1111-* containers are running and healthy.
# Usage: check-containers.sh [--strict]
set -euo pipefail

STRICT=false
if [[ "${1:-}" == "--strict" ]]; then
  STRICT=true
fi

DOCKER="docker"
if ! docker info >/dev/null 2>&1; then
  DOCKER="sudo docker"
fi

FAILED=0

curl_with_retries() {
  local url="$1"
  local attempts="${2:-1}"
  local delay="${3:-5}"
  local i

  for ((i = 1; i <= attempts; i++)); do
    if curl -fsS --max-time 10 "$url" >/dev/null 2>&1; then
      return 0
    fi
    if [[ "$i" -lt "$attempts" ]]; then
      sleep "$delay"
    fi
  done
  return 1
}

echo "=== Container status (1111-*) ==="
while IFS= read -r line; do
  name="${line%% *}"
  status="${line#* }"
  echo "$name: $status"

  if [[ "$status" != Up* ]]; then
    echo "  FAIL: container not running"
    FAILED=$((FAILED + 1))
    continue
  fi

  health="$($DOCKER inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$name" 2>/dev/null || echo unknown)"
  if [[ "$health" == "unhealthy" ]]; then
    echo "  FAIL: healthcheck unhealthy"
    FAILED=$((FAILED + 1))
  elif [[ "$health" == "healthy" ]]; then
    echo "  OK: healthy"
  else
    echo "  OK: running (no healthcheck)"
  fi
done < <($DOCKER ps -a --filter "name=1111-" --format '{{.Names}} {{.Status}}' | sort)

echo ""
echo "=== HTTP smoke checks ==="
CORE_URLS=(
  "http://127.0.0.1:3000/health"
  "http://127.0.0.1:3001/"
)

MONITORING_URLS=(
  "http://127.0.0.1:9090/-/healthy"
  "http://127.0.0.1:3030/api/health"
)

URLS=("${CORE_URLS[@]}")
if $DOCKER ps --filter "name=1111-prometheus" --format '{{.Names}}' | grep -q .; then
  URLS+=("${MONITORING_URLS[@]}")
fi

for url in "${URLS[@]}"; do
  attempts=1
  if [[ "$url" == http://127.0.0.1:9090* || "$url" == http://127.0.0.1:3030* ]]; then
    attempts=12
  fi

  if curl_with_retries "$url" "$attempts" 5; then
    echo "OK  $url"
  else
    echo "FAIL $url"
    FAILED=$((FAILED + 1))
  fi
done

if [[ "$FAILED" -gt 0 ]]; then
  echo ""
  echo "Container/smoke checks failed: $FAILED issue(s)"
  if [[ "$STRICT" == true ]]; then
    exit 1
  fi
  exit 0
fi

echo ""
echo "All checks passed."
