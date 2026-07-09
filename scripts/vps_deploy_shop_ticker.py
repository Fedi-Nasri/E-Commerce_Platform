#!/usr/bin/env python3
"""Deploy shop avg prices JSON + ticker components to VPS."""
import os
import sys
from pathlib import Path

try:
    import paramiko
except ImportError:
    print("Installing paramiko...")
    os.system(f"{sys.executable} -m pip install paramiko -q")
    import paramiko

HOST = "164.132.47.136"
USER = "ubuntu"
PASSWORD = "galylio-ai"
REMOTE_ROOT = "/home/ubuntu/project"
LOCAL_ROOT = Path(r"C:\Users\stage.td\Desktop\front new 1111")

FILES = [
    "lib/data/retailShopAvgPrices.json",
    "lib/retailShopAvgPrices.ts",
    "app/api/stats/shop-avg-prices/route.ts",
    "components/ShopMarketTicker.tsx",
    "components/ShopMarketSection.tsx",
    "app/page.tsx",
]


def ensure_remote_dir(sftp, remote_dir: str):
    parts = remote_dir.strip("/").split("/")
    cur = ""
    for p in parts:
        cur += "/" + p
        try:
            sftp.stat(cur)
        except FileNotFoundError:
            sftp.mkdir(cur)


def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {HOST}...")
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    sftp = ssh.open_sftp()

    for rel in FILES:
        local = LOCAL_ROOT / rel.replace("/", os.sep)
        remote = f"{REMOTE_ROOT}/{rel.replace(chr(92), '/')}"
        if not local.exists():
            print(f"  SKIP missing local: {local}")
            continue
        ensure_remote_dir(sftp, os.path.dirname(remote))
        print(f"  UP {rel}")
        sftp.put(str(local), remote)

    sftp.close()
    print("\nBuilding on VPS...")
    cmds = [
        f"cd {REMOTE_ROOT} && npm run build 2>&1 | tail -25",
        "pm2 restart all 2>/dev/null || pm2 restart project 2>/dev/null || true",
        "pm2 list 2>/dev/null | head -8 || true",
    ]
    for cmd in cmds:
        print(f"\n$ {cmd[:80]}...")
        stdin, stdout, stderr = ssh.exec_command(cmd, timeout=600)
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        if out.strip():
            print(out.strip()[-3000:])
        if err.strip() and "warning" not in err.lower():
            print("stderr:", err.strip()[-500:])

    ssh.close()
    print("\n✓ Deploy complete.")


if __name__ == "__main__":
    main()
