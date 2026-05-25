#!/bin/bash
# ============================================================================
# install_server.sh — Runs as CPANEL_USER (NOT root) on first install
# Called from deploy.sh via:  su -s /bin/bash -l USER -c "bash .../install_server.sh"
# ============================================================================
set -e

CPANEL_USER="ezunitap"
PORT=8007
DOMAIN="ezunitap.com"

REPO="/home/${CPANEL_USER}/repo"
PROD="/opt/${CPANEL_USER}/backend"
PUBLIC_HTML="/home/${CPANEL_USER}/public_html"

echo ">>> [user=$CPANEL_USER] install_server.sh starting..."

# -----------------------------------------------------------------------------
# 1. Python venv + prod requirements (SLIM)
# -----------------------------------------------------------------------------
echo ">>> Setting up Python venv at $PROD/venv"
python3.9 -m venv "$PROD/venv" 2>/dev/null || python3 -m venv "$PROD/venv"
source "$PROD/venv/bin/activate"

pip install --upgrade pip setuptools wheel

pip install \
    --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/ \
    -r "$REPO/deploy/requirements.prod.txt"

# -----------------------------------------------------------------------------
# 2. Copy backend source into /opt/USER/backend
# -----------------------------------------------------------------------------
echo ">>> Copying backend source to $PROD"
rsync -a --delete \
    --exclude '__pycache__' \
    --exclude 'tests' \
    --exclude '.env' \
    "$REPO/backend/" "$PROD/"

# Symlink the production .env (already created by deploy.sh)
ln -sf "$PROD/.env" "$PROD/.env" 2>/dev/null || true

# -----------------------------------------------------------------------------
# 3. Deploy frontend build into public_html
# -----------------------------------------------------------------------------
echo ">>> Deploying frontend build to $PUBLIC_HTML"
if [ ! -d "$REPO/frontend/build" ] || [ ! -f "$REPO/frontend/build/index.html" ]; then
    echo "X $REPO/frontend/build/index.html missing — run 'yarn build' on dev and commit it."
    exit 1
fi

mkdir -p "$PUBLIC_HTML"
# Wipe old static/index.html (avoid stale asset hashes), keep .well-known etc.
rm -rf "$PUBLIC_HTML/static" "$PUBLIC_HTML/index.html" "$PUBLIC_HTML/asset-manifest.json" "$PUBLIC_HTML/favicon.ico" "$PUBLIC_HTML/manifest.json" "$PUBLIC_HTML/robots.txt"
cp -r "$REPO/frontend/build/." "$PUBLIC_HTML/"

# .htaccess with proxy + SPA fallback
cp "$REPO/deploy/htaccess" "$PUBLIC_HTML/.htaccess"

# Permissions (Apache traversal)
find "$PUBLIC_HTML" -type f -exec chmod 644 {} \;
find "$PUBLIC_HTML" -type d -exec chmod 755 {} \;

# -----------------------------------------------------------------------------
# 4. Start backend with nohup
# -----------------------------------------------------------------------------
echo ">>> Starting backend (uvicorn) on port $PORT"
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
    echo "  ✅ Backend up on 127.0.0.1:$PORT"
else
    echo "  ❌ Backend failed to start — see $PROD/backend.log"
    tail -n 40 "$PROD/backend.log"
    exit 1
fi

# -----------------------------------------------------------------------------
# 5. Personal restart script for the user
# -----------------------------------------------------------------------------
cat > "/home/${CPANEL_USER}/restart.sh" <<EOF
#!/bin/bash
pkill -f "uvicorn.*:${PORT}" 2>/dev/null || true
sleep 1
cd ${PROD}
nohup ${PROD}/venv/bin/uvicorn server:app --host 127.0.0.1 --port ${PORT} --workers 1 > ${PROD}/backend.log 2>&1 &
sleep 2
curl -sf http://127.0.0.1:${PORT}/api/ && echo "Backend OK" || echo "Backend FAIL"
EOF
chmod +x "/home/${CPANEL_USER}/restart.sh"

echo ">>> install_server.sh DONE for https://${DOMAIN}"
