#!/bin/bash
# ============================================================================
# Unitap — Production Deploy (GoDaddy VPS + cPanel + AlmaLinux)
# Run as ROOT on the server: bash /home/ezunitap/repo/deploy.sh
# ============================================================================
set -e

# ============ 4 VARIABLES ============
REPO_URL="https://github.com/Pzsuave007/ezunitap.git"
CPANEL_USER="ezunitap"
PORT=8007
DOMAIN="ezunitap.com"
# =====================================

REPO="/home/${CPANEL_USER}/repo"
PROD="/opt/${CPANEL_USER}/backend"

[ "$EUID" -ne 0 ] && { echo "X Run as root"; exit 1; }

git config --global --add safe.directory '*' 2>/dev/null || true

as_user() { su -s /bin/bash -l "$CPANEL_USER" -c "$1"; }

if [ ! -d "$PROD/venv" ]; then
    echo ">>> FIRST-TIME INSTALL for $CPANEL_USER on port $PORT"

    # Ensure repo exists
    if [ ! -d "$REPO/.git" ]; then
        rm -rf "$REPO"
        git clone "$REPO_URL" "$REPO"
    fi
    chown -R "$CPANEL_USER:$CPANEL_USER" "$REPO"
    chmod 711 "/home/$CPANEL_USER"

    # /opt/<user>/backend tree
    mkdir -p "$PROD"
    chown -R "$CPANEL_USER:$CPANEL_USER" "/opt/$CPANEL_USER"

    # First-time .env (only if not present)
    if [ ! -f "$PROD/.env" ]; then
        cp "$REPO/deploy/backend.env.production.example" "$PROD/.env"
        sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 64)|" "$PROD/.env"
        chown "$CPANEL_USER:$CPANEL_USER" "$PROD/.env"
        chmod 600 "$PROD/.env"
        echo "  >>> .env created at $PROD/.env  (review credentials!)"
    fi

    as_user "bash $REPO/deploy/install_server.sh"
    as_user "bash $REPO/deploy/setup-autostart.sh"
else
    echo ">>> UPDATE for $CPANEL_USER on port $PORT"
    chown -R "$CPANEL_USER:$CPANEL_USER" "$REPO"
    as_user "bash $REPO/deploy/fix.sh"
fi

sleep 3
if curl -sf "http://127.0.0.1:$PORT/api/" >/dev/null; then
    echo ""
    echo "  ✅ Backend healthy on http://127.0.0.1:$PORT"
    echo "  🎉 https://$DOMAIN/"
else
    echo ""
    echo "  ❌ Backend not responding on port $PORT"
    echo "  --- last log lines ---"
    tail -n 40 "$PROD/backend.log" 2>/dev/null || true
    exit 1
fi
