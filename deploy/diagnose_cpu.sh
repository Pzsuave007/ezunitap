#!/bin/bash
# ============================================================================
# diagnose_cpu.sh — READ-ONLY CPU/RAM investigator for the UniTech VPS
# (AlmaLinux + cPanel). Touches NOTHING. Just reports what's eating the CPU.
#
# Usage on the VPS:
#   bash diagnose_cpu.sh                # print to screen
#   bash diagnose_cpu.sh > /tmp/cpu_report.txt 2>&1   # save to a file
# ============================================================================
set +e
line(){ printf '\n\033[1;36m========== %s ==========\033[0m\n' "$1"; }

echo "UniTech CPU/RAM diagnostic — $(date)"
echo "Host: $(hostname)"

line "1) LOAD AVERAGE & UPTIME"
uptime
echo "CPU cores: $(nproc)"
echo "(Rule of thumb: load average should stay BELOW the number of cores.)"

line "2) TOP 15 PROCESSES BY CPU"
ps -eo pid,ppid,user,%cpu,%mem,etime,cmd --sort=-%cpu | head -16

line "3) TOP 15 PROCESSES BY MEMORY"
ps -eo pid,ppid,user,%cpu,%mem,etime,cmd --sort=-%mem | head -16

line "4) MEMORY & SWAP (low RAM + swapping = high CPU)"
free -h
echo "--- swappiness ---"; cat /proc/sys/vm/swappiness 2>/dev/null

line "5) SUSPECT #1 — ffmpeg (Reel/video rendering is VERY CPU heavy)"
FF=$(pgrep -a ffmpeg)
if [ -n "$FF" ]; then
  echo "⚠️  ffmpeg IS RUNNING:"; echo "$FF"
  echo "Count: $(pgrep -c ffmpeg)"
  echo ">>> If several ffmpeg run at once on a low-RAM VPS, THIS is your CPU spike."
else
  echo "✅ No ffmpeg running right now."
fi

line "6) BACKEND — uvicorn / gunicorn / python (FastAPI)"
ps -eo pid,%cpu,%mem,etime,cmd --sort=-%cpu | grep -E "uvicorn|gunicorn|python" | grep -v grep | head -10
echo "Backend process count: $(pgrep -fc 'uvicorn|gunicorn' )"

line "7) MONGODB (mongod)"
ps -eo pid,%cpu,%mem,etime,cmd --sort=-%cpu | grep -E "mongod" | grep -v grep | head
echo "--- Mongo current ops > 1s (needs mongosh/mongo) ---"
if command -v mongosh >/dev/null 2>&1; then
  mongosh --quiet --eval 'db.getSiblingDB("admin").currentOp({"active":true,"secs_running":{"$gte":1}}).inprog.forEach(o=>print(o.secs_running+"s  "+o.op+"  "+o.ns+"  "+JSON.stringify(o.command).slice(0,160)))' 2>/dev/null
elif command -v mongo >/dev/null 2>&1; then
  mongo --quiet --eval 'db.getSiblingDB("admin").currentOp({"active":true,"secs_running":{"$gte":1}}).inprog.forEach(function(o){print(o.secs_running+"s  "+o.op+"  "+o.ns)})' 2>/dev/null
else
  echo "(mongosh/mongo not found — skip)"
fi

line "8) APACHE / WEB SERVER (httpd) — process count & top"
echo "httpd process count: $(pgrep -c httpd)"
ps -eo pid,%cpu,%mem,etime,cmd --sort=-%cpu | grep -E "httpd|apache" | grep -v grep | head -8

line "9) NODE / YARN (should NOT run in prod — VPS has low RAM!)"
NODE=$(pgrep -a "node|yarn" )
if [ -n "$NODE" ]; then
  echo "⚠️  node/yarn RUNNING (a stray build/dev server burns CPU+RAM):"; echo "$NODE"
else
  echo "✅ No node/yarn running."
fi

line "10) CRON JOBS (a backup/render job may run on a schedule)"
echo "--- root crontab ---"; crontab -l 2>/dev/null | grep -v '^#'
for u in ezunitap; do
  echo "--- $u crontab ---"; crontab -u "$u" -l 2>/dev/null | grep -v '^#'
done
echo "--- system cron dirs ---"; ls -1 /etc/cron.d/ 2>/dev/null

line "11) DISK USAGE (a full disk can spike CPU/IO)"
df -h / /home /tmp 2>/dev/null | sort -u
echo "--- biggest dirs under the app (top 8) ---"
du -sh /opt/ezunitap 2>/dev/null
du -sh /home/ezunitap/* 2>/dev/null | sort -hr | head -8

line "12) DISK I/O WAIT (high %wa = disk bottleneck, not CPU)"
if command -v top >/dev/null 2>&1; then top -bn1 | grep -E "Cpu|%Cpu" | head -1; fi

line "13) NETWORK CONNECTIONS (count by state — spot a flood/bot)"
if command -v ss >/dev/null 2>&1; then
  ss -ant 2>/dev/null | awk 'NR>1{print $1}' | sort | uniq -c | sort -rn
  echo "--- top 10 remote IPs by open connections (possible bot/scrape) ---"
  ss -ant 2>/dev/null | awk 'NR>1{split($5,a,":"); print a[1]}' | sort | uniq -c | sort -rn | head -10
fi

line "14) RECENT BACKEND LOG TAIL (errors/loops?)"
for f in /opt/ezunitap/backend/*.log /home/ezunitap/logs/*.log /var/log/uvicorn*.log; do
  [ -f "$f" ] && { echo "--- $f (last 15) ---"; tail -n 15 "$f"; }
done

line "DONE"
echo "Quick read:"
echo "  • ffmpeg in section 5  -> a Reel is rendering (expected, temporary). Many at once = the problem."
echo "  • httpd count very high -> web traffic/bot flood (see section 13)."
echo "  • mongod high + slow ops in 7 -> a missing index / heavy query."
echo "  • node/yarn in 9        -> kill it; prod should never build here."
echo "  • high %wa / swap used  -> low RAM, disk thrashing (sections 4 & 12)."
