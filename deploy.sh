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

# --- Self-update: always run the LATEST deploy.sh (pull once, then re-exec) ---
# This makes future script changes apply in a SINGLE `bash deploy.sh` run.
if [ -z "${DEPLOY_SELF_UPDATED:-}" ] && [ -d "$REPO/.git" ]; then
    su -s /bin/bash -l "$CPANEL_USER" -c "git -C '$REPO' fetch -q origin && git -C '$REPO' reset -q --hard origin/main" 2>/dev/null || true
    export DEPLOY_SELF_UPDATED=1
    exec bash "$REPO/deploy.sh"
fi

as_user() { su -s /bin/bash -l "$CPANEL_USER" -c "$1"; }

# --- Uploads dir: the backend (runs as $CPANEL_USER) stores photos here. Some
#     subfolders may have been created by root in the past → PermissionError on
#     write. Force ownership + writable perms every deploy so stock/uploaded
#     photos always save. Runs as root here so chown always succeeds.
UPLOADS_DIR="/home/${CPANEL_USER}/uploads"
mkdir -p "$UPLOADS_DIR"
chown -R "$CPANEL_USER:$CPANEL_USER" "$UPLOADS_DIR"
chmod -R 775 "$UPLOADS_DIR"
echo "  ✅ uploads dir owned by $CPANEL_USER and writable ($UPLOADS_DIR)"

if [ ! -f "$PROD/venv/bin/activate" ]; then
    echo ">>> FIRST-TIME INSTALL for $CPANEL_USER on port $PORT"

    # Clean any half-broken state
    rm -rf "$PROD/venv"

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

# ============ Publish the SAME app to ezunitech.com ============
# ezunitech.com is a separate cPanel account on this same VPS. It shares this
# backend (127.0.0.1:$PORT) and database, so it only needs the frontend +
# .htaccess. Runs as root here because it writes into another account.
NEW_USER="ezunitech"
PH_NEW="/home/${NEW_USER}/public_html"
if [ -d "/home/${NEW_USER}" ] && [ -f "$REPO/frontend/build/index.html" ]; then
    echo ">>> Publishing to ${NEW_USER} (ezunitech.com) ..."
    mkdir -p "$PH_NEW"
    rm -rf "$PH_NEW/static" "$PH_NEW/index.html" "$PH_NEW/asset-manifest.json"
    cp -r "$REPO/frontend/build/." "$PH_NEW/"
    cp "$REPO/deploy/htaccess" "$PH_NEW/.htaccess"
    chown -R "${NEW_USER}:${NEW_USER}" "$PH_NEW"
    find "$PH_NEW" -type f -exec chmod 644 {} \;
    find "$PH_NEW" -type d -exec chmod 755 {} \;
    echo "  ✅ ezunitech.com updated (shares backend on :$PORT, same data)"
    if [ -x /usr/local/cpanel/bin/autossl_check ]; then
        /usr/local/cpanel/bin/autossl_check --user "${NEW_USER}" >/dev/null 2>&1 \
          && echo "  ✅ AutoSSL checked for ezunitech.com" \
          || echo "  (!) If cert missing, run AutoSSL in WHM > Manage AutoSSL"
    fi
else
    echo "  (skip) ezunitech account or frontend build not found"
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
