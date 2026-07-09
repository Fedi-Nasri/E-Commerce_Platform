#!/usr/bin/env python3
"""Deploy clim brand pages to VPS."""
import os
import sys
from pathlib import Path

import paramiko

HOST, USER, PW = "164.132.47.136", "ubuntu", "galylio-ai"
ROOT = "/home/ubuntu/project"
LOCAL = Path(r"C:\Users\stage.td\Desktop\front new 1111")

FILES = [
    "lib/climBrandUtils.ts",
    "lib/climStats.ts",
    "components/ClimStockSlider.tsx",
    "components/ClimBrandBadge.tsx",
    "components/ClimBrandProductList.tsx",
    "components/ClimStockSection.tsx",
    "app/climatiseurs-stock/page.tsx",
    "app/climatiseurs-stock/marque/[brand]/page.tsx",
]


def ensure_dir(sftp, path: str):
    parts = [p for p in path.split("/") if p]
    cur = ""
    for p in parts:
        cur += "/" + p
        try:
            sftp.stat(cur)
        except FileNotFoundError:
            sftp.mkdir(cur)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PW, timeout=30)
    sftp = ssh.open_sftp()
    for rel in FILES:
        local = LOCAL / rel.replace("/", os.sep)
        remote = f"{ROOT}/{rel.replace(chr(92), '/')}"
        if not local.exists():
            print("SKIP", rel)
            continue
        ensure_dir(sftp, os.path.dirname(remote))
        print("UP", rel)
        sftp.put(str(local), remote)
    sftp.close()
    cmd = f"cd {ROOT} && npm run build && pm2 restart frontend"
    print("BUILD...")
    _, o, e = ssh.exec_command(cmd, timeout=600)
    out = o.read().decode("utf-8", errors="replace")
    err = e.read().decode("utf-8", errors="replace")
    print(out[-2500:] if out else "")
    if err:
        print(err[-800:])
    ssh.close()
    print("Done.")


if __name__ == "__main__":
    main()
