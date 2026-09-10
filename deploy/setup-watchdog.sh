#!/bin/bash
# ============================================================================
# setup-watchdog.sh — installs the every-minute watchdog cron (runs as CPANEL_USER)
# Idempotent: safe to run multiple times. Fixes the recurring "backend down" issue.
# Usage:  bash /home/ezunitap/repo/deploy/setup-watchdog.sh
# ============================================================================
set -e
CPANEL_USER="ezunitap"
WATCHDOG="/home/${CPANEL_USER}/repo/deploy/watchdog.sh"

chmod +x "$WATCHDOG" 2>/dev/null || true

CRON_CURRENT="$(crontab -l 2>/dev/null || true)"
if echo "$CRON_CURRENT" | grep -q "deploy/watchdog.sh"; then
    echo "  ✅ watchdog cron already installed"
else
    (echo "$CRON_CURRENT"; echo "* * * * * bash ${WATCHDOG}") | crontab -
    echo "  ✅ watchdog cron installed — checks backend every minute and auto-restarts if down"
fi
echo ">>> setup-watchdog.sh DONE"
