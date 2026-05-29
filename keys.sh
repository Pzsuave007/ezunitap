#!/usr/bin/env bash
# Verify which Stripe keys are currently loaded in production.
# Usage: sudo bash /home/ezunitap/repo/keys.sh

ENV_FILE="/opt/ezunitap/backend/.env"

echo "=========================================="
echo "  Stripe keys currently active"
echo "=========================================="

KEY=$(grep -E '^STRIPE_API_KEY=' "$ENV_FILE" | sed 's/^STRIPE_API_KEY=//')
WEBHOOK=$(grep -E '^STRIPE_WEBHOOK_SECRET=' "$ENV_FILE" | sed 's/^STRIPE_WEBHOOK_SECRET=//')

if [[ "$KEY" == sk_live_* ]]; then
  echo "  MODE:    🟢 LIVE (production — real money)"
  echo "  KEY:     ${KEY:0:14}...${KEY: -4}"
elif [[ "$KEY" == sk_test_* ]]; then
  echo "  MODE:    🟡 TEST (no real money)"
  echo "  KEY:     ${KEY:0:14}...${KEY: -4}"
else
  echo "  MODE:    🔴 NOT SET or INVALID"
  echo "  KEY:     ${KEY:0:20}..."
fi

if [[ -n "$WEBHOOK" ]]; then
  echo "  WEBHOOK: ${WEBHOOK:0:10}...${WEBHOOK: -4}"
else
  echo "  WEBHOOK: 🔴 NOT SET"
fi

echo ""
echo "  Backend process:"
pgrep -fa "uvicorn.*server:app.*8007" | head -1 || echo "    🔴 not running"

echo ""
echo "  Quick API test:"
curl -s -o /dev/null -w "    ezunitap.com/api/payments/plans -> HTTP %{http_code}\n" https://ezunitap.com/api/payments/plans
echo "=========================================="
