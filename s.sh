#!/usr/bin/env bash
# Unitap — Stripe / Production diagnostic script (READ-ONLY).
# Run on the VPS as the user that owns the deployment.
# Usage:
#   chmod +x diagnose-stripe.sh
#   sudo ./diagnose-stripe.sh 2>&1 | tee /tmp/unitap-diag.txt
# Then paste the contents of /tmp/unitap-diag.txt back into chat.

set +e  # do NOT stop on errors — we want to collect everything

BACKEND_ENV="/opt/ezunitap/backend/.env"
SERVICE="ezunitap-backend"
DOMAIN="https://ezunitap.com"

bar() { echo ""; echo "=========================================="; echo "  $1"; echo "=========================================="; }

bar "0. Host & basic info"
echo "Date:     $(date -u)"
echo "Hostname: $(hostname)"
echo "User:     $(whoami)"
echo "OS:       $(uname -a)"

bar "1. Backend .env file (Stripe lines only, key masked)"
if [[ -f "$BACKEND_ENV" ]]; then
  echo "File:     $BACKEND_ENV  ($(stat -c '%s bytes, owner=%U' "$BACKEND_ENV"))"
  echo "--- raw Stripe lines (will mask the secret middle) ---"
  grep -E '^(STRIPE_|MONGO_URL|DB_NAME)' "$BACKEND_ENV" | sed -E 's/(sk_[a-z]+_[A-Za-z0-9]{6})[A-Za-z0-9]+([A-Za-z0-9]{4})/\1...REDACTED...\2/g; s/(whsec_)[A-Za-z0-9]+/\1...REDACTED.../g; s/(mongodb(\+srv)?:\/\/[^@]*@)/\1***REDACTED***@/'
  echo "--- count of chars in STRIPE_API_KEY value ---"
  KEY_LEN=$(grep -E '^STRIPE_API_KEY=' "$BACKEND_ENV" | sed 's/^STRIPE_API_KEY=//; s/^"//; s/"$//' | tr -d '\r' | wc -c)
  echo "STRIPE_API_KEY value length (should be ~107): $KEY_LEN"
  echo "--- bytes around the key (to detect quotes/CR/LF) ---"
  grep -E '^STRIPE_API_KEY=' "$BACKEND_ENV" | head -c 50 | od -c | head -3
else
  echo "[!!] Backend .env NOT FOUND at $BACKEND_ENV"
  echo "Trying common alt locations..."
  find / -maxdepth 5 -name ".env" -path "*ezunitap*" 2>/dev/null
fi

bar "2. systemd service unit file"
SYSTEMD_FILE="/etc/systemd/system/${SERVICE}.service"
if [[ -f "$SYSTEMD_FILE" ]]; then
  cat "$SYSTEMD_FILE"
else
  echo "[!!] No systemd unit at $SYSTEMD_FILE — checking alternatives..."
  ls -la /etc/systemd/system/ 2>/dev/null | grep -i ezunitap
  ls -la /etc/systemd/system/ 2>/dev/null | grep -iE "unitap|servicio|backend"
fi

bar "3. Environment of the running backend process"
echo "--- pgrep for backend processes ---"
ps -eo pid,user,cmd | grep -iE "uvicorn|gunicorn|python.*server|fastapi" | grep -v grep
echo ""
echo "--- STRIPE / MONGO env vars seen by each python backend process ---"
for PID in $(pgrep -f 'uvicorn\|gunicorn\|python.*server'); do
  echo "PID $PID:"
  if [[ -r "/proc/$PID/environ" ]]; then
    tr '\0' '\n' < /proc/$PID/environ | grep -E '^(STRIPE_|MONGO|DB_NAME)' | sed -E 's/(sk_[a-z]+_[A-Za-z0-9]{6})[A-Za-z0-9]+([A-Za-z0-9]{4})/\1...REDACTED...\2/g; s/(whsec_)[A-Za-z0-9]+/\1...REDACTED.../g'
  else
    echo "  (cannot read /proc/$PID/environ — try running with sudo)"
  fi
done

bar "4. systemctl status"
systemctl status "$SERVICE" --no-pager 2>&1 | head -25

bar "5. Last 30 lines of backend logs"
journalctl -u "$SERVICE" -n 30 --no-pager 2>&1 | tail -40

bar "6. Stripe API key works? (direct test against api.stripe.com)"
if [[ -f "$BACKEND_ENV" ]]; then
  KEY=$(grep -E '^STRIPE_API_KEY=' "$BACKEND_ENV" | sed 's/^STRIPE_API_KEY=//; s/^"//; s/"$//' | tr -d '\r\n')
  if [[ -z "$KEY" ]]; then
    echo "[!!] STRIPE_API_KEY is empty in $BACKEND_ENV"
  else
    echo "Testing key (first 12 chars: ${KEY:0:12}...) against Stripe..."
    RESP=$(curl -s -u "${KEY}:" https://api.stripe.com/v1/customers?limit=1)
    if echo "$RESP" | grep -q '"object": "list"'; then
      echo "[OK] Key is VALID and authenticates with Stripe."
    elif echo "$RESP" | grep -q "Invalid API Key"; then
      echo "[FAIL] Key is INVALID. Stripe response:"
      echo "$RESP" | head -c 400
    else
      echo "[?] Unexpected Stripe response:"
      echo "$RESP" | head -c 400
    fi
  fi
fi

bar "7. Local backend reachable? (port 8001 / 8000)"
for PORT in 8001 8000; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PORT}/api/payments/plans")
  echo "  127.0.0.1:${PORT}/api/payments/plans -> HTTP $CODE"
done

bar "8. End-to-end test via ezunitap.com"
echo "--- Plans endpoint (public, doesn't need auth) ---"
curl -s "$DOMAIN/api/payments/plans" | head -c 300
echo ""
echo ""
echo "--- Try a real checkout call (needs a JWT) ---"
echo "Skipped automated checkout test — it requires a valid login."

bar "9. nginx / reverse proxy config (last 30 lines, may help)"
for f in /etc/nginx/sites-enabled/ezunitap* /etc/nginx/conf.d/ezunitap*; do
  if [[ -f "$f" ]]; then
    echo "--- $f ---"
    cat "$f"
  fi
done

bar "DONE"
echo "Full output saved to /tmp/unitap-diag.txt if you ran with: | tee /tmp/unitap-diag.txt"
echo "Please paste the entire output (above) back into the chat."
