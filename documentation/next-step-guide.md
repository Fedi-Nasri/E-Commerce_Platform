# 1111.tn — Next-Step Guide for the Development Team

**Author:** Fedi Nasri (DevSecOps) — `fedinasri.fsb@gmail.com`
**Role:** This guide is my **guidance and approach** for the next phase of the project, based on everything implemented and discovered during the internship — including the long-term goals for how the platform should be structured, secured, and shipped to production.
**Purpose:** Handover document for the development team  1111.tn project 

---

## 1. State of the Project

Infrastructure, security tooling, and CI/CD are ready; the application code has **outstanding bugs, tests, and security debt** that need the development team to resolve them.

### What is DONE and healthy

| Area | Status |
|---|---|
| CI/CD pipeline (GitHub Actions) | ✅ Green — lint, typecheck, build, Docker publish to GHCR |
| Staging deployment (Tailscale SSH) | ✅ Working — auto-deploy, rollback, health checks |need Galylio Account to connect staging server to Github Action workflow|
| Security scanning | ✅ Trivy (CVE) + OWASP ZAP (DAST) + SonarQube (SAST) |
| Monitoring stack | ✅ Prometheus + Grafana + Loki + Promtail + exporters |
| All ~36 staging containers | ✅ Running (one healthcheck failing, see §4.4) |

###  known problems 

| Area | Problem |
|---|---|
| **Critical security debt** | Secrets leaked in git history, hardcoded DB password, default creds (§3) |
| **Dependency CVEs** | `next@14.2.5` has a CRITICAL auth-bypass CVE  |
| **Tests** | No test coverage in CI, tests commented out, SonarQube shows 0% coverage  |
| **Code quality** | SonarQube: 30 vulnerabilities, 311 bugs, 887 code smells, 24.6% duplication |
| **Production** | Not deployed — blocked on VPS secrets  |
| **CI-Linting** | check rules `.eslintrc.json`|
| **CI** | commented sections need to uncomment and resolve outputed warning,errors |

---

## 2. Recommended Phases Roadmap (in order)

| Phase | Focus | Sections |
|---|---|---|
| Phase 1 | **Critical security fixes** (rotate secrets, remove hardcoded creds) | §3 |
| Phase 2 | **Security-critical code fixes** (Next.js CVE, /api 500s, healthcheck) | §4 |
| Phase 3 | **SonarQube code quality** (SAST) — resolve issues via MCP, verify false positives | §5 |
| Phase 4 | **CI/CD** — uncomment tests, resolve linting, adjust lint rules | §6 |
| Phase 4 (reference) | How to **read GitHub Actions runs**, Security Summary, artifacts | §7 |
| Phase 5 | **Production readiness** + hand back to DevSecOps/Ops | §8 |
| Future | **Near-production restructuring** — branch cleanup, releases, QA/pentest env, VLAN/DMZ | §9 |

> **Golden rule from the runbook (§7):** never commit `.env` or secrets. They are gitignored. Use `.env.example` + GitHub secrets instead.

---

## 3. Phase 1 — Critical Security Fixes (DO FIRST)

These were flagged by the security audit (runbook §7) and **must be fixed before any production deployment**. They affect your local `.env`, git history, and some source files.

| # | Fix | How | Where |
|---|---|---|---|
| 3.1 | **Rotate `JWT_SECRET`** — the raw value was committed in git history (commits `3ba7c1b`, `806560f`) | Generate a new one: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | `.env` → also update GitHub secret `STAGING_ENV_FILE` |
| 3.2 | **Remove hardcoded DB password** `galylio-ai` | Replace with per-DB secrets read from env vars | `scripts/*.mjs` (import/seed scripts) |
| 3.3 | **Replace default RabbitMQ creds** `guest/guest` | Choose strong creds, set in compose + `.env` | `docker-compose*.yml`, `.env` |
| 3.4 | **Replace placeholder `SUPER_ADMIN_PASSWORD`** (`change_me_super_admin_password`) | Set before re-running `backend/scripts/seedDemo.js` | `.env`, seed script |
| 3.5 | **Set real SMTP creds** (currently empty → MailHog) | Request from team/provider (Brevo/SMTP2GO/Google App Password) | `.env` |
| 3.6 | **Fix `ALLOWED_ORIGINS`** (localhost-only) | Add the real frontend origin(s) | `.env` |
| 3.7 | **Fix `NEXT_PUBLIC_API_URL` duplication** | Both `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_API_BASE_URL` exist — keep in sync; must be the **public HTTPS** URL in prod, or browsers call localhost | `.env`, `docker-compose.staging.yml` |
| 3.8 | **Set `GOOGLE_CLIENT_ID_CI`** GitHub secret (frontend CI build references it) | Create Google OAuth Client ID, add to GitHub repo secrets | GitHub → Settings → Secrets |
| 3.9 | **Delete dead `GHCR_SEC_TOKEN`** secret | Not referenced by any workflow | GitHub → Settings → Secrets |

> **MailHog note:** outbound email currently goes to MailHog (`SMTP_HOST=mailhog`, UI on `:8025`). No real SMTP credentials exist yet — ask the team for them when you need real email (§3.5).

**After fixing §3.1–3.4, also update the `STAGING_ENV_FILE` GitHub secret** with the new `.env`:
```bash
gh secret set STAGING_ENV_FILE < .env
```

---

## 4. Phase 2 — Security & Bug Fixes in the Code

### 4.1 Update Next.js (CRITICAL)

`next@14.2.5` ships with **CVE-2025-29927** (authentication bypass) — the last remaining CRITICAL CVE.

- Upgrade `next` to `14.2.25+`, then run `npm audit` to confirm.
- Verify the frontend still builds: `npm run build` and CI passes.

### 4.2 Update frontend dependencies

```bash
npm update        # frontend deps
cd backend && npm update && cd ..
```

Re-run Trivy (or `npm audit`) afterwards to confirm remaining HIGH/CRITICAL findings are gone.

---

## 5. Phase 3 — SonarQube: Resolve Code Quality & SAST Findings

SonarQube already scanned the whole codebase. Your job in this phase is to **work the findings down** — not just write new code.

### 5.1 Where to look

- Open SonarQube: `http://<staging-host>:8084` (login `admin` / `Sonarqube@123`)
- Open the **1111 project** → **Issues** tab → filter by severity and category.

Baseline from the first local scan (2026-07-20) — current numbers will differ:

| Metric | Grade | Count | Target |
|---|---|---|---|
| Security | E | 30 vulnerabilities | ≥ A (gate: worse than D fails on overall) |
| Reliability | D | 311 bugs | A |
| Maintainability | A | 887 code smells | A |
| Coverage | — | 0% | ≥ 60% on new code |
| Duplications | — | 24.6% | ≤ 3% on new code |

### 5.2 How to fix the issues

1. **Identify** the errors and warnings in SonarQube (Vulnerabilities → Bugs → Code Smells), grouped by file/component.
2. **Fix them in the source code**, then re-run the scan to confirm the finding is gone.
3. Use the failing **quality-gate condition** as your priority list — it tells you exactly what blocks a release.

### 5.3 Use the SonarQube MCP server to speed this up

A **SonarQube MCP server** is deployed on the staging host and can be connected to your AI coding agent (Claude Code, Cursor, OpenCode) so you can query and fix issues from your editor without clicking through the dashboard.

- **Server URL:** `http://192.168.1.106:8085/mcp` (only reachable from the staging LAN — see runbook §5.5)
- **Auth:** Bearer token — `SONARQUBE_MCP_TOKEN` (create one in SonarQube UI → My Account → Security → Tokens)
- **Setup per tool:** Claude Code, Cursor, and OpenCode configs are in runbook §5.5 — paste the token, then restart your agent.

Once connected, ask your agent things like *"what security vulnerabilities are open in the 1111 project"* — it pulls live data and can point you at the exact files to fix, which is much faster than browsing the UI.

### 5.4 Triage: false positives & issue status

Not every finding is a real bug. Some errors and warnings were counted as **false positives** during the DevSecOps review — they need **verification** by you:

- **Check each suspicious finding manually** in its code context (e.g. Base64/Timestamp "disclosure" inside minified JS bundles is usually just build hashes — not a real secret leak).
- **Adjust the rules** for confirmed false positives in SonarQube so they stop being flagged (quality profiles / rule configuration).
- **Change the status or severity** of an issue based on its actual impact — you can mark an issue as **False Positive**, **Won't Fix**, or **re-severity** it (e.g. downgrade a real-but-benign warning to INFO, or raise a genuine risk to CRITICAL) directly from the issue page.
- Re-run the scan after triage so the report reflects reality.

> **Do not lower the quality-gate thresholds** (issues > 0, coverage < 60%, duplication > 3%, ratings < A) to unblock merges without team sign-off — the gate is intentionally strict.

---

## 6. Phase 4 — CI/CD: Uncomment Tests & Fix Linting

The pipeline is green, but **parts of it were disabled to get there**. This phase makes CI strict again — the way it should be.

### 6.1 Uncomment the commented sections in CI

- In `.github/workflows/demo-ci.yml`, the `backend-tests` job only **type-checks** — the actual `npm test` (Vitest) step is **commented out**. Write/fix the tests, then **uncomment** that step so tests run on every push.
- Review any other commented blocks in the workflow files and re-enable them once their failures are fixed.

### 6.2 Resolve the linting problems CI detects

- Run the frontend checks locally to see what CI will flag:
  ```bash
  npm run lint
  npm run typecheck
  cd backend && npm run typecheck
  ```
- **Fix the actual lint errors/warnings** in the source code (they are currently tolerated because of the changes below).

### 6.3 Adjust lint rules to match the team's workflow

- Some **ESLint stylistic rules were disabled** in `.eslintrc.json` to get CI green. Go through them as a team and decide which ones to keep.
- **If a rule conflicts with the team's coding workflow**, you can **delete it or change it** directly in the lint rules file (`.eslintrc.json` / frontend ESLint config) — the goal is rules the team can actually live with, not rules that are silently ignored or that everyone disables.
- After any change, make sure CI still passes: push and watch `demo-ci.yml` go green.

### 6.4 Branches & how the team uses the pipeline day to day

**Branches you work in** (this is the active DevSecOps workspace):

| Branch | Purpose |
|---|---|
| `ci-workflow-update` | **Main working branch** — push here triggers CI. This is where the DevSecOps work (CI/CD, security, monitoring, this guide) lives. |
| `develop` | Integration branch — open PRs `ci-workflow-update → develop` to run the same CI checks. |
| `main` | Release/stable branch (upstream `Galylio-ai/1111`). Do **not** push directly. |
| `containerization` / `containerization-new` / `monitoring` / `test-ci` / `tailscale-connection` | Older feature/experiment branches — see the notes in each before deleting. |

**Workflow:**

| Branch | Trigger | What happens |
|---|---|---|
| `ci-workflow-update` (push) | `demo-ci.yml` | Full CI: lint, typecheck, build, tests, Docker build+push to GHCR, security scan |
| PR → `develop` | `demo-ci.yml` | Same pipeline |
| `demo-cd.yml` (manual) | Staging deploy | Deploys **only changed services** from GHCR to staging |

```bash
git checkout ci-workflow-update
git add . && git commit -m "fix: ..."
git push
gh run watch                      # watch CI
# CI green → optionally deploy to staging:
gh workflow run demo-cd.yml
```

**CD does NOT need to wait for the security scan:**
- CD (`demo-cd.yml`) only needs the **Docker images** that `docker-build` pushes to GHCR (and the `changed-services` artifact from CI).
- As soon as **`docker-build` is green**, you can trigger the deploy — you do **not** need to wait for the `security-scan` job to finish.
- The security workflow (`security-scanning.yml` — Trivy + ZAP) is **advisory** and can run **in parallel with the CD**: trigger the deploy now, and run `gh workflow run security-scanning.yml -f scan_target=all` alongside it. If the scan later finds something, roll back (§3.2) or fix and redeploy.

Key behavior to remember (runbook §3):
- Only **changed** services are built and deployed — don't panic if your service isn't in the logs.
- If a deploy is skipped, check whether the SHA is already running (it likely is).
- Rollback: `bash deploy/scripts/rollback.sh` on the host.

**Dev team responsibility:** CI quality checks (tests, typecheck, build, lint) must stay green on every push. If you merge broken code to `develop`, you break the release path.

---

## 7. How to Read GitHub Actions Workflow Outputs (reference)

This section teaches you how to **read and interact** with the pipeline output — the run page, the job logs, the Security Summary, and the artifacts. The workflow definitions themselves live in `.github/workflows/` (`demo-ci.yml`, `demo-cd.yml`, `security-scanning.yml`) — see them there for more detail.

### 7.1 Where to find the pipeline output

- **Web:** GitHub → **Actions** tab → click a workflow run (e.g. `CI`, `Security · Full Scan`).
- **CLI:**
  ```bash
  gh run list                        # recent runs + status
  gh run watch                       # watch the current run live
  gh run view <run-id> --log-failed  # show only the failing steps' logs
  ```

A run page shows:
- **Jobs** on the left (e.g. `detect-changes`, `docker-build`, `security-scan`) with ✔️/❌ per job.
- **Steps** inside each job — a ❌ job means **at least one step failed**; expand the job and find the red step.
- **Annotations** — ⚠️/❌ banners at the top of the run (e.g. *"2 errors and 31 warnings"*). Read every one; most are warnings, but an ❌ error usually means a real problem.
- **Artifacts** — downloadable files produced during the run (see §7.4).

### 7.2 The CI job chain and what each job reports

| Job (in `demo-ci.yml`) | What it does | If it fails, look at |
|---|---|---|
| `detect-changes` | Compares the push against the previous commit and decides which services changed | The paths-filter diff output |
| `backend-tests` | Installs deps + type-checks the backend | The typecheck errors in the log |
| `backend-quality` | Python (mailer) lint/tests — **soft-fail** (won't block CI) | The flake8/pytest output |
| `frontend-quality` | Installs deps + typecheck + build + audit | The `next build` / `npm audit` errors |
| `docker-build` | Matrix: builds the changed services and pushes `:latest` + `:sha-<commit>` to GHCR | Build errors per service |
| `security-scan` | Calls `security-scanning.yml` (Trivy + ZAP + SonarQube) | See §7.3 |

### 7.3 Reading the "Security · Full Scan / Security Summary"

When a full security scan runs, the **Security Summary** job produces a human-readable summary at the bottom of the run page. **Reference example** (numbers change per scan):


## Security Scanning Results

### Trivy Summary

| Severity | Total Found |
|----------|-------------|
| CRITICAL | **44** |
| HIGH | **479** |

### Per-Service Breakdown

| Service | CRITICAL | HIGH | Report |
|---------|----------|------|--------|
| alimentation | 🔴 3 | 38 | [View](../trivy-alimentation) |
| auth | 🔴 3 | 38 | [View](../trivy-auth) |
| ...
| frontend | 🔴 2 | 34 | [View](../trivy-frontend) |
| ...
| mailer | 🔴 12 | 65 | [View](../trivy-mailer) |
| ...

### ZAP Results

| Target | Status | Report |
|--------|--------|--------|
| Frontend (3001) | ✅ Completed | [View](../zap-report-baseline) |
| Backend (3000) | ✅ Completed | [View](../zap-report-baseline) |

### Download
- [All Reports (zip)](../security-reports)
- [Trivy SARIF](../trivy-gateway) — upload to GitHub Security tab
- [ZAP HTML Reports](../zap-report-baseline)

---

**How to read it:**
- **Trivy Summary** → the global CRITICAL/HIGH CVE count across all images. This is your "is the platform safer than last scan" number.
- **Per-Service Breakdown** → which image is worst. The **mailer** row (🔴 12 CRITICAL / 65 HIGH) is consistently the heaviest — its dependencies are the biggest attack surface. Click **View** on any row to open that service's full Trivy report.
- **ZAP Results** → whether the DAST scan completed and the link to the HTML report. `✅ Completed` means the scan ran; `FAIL` means the app returned failing-severity findings or the scan infra broke.
- **Download** → get the zip of all reports, the SARIF file (for GitHub Security tab), or the ZAP HTML reports.

### 7.4 Annotations you'll commonly see — what they mean

These are real examples from past runs. Most are **warnings you don't act on**, but know the difference:

| Annotation | Severity | What it means / what to do |
|---|---|---|
| *"Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced to run on Node.js 24..."* | ⚠️ Warning | GitHub actions are moving off Node 20. Harmless today, but **bump the action versions** in the workflows when convenient. |
| *"Security · Full Scan / SonarQube · Source Code Scan — Process completed with exit code 1"* | ❌ Error | The SonarQube scan step **failed**. Open the step log — usually an auth/`SONAR_TOKEN`/reachability problem, or the analysis failed. See runbook §5.1. |
| *"Security · Full Scan / ZAP · DAST Scan — Failed to CreateArtifact: 409 Conflict: an artifact with this name already exists"* | ❌ Error | The workflow was **re-run/retried** and tried to upload an artifact with the same name twice. Not a scan failure — fix by giving each run unique artifact names in the workflow. |
| *"Unexpected input(s) 'context_file', valid inputs are [...']"* | ⚠️ Warning | The ZAP action version doesn't accept the `context_file` input the workflow passes. Remove the input or upgrade the ZAP action. |
| *"This version of the SonarQube Scanner GitHub Action is no longer supported and contains a security vulnerability..."* | ⚠️ Warning | **Act on this one**: update `security-scanning.yml` to use `sonarsource/sonarqube-scan-action@v6`. |

Rule of thumb: a ❌ **error** annotation needs investigation; a ⚠️ **deprecation** warning is housekeeping; a ❌ **artifact 409** is a re-run artifact collision, not a real scan failure.

### 7.5 Artifacts — what each one is and how to read it

Artifacts are downloaded from the run page (bottom, **Artifacts** section) or via `gh run download <run-id>`. Reference list from a real full-scan run:

| Artifact | Size | What it is | How to read it |
|---|---|---|---|
| `changed-services` | 161 B | JSON list of the services that changed in this run | `cat changed-services` → e.g. `["auth","frontend"]`. **This is what CD reads** to decide which images to pull. |
| `security-reports` | 1.14 MB | Zip of all security reports combined | Download + unzip → all reports in one place |
| `trivy-<service>` (e.g. `trivy-gateway`, `trivy-mailer`) | ~80–160 KB | Per-service Trivy report (JSON + SARIF + table) | Open the table/JSON for CVE details (package, version, fix). SARIF is for the GitHub Security tab. `trivy-mailer` is largest because the mailer image has the most findings. |
| `zap-report-baseline` | ~50 KB | ZAP DAST report (HTML) | Open the HTML in a browser → each finding has ID, risk level (Info/Low/Medium/High) and the affected URLs (see runbook §5.3 for triage). |
| `zap_scan` | ~33 KB | ZAP scan raw output/log | The scanner's console output; useful when the HTML report is missing or a job fails. |

**How to interact with them:**
- **Download** the zip/HTML to your machine and open in a browser — no extra tools needed.
- **Search a log** for a specific error: `gh run view <run-id> --log | grep -i error`.
- **Upload the SARIF** file to the GitHub Security tab (Code Scanning) so CVEs show up as security alerts next to your PRs.

---

## 8. Phase 5 — Production  (team + Ops/DevSecOps)

Production deployment is **blocked on missing GitHub secrets** — request these from the mentor/project owner:

`VPS_HOST`, `VPS_PORT`, `VPS_USER`, `VPS_SSH_PRIVATE_KEY`, `PROD_ENV_FILE`

Once provided, this is the remaining checklist:

- [ ] All §3 security fixes merged
- [ ] All §4 code fixes merged
- [ ] SonarQube findings from §5 resolved (or triaged as false positive/won't fix)
- [ ] CI green with tests and lint enabled (§6)
- [ ] SonarQube gate passing on new code
- [ ] SSL/TLS (Certbot) configured for `1111.tn`
- [ ] `NEXT_PUBLIC_API_URL` set to public HTTPS URL
- [ ] `ALLOWED_ORIGINS` includes production origin
- [ ] Real SMTP credentials in place
- [ ] Database backup automation + restore drill (backlog #34, #65 — needs real DBs)
- [ ] Log rotation policy (backlog #17)
- [ ] Health alerts delivered (Alertmanager + Google Chat — backlog #52)
- [ ] Deploy via `vps-prod-cd.yml`, verify against the runbook §3 checklist

---

## 9. Near-Production Restructuring (forward-looking)

> **When to apply this:** these changes are **not** day-one urgent. Apply them once the team is actively fixing problems, the pipeline is stable, and releases become routine. They clean up the DevSecOps workspace and set the project up for production properly.

### 9.1 Branch strategy — retire `ci-workflow-update`, standardize branches

The DevSecOps work ran on the custom branch `ci-workflow-update` (CI triggers on push to it). Once that work is merged, this branch should be **removed** so there is one clean way to trigger the pipeline.

**Target branch model:**

| Branch | Purpose | How changes get in |
|---|---|---|
| `main` | Production/stable — the only branch that ever deploys to prod | PRs from `staging` only |
| `staging` | Pre-production — auto-deploys to the staging environment | PRs from `feature/*` |
| `feature/<name>` | All development work | Created from `staging`, merged via PR |
| `hotfix/<name>` | Urgent production fixes | Created from `main`, merged back to both `main` + `staging` |

**Cleanup steps (when ready):**
1. Merge all outstanding `ci-workflow-update` work to `staging` (or `develop`).
2. Update `demo-ci.yml` triggers: push/PR to `staging` instead of `ci-workflow-update`.
3. Delete `ci-workflow-update` locally and on origin after confirming nothing depends on it.
4. Prune the old experiment branches (`containerization`, `containerization-new`, `monitoring`, `test-ci`, `tailscale-connection`) after reviewing each.

### 9.2 PR & change-acceptance workflow

Standardize how changes are accepted — **no direct pushes** to `staging` or `main`:

1. Create `feature/<name>` from `staging`.
2. Push, open a PR → CI runs (tests, typecheck, lint, build) + SonarQube quality gate.
3. At least **one reviewer approval** required.
4. Merge only when CI is green **and** the quality gate passes (see §5).
5. After `staging` is validated, promote to production via a **release** (§9.3).

**Recommended GitHub branch-protection rules** (Settings → Branches):
- Require a pull request before merging (1 reviewer).
- Require status checks to pass (CI jobs + quality gate).
- Require branches to be up to date before merging.
- Block force-pushes and branch deletion on `main`/`staging`.

### 9.3 Releases & versioning

Introduce a formal release process:

- **Semantic versioning:** tag releases as `v<major>.<minor>.<patch>` (e.g. `v1.2.0`).
- **Image tags:** GHCR already gets `:latest` + `:sha-<commit>`; add a `:v1.2.0` tag on every release so you can always pin/roll back to a known-good version.
- **Release flow:**
  1. Cut a release branch/tag from `main`.
  2. Run full CI + full security scan (`security-scanning.yml -f scan_target=all`).
  3. Validate on staging first (§9.5).
  4. Deploy to production via `vps-prod-cd.yml`, tagged with the release version.
- Keep a per-release changelog (what changed, what was fixed, known issues).

### 9.4 Staging vs production workflows & environments

| Environment | Branch | CD workflow | Secrets |
|---|---|---|---|
| Staging | `staging` | `demo-cd.yml` (exists, working) | `STAGING_ENV_FILE` |
| Production | `main` + release tag | `vps-prod-cd.yml` (exists, blocked on VPS secrets) | `PROD_ENV_FILE` |

- Keep environment config **separate** — different `.env` per environment, never share secrets across envs.
- Production deploys should be gated on: CI green + quality gate + staging validation + release tag.

### 9.5 Testing / QA & pentest environment

Dedicate a **testing environment** that mirrors production but stays isolated. This is where QA, automated pentesting, and all pre-release validation happens:

- **Testing pyramid to cover:**
  - Unit tests (Vitest) — fast, run on every push in CI.
  - Integration tests — service ↔ DB / RabbitMQ, run on a staging-like env.
  - E2E tests — user journeys through the frontend + gateway (Playwright/Cypress).
  - DAST — OWASP ZAP baseline + full scans (already in place, §7).
  - Manual pentest — scheduled after releases or before major launches.
- **QA process & meetings:** hold a regular QA sync (e.g. weekly) to review coverage, SonarQube metrics, and scan results; define a **Definition of Done** that includes ≥ 60% new-code coverage and a passing security gate.
- **Organize resources:** separate test DBs with seeded test data, dedicated CI test-runner capacity, and a documented test-data reset procedure.

### 9.6 Dedicated servers for security tooling (scale-out)

When the shared staging host's workload grows — CPU/memory saturated, scans interfering with deploys, or SonarQube competing with app containers — **move the security tooling to dedicated hosts**:

- **Dedicated SonarQube server** — SonarQube is memory-hungry (`ulimits`/nofile requirements, Elasticsearch); isolating it removes a whole class of startup/app interference.
- **Dedicated scan/pentest server** — hosts ZAP full scans (30–60 min), Trivy, and scheduled automated pentests, so heavy scans never compete with the running application.

**Decision trigger:** when the staging host regularly exceeds ~70–80% CPU/mem during a scan, or a scan run starts failing because the app starves it of resources.

### 9.7 Network segmentation — VLANs & DMZ

Currently everything runs on one host behind UFW (22/80/443). For production, segment the network to shrink the attacker's territory:

```
┌─────────────┐   ┌──────────────────┐   ┌──────────────────┐
│  DMZ VLAN   │   │  Internal VLAN   │   │  Tools VLAN      │
│  (exposed)  │──▶│  (not exposed)   │   │  (restricted)    │
│             │   │                  │   │                  │
│ Nginx       │   │ Postgres ×6      │   │ SonarQube        │
│ Frontend    │   │ RabbitMQ         │   │ Monitoring stack │
│ Gateway     │   │ Backend services │   │ Scan/pentest     │
└─────────────┘   └──────────────────┘   └──────────────────┘
```

- **DMZ VLAN:** only the public-facing pieces (Nginx, frontend, gateway) — directly reachable from the internet.
- **Internal VLAN:** databases, RabbitMQ, backend services — **no direct internet access**; reachable only from the DMZ via the ports the app actually needs.
- **Tools VLAN:** SonarQube, monitoring, scanners — restricted to admins, not reachable from the DMZ.
- **Firewall rules:** allow only the required flows between VLANs; deny everything else by default (per-department/environment segmentation with `department`/`environment` VLANs if needed).

**Why:** if the DMZ is compromised, internal databases and tools stay unreachable — the attacker's blast radius is limited to the public tier.

### 9.8 Long-term goals (scaling to more teams/departments)

These apply when demand grows, the platform needs to scale beyond the current single-host setup.

#### Scaling the architecture (single-host Compose → real scale)

- Move from single-host Docker Compose to **Kubernetes** (or at least a managed cluster) for autoscaling, self-healing, and multi-host HA.
- Add **load balancing + horizontal scaling** per service (gateway and frontend first).
- Database scale-out: **PgBouncer connection pooling, read replicas, streaming replication** per domain DB.
- Introduce a **Redis cache layer** (sessions, hot API responses) to offload Postgres.
- Add **CDN + edge caching** for public product/category pages.
- Add **OpenTelemetry distributed tracing** (Jaeger/Tempo) so cross-service requests are traceable across 10+ services.
- Define **SLOs** per service (uptime, latency, error budget) and monitor them in Grafana.

#### Security at scale (per-team + supply chain)

- **Security champions** embedded in each team; security reviews become part of every PR.
- Automate **dependency updates** (Dependabot/Renovate) so CVEs are patched in PRs, not discovered by scans.
- Add **secrets scanning** (Gitleaks) as a CI gate so a leaked JWT can't happen again.

#### Compliance & governance (department-level)

- Per-department **RBAC/IAM** — read-only access for QA, separate prod access for the release team, least-privilege everywhere.
- Formal **change management** for production (release calendar, CAB approval for risky changes).
- **DR / audit trails**: long-term log retention, backup restores tested on a schedule, evidence for audits.

#### Delivery & reliability culture

- Track **DORA metrics** (deploy frequency, lead time, MTTR, change-failure rate) per team.
- Set up **on-call rotation** with PagerDuty / Alertmanager → Google Chat (already blocked — unblocks at scale).
- Incident **postmortems** — blameless, with action items tracked.
- Introduce **chaos engineering** (game days, fault injection) once staging is stable.

---

## 10. What the Team Should Hand Back to Ops/DevSecOps

Please document these when you pick them up:

- Table names to spot-check after a DB restore (runbook §4.2)
- Exact behavior of `bootstrap-vps.sh` steps (runbook §4.3)
- Any risk-acceptance decisions you make about the flagged CVEs (runbook §5.2)
- Your **false-positive triage log** from §5.4 (which SonarQube/ZAP findings you verified as not real, and the rules you adjusted)

---

## 11. Quick Reference — Key Commands

```bash
# Local
docker compose up -d                     # start all 20 services
npm run dev                              # frontend :3001
cd backend && npm run build && npm test  # backend
npm run lint && npm run typecheck        # frontend checks

# Staging (run from the host, /opt/1111/current/deploy/scripts/)
./check-containers.sh                    # health + smoke checks
bash deploy-ghcr.sh                      # deploy latest
bash rollback.sh                         # rollback to previous SHA

# CI/CD
gh run watch                             # watch pipeline
gh workflow run demo-cd.yml              # deploy to staging
gh workflow run security-scanning.yml -f scan_target=all   # full security scan

# SonarQube (staging)
# Web UI:    http://<staging-host>:8084   (admin / Sonarqube@123)
# MCP server: http://192.168.1.106:8085/mcp  (Bearer SONARQUBE_MCP_TOKEN, runbook §5.5)

# Monitoring (staging)
curl -i http://localhost:3000/health     # gateway
docker compose -f docker-compose.staging.yml ps
```

---

*If anything in this guide contradicts the live system, trust the server and update both this guide and the runbook.*
