#!/bin/bash
# ============================================================================
# fixit.sh — Full clean redeploy + verification for Unitap
# Run as root:   bash /home/ezunitap/repo/deploy/fixit.sh
# Or one-liner:  curl -sSL https://raw.githubusercontent.com/Pzsuave007/ezunitap/main/deploy/fixit.sh | bash
# ============================================================================
set -e
CPANEL_USER="ezunitap"
REPO="/home/${CPANEL_USER}/repo"
PROD="/opt/${CPANEL_USER}/backend"
LOG="/tmp/unitap-deploy.log"

BLUE='\033[0;34m'; GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
sec()  { echo -e "\n${BLUE}===== $1 =====${NC}"; }
ok()   { echo -e "  ${GREEN}✅ $1${NC}"; }
fail() { echo -e "  ${RED}❌ $1${NC}"; }
warn() { echo -e "  ${YELLOW}⚠️  $1${NC}"; }

[ "$EUID" -ne 0 ] && { fail "Run as root"; exit 1; }

sec "A. Python version available"
PY=$(which python3.9 2>/dev/null || which python3 2>/dev/null)
if [ -n "$PY" ]; then ok "$PY $($PY --version 2>&1)"; else fail "no python3 found"; fi

sec "B. cPanel user shell access"
PASSWD_LINE=$(grep "^${CPANEL_USER}:" /etc/passwd)
echo "  $PASSWD_LINE"
if echo "$PASSWD_LINE" | grep -qE "(bash|jailshell)"; then
  ok "shell looks usable"
else
  warn "shell may be /bin/false or noshell — install_server.sh uses 'su -s /bin/bash' to bypass"
fi
SU_TEST=$(su -s /bin/bash -l "$CPANEL_USER" -c "echo OK && which python3" 2>&1 || true)
echo "  su test → $SU_TEST"

sec "C. frontend/build present in repo"
if [ -f "$REPO/frontend/build/index.html" ]; then
  ok "index.html present"
  ls "$REPO/frontend/build/static/" 2>/dev/null | head -5 | sed 's/^/    /'
else
  fail "$REPO/frontend/build/index.html MISSING — Save to GitHub didn't include the build"
fi

sec "D. git pull (get latest deploy fixes)"
cd "$REPO"
git fetch origin 2>&1 | sed 's/^/  /' || true
git reset --hard origin/main 2>&1 | sed 's/^/  /'
ok "repo synced to origin/main"

sec "E. wipe broken venv"
if [ -d "$PROD/venv" ]; then
  rm -rf "$PROD/venv"
  ok "deleted $PROD/venv"
else
  ok "no venv to wipe"
fi

sec "F. run deploy.sh (capturing ALL output to $LOG)"
chmod +x "$REPO/deploy.sh" "$REPO/deploy/"*.sh "$REPO/bootstrap.sh" 2>/dev/null || true
set +e
bash "$REPO/deploy.sh" 2>&1 | tee "$LOG"
RC=${PIPESTATUS[0]}
set -e

if [ $RC -eq 0 ]; then
  ok "deploy.sh exited 0"
else
  fail "deploy.sh exited $RC — see last lines above"
fi

sec "G. Post-deploy quick checks"
if pgrep -af "uvicorn.*:8007" >/dev/null; then ok "uvicorn running"; else fail "uvicorn NOT running"; fi
LOCAL=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:8007/api/" --max-time 5)
[ "$LOCAL" = "200" ] && ok "127.0.0.1:8007/api/ → 200" || fail "127.0.0.1:8007/api/ → $LOCAL"
EXT=$(curl -s -o /dev/null -w "%{http_code}" "https://ezunitap.com/" --max-time 10)
echo "  https://ezunitap.com/   →   HTTP $EXT"
EXT_API=$(curl -s -o /dev/null -w "%{http_code}" "https://ezunitap.com/api/" --max-time 10)
echo "  https://ezunitap.com/api/ →   HTTP $EXT_API"

if [ -f "$PROD/backend.log" ]; then
  echo ""
  echo "  --- last 20 lines of backend.log ---"
  tail -n 20 "$PROD/backend.log" | sed 's/^/    /'
fi

sec "DONE"
echo "  Full deploy log saved to: $LOG"
echo "  Paste the entire output of this script to the chat."
