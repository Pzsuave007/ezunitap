#!/bin/bash
# ============================================================================
# fix.sh — Runs as CPANEL_USER (NOT root) on every UPDATE deploy
# Called from deploy.sh via:  su -s /bin/bash -l USER -c "bash .../fix.sh"
# ============================================================================
set -e

CPANEL_USER="ezunitap"
PORT=8007

REPO="/home/${CPANEL_USER}/repo"
PROD="/opt/${CPANEL_USER}/backend"
PUBLIC_HTML="/home/${CPANEL_USER}/public_html"

echo ">>> [user=$CPANEL_USER] fix.sh starting..."

# -----------------------------------------------------------------------------
# 1. Pull latest from git
# -----------------------------------------------------------------------------
cd "$REPO"
git fetch origin
git reset --hard origin/main

# -----------------------------------------------------------------------------
# 2. Update prod python deps (in case requirements.prod.txt changed)
# -----------------------------------------------------------------------------
if [ ! -f "$PROD/venv/bin/activate" ]; then
    echo "  ⚠️  venv missing/corrupt — delete it and re-run deploy.sh:"
    echo "      rm -rf $PROD/venv && bash $REPO/deploy.sh"
    exit 1
fi
source "$PROD/venv/bin/activate"
pip install \
    --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/ \
    -r "$REPO/deploy/requirements.prod.txt"

# -----------------------------------------------------------------------------
# 3. Sync backend source (PRESERVE .env)
# -----------------------------------------------------------------------------
rsync -a --delete \
    --exclude '__pycache__' \
    --exclude 'tests' \
    --exclude '.env' \
    --exclude 'backend.log' \
    "$REPO/backend/" "$PROD/"

# -----------------------------------------------------------------------------
# 4. Re-deploy frontend build
# -----------------------------------------------------------------------------
if [ -d "$REPO/frontend/build" ] && [ -f "$REPO/frontend/build/index.html" ]; then
    rm -rf "$PUBLIC_HTML/static" "$PUBLIC_HTML/index.html" "$PUBLIC_HTML/asset-manifest.json"
    cp -r "$REPO/frontend/build/." "$PUBLIC_HTML/"
    cp "$REPO/deploy/htaccess" "$PUBLIC_HTML/.htaccess"
    find "$PUBLIC_HTML" -type f -exec chmod 644 {} \;
    find "$PUBLIC_HTML" -type d -exec chmod 755 {} \;
    echo "  ✅ frontend deployed"
else
    echo "  ⚠️  frontend/build missing — skipping frontend update"
fi

# -----------------------------------------------------------------------------
# 5. Restart backend
# -----------------------------------------------------------------------------
pkill -f "uvicorn.*:$PORT" 2>/dev/null || true
sleep 1

cd "$PROD"
nohup "$PROD/venv/bin/uvicorn" server:app \
    --host 127.0.0.1 \
    --port "$PORT" \
    --workers 1 \
    > "$PROD/backend.log" 2>&1 &

sleep 3

if curl -sf "http://127.0.0.1:$PORT/api/" >/dev/null; then
    echo "  ✅ Backend restarted on 127.0.0.1:$PORT"
else
    echo "  ❌ Backend failed to restart — see $PROD/backend.log"
    tail -n 40 "$PROD/backend.log"
    exit 1
fi

echo ">>> fix.sh DONE"
