#!/usr/bin/env python3
"""Run grocery crossing compute on VPS and download updated JSON."""
import sys, paramiko
sys.stdout.reconfigure(encoding="utf-8")
HOST, USER, PW = "164.132.47.136", "ubuntu", "galylio-ai"
ROOT = "/home/ubuntu/project"
LOCAL_JSON = r"c:\Users\stage.td\Desktop\front new 1111\lib\data\grocery-crossing-ranking.json"
LOCAL_SCRIPT = r"c:\Users\stage.td\Desktop\front new 1111\scripts\compute-grocery-crossing.mjs"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PW, timeout=30)
sftp = ssh.open_sftp()
sftp.put(LOCAL_SCRIPT, f"{ROOT}/scripts/compute-grocery-crossing.mjs")
sftp.close()

cmd = f"cd {ROOT} && set -a && source .env.local && set +a && node scripts/compute-grocery-crossing.mjs"
print("$", cmd)
_, o, e = ssh.exec_command(cmd, timeout=300)
out = o.read().decode("utf-8", errors="replace")
err = e.read().decode("utf-8", errors="replace")
print(out)
if err.strip():
    print("ERR:", err)

sftp = ssh.open_sftp()
sftp.get(f"{ROOT}/lib/data/grocery-crossing-ranking.json", LOCAL_JSON)
sftp.close()
ssh.close()
print("Downloaded JSON to local workspace")
