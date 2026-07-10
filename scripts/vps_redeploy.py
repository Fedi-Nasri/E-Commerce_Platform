#!/usr/bin/env python3
import sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8")
HOST, USER, PW = "164.132.47.136", "ubuntu", "galylio-ai"
ROOT = "/home/ubuntu/project"
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PW, timeout=30)
cmds = [
    f"cd {ROOT} && git fetch origin main && git reset --hard origin/main",
    f"cd {ROOT} && npm run build 2>&1 | tail -25",
    "pm2 restart frontend",
    "curl -sI 'https://production.1111.tn/classement/smartphones' | head -8",
    "curl -sI 'https://production.1111.tn/classement/electromenager' | head -8",
]
for cmd in cmds:
    print("$", cmd[:110])
    _, o, e = ssh.exec_command(cmd, timeout=600)
    out = o.read().decode("utf-8", errors="replace")
    err = e.read().decode("utf-8", errors="replace")
    if out.strip():
        print(out[-3500:])
    if err.strip():
        print("ERR:", err[-800:])
ssh.close()
print("Done")
