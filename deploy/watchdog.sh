#!/bin/bash
# ============================================================================
# watchdog.sh — auto-heals the UniTech backend.
# Runs every minute from cron. If the API on :8007 is not answering, it
# restarts the backend via restart.sh. Also flags if MongoDB is down.
# This is what keeps ezunitech.com from staying down after a crash.
# ============================================================================
CPANEL_USER="ezunitap"
PORT=8007
HOME_DIR="/home/${CPANEL_USER}"
RESTART="${HOME_DIR}/restart.sh"
LOG="${HOME_DIR}/watchdog.log"

ts() { date '+%Y-%m-%d %H:%M:%S'; }

# 1) MongoDB must be up first (the API needs it)
if ! pgrep -x mongod >/dev/null 2>&1; then
    echo "$(ts) [WARN] mongod is NOT running — data layer is down" >> "$LOG"
fi

# 2) API health check (short timeout so cron never hangs)
if curl -sf -m 8 "http://127.0.0.1:${PORT}/api/" >/dev/null 2>&1; then
    exit 0   # healthy, nothing to do
fi

echo "$(ts) [DOWN] API not responding on :${PORT} — restarting backend" >> "$LOG"
if [ -x "$RESTART" ]; then
    bash "$RESTART" >> "$LOG" 2>&1
else
    echo "$(ts) [ERROR] $RESTART not found/executable" >> "$LOG"
fi

# keep the log from growing forever (last 500 lines)
tail -n 500 "$LOG" > "${LOG}.tmp" 2>/dev/null && mv "${LOG}.tmp" "$LOG" 2>/dev/null
