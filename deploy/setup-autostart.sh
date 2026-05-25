#!/bin/bash
# ============================================================================
# setup-autostart.sh — registers @reboot crontab so backend survives server reboots
# Runs as CPANEL_USER
# ============================================================================
set -e

CPANEL_USER="ezunitap"
RESTART_SCRIPT="/home/${CPANEL_USER}/restart.sh"

if [ ! -f "$RESTART_SCRIPT" ]; then
    echo "X $RESTART_SCRIPT not found — run install_server.sh first"
    exit 1
fi

# Get current crontab (empty string if none)
CRON_CURRENT="$(crontab -l 2>/dev/null || true)"

# Add @reboot line only if not already present
if echo "$CRON_CURRENT" | grep -q "$RESTART_SCRIPT"; then
    echo "  ✅ @reboot already configured"
else
    (echo "$CRON_CURRENT"; echo "@reboot bash $RESTART_SCRIPT > /home/${CPANEL_USER}/restart.log 2>&1") | crontab -
    echo "  ✅ @reboot crontab installed"
fi

# Daily MongoDB backup at 3 AM (KEEP DATA SAFE!)
BACKUP_DIR="/home/${CPANEL_USER}/backups"
mkdir -p "$BACKUP_DIR"

BACKUP_CMD="0 3 * * * mongodump --db unitap_prod --out ${BACKUP_DIR}/\$(date +\\%Y\\%m\\%d) --quiet && find ${BACKUP_DIR} -mindepth 1 -maxdepth 1 -type d -mtime +14 -exec rm -rf {} \\;"

CRON_CURRENT="$(crontab -l 2>/dev/null || true)"
if echo "$CRON_CURRENT" | grep -q "mongodump --db unitap_prod"; then
    echo "  ✅ daily mongo backup already configured"
else
    (echo "$CRON_CURRENT"; echo "$BACKUP_CMD") | crontab -
    echo "  ✅ daily mongo backup installed (3 AM, keeps 14 days at $BACKUP_DIR)"
fi

echo ">>> setup-autostart.sh DONE"
