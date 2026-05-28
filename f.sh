#!/usr/bin/env bash
# Unitap — Stripe production fix: load API keys from external file + restart backend.
#
# SETUP (one-time):
#   1. Create the keys file (outside the repo so it never goes to git):
#        nano /home/ezunitap/public_html/keys.txt
#      Paste exactly two lines (no quotes, no spaces):
#        STRIPE_API_KEY=sk_test_xxx...
#        STRIPE_WEBHOOK_SECRET=whsec_xxx...
#      Save (Ctrl+O, Enter, Ctrl+X).
#   2. Make it readable only by you:
#        chmod 600 /home/ezunitap/public_html/keys.txt
#
# USAGE:
#   cd /home/ezunitap/repo && git pull && sudo ./f.sh
#
# What it does:
#   - Reads STRIPE_API_KEY + STRIPE_WEBHOOK_SECRET from keys.txt
#   - Backs up backend/.env
#   - Writes/updates those two values in backend/.env
#   - Restarts the ezunitap backend process (port 8007)

set -e

KEYS_FILE="/home/ezunitap/public_html/keys.txt"
ENV_FILE="/opt/ezunitap/backend/.env"
APP_DIR="/opt/ezunitap/backend"
APP_USER="ezunitap"
PORT="8007"

echo ">> 1. Reading keys from $KEYS_FILE"
if [[ ! -f "$KEYS_FILE" ]]; then
  echo "[!!] $KEYS_FILE not found."
  echo "    Create it with two lines:"
  echo "        STRIPE_API_KEY=sk_test_..."
  echo "        STRIPE_WEBHOOK_SECRET=whsec_..."
  exit 1
fi

# Source the keys file in a subshell to extract values safely.
STRIPE_KEY=$(grep -E '^STRIPE_API_KEY=' "$KEYS_FILE" | head -1 | sed 's/^STRIPE_API_KEY=//; s/^"//; s/"$//' | tr -d '\r\n')
STRIPE_WEBHOOK=$(grep -E '^STRIPE_WEBHOOK_SECRET=' "$KEYS_FILE" | head -1 | sed 's/^STRIPE_WEBHOOK_SECRET=//; s/^"//; s/"$//' | tr -d '\r\n')

if [[ -z "$STRIPE_KEY" ]]; then
  echo "[!!] STRIPE_API_KEY is empty in $KEYS_FILE"
  exit 1
fi
if [[ -z "$STRIPE_WEBHOOK" ]]; then
  echo "[!!] STRIPE_WEBHOOK_SECRET is empty in $KEYS_FILE"
  exit 1
fi
echo "   STRIPE_API_KEY length: ${#STRIPE_KEY} chars (prefix: ${STRIPE_KEY:0:12}...)"
echo "   STRIPE_WEBHOOK_SECRET length: ${#STRIPE_WEBHOOK} chars (prefix: ${STRIPE_WEBHOOK:0:10}...)"

echo ">> 2. Backing up $ENV_FILE"
cp "$ENV_FILE" "${ENV_FILE}.bak.$(date +%s)"

echo ">> 3. Updating Stripe keys in backend/.env"
if grep -q "^STRIPE_API_KEY=" "$ENV_FILE"; then
  sed -i "s|^STRIPE_API_KEY=.*|STRIPE_API_KEY=${STRIPE_KEY}|" "$ENV_FILE"
  echo "   STRIPE_API_KEY updated"
else
  echo "STRIPE_API_KEY=${STRIPE_KEY}" >> "$ENV_FILE"
  echo "   STRIPE_API_KEY added"
fi
if grep -q "^STRIPE_WEBHOOK_SECRET=" "$ENV_FILE"; then
  sed -i "s|^STRIPE_WEBHOOK_SECRET=.*|STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK}|" "$ENV_FILE"
  echo "   STRIPE_WEBHOOK_SECRET updated"
else
  echo "STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK}" >> "$ENV_FILE"
  echo "   STRIPE_WEBHOOK_SECRET added"
fi

echo ">> 4. Verifying .env (keys masked)"
grep -E '^STRIPE_' "$ENV_FILE" | sed -E 's/(sk_[a-z]+_[A-Za-z0-9]{6})[A-Za-z0-9]+([A-Za-z0-9]{4})/\1...REDACTED...\2/g; s/(whsec_)[A-Za-z0-9]+/\1...REDACTED.../g'

echo ">> 5. Killing existing backend process on port ${PORT}"
PIDS=$(pgrep -f "uvicorn.*server:app.*--port ${PORT}" || true)
if [[ -n "$PIDS" ]]; then
  for P in $PIDS; do
    echo "   Killing PID $P"
    kill -TERM $P 2>/dev/null || true
  done
  sleep 2
  for P in $PIDS; do
    if kill -0 $P 2>/dev/null; then
      echo "   Force-killing PID $P"
      kill -KILL $P 2>/dev/null || true
    fi
  done
else
  echo "   No backend running on port ${PORT}"
fi

echo ">> 6. Starting backend as user '${APP_USER}'"
cd "$APP_DIR"
sudo -u "$APP_USER" -- bash -c "cd '${APP_DIR}' && nohup ./venv/bin/uvicorn server:app --host 127.0.0.1 --port ${PORT} --workers 1 > /tmp/ezunitap-backend.log 2>&1 &"
sleep 3

echo ">> 7. Verifying backend is up"
if pgrep -f "uvicorn.*server:app.*--port ${PORT}" >/dev/null; then
  echo "   [OK] Backend running"
  ps -eo pid,user,cmd | grep "uvicorn.*--port ${PORT}" | grep -v grep
else
  echo "   [FAIL] Backend did not start. Last log:"
  tail -30 /tmp/ezunitap-backend.log
  exit 1
fi

echo ">> 8. Testing Stripe is loaded"
sleep 1
curl -s http://127.0.0.1:${PORT}/api/payments/plans -o /dev/null -w "   /api/payments/plans -> HTTP %{http_code}\n"

echo ""
echo "=========================================="
echo "  DONE. Try subscribing again on ezunitap.com"
echo "=========================================="
echo "If checkout still fails, paste this back to chat:"
echo "  tail -50 /tmp/ezunitap-backend.log"
