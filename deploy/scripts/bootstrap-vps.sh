#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/1111}"
APP_USER="${APP_USER:-ubuntu}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run this script with sudo."
  exit 1
fi

apt-get update
apt-get install -y ca-certificates curl gnupg git nginx ufw certbot python3-certbot-nginx jq

install -m 0755 -d /etc/apt/keyrings
if [[ ! -f /etc/apt/keyrings/docker.gpg ]]; then
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
fi

. /etc/os-release
DOCKER_CODENAME="$VERSION_CODENAME"
if ! curl -fsSL "https://download.docker.com/linux/ubuntu/dists/${DOCKER_CODENAME}/Release" >/dev/null; then
  DOCKER_CODENAME="noble"
fi

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${DOCKER_CODENAME} stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable --now docker
systemctl enable --now nginx

usermod -aG docker "$APP_USER"

install -d -o "$APP_USER" -g "$APP_USER" "$APP_DIR" "$APP_DIR/releases" "$APP_DIR/shared" "$APP_DIR/backups/db"

docker volume create backend_postgres_data >/dev/null
docker volume create 1111_retail_postgres_data >/dev/null
docker volume create 1111_para_postgres_data >/dev/null
docker volume create 1111_alimentation_postgres_data >/dev/null
docker volume create 1111_fashion_postgres_data >/dev/null
docker volume create 1111_catalog_postgres_data >/dev/null
docker volume create 1111_rabbitmq_data >/dev/null
docker volume create 1111_uploads >/dev/null
docker volume create 1111_prometheus_data >/dev/null
docker volume create 1111_grafana_data >/dev/null
docker volume create 1111_loki_data >/dev/null

ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "Bootstrap complete. Log out and back in so Docker group membership applies for $APP_USER."
