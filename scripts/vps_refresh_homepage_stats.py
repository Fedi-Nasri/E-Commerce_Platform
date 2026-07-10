#!/usr/bin/env python3
"""Pull latest code, refresh homepage stats in PostgreSQL, rebuild frontend."""
import os
import sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8")
HOST, USER, PW = "164.132.47.136", "ubuntu", "galylio-ai"
ROOT = "/home/ubuntu/project"
STOCK_DIR = "/home/ubuntu/scrapping/data"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
print(f"Connecting to {HOST}...")
ssh.connect(HOST, username=USER, password=PW, timeout=30)

cmds = [
    f"cd {ROOT} && git fetch origin main && git reset --hard origin/main",
    (
        f"cd {ROOT} && export $(grep -E '^RETAIL_DB_URL=' .env.local | xargs) && "
        f"STOCK_DIR={STOCK_DIR} SHOP_SCRAPE_DIR={STOCK_DIR} "
        f"node scripts/refresh-homepage-stats.mjs --skip-compute 2>&1"
    ),
    f"cd {ROOT} && npm run build 2>&1 | tail -25",
    "pm2 restart frontend",
    "curl -s 'https://production.1111.tn/api/stats/shop-avg-prices' | head -c 200",
]

for cmd in cmds:
    print("\n$", cmd[:120])
    _, o, e = ssh.exec_command(cmd, timeout=900)
    out = o.read().decode("utf-8", errors="replace")
    err = e.read().decode("utf-8", errors="replace")
    if out.strip():
        print(out[-4000:])
    if err.strip() and "warning" not in err.lower():
        print("ERR:", err[-800:])

ssh.close()
print("\n✓ VPS homepage stats refresh done")
