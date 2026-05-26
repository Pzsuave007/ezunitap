#!/bin/bash
# ============================================================================
# fix.sh — Runs as CPANEL_USER on every UPDATE deploy
# ============================================================================
set -e

CPANEL_USER="ezunitap"
PORT=8007
DOMAIN="ezunitap.com"

REPO="/home/${CPANEL_USER}/repo"
PROD="/opt/${CPANEL_USER}/backend"
PH="/home/${CPANEL_USER}/public_html"

echo ">>> [user=$CPANEL_USER] fix.sh starting..."

# 1. Pull latest
cd "$REPO"
git fetch origin
git reset --hard origin/main

# 2. Update prod python deps
if [ ! -f "$PROD/venv/bin/activate" ]; then
    echo "X venv missing — delete it and re-run deploy.sh:"
    echo "  rm -rf $PROD/venv && bash $REPO/deploy.sh"
    exit 1
fi
source "$PROD/venv/bin/activate"
pip install \
    --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/ \
    -r "$REPO/deploy/requirements.prod.txt"

# 3. Sync backend source (NEVER touch venv or .env)
rsync -a \
    --exclude '__pycache__' \
    --exclude 'tests' \
    --exclude '.env' \
    --exclude 'venv' \
    --exclude 'backend.log' \
    "$REPO/backend/" "$PROD/"

# 4. Deploy pre-built frontend
if [ -f "$REPO/frontend/build/index.html" ]; then
    rm -rf "$PH/static" "$PH/index.html" "$PH/asset-manifest.json"
    cp -r "$REPO/frontend/build/." "$PH/"
    cp "$REPO/deploy/htaccess" "$PH/.htaccess"
    find "$PH" -type f -exec chmod 644 {} \;
    find "$PH" -type d -exec chmod 755 {} \;
    echo "  ✅ frontend deployed"
else
    echo "  ⚠️  frontend/build missing — skipping frontend update"
fi

# 5. Restart backend
pkill -f "uvicorn.*:${PORT}" 2>/dev/null || true
fuser -k "${PORT}/tcp" 2>/dev/null || true
sleep 2
cd "$PROD"
nohup "$PROD/venv/bin/uvicorn" server:app \
    --host 127.0.0.1 --port "$PORT" --workers 1 \
    > "$PROD/backend.log" 2>&1 &

sleep 4
if curl -sf "http://127.0.0.1:${PORT}/api/" >/dev/null; then
    echo "  ✅ Backend restarted on :${PORT}"
else
    # Give it a few more seconds — first request can be slow
    sleep 6
    if curl -sf "http://127.0.0.1:${PORT}/api/" >/dev/null; then
        echo "  ✅ Backend restarted on :${PORT} (slow start)"
    else
        echo "  ❌ Backend failed — see $PROD/backend.log"
        tail -n 40 "$PROD/backend.log"
        exit 1
    fi
fi

echo ">>> fix.sh DONE"
