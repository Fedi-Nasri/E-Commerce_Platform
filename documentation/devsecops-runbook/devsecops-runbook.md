# 1111.tn — DevSecOps Runbook

**Platform:** 1111.tn — Tunisian price-intelligence platform (parapharmacy, supermarket, retail)
**Audience:** DevSecOps intern (day 1) and on-call engineer (under pressure)
**Repository:** `GalylioAI/1111_Summer_Internship` (origin) / `Galylio-ai/1111` (upstream)
**Branch:** `ci-workflow-update`

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Health & Monitoring](#2-health--monitoring-operations)
3. [Deployment & Rollback](#3-deployment--rollback-release)
4. [Backup & Disaster Recovery](#4-backup--disaster-recovery)
5. [Security Scans — Operating & Triage](#5-security-scans--operating--triage)
6. [Incident Response Playbook](#6-incident-response-playbook)
7. [Secrets Management](#7-secrets-management)



---

## 1. System Overview

### 1.1 What it is

1111.tn scrapes and compares prices across Tunisian parapharmacy, supermarket, and retail sites, and shows rankings, categories, and best deals to consumers (bilingual FR/AR, dark mode).

### 1.2 Architecture summary

```
                    ┌──────────────────────────────┐
                    │         Nginx (:80, :8081-8085)│
                    │   :80    → Frontend (3001)     │
                    │   :8081  → Gateway  (3000)     │
                    │   :8082  → Grafana  (3030)     │
                    │   :8083  → Prometheus (9090)   │
                    │   :8084  → SonarQube (9000)    │
                    │   :8085  → MCP server (3010)   │
                    └──────────┬───────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                 ▼
        Frontend          Gateway           Monitoring stack
     (Next.js :3001)   (Express :3000)    (Prometheus/Grafana/Loki/…)
                               │
              ┌─────┬─────┬────┴───┬─────┬─────┬─────┬─────┐
              ▼     ▼     ▼        ▼     ▼     ▼     ▼     ▼
            auth  user  retail   para  alim  mailer fashion engag. web-ctrl
                               │
                   6 x PostgreSQL 16 + RabbitMQ
```

The gateway (port 3000) is the single API entrypoint and proxies to the 9 other backend services by container name over the internal Docker network — it does not use published host ports for that internal traffic.

#### Monitoring stack — services inside it

The monitoring stack (`docker-compose.monitoring.yml`) joins the app's `1111` network and runs **13 containers** alongside the application:

| Container | Image | Published port | Role |
|---|---|---|---|
| `1111-prometheus` | prom/prometheus:v2.53.0 | `127.0.0.1:9090` | Metrics TSDB + alerting. Scrapes every exporter below + all service scrape jobs. Alert rules in `deploy/monitoring/alert-rules.yml`. |
| `1111-grafana` | grafana/grafana:11.1.0 | `127.0.0.1:3030` | Dashboards UI (6 dashboards). Read via Nginx `:8082`. |
| `1111-loki` | grafana/loki:3.7.3 | `127.0.0.1:3100` | Log aggregation store (TSDB v13). |
| `1111-promtail` | grafana/promtail:2.9.1 | — (internal) | Log agent — auto-discovers all Docker containers on the host and ships their `json-file` logs to Loki `:3100`. |
| `1111-node-exporter` | prom/node-exporter:v1.8.2 | — (host network) | Host-level metrics: CPU, memory, disk, network. |
| `1111-cadvisor` | gcr.io/cadvisor/cadvisor:v0.49.1 | `127.0.0.1:8080` | Per-container CPU/memory/restart/IO metrics. |
| `1111-blackbox-exporter` | prom/blackbox-exporter:v0.25.0 | `9115` (internal) | HTTP/HTTPS probes against the 11 service endpoints (10 backend + frontend) → `probe_success`. |
| `1111-postgres-exporter` | prometheuscommunity/postgres-exporter:v0.15.0 | `9187` (internal) | Main shared DB metrics. |
| `1111-retail-postgres-exporter` | prometheuscommunity/postgres-exporter:v0.15.0 | `9187` (internal) | Retail catalog DB metrics. |
| `1111-para-postgres-exporter` | prometheuscommunity/postgres-exporter:v0.15.0 | `9187` (internal) | Para catalog DB metrics. |
| `1111-alimentation-postgres-exporter` | prometheuscommunity/postgres-exporter:v0.15.0 | `9187` (internal) | Alimentation catalog DB metrics. |
| `1111-fashion-postgres-exporter` | prometheuscommunity/postgres-exporter:v0.15.0 | `9187` (internal) | Fashion catalog DB metrics. |
| `1111-catalog-postgres-exporter` | prometheuscommunity/postgres-exporter:v0.15.0 | `9187` (internal) | Catalog DB metrics (service on `catalog-postgres`). |

**Data flow:** containers write JSON logs → Promtail scrapes Docker sockets → ships to Loki → Grafana renders. Exporters + cAdvisor + node_exporter + blackbox → Prometheus (`:9090`) → Grafana.

#### SonarQube stack (separate compose file)

| Container | Image | Published port | Role |
|---|---|---|---|
| `1111-sonarqube` | sonarqube:26.6.0.123539-community | `127.0.0.1:9000` | SAST/SCA server. Read via Nginx `:8084`. |
| `1111-sonarqube-db` | postgres:16-alpine | `5432` (internal) | SonarQube's own database. |
| `1111-sonarqube-mcp` | sonarsource/sonarqube-mcp | `127.0.0.1:3010` | MCP server for AI tooling. Read via Nginx `:8085`. |

### 1.3 Key ports

Resolved from the **live staging host** (`docker ps` on 2026-08-03) + the active Nginx config (`/etc/nginx/sites-available/staging.1111.tn`). This replaces all earlier `[VERIFY]`/`[MISSING]` markers in this table.

#### Public entry — Nginx (host)

| Host port | Proxies to | Purpose |
|---|---|---|
| 80 (default_server) | `127.0.0.1:3001` | Frontend (Next.js) |
| 8081 | `127.0.0.1:3000` | Gateway / backend API |
| 8082 | `127.0.0.1:3030` | Grafana UI |
| 8083 | `127.0.0.1:9090` | Prometheus UI |
| 8084 | `127.0.0.1:9000` | SonarQube UI |
| 8085 | `127.0.0.1:3010` | SonarQube MCP server |

> Note: only port 80 (HTTP) is configured — there is no `:443`/TLS virtual host yet (SSL cert setup is still Pending in the backlog). UFW allows 22/80/443; the 8081–8085 ports are reachable by whatever the host firewall permits.

#### Backend services (internal `1111` network)

| Container | Published port | Host-visible? |
|---|---|---|
| `1111-gateway` | `127.0.0.1:3000` | Yes — reachable at `:8081` |
| `1111-frontend` | `127.0.0.1:3001` | Yes — reachable at `:80` |
| `1111-auth` | `3001` | Internal only (same numeric port as frontend, but **not published to host** — separate containers on the Docker network, so no conflict) |
| `1111-user` | `3002` | Internal only |
| `1111-retail` | `3003` | Internal only |
| `1111-para` | `3004` | Internal only |
| `1111-alimentation` | `3005` | Internal only |
| `1111-mailer-api` | `3006` | Internal only |
| `1111-fashion` | `3007` | Internal only |
| `1111-engagement` | `3008` | Internal only |
| `1111-web-control` | `3009` | Internal only |
| `1111-mailer` | — | Internal consumer, no exposed port |

#### Data layer (internal)

| Container(s) | Port | Notes |
|---|---|---|
| `1111-postgres`, `1111-retail-postgres`, `1111-para-postgres`, `1111-alimentation-postgres`, `1111-fashion-postgres`, `1111-catalog-postgres` | `5432` | 6× PostgreSQL 16.3 — internal only |
| `1111-rabbitmq` | `15672` (mgmt UI, `127.0.0.1`), `15692` (Prometheus metrics, `127.0.0.1`), `5672` AMQP internal | Internal only |
| `1111-token-cleanup` | `5432` | Uses the `postgres:16.3` image as a cron-like job (`while true` loop running `auth.purge_expired_tokens()`), not a server |

#### Monitoring (see §1.2 table above for roles)

| Container | Published port | Host-visible? | username/pass |
|---|---|---|---|
| `1111-prometheus` | `127.0.0.1:9090` | Yes — `:8083` | 
| `1111-grafana` | `127.0.0.1:3030` | Yes — `:8082` | admin/admin|
| `1111-loki` | `127.0.0.1:3100` | Internal |
| `1111-cadvisor` | `127.0.0.1:8080` | Internal |
| 6× `*-postgres-exporter` | `9187` | Internal |
| `1111-blackbox-exporter` | `9115` | Internal |
| `1111-promtail` | — | Internal |
| `1111-node-exporter` | — (host network) | Host |

#### SonarQube stack

| Container | Published port | Host-visible? | username/pass |
|---|---|---|---|
| `1111-sonarqube` | `127.0.0.1:9000` | Yes — `:8084` | admin/Sonarqube@123|
| `1111-sonarqube-mcp` | `127.0.0.1:3010` | Yes — `:8085` |
| `1111-sonarqube-db` | `5432` | Internal |

### 1.4 Environment map

| Environment | Compose file | Where it runs |
|---|---|---|
| Local dev | `docker-compose.yml` | Developer machine, 20 services |
| Staging | `docker-compose.staging.yml` | Staging host, 20 app containers |
| Production | `docker-compose.prod.yml` | **Not yet deployed** — blocked, see §9 |
| Monitoring | `docker-compose.monitoring.yml` | Staging host, 13 containers |
| SonarQube | `docker-compose.sonarqube.yml` | Staging host, 3 containers |

**Networks:**
- `1111` — the app network (services, DBs, RabbitMQ).
- The monitoring stack joins `1111` externally via the `external: true` reference in `docker-compose.monitoring.yml` — confirmed on staging 2026-08-03; there is **no** separate `1111-monitoring` network.

**How components connect:**
- Nginx (host) → frontend on port 80, gateway on 8081 (see §1.3 for the full map).
- Gateway → each of the 9 backend services by container DNS name, over `1111` network.
- Promtail → Loki: Promtail auto-discovers all Docker containers and ships their logs to Loki (`:3100`).
- Postgres exporters (x6) → Prometheus (`:9090`) via scrape jobs `postgres`, `postgres_retail`, `postgres_para`, `postgres_alimentation`, `postgres_fashion`, `postgres_catalog`.
- Blackbox exporter → Prometheus: HTTP probes against all 11 service endpoints (10 backend + frontend).
- cAdvisor → Prometheus: per-container CPU/memory/restart metrics.
- Prometheus → Grafana: 6 dashboards render off these Prometheus + Loki data sources.

---

## 2. Health & Monitoring (Operations)

### 2.1 Run the container health check

Run from the deploy directory on the host (staging server has it at `/opt/1111/current/deploy/scripts/`):

```bash
cd deploy/scripts && ./check-containers.sh
```

The script reports two things — **container status** (all containers named `1111-*`/`1111*`) then **HTTP smoke checks**, and finishes with a pass/fail summary line. Output format, confirmed on staging **2026-08-03**:

```text
=== Container status (1111-*) ===
1111-gateway: Up 4 days (healthy)
  OK: healthy
1111-frontend: Up 4 days (unhealthy)
  FAIL: healthcheck unhealthy
1111-loki: Up 4 days
  OK: running (no healthcheck)
...
=== HTTP smoke checks ===
OK  http://127.0.0.1:3000/health
OK  http://127.0.0.1:3001/
OK  http://127.0.0.1:9090/-/healthy
OK  http://127.0.0.1:3030/api/health
Container/smoke checks failed: N issue(s)
```

How to read it:
- `healthy` status line → container has a working healthcheck → command prints `OK: healthy`.
- container line **with no status** (e.g. `1111-loki: Up 4 days`) → container has **no healthcheck defined** → prints `OK: running (no healthcheck)`. These are expected for image/service types that don't define one (leaves the `0` bucket; a `no healthcheck` line is **not** an alarm by itself).
- `(unhealthy)` → prints **`FAIL: healthcheck unhealthy`** and counts toward the failure total.
- Exit: the script prints `Container/smoke checks failed: N issue(s)` and returns non-zero if `N > 0`.

> Gotcha: a `FAIL: healthcheck unhealthy` (internal Docker healthcheck failing) can still co-exist with an `OK` HTTP smoke check on the same port — the healthcheck probes a specific internal path while the smoke check just hits the service's root. Judge by the `FAIL` line, not the smoke check.

### 2.2 What a healthy state looks like

- **Staging:** 36 containers total, confirmed by `check-containers.sh` on the host 2026-08-03:
  - **App stack (20):** `frontend`, `gateway`, `auth`, `user`, `retail`, `para`, `alimentation`, `mailer-api`, `fashion`, `engagement`, `web-control`, `mailer`, `token-cleanup`, 6× postgres, `rabbitmq`
  - **Monitoring (13):** `prometheus`, `grafana`, `loki`, `promtail`, `node-exporter`, `cadvisor`, `blackbox-exporter`, 6× postgres-exporter
  - **SonarQube (3):** `sonarqube`, `sonarqube-db`, `sonarqube-mcp`
- Healthy = every container that has a healthcheck reports `Up X days (healthy)` and the smoke checks all pass; containers without healthchecks report `running (no healthcheck)` and are checked via the HTTP smoke tests instead.
- All 11 blackbox probe targets (gateway, auth, user, retail, para, alimentation, mailer-api, fashion, engagement, web-control, frontend) return `probe_success 1` in Prometheus.
- Grafana dashboards show non-empty panels (Loki panels specifically were empty until Promtail was fixed on 2026-07-23 — if they go empty again, treat as an incident, see §6.9).

> **Live note (2026-08-03, confirmed by `check-containers.sh`):** `1111-frontend` reports **`(unhealthy)` → `FAIL: healthcheck unhealthy`**, while HTTP smoke check on `:3001` still passes. So the app serves traffic but the container's own Docker healthcheck path is failing — a real config/health-check-probe issue, not a total outage. Investigate the frontend `healthcheck` command/path (see §6.8); track as SEV3 until the healthcheck reports healthy.

### 2.3 Manual health verification commands

```bash
# Container status (preferred entry point — used by the script, category-separated)
docker compose -f docker-compose.staging.yml ps

# The 4 HTTP smoke endpoints the script checks (confirmed 2026-08-03)
curl -i http://localhost:3000/health          # gateway — path confirmed: /health
curl -i http://localhost:3001/                # frontend
curl -i http://localhost:9090/-/healthy        # prometheus
curl -i http://localhost:3030/api/health       # grafana

# Individual service logs
docker compose -f docker-compose.staging.yml logs -f <service_name>

# Monitoring stack status
docker compose -f docker-compose.monitoring.yml ps

# Prometheus targets (should all show "up")
curl -s http://localhost:9090/api/v1/targets | grep -o '"health":"[a-z]*"' | sort | uniq -c

# Loki is receiving logs (should return recent log lines, not empty)
curl -s "http://localhost:3100/loki/api/v1/query_range?query={job=%22docker%22}&limit=5"
```

### 2.4 Grafana dashboards

| Dashboard | Data source | What to look for |
|---|---|---|
| node-exporter-full | Prometheus | Host CPU/memory/disk — watch for disk approaching 80%+ used |
| postgresql-database | Prometheus | Per-DB connections, query rate, replication lag if any |
| docker-monitoring | Prometheus | Container CPU/memory/restart counts |
| rabbitmq-overview | Prometheus | Queue depth, message rates — backlog = mailer/token-cleanup problem |
| loki-application-logs | Loki | Full log stream from all containers |
| loki-application-logs-simple | Loki | Simplified/filtered log view |

### 2.5 Alert rules

Defined in `deploy/monitoring/alert-rules.yml` . Table reflects the **actual** rules in that file:

| Alert | Condition | Severity | What it means |
|---|---|---|---|
| ServiceDown | `probe_success == 0` for 2 min | critical | One of the 11 blackbox targets is unreachable — see §6.1/§6.2 |
| ContainerHighRestartRate | `increase(container_start_time_seconds[15m]) > 3` for 5 min | warning | A container is crash-looping — see §6.1 |
| HostHighCpu | CPU >85% for 10 min | warning | Check `docker stats`, look for a runaway process or traffic spike |
| HostDiskAlmostFull | Disk free <20% for 10 min | warning | Likely logs — see §6.6 |
| RabbitMQQueueBacklog | `rabbitmq_queue_messages > 100` for 5 min | warning | Mailer consumer stalled or DB down — see §6.4 |

`[MISSING]`: Alertmanager routing (e.g. to Google Chat) is **not yet configured** — see blocker in §9. Until it is, these alerts are only visible by manually checking Grafana/Prometheus, not pushed anywhere.

---

## 3. Deployment & Rollback (Release)

### 3.1 Normal deploy procedure (staging)

1. Push to the `ci-workflow-update` branch (or open a PR to `develop`) — this triggers `demo-ci.yml` on `push: ci-workflow-update` / `pull_request: develop`. Note: only the **changed** services are built (see `detect-changes` path filters).
2. Watch the 6 CI jobs go green: `detect-changes → backend-tests → backend-quality → frontend-quality → docker-build → security-scan`.
   ```bash
   gh run watch
   ```
3. CI's `docker-build` job pushes **only the changed** images to GHCR (`ghcr.io/galylioai/1111-*`) with two tags: `:latest` **and** `:sha-<commit>` (both tags pushed, build-push-action). The list of changed services is produced and uploaded as the `changed-services` artifact by the **`detect-changes`** job (not docker-build). The `backend-tests` job only type-checks (the actual `npm test` step is **commented out** in CI — see note below).
4. Trigger the CD workflow (staging auto-deploy is configured, or dispatch manually):
   ```bash
   gh workflow run demo-cd.yml
   ```
5. `demo-cd.yml` runs `deploy/scripts/deploy-ghcr.sh` on the host over **Tailscale SSH** (`TS_SERVER_IP`), which:
   - writes the `STAGING_ENV_FILE` secret to `.env`
   - reads the `changed-services` artifact and pulls **only** those images in parallel
   - skips the deploy entirely if the target SHA is already running (checks the `org.opencontainers.image.revision` container label)
   - saves the current SHA to `.previous-sha` **before** switching over (this is what rollback reads)
   - installs/refreshes compose + monitoring config files and the Nginx site config (`staging.1111.tn.conf`) at `$APP_DIR/current` and `/etc/nginx/`
   - runs `docker compose --env-file .env -f docker-compose.staging.yml up -d --remove-orphans`
   - brings up `docker-compose.monitoring.yml`, waits for Prometheus (`/-/healthy`) + Grafana (`/api/health`)
   - installs/refreshes the container-watchdog cron entry (`*/5 * * * * ... check-containers.sh --strict`)
   - runs a health check on gateway + frontend (curl loops; **warns and dumps logs on failure — does not hard-fail the deploy**, exit code is still 0); on success also runs `check-containers.sh --strict`
6. Verify manually:
   ```bash
   docker compose -f docker-compose.staging.yml ps
   curl -i http://localhost:3000/health   # path confirmed: /health
   curl -i http://localhost:3001/
   ```
   - [ ] All expected containers `Up`
   - [ ] Gateway and frontend return 2xx
   - [ ] Grafana `docker-monitoring` dashboard shows no restart spike in the last 5 min

### 3.2 Rollback procedure

`deploy/scripts/rollback.sh` reads `.previous-sha` (written by `deploy-ghcr.sh` on the prior deploy), pulls the previous images from GHCR, retags them `:latest`, and restarts containers.

```bash
bash deploy/scripts/rollback.sh
```

Expected behavior:
- If an image for the previous SHA doesn't exist in GHCR, the script warns **"WARN: sha-<SHA> not found for <service> — keeping existing :latest"** and keeps the existing image rather than failing hard (confirmed in `rollback.sh`).
- On success it writes `.rollback-sha` (the pre-rollback SHA), which allows re-rolling forward/back.
- After rollback, `.previous-sha` is rewritten to the rolled-back SHA so a subsequent rollback call still has a valid reference (note: this means it points at the same SHA you just rolled back **to** — to re-deploy the pre-rollback image you'd use the SHA saved in `.rollback-sha`, not `.previous-sha`).

Success criteria:
- [ ] `docker compose -f docker-compose.staging.yml ps` shows all containers `Up` on the previous image tags
- [ ] `docker inspect <container> --format '{{index .Config.Labels "org.opencontainers.image.revision"}}'` matches the SHA in `.previous-sha`
- [ ] Gateway + frontend health checks return 2xx

### 3.3 If a deploy fails mid-way

1. Check which containers restarted vs. which are still on old images:
   ```bash
   docker compose -f docker-compose.staging.yml ps
   docker inspect <container> --format '{{index .Config.Labels "org.opencontainers.image.revision"}}'
   ```
2. If only some services updated (version skew), do **not** leave it half-deployed — either finish the deploy (`bash deploy/scripts/deploy-ghcr.sh` again) or roll everything back (`bash deploy/scripts/rollback.sh`).
3. Check logs on any unhealthy service:
   ```bash
   docker compose -f docker-compose.staging.yml logs --tail=200 <service>
   ```
4. If a specific service image is broken (crash-looping on the new tag), roll back just that decision by re-running deploy after CI produces a fixed image, or roll back the whole stack if time is short.

### 3.4 If rollback itself fails

1. Check `.previous-sha` exists and is a valid, non-empty SHA:
   ```bash
   cat /opt/1111/current/.previous-sha      # = $APP_DIR/current/.previous-sha (confirmed)
   ```
2. Manually pull and tag the last known-good SHA from GHCR:
   ```bash
   docker pull ghcr.io/galylioai/1111-<service>:sha-<KNOWN_GOOD_SHA>
   docker tag ghcr.io/galylioai/1111-<service>:sha-<KNOWN_GOOD_SHA> ghcr.io/galylioai/1111-<service>:latest
   docker compose -f docker-compose.staging.yml up -d <service>
   ```
3. If GHCR itself is unreachable or images are missing, this is now a SEV1 — escalate per §8 and consider a full server rebuild drill (§4.3) as a last resort if data integrity isn't at risk.

---

## 4. Backup & Disaster Recovery

> **Status flag:** database backup automation is **not fully implemented**. `deploy/scripts/backup-db.sh` exists, but daily cron, rotation, and off-site copy are still pending . Do not assume backups are currently running on a schedule. Confirm before relying on this in a real incident.

### 4.1 Manual backup procedure

```bash
bash deploy/scripts/backup-db.sh
```

Expected: a `pg_dump` for each of the 6 databases (core `app_auth`/`appdb`, `retail_db`, `para_db`, `alimentation_db`, `fashion_db`, `catalog_db`). `[VERIFY]` output file location, naming convention, and whether compression/rotation is applied — read the script before your first real backup, since automation around it (rotation, off-site copy) is explicitly still pending.

- [ ] Confirm 6 dump files were created, one per database
- [ ] Confirm file sizes are non-zero and roughly consistent with prior backups
- [ ] Copy the dumps off the VPS to durable storage — **this step is not automated yet**, do it manually until backlog #34 is resolved

### 4.2 Restore procedure

```bash
bash deploy/scripts/restore-db.sh <db_name> <backup_file.sql.gz>
# example:
bash deploy/scripts/restore-db.sh main backup.sql.gz
```

**Status flag:** this script has **not been tested end-to-end on staging** (backlog #65, blocked — same reason, lack of staging databases at time of writing). Treat a first real restore as higher-risk than it should be; verify against a non-production database first if at all possible.

Pre-checks:
- [ ] Confirm target database container is up (`docker compose -f docker-compose.staging.yml ps <db>`)
- [ ] Confirm the backup file is not corrupted (`gunzip -t backup_file.sql.gz`)
- [ ] Take a fresh backup of current (possibly bad) state before overwriting, if the DB is still reachable

Post-restore verification:
- [ ] `psql` into the restored DB and spot-check row counts on a couple of key tables `[VERIFY table names — not documented]`
- [ ] Restart the dependent backend service(s) and confirm they connect cleanly (check logs for connection errors)
- [ ] Run the relevant blackbox probe / health endpoint for that service

### 4.3 Full server rebuild drill

1. Provision a fresh VPS.
2. Run:
   ```bash
   bash deploy/scripts/bootstrap-vps.sh
   ```
   `[VERIFY]` exact steps this performs (Docker install, UFW rules, directory layout) — not itemized in `ai-context/`; read the script before running against anything that matters.
3. Deploy the application stack:
   ```bash
   bash deploy/scripts/deploy-ghcr.sh
   ```
4. Restore all 6 databases using §4.2, one at a time, verifying each before moving to the next.
5. Bring up monitoring:
   ```bash
   docker compose -f docker-compose.monitoring.yml up -d
   ```
6. Full verification checklist:
   - [ ] All ~20 containers `Up`
   - [ ] All 6 databases restored and reachable
   - [ ] Gateway + frontend health checks pass
   - [ ] Grafana dashboards populating
   - [ ] Loki receiving logs


---

## 5. Security Scans — Operating & Triage

All three scanners are orchestrated by `security-scanning.yml`, called from `demo-ci.yml`'s `security-scan` job or triggered manually.

### 5.1 SonarQube (SAST + SCA)

- Deployed on the staging server (Docker), exposed via Nginx on host port **8084**; SonarQube MCP server on **8085**.
- Quality gate "1111-Strict-Gate" — **confirmed from the live SonarQube UI (2026-08-03).** 7 conditions on New Code + 1 on Overall Code:

  **New Code — fail when:**
  | When to fail... | Value |
  |---|---|
  | New Issues | > 0 |
  | Security Hotspots Reviewed | < 100% |
  | Coverage | < 60.0% |
  | Duplicated Lines (%) | > 3.0% |
  | Maintainability Rating | worse than A |
  | Reliability Rating | worse than A |
  | Security Rating | worse than A |

  **Overall Code — fail when:**
  | Metric | Value |
  |---|---|
  | Security Rating | worse than D |

- **How to view the gate:** open SonarQube at `http://<staging-host>:8084` (or via the domain if fronted by Nginx), navigate to the project, check the Quality Gate badge (Passed/Failed) and drill into whichever condition failed.
- **Handling a failed gate:**
  1. Open the failing condition in the SonarQube UI and identify the specific file/line.
  2. If it's a genuine new bug/vulnerability/code smell — fix it before merging.
  3. If it's coverage or duplication on a New Code delta that's unavoidable (e.g. generated code, config), discuss a scoped exclusion with the team rather than disabling the gate.
  4. Do not lower the gate's thresholds to unblock a merge without team sign-off — the gate is intentionally strict ("Production-Ready"). Note that the CI quality-gate step itself is `continue-on-error: true` (see below), so a red gate alone won't fail CI.
- **CI gate behavior (confirmed in `security-scanning.yml`):** the `SonarQube Quality Gate check` step sets `continue-on-error: true` (line 96), so a **failed gate does not fail the CI job** — it's advisory. If you want the gate to block merges, remove `continue-on-error` or gate on the step result in `demo-ci.yml`. PR decoration (gate shown in PRs) is on the Next-Steps list, not yet enabled.
- Local baseline scan result for reference (2026-07-20, before the gate existed): Security grade E (30 vulnerabilities), Reliability grade D (311 bugs), Maintainability grade A (887 code smells), 0% coverage, 24.6% duplication. Use this only as historical context — re-check current numbers in the live UI.

### 5.2 Trivy (SCA — container images)

- Scans all 12 Docker images (11 backend/mailer + frontend) from GHCR, severities CRITICAL + HIGH.
- CI is currently configured with `exit-code: 0` — **Trivy does not block the pipeline**, it reports only. Don't assume a green CI run means zero CVEs.
- **Reading CI output:** check the Step Summary for the table/count breakdown, or open the SARIF results in the GitHub Security tab.
- **Triage:**
  1. **CRITICAL** — treat as fix-now unless there's a documented, team-approved risk acceptance. As of the last scan there is exactly one known remaining CRITICAL: `CVE-2025-29927` (Next.js auth bypass), fix = upgrade `next@14.2.5` → `14.2.25+` (tracked, still pending).
  2. **HIGH** — evaluate exploitability in context (is the vulnerable code path actually reachable from this service?) before deciding fix vs. accept.
  3. Document any accepted risk with the CVE ID, reasoning, and an owner — `[MISSING]`: no existing risk-acceptance log was found in `ai-context/`; start one if none exists.
- Baseline for comparison: total findings across 12 images went from 1,259 → 147 (-88.3%) after base-image and non-root-user hardening; critical CVEs went from 12 → 1.

### 5.3 OWASP ZAP (DAST)

- **Baseline scan** (passive, ~2–5 min): runs by default, spins up all ~12 app containers + 6 DBs + RabbitMQ + MailHog locally via `docker-compose.staging.yml`, scans frontend (`:3001`) and gateway (`:3000`).
- **Full scan** (active, ~30–60 min): opt-in via `zap_mode=full`, probes for SQLi/XSS/CSRF/auth bypass.
- **Authenticated scanning:** configured via `.zap/1111-authenticated.context` + an auth script (added 2026-07-30). Confirmed from `.zap/auth-script.js`: it POSTs `{email, password}` as JSON to `http://localhost:3000/api/auth/login`, reads `data.access_token` from the response, and sets it as `Authorization: Bearer <token>` on the session. Credentials come from the context file's user  — the CI job (`security-scanning.yml`) also **recreates/upserts this ZAP user in the DB before scanning** (`docker exec 1111-auth` + `1111-postgres` INSERT with `ON CONFLICT (email) DO UPDATE`), so the login should always succeed on a fresh stack.
- **Reading HTML reports:** each finding has an ID, risk level (Informational/Low/Medium/High), and affected URLs. First run (2026-07-22) baseline: frontend 12 WARN / 0 FAIL, backend 2 WARN / 0 FAIL — all findings were WARN-severity (missing security headers, disclosure issues), nothing FAIL-severity.
- **Real vs. false positive:**
  - Missing headers (CSP, Permissions-Policy, COEP, SRI) on a Next.js SPA are common and usually genuine gaps worth fixing incrementally, not false positives — but they're low urgency (WARN, not FAIL).
  - Base64/Timestamp "disclosure" findings inside minified JS bundles are frequently false positives (just build hashes/version strings) — this is exactly what `.zap/rules.tsv` tuning (backlog #56, partially done) is meant to suppress. Don't treat every Base64 hit in a JS chunk as a real secret leak without checking it manually first.
  - Application Error Disclosure (500s) on `/api/*` **is not a ZAP false positive** — it means a real backend 500 happened during the scan; check the corresponding service logs.
- **Re-tuning:** edit `.zap/rules.tsv` to add/adjust ignore rules for confirmed false positives, then re-run.

### 5.4 Manually re-triggering scans

```bash
gh workflow run security-scanning.yml -f scan_target=all
gh workflow run security-scanning.yml -f scan_target=trivy
gh workflow run security-scanning.yml -f scan_target=zap -f zap_mode=baseline
gh workflow run security-scanning.yml -f scan_target=zap -f zap_mode=full
gh workflow run security-scanning.yml -f scan_target=zap -f zap_target_url=https://staging.1111.tn
```

### 5.5 SonarQube MCP server (AI coding agents)

The SonarQube MCP server lets AI agents (Claude Code, Cursor, OpenCode) query issues, vulnerabilities, and quality-gate status **directly from the editor** instead of clicking through the SonarQube dashboard.

- **Server URL:** `http://192.168.1.106:8085/mcp` (SonarQube MCP container, exposed via Nginx on host port **8085**).
- **Auth:** Bearer token `SONARQUBE_MCP_TOKEN` (see §7.1; create a new one in SonarQube UI → My Account → Security if you don't have it).
- **⚠️ Network reachability:** this IP/URL only works from **the same local network or VPN as the staging server**. It is not reachable from the public internet, and CI cannot reach it from GitHub runners (no Tailscale in the MCP path). On this project that presently means `192.168.1.106` is only usable from a machine on the staging LAN.

**Setup per tool** (replace `<PASTE_NEW_TOKEN_HERE>` with the token, and the URL with the server's LAN IP on your network):

**Claude Code** — `~/.claude.json`:
```json
{
  "mcpServers": {
    "sonarqube": {
      "type": "sse",
      "url": "http://192.168.1.106:8085/mcp",
      "headers": { "Authorization": "Bearer <PASTE_NEW_TOKEN_HERE>" }
    }
  }
}
```

**Cursor** — `~/.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "sonarqube": {
      "url": "http://192.168.1.106:8085/mcp",
      "headers": { "Authorization": "Bearer <PASTE_NEW_TOKEN_HERE>" }
    }
  }
}
```

**OpenCode** — `~/.config/opencode/opencode.json`:
```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "sonarqube": {
      "type": "remote",
      "url": "http://192.168.1.106:8085/mcp",
      "enabled": true,
      "headers": { "Authorization": "Bearer <PASTE_NEW_TOKEN_HERE>" }
    }
  }
}
```

> ⚠️ The server is configured for **SSE/HTTPS-style HTTP transport** per the agent configs above, but earlier `ai-context/` notes said the SonarQube MCP image **only supports `stdio` transport** (reported 502 behind Nginx). If the SSE connection above fails, this is the known cause — fall back to running the MCP locally in `stdio` mode, or confirm the live image/setup supports SSE before relying on it.

**Verify it works:** after adding the config, restart your agent and ask *"Ping the SonarQube MCP server"*. Once connected you can ask things like *"what security vulnerabilities are open in the 1111 project"* and it pulls live data.

---

## 6. Incident Response Playbook

Each entry: **Symptom → Likely Cause → Immediate Actions → Escalation**. Target: resolvable or triaged within 10 minutes.

### 6.1 Container crash-looping or container down

- **Symptom:** `docker compose ps` shows `Restarting` or `Exited`; `ContainerHighRestartRate` alert fires.
- **Likely cause:** bad image/config from last deploy, DB connection failure, OOM.
1. `docker compose -f docker-compose.staging.yml logs --tail=100 <service>` — read the crash reason.
2. `docker inspect <container> --format '{{.State.OOMKilled}}'` — rule out OOM.
3. If it's the newest deploy: `bash deploy/scripts/rollback.sh` (§3.2).
4. If it's a single flaky container unrelated to a deploy: `docker compose -f docker-compose.staging.yml restart <service>`.
5. If it keeps crash-looping after restart + rollback, treat as SEV2 and escalate (§8).
- **Escalation:** if rollback doesn't fix it, or if it's a database container → SEV1, escalate immediately.

### 6.2 Gateway returns 502/503 on all `/api/*`

- **Symptom:** every API call through gateway fails; frontend shows errors app-wide.
- **Likely cause:** gateway container down, or gateway can't reach one/more backend services it depends on for startup, or Nginx misconfiguration.
1. `docker compose -f docker-compose.staging.yml ps gateway` — is it running?
2. `docker compose -f docker-compose.staging.yml logs --tail=100 gateway`.
3. `curl -i http://localhost:3000/health` directly on the host (bypass Nginx) to isolate Nginx vs. gateway.
4. If gateway itself is down: `docker compose -f docker-compose.staging.yml restart gateway`.
5. If gateway is up but Nginx returns 502: check the Nginx config on the host and `journalctl -u nginx` or `/var/log/nginx/error.log` (Nginx runs on the host directly — confirmed 2026-08-03, it is not a container).
- **Escalation:** SEV1 if unresolved in 10 minutes — this is total API outage.

### 6.3 PostgreSQL down or unresponsive (any of the 6)

- **Symptom:** service(s) depending on that DB throw connection errors; `postgresql-database` Grafana dashboard shows a gap.
1. `docker compose -f docker-compose.staging.yml ps <db-container>` (e.g. `retail-postgres`).
2. `docker compose -f docker-compose.staging.yml logs --tail=100 <db-container>` — look for crash reason (disk full, OOM, corruption).
3. Check disk space first — DB crashes are frequently disk-full: `df -h`.
4. `docker compose -f docker-compose.staging.yml restart <db-container>`.
5. If it won't come back up cleanly, this is a data-integrity risk — do **not** attempt ad-hoc fixes; escalate before running any repair commands.
- **Escalation:** SEV1 immediately if the container won't restart cleanly or logs suggest corruption.

### 6.4 RabbitMQ down (mailer / token-cleanup failing)

- **Symptom:** `RabbitMQQueueBacklog` alert, mailer not sending emails, token-cleanup jobs failing.
1. `docker compose -f docker-compose.staging.yml ps rabbitmq`.
2. `docker compose -f docker-compose.staging.yml logs --tail=100 rabbitmq`.
3. Check the management UI (`:15672`) for queue depth and consumer count.
4. `docker compose -f docker-compose.staging.yml restart rabbitmq`.
5. Restart the mailer consumer after RabbitMQ is confirmed healthy: `docker compose -f docker-compose.staging.yml restart mailer`.
- **Escalation:** SEV2 unless it's blocking auth flows that depend on token cleanup, then SEV1.

### 6.5 SonarQube or SonarQube MCP server unreachable

- **Symptom:** can't load `:8084` (SonarQube) or `:8085` (MCP server); CI security-scan job fails to reach it.
1. `docker compose -f docker-compose.sonarqube.yml ps`.
2. `docker compose -f docker-compose.sonarqube.yml logs --tail=100 sonarqube`.
3. SonarQube is memory-hungry and has `ulimits`/`nofile` requirements in its compose config — check for `Elasticsearch bootstrap checks` failures in logs, a common SonarQube startup failure mode.
4. Restart: `docker compose -f docker-compose.sonarqube.yml restart`.
5. Verify Nginx is still proxying `:8084`/`:8085` correctly if the container is healthy but unreachable externally.
- **Escalation:** SEV3 — this blocks the SAST gate but does not take down the running application; don't let it interrupt an active production incident response.

### 6.6 Disk full on the server (logs filling up)

- **Symptom:** `HostDiskAlmostFull` alert; writes failing across containers.
1. `df -h` — confirm which mount is full.
2. `docker system df` — see how much is Docker images/containers/volumes vs. logs.
3. Find largest log files: `du -sh /var/lib/docker/containers/*/*.log 2>/dev/null | sort -rh | head`.
4. If Docker container logs are the cause: `docker compose -f docker-compose.staging.yml down && docker compose -f docker-compose.staging.yml up -d` will not clear logs by default — truncate manually if urgent: `truncate -s 0 <logfile>` (only as an emergency measure).
5. `docker system prune` (carefully — confirm you're not pruning anything needed) to reclaim space from unused images/volumes.
- **Note:** proper log rotation policy is **not yet implemented** (backlog #17, blocked on staging host file-creation access) — this incident is likely to recur until that's resolved. Flag it, don't just firefight it each time.
- **Escalation:** SEV2, becomes SEV1 if disk hits 100% and writes start failing across services.

### 6.7 Nginx reverse proxy failing

- **Symptom:** `1111.tn` or `backend.1111.tn` unreachable, or 502s at the edge even though backend containers are healthy.
1. Nginx runs **on the host directly** (not a container — confirmed on staging 2026-08-03; no `nginx` container appears in `docker ps`). Check it with `systemctl status nginx`.
2. `nginx -t` to check config syntax.
3. Check Nginx error log: `/var/log/nginx/error.log`.
4. Restart: `systemctl restart nginx`.
5. If a cert issue (`[VERIFY]` — Certbot/SSL setup status is listed as **Pending** in the backlog, so this may not yet be configured on this environment) — check cert validity if HTTPS is affected.
- **Escalation:** SEV1 if it's the public-facing edge and the outage is customer-visible.

### 6.8 Frontend container unhealthy (confirmed 2026-08-03)

- **Symptom:** `check-containers.sh` reports `1111-frontend: Up 4 days (unhealthy)` → `FAIL: healthcheck unhealthy`, while `curl http://localhost:3001/` still returns OK. Currently the **only** failing healthcheck on staging — see the live note in §2.2.
1. Confirm the healthcheck that's defined for the frontend in compose: `docker inspect --format '{{json .Config.Healthcheck}}' 1111-frontend`.
2. See why it's failing: `docker inspect --format '{{json .State.Health}}' 1111-frontend` — look at the last `FailingStreak`/log output, and `docker compose -f docker-compose.staging.yml logs --tail=100 frontend`.
3. The likely cause is a wrong healthcheck path/command (the app answers on `:3001` but the healthcheck probes a path that returns non-2xx). Compare the `healthcheck` block in `docker-compose.staging.yml` for `frontend` against the working probes (e.g. `3000/health`).
4. Fix the healthcheck path in compose, then `docker compose -f docker-compose.staging.yml up -d frontend` (recreate with the new config) and re-run `./check-containers.sh` until it reports `OK: healthy`.
- **Escalation:** SEV3 — the app is still serving traffic, so this doesn't block users, but it breaks dashboards/alerting that key off container health. Do **not** let it linger until it becomes an actual outage.
- **Note:** the deployment target on the host is `/opt/1111/current/` — after fixing the compose file, ensure the change is applied to the *deployed* copy there, not just the repo.

### 6.9 Prometheus/Grafana/Loki not collecting data

- **Symptom:** Grafana panels empty (this happened before with Loki, fixed 2026-07-23 — treat a recurrence as a regression).
1. `docker compose -f docker-compose.monitoring.yml ps`.
2. Prometheus: `curl -s http://localhost:9090/api/v1/targets` — check for targets marked `down`.
3. Loki: `curl -s "http://localhost:3100/loki/api/v1/query_range?query={job=%22docker%22}&limit=5"` — empty result = Promtail isn't shipping.
4. Promtail: `docker compose -f docker-compose.monitoring.yml logs --tail=100 promtail` — look for Docker socket permission errors or discovery failures.
5. Restart the affected component(s): `docker compose -f docker-compose.monitoring.yml restart <prometheus|grafana|loki|promtail>`.
- **Escalation:** SEV3 (doesn't affect the running app) unless it blinds you during an active SEV1/SEV2, in which case treat restoring visibility as urgent.

### 6.10 Security scan fails or gate blocks a release

- **Symptom:** `security-scan` job in CI fails, or SonarQube Production-Ready gate shows Failed.
1. Open the CI run and identify which sub-job failed (Trivy / SonarQube / ZAP).
2. For Trivy: this shouldn't block CI (exit-code 0) — if CI failed anyway, something else broke (check for infra errors, not CVE findings).
3. For SonarQube gate failures: follow §5.1 triage steps — fix the flagged issue or get team sign-off on an exception.
4. For ZAP: check whether it's a container startup failure (infra) vs. an actual new FAIL-severity finding (real regression) — see §5.3.
5. Re-trigger the specific scan after a fix using the commands in §5.4.
- **Escalation:** SEV3 unless it's blocking an urgent hotfix deploy, in which case discuss a documented, time-boxed exception with the team rather than silently disabling the check.

### 6.11 Suspected compromise / leaked credential (`.env` committed, unknown access)

- **Symptom:** `.env` or secret material appears in a commit/PR; unrecognized access in logs; unexpected container/process activity.
1. **Do not** just delete the commit and move on — assume the secret is compromised the moment it's pushed, even to a private repo.
2. Rotate every credential that was exposed immediately (see §7 rotation procedures) — JWT secrets, DB passwords, SMTP creds, API tokens, whichever applies.
3. Force-push history rewrite only after rotation is done and only with team awareness (rewriting history doesn't undo exposure, it just cleans the repo going forward).
4. Check `docker compose logs` and host auth logs (`/var/log/auth.log` or equivalent) for any signs the exposed credential was actually used.
5. If there's evidence of actual unauthorized access (not just exposure), treat as SEV1 and escalate immediately — do not attempt to investigate further alone.
- **Escalation:** SEV1, always, immediately, regardless of whether misuse is confirmed yet.

---

## 7. Secrets Management

This section documents **every secret/variable** in the system, where it lives, and **how to create or obtain it**. Two tiers:

- **Runtime `.env`** — the app's configuration on the server (`/opt/1111/current/.env` on staging). It is *provisioned* by the `STAGING_ENV_FILE` GitHub secret (CD writes it), so there are effectively two copies: the GitHub secret (source) and the deployed file (runtime).
- **GitHub Actions secrets** — used by CI/CD and scan workflows. These are stored encrypted in the repo settings; only referenced by workflows as `${{ secrets.X }}`.

> **Security audit status (2026-08-03):** several staging values are **placeholders or shared defaults** and must be rotated before production. Flagged inline below with ⚠️ and summarized in §7.5.

### 7.1 The server `.env` — full variable reference

Location on staging: `/opt/1111/current/.env` (written from the `STAGING_ENV_FILE` GitHub secret; local copy: `backend/.env` for backend dev, root `.env` for compose). **Never commit this file** — it is gitignored.

**Secrets — how to create/rotate:**

| Variable | Purpose | How to obtain / create | Notes |
|---|---|---|---|
| `JWT_SECRET` | Signs access tokens | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` — 64 hex chars, min 32 | ⚠️ **MUST ROTATE** — was committed in plaintext in git history (commits `3ba7c1b`, `806560f`). Rotating invalidates all existing sessions; users must re-login. |
| `JWT_EXPIRES_IN` | Access-token lifetime | Decide policy; current `15m` | Not a secret, tune deliberately |
| `REFRESH_TOKEN_EXPIRES_DAYS` | Refresh-token lifetime | Decide policy; current `7` | Not a secret |
| `DB_PASSWORD` (+ all `*_DB_PASSWORD`) | PostgreSQL passwords | Set at DB-provisioning time; generate with `openssl rand -hex 16`. Currently **all 6 DBs share `galylio-ai`** ⚠️ | ⚠️ **Shared dev password also hardcoded in git-tracked `scripts/*.mjs`** — rotate per-DB before prod; each compose `*_postgres` service consumes its own `*_DB_*` var |
| `RABBITMQ_USER` / `RABBITMQ_PASSWORD` | RabbitMQ default creds | Chosen at setup; compose passes them to the container via `RABBITMQ_DEFAULT_USER/PASS`. Currently `guest/guest` ⚠️ | ⚠️ Default creds; change before exposing beyond the internal network |
| `SMTP_USER` / `SMTP_PASSWORD` | Mail provider creds | **Request from the team/mail provider** (e.g. Brevo/SMTP2GO/Google App Password). Currently **empty** — mail flows to MailHog (`SMTP_HOST=mailhog`) | Not yet provisioned — no real email is sent today |
| `SMTP_FROM` | Sender address | Team's sending address (`noreply@example.com` is a placeholder) | |
| `SUPER_ADMIN_PASSWORD` | Bootstrap super-admin account | Choose a strong password **before** running `backend/scripts/seedDemo.js` (which reads `SUPER_ADMIN_*` env vars). Current value `change_me_super_admin_password` is a placeholder ⚠️ | ⚠️ If the seed already ran with this value, the admin account is a known default-cred risk — change it in the DB or re-seed |
| `SUPER_ADMIN_EMAIL` / `NAME` / `STATE` / `PHONE` | Seed identity | Team decision (`backend/scripts/seedDemo.js` defaults to `boudhriwa.haydar@gmail.com` / `Haydar Boudhriwa` if unset) | |
| `SONARQUBE_MCP_TOKEN` | Auth for the SonarQube MCP server | Generate in SonarQube UI: **My Account → Security → Tokens**, or `POST /api/user_tokens/generate` | Used by the AI/MCP tooling, not CI |

**Runtime config — mostly not secrets:**

| Variable | Purpose | How to obtain / notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_API_BASE_URL` | Frontend → gateway URL | Set to the public API URL (`http://localhost:3000` today; **duplicated** — both keys present, keep in sync). **⚠️ In production this must be the public `https://` URL or the browser calls localhost** |
| `ALIMENTATION_DB_URL` / `PARA_DB_URL` / `RETAIL_DB_URL` | Host-view URLs for the Next.js `/api/*-products` routes | Host-published ports: alimentation **5435**, para **5434**, retail **5433** (these differ from container port 5432) |
| `CATALOG_DB_URL` | Catalog DB from mobile backend | `postgres://catalog_user:***@catalog-postgres:5432/catalog_db` |
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` | App DB (container) | `postgres`, `5432`, `appdb`, `appuser` |
| `*_DB_HOST` / `*_DB_PORT` / `*_DB_NAME` / `*_DB_USER` | 6 catalog DBs (container) | Each catalog service → its own `*-postgres` container on `5432` |
| `AUTH_SERVICE_URL` … `WEB_CONTROL_SERVICE_URL` | Internal service DNS names | `http://<service>:<port>` on the `1111` network (ports 3001–3009) |
| `*_PORT` / `GATEWAY_PORT` | Port definitions | Mirror the service URLs (auth 3001 … web-control 3009, gateway 3000) |
| `ALLOWED_ORIGINS` | CORS allowlist | **`http://localhost:3001` only** ⚠️ — must add the public frontend origin in prod or browser requests will be blocked |
| `UPLOAD_PATH` / `MAX_AVATAR_SIZE_MB` / `MAX_MEDIA_SIZE_MB` | Upload config | `/app/uploads`, 5 MB, 8 MB |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USE_TLS` / `SMTP_USE_SSL` | SMTP transport | `mailhog` / `1025` / `false` (dev) |
| `NODE_ENV` | Runtime mode | `production` on the deployed stack |

### 7.2 GitHub Actions secrets — inventory (checked 2026-08-03)

Set via the repo's **Settings → Secrets and variables → Actions**, or `gh secret set <NAME>`. **Plaintext values never appear in workflow logs** — use `${{ secrets.X }}` only.

| Secret | Used by | How to create / obtain | Status |
|---|---|---|---|
| `STAGING_ENV_FILE` | `demo-cd.yml`, `security-scanning.yml` (ZAP local) | The **entire `.env` content** (see §7.1) pasted as one secret. It becomes `/opt/1111/current/.env` on deploy. | ✅ present (updated 3 weeks ago) |
| `GHCR_TOKEN` | `demo-cd.yml` | GitHub **PAT** (or fine-grained token) with `read:packages` + `write:packages`. Create: GitHub → Settings → Developer settings → Personal access tokens → generate, paste here. | ✅ present |
| `IMAGE_PREFIX` | `demo-cd.yml`, `security-scanning.yml` | Fixed value `ghcr.io/galylioai/1111` | ✅ present |
| `APP_DIR` | `demo-cd.yml` | Server app path — currently `/opt/1111` | ✅ present |
| `DEPLOY_USER` | `demo-cd.yml` | SSH user on the staging host that owns `/opt/1111` | ✅ present |
| `SSH_PRIVATE_KEY` | `demo-cd.yml` | Generate: `ssh-keygen -t ed25519`; paste the **private** key here, install `.pub` in the deploy user's `authorized_keys` | ✅ present |
| `TS_SERVER_IP` | `demo-cd.yml` | The staging host's **Tailscale IP** (`tailscale ip -4`) | ✅ present |
| `TAILSCALE_CLIENT_ID` / `TAILSCALE_CLIENT_SECRET` | `demo-cd.yml`, `security-scanning.yml` | Create an **OAuth client** in the Tailscale admin console (tag `tag:githubactions`), copy ID + secret here | ✅ present |
| `SONAR_TOKEN` | `security-scanning.yml` | SonarQube UI → **My Account → Security → Tokens**; copy here | ✅ present (added 5 days ago) |
| `SONAR_HOST_URL` | `security-scanning.yml` | URL of the self-hosted SonarQube reachable over Tailscale (e.g. `http://<staging-host>:9000` or the Nginx `:8084` URL) | ✅ present |
| `GHCR_SEC_TOKEN` | **nothing** | Legacy — never referenced by any workflow | ⚠️ **stale — delete** |
| `GOOGLE_CLIENT_ID_CI` | `demo-ci.yml` (frontend build) | Google OAuth **Client ID** from Google Cloud Console (used for frontend CI build) | ⚠️ **MISSING from the secrets list** — the frontend CI build references it; confirm it's set or the job falls back to an empty value |
| `VPS_HOST`, `VPS_PORT`, `VPS_USER`, `VPS_SSH_PRIVATE_KEY`, `PROD_ENV_FILE` | `vps-prod-cd.yml` | Same approach as the staging equivalents, but for the **production** server | **Missing — expected.** Prod deploy is blocked (see §9) |
| `LOCAL_SERVER_HOST/PORT/USER/SSH_KEY`, `LOCAL_ENV_FILE` | `local-deploy-cd.yml` | For deploying to a local/dev machine | Missing — only needed if that workflow is used |
| `GITHUB_TOKEN` | auto | Provided by GitHub Actions automatically | ✅ n/a |

> **`GITHUB_TOKEN`** is auto-generated per run — never create it manually.

### 7.3 How secrets flow (staging deploy)

```
GitHub secret STAGING_ENV_FILE
        │  (demo-cd.yml "Prepare staging env file")
        ▼
     .env (workflow runner) ──scp──► /tmp/.env ──install──► /opt/1111/current/.env
        │
        └──► read by deploy-ghcr.sh → docker compose --env-file .env -f docker-compose.staging.yml up -d
```

The same `.env` is also written on the CI runner for the **ZAP local scan** job (`security-scanning.yml`), which spins up the stack with `docker compose -f docker-compose.staging.yml`.

### 7.4 Rotation cheat-sheet

| Secret | When to rotate | Command / steps |
|---|---|---|
| `JWT_SECRET` | **Now** (leaked in git history) | generate new hex (see §7.1), update `backend/.env` + `STAGING_ENV_FILE`, redeploy, all users re-login |
| DB passwords | Before prod; now if any were exposed | `openssl rand -hex 16` per DB; update compose DB init + `.env` + `scripts/*.mjs` that hardcode `galylio-ai` |
| `GHCR_TOKEN` | If suspected compromised | GitHub → Developer settings → regenerate, update secret |
| `SONAR_TOKEN` | If suspected compromised | SonarQube UI → revoke token → generate new → update secret |
| `SSH_PRIVATE_KEY` | If exposed | `ssh-keygen -t ed25519`, replace key in `authorized_keys`, update secret |
| `SUPER_ADMIN_PASSWORD` | If seed ran with placeholder | re-seed or `UPDATE auth.users SET password_hash = <new bcrypt> WHERE email='<superadmin>';` |

### 7.5 Known issues / open items

- ⚠️ **`JWT_SECRET` in git history** — commits `3ba7c1b` and `806560f` (both ancestors of `HEAD`) embedded the raw value in `security-scanning.yml`. Remove via history rewrite (`git filter-repo`) **and** rotate the value.
- ⚠️ **`galylio-ai` hardcoded in tracked `scripts/*.mjs`** — several import scripts contain DB credentials in source.
- ⚠️ Defaults/placeholders live in staging: RabbitMQ `guest/guest`, `SUPER_ADMIN_PASSWORD=change_me_...`, SMTP empty (MailHog), `ALLOWED_ORIGINS` localhost-only, `NEXT_PUBLIC_API_*` localhost.
- ⚠️ `GHCR_SEC_TOKEN` is dead — remove from GitHub settings.
- `[MISSING]` — no risk-acceptance log yet (start one if you accept any of the above); Google Chat webhook for Alertmanager not provisioned (§9).


---
