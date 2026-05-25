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

# 2. Update prod python deps if needed
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

# 4. Rebuild frontend on server
echo ">>> Rebuild frontend"
cd "$REPO/frontend"
cat > "$REPO/frontend/.env.production" <<EOF
REACT_APP_BACKEND_URL=https://${DOMAIN}
GENERATE_SOURCEMAP=false
EOF

yarn install --ignore-engines --frozen-lockfile 2>&1 | tail -5

NODE_OPTIONS="--max-old-space-size=1536" \
GENERATE_SOURCEMAP=false \
INLINE_RUNTIME_CHUNK=false \
    yarn build 2>&1 | tail -10

if [ ! -f "$REPO/frontend/build/index.html" ]; then
    echo "X yarn build failed"
    exit 1
fi

# 5. Deploy build
rm -rf "$PH/static" "$PH/index.html" "$PH/asset-manifest.json"
cp -r "$REPO/frontend/build/." "$PH/"
cp "$REPO/deploy/htaccess" "$PH/.htaccess"
find "$PH" -type f -exec chmod 644 {} \;
find "$PH" -type d -exec chmod 755 {} \;

# 6. Restart backend
pkill -f "uvicorn.*:${PORT}" 2>/dev/null || true
sleep 1
cd "$PROD"
nohup "$PROD/venv/bin/uvicorn" server:app \
    --host 127.0.0.1 --port "$PORT" --workers 1 \
    > "$PROD/backend.log" 2>&1 &

sleep 4
if curl -sf "http://127.0.0.1:${PORT}/api/" >/dev/null; then
    echo "  ✅ Backend restarted on :${PORT}"
else
    echo "  ❌ Backend failed — see $PROD/backend.log"
    tail -n 40 "$PROD/backend.log"
    exit 1
fi

echo ">>> fix.sh DONE"
