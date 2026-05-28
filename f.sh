#!/usr/bin/env bash
# Unitap — One-shot deploy + fix script.
# Run on the VPS after every git pull (or after editing keys.txt).
#
# What it does:
#   1. Reads STRIPE_API_KEY + STRIPE_WEBHOOK_SECRET from /home/ezunitap/public_html/keys.txt
#   2. Updates /opt/ezunitap/backend/.env (preserving MONGO_URL/DB_NAME)
#   3. Syncs backend Python files from this repo to /opt/ezunitap/backend/
#   4. Syncs frontend build/ from this repo to /home/ezunitap/public_html/
#   5. Restarts the backend (port 8007)
#
# USAGE:
#   cd /home/ezunitap/repo && git pull && sudo ./f.sh

set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
KEYS_FILE="/home/ezunitap/public_html/keys.txt"
ENV_FILE="/opt/ezunitap/backend/.env"
APP_DIR="/opt/ezunitap/backend"
WEB_DIR="/home/ezunitap/public_html"
APP_USER="ezunitap"
PORT="8007"

echo ">> 1. Reading Stripe keys from $KEYS_FILE"
if [[ ! -f "$KEYS_FILE" ]]; then
  echo "[!!] $KEYS_FILE not found. Create it with:"
  echo "        STRIPE_API_KEY=sk_test_..."
  echo "        STRIPE_WEBHOOK_SECRET=whsec_..."
  exit 1
fi
STRIPE_KEY=$(grep -E '^STRIPE_API_KEY=' "$KEYS_FILE" | head -1 | sed 's/^STRIPE_API_KEY=//; s/^"//; s/"$//' | tr -d '\r\n')
STRIPE_WEBHOOK=$(grep -E '^STRIPE_WEBHOOK_SECRET=' "$KEYS_FILE" | head -1 | sed 's/^STRIPE_WEBHOOK_SECRET=//; s/^"//; s/"$//' | tr -d '\r\n')
if [[ -z "$STRIPE_KEY" || -z "$STRIPE_WEBHOOK" ]]; then
  echo "[!!] Missing key in $KEYS_FILE"
  exit 1
fi
echo "   STRIPE_API_KEY length: ${#STRIPE_KEY} (prefix: ${STRIPE_KEY:0:12}...)"
echo "   STRIPE_WEBHOOK_SECRET length: ${#STRIPE_WEBHOOK} (prefix: ${STRIPE_WEBHOOK:0:10}...)"

echo ">> 2. Updating $ENV_FILE"
cp "$ENV_FILE" "${ENV_FILE}.bak.$(date +%s)"
for VAR in STRIPE_API_KEY STRIPE_WEBHOOK_SECRET; do
  VAL=$([ "$VAR" = "STRIPE_API_KEY" ] && echo "$STRIPE_KEY" || echo "$STRIPE_WEBHOOK")
  if grep -q "^${VAR}=" "$ENV_FILE"; then
    sed -i "s|^${VAR}=.*|${VAR}=${VAL}|" "$ENV_FILE"
  else
    echo "${VAR}=${VAL}" >> "$ENV_FILE"
  fi
done
echo "   .env updated (keys masked):"
grep -E '^STRIPE_' "$ENV_FILE" | sed -E 's/(sk_[a-z]+_[A-Za-z0-9]{6})[A-Za-z0-9]+([A-Za-z0-9]{4})/\1...REDACTED...\2/g; s/(whsec_)[A-Za-z0-9]+/\1...REDACTED.../g' | sed 's/^/        /'

echo ">> 3. Syncing backend code from $REPO_DIR/backend → $APP_DIR"
# Sync all .py files + requirements.txt; preserve venv/ and .env
rsync -a --delete \
  --exclude='.env*' \
  --exclude='venv/' \
  --exclude='__pycache__/' \
  --exclude='*.pyc' \
  --exclude='tests/' \
  "$REPO_DIR/backend/" "$APP_DIR/"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
echo "   Backend code synced"

echo ">> 4. Syncing frontend build from $REPO_DIR/frontend/build → $WEB_DIR"
if [[ -d "$REPO_DIR/frontend/build" ]]; then
  rsync -a --delete "$REPO_DIR/frontend/build/" "$WEB_DIR/"
  chown -R "$APP_USER:$APP_USER" "$WEB_DIR"
  echo "   Frontend build synced"
else
  echo "   [skip] frontend/build/ not found"
fi

echo ">> 5. Restarting backend on port $PORT"
pkill -f "uvicorn.*server:app.*--port ${PORT}" 2>/dev/null || true
sleep 2
sudo -u "$APP_USER" -- bash -c "cd '${APP_DIR}' && nohup ./venv/bin/uvicorn server:app --host 127.0.0.1 --port ${PORT} --workers 1 > /tmp/ezunitap-backend.log 2>&1 &"
sleep 3

if pgrep -f "uvicorn.*server:app.*--port ${PORT}" >/dev/null; then
  echo "   [OK] Backend running"
else
  echo "   [FAIL] Backend did not start. Last log:"
  tail -30 /tmp/ezunitap-backend.log
  exit 1
fi

echo ">> 6. Smoke test"
sleep 1
curl -s https://ezunitap.com/api/payments/plans -o /dev/null -w "   ezunitap.com/api/payments/plans -> HTTP %{http_code}\n"

echo ""
echo "=========================================="
echo "  DONE — try ezunitap.com (hard refresh)"
echo "=========================================="
echo "If something fails:  tail -50 /tmp/ezunitap-backend.log"
