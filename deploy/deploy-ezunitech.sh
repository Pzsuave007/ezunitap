#!/bin/bash
# ============================================================================
# deploy-ezunitech.sh  —  Serve the SAME UniTech app on ezunitech.com
# ----------------------------------------------------------------------------
# Context: ezunitech.com is a SEPARATE cPanel account on the SAME VPS as
# ezunitap.com (same IP 132.148.78.187). The FastAPI backend already runs on
# 127.0.0.1:8007 and is shared. So the new account only needs the pre-built
# React frontend + the same .htaccess (which proxies /api -> 127.0.0.1:8007).
# Result: ezunitech.com shows the exact same app and the SAME data.
#
# RUN THIS AS ROOT (WHM/SSH), because it reads the ezunitap repo and writes
# into the ezunitech account (cross-account = needs root).
#
#   sudo bash /home/ezunitap/repo/deploy/deploy-ezunitech.sh
#
# Run it once now, and again after every `fix.sh` deploy (or add to a root cron)
# so the new domain always has the latest build.
# ============================================================================
set -e

SRC_USER="ezunitap"                       # account that holds the git repo
NEW_USER="ezunitech"                      # new account serving ezunitech.com
REPO="/home/${SRC_USER}/repo"
PH="/home/${NEW_USER}/public_html"

echo ">>> Deploying UniTech to ${NEW_USER} (ezunitech.com) ..."

# 1. Make sure the shared repo is up to date
cd "$REPO"
git fetch origin
git reset --hard origin/main

# 2. Copy the pre-built frontend + the shared .htaccess into the new account
if [ ! -f "$REPO/frontend/build/index.html" ]; then
    echo "  X frontend/build missing in repo — run the normal build/commit first."
    exit 1
fi

mkdir -p "$PH"
rm -rf "$PH/static" "$PH/index.html" "$PH/asset-manifest.json"
cp -r "$REPO/frontend/build/." "$PH/"
cp "$REPO/deploy/htaccess" "$PH/.htaccess"

# 3. Fix ownership/permissions for the new cPanel user
chown -R "${NEW_USER}:${NEW_USER}" "$PH"
find "$PH" -type f -exec chmod 644 {} \;
find "$PH" -type d -exec chmod 755 {} \;

echo "  ✅ Frontend + .htaccess deployed to $PH"
echo "  ℹ️  Backend is SHARED on 127.0.0.1:8007 (nothing to restart)."
echo ""
echo ">>> NEXT (one-time):"
echo "    • Issue SSL for ezunitech.com: WHM > Manage AutoSSL > Run AutoSSL"
echo "      (or cPanel of ${NEW_USER} > SSL/TLS Status > Run AutoSSL)."
echo "    • Verify: curl -A 'WhatsApp' https://ezunitech.com/c/<slug>  (should show OG with ezunitech.com)"
echo ">>> deploy-ezunitech.sh DONE"
