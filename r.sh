#!/usr/bin/env bash
# Unitap — Quick recovery script.
# Run if the website is down after f.sh.
#
# What it does:
#   1. Lists what's in /home/ezunitap/public_html/ (so we see if keys.txt survived)
#   2. Shows the last backend log
#   3. Tries to restart the backend (with whatever keys are currently in .env)
#   4. Tests if site responds

echo ">> 1. What survived in /home/ezunitap/public_html/"
ls -la /home/ezunitap/public_html/ 2>&1 | head -25

echo ""
echo ">> 2. keys.txt status"
if [[ -f /home/ezunitap/public_html/keys.txt ]]; then
  echo "   keys.txt EXISTS"
  grep -E '^STRIPE_' /home/ezunitap/public_html/keys.txt | sed -E 's/(sk_[a-z]+_[A-Za-z0-9]{6})[A-Za-z0-9]+([A-Za-z0-9]{4})/\1...REDACTED...\2/g; s/(whsec_)[A-Za-z0-9]+/\1...REDACTED.../g'
else
  echo "   [!!] keys.txt MISSING — recreate it (see chat for keys)"
fi

echo ""
echo ">> 3. Backend .env status"
ls -la /opt/ezunitap/backend/.env* 2>&1 | head -10
echo "   Stripe lines in current .env:"
grep -E '^STRIPE_' /opt/ezunitap/backend/.env 2>/dev/null | sed -E 's/(sk_[a-z]+_[A-Za-z0-9]{6})[A-Za-z0-9]+([A-Za-z0-9]{4})/\1...REDACTED...\2/g; s/(whsec_)[A-Za-z0-9]+/\1...REDACTED.../g'

echo ""
echo ">> 4. Backend process status"
pgrep -fa "uvicorn.*server:app.*8007" || echo "   Backend NOT running"

echo ""
echo ">> 5. Last 40 lines of backend log"
tail -40 /tmp/ezunitap-backend.log 2>&1

echo ""
echo ">> 6. Restart attempt"
pkill -f "uvicorn.*server:app.*8007" 2>/dev/null || true
sleep 2
sudo -u ezunitap -- bash -c "cd /opt/ezunitap/backend && nohup ./venv/bin/uvicorn server:app --host 127.0.0.1 --port 8007 --workers 1 > /tmp/ezunitap-backend.log 2>&1 &"
sleep 4

echo ""
echo ">> 7. Site reachable?"
curl -s -o /dev/null -w "   ezunitap.com (homepage) -> HTTP %{http_code}\n" https://ezunitap.com/
curl -s -o /dev/null -w "   ezunitap.com/api/payments/plans -> HTTP %{http_code}\n" https://ezunitap.com/api/payments/plans

echo ""
echo "=========================================="
echo "  Paste this entire output to chat"
echo "=========================================="
