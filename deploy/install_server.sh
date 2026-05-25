#!/bin/bash
# ============================================================================
# install_server.sh — Runs as CPANEL_USER on first install
# ============================================================================
set -e

CPANEL_USER="ezunitap"
PORT=8007
DOMAIN="ezunitap.com"

REPO="/home/${CPANEL_USER}/repo"
PROD="/opt/${CPANEL_USER}/backend"
PH="/home/${CPANEL_USER}/public_html"

echo ">>> [user=$CPANEL_USER] install_server.sh starting..."

# -----------------------------------------------------------------------------
# 1. Python venv + prod requirements (SLIM)
# -----------------------------------------------------------------------------
echo ">>> Python venv at $PROD/venv"
python3.9 -m venv "$PROD/venv" 2>/dev/null || python3 -m venv "$PROD/venv"
source "$PROD/venv/bin/activate"

pip install --upgrade pip setuptools wheel
pip install \
    --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/ \
    -r "$REPO/deploy/requirements.prod.txt"

# -----------------------------------------------------------------------------
# 2. Copy backend source into /opt/USER/backend (NEVER touch venv)
# -----------------------------------------------------------------------------
echo ">>> Copy backend source → $PROD"
rsync -a \
    --exclude '__pycache__' \
    --exclude 'tests' \
    --exclude '.env' \
    --exclude 'venv' \
    --exclude 'backend.log' \
    "$REPO/backend/" "$PROD/"

# -----------------------------------------------------------------------------
# 3. Build frontend ON THE SERVER (memory-safe flags)
# -----------------------------------------------------------------------------
echo ">>> Build frontend"
cd "$REPO/frontend"

# Write production .env so REACT_APP_BACKEND_URL is baked into the bundle
cat > "$REPO/frontend/.env.production" <<EOF
REACT_APP_BACKEND_URL=https://${DOMAIN}
GENERATE_SOURCEMAP=false
EOF

# Install JS deps (Node 18 vs React 19 → ignore-engines)
yarn install --ignore-engines --frozen-lockfile 2>&1 | tail -5

# Build with memory cap (avoids OOM on small VPS) and no sourcemaps
NODE_OPTIONS="--max-old-space-size=1536" \
GENERATE_SOURCEMAP=false \
INLINE_RUNTIME_CHUNK=false \
    yarn build 2>&1 | tail -10

if [ ! -f "$REPO/frontend/build/index.html" ]; then
    echo "X yarn build did NOT produce index.html"
    exit 1
fi

# -----------------------------------------------------------------------------
# 4. Deploy build into public_html
# -----------------------------------------------------------------------------
echo ">>> Deploy frontend → $PH"
mkdir -p "$PH"
rm -rf "$PH/static" "$PH/index.html" "$PH/asset-manifest.json" "$PH/favicon.ico" "$PH/manifest.json" "$PH/robots.txt" "$PH/landing-portrait.jpg" "$PH/landing-yard.jpg"
cp -r "$REPO/frontend/build/." "$PH/"

cp "$REPO/deploy/htaccess" "$PH/.htaccess"

find "$PH" -type f -exec chmod 644 {} \;
find "$PH" -type d -exec chmod 755 {} \;

# -----------------------------------------------------------------------------
# 5. Start backend
# -----------------------------------------------------------------------------
echo ">>> Start backend on :$PORT"
pkill -f "uvicorn.*:${PORT}" 2>/dev/null || true
sleep 1

cd "$PROD"
nohup "$PROD/venv/bin/uvicorn" server:app \
    --host 127.0.0.1 \
    --port "$PORT" \
    --workers 1 \
    > "$PROD/backend.log" 2>&1 &

sleep 4
if curl -sf "http://127.0.0.1:${PORT}/api/" >/dev/null; then
    echo "  ✅ Backend up on 127.0.0.1:${PORT}"
else
    echo "  ❌ Backend failed — see $PROD/backend.log"
    tail -n 40 "$PROD/backend.log"
    exit 1
fi

# -----------------------------------------------------------------------------
# 6. Personal restart script
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

echo ">>> install_server.sh DONE — https://${DOMAIN}/"
