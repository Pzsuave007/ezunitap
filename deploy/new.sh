#!/bin/bash
# ============================================================================
# new.sh  —  ONE-TIME setup to publish the UniTech app on ezunitech.com
# ----------------------------------------------------------------------------
# ezunitech.com is a separate cPanel account on the SAME VPS as ezunitap.com
# (same IP). The FastAPI backend on 127.0.0.1:8007 is SHARED, so ezunitech.com
# only needs the pre-built frontend + the same .htaccess (which proxies
# /api -> 127.0.0.1:8007). Same app, SAME database, SAME data.
#
# This script does EVERYTHING in one shot:
#   1) Updates the shared backend + ezunitap.com   (runs your normal fix.sh)
#   2) Publishes the frontend + .htaccess to ezunitech.com
#   3) Issues the SSL certificate (AutoSSL) for ezunitech.com
#
# >>> RUN ONCE, AS ROOT (WHM Terminal or SSH):
#       sudo bash /home/ezunitap/repo/deploy/new.sh
#
# After this, go back to your normal deploy (fix.sh) for routine updates.
# (To also push future builds to ezunitech.com, re-run deploy-ezunitech.sh.)
# ============================================================================
set -e

SRC_USER="ezunitap"                 # account holding the git repo + backend
NEW_USER="ezunitech"                # new account serving ezunitech.com
NEW_DOMAIN="ezunitech.com"
REPO="/home/${SRC_USER}/repo"
PH="/home/${NEW_USER}/public_html"

if [ "$(id -u)" != "0" ]; then
  echo "X Please run as root:  sudo bash $0"
  exit 1
fi

echo "============================================================"
echo "  UniTech one-time setup → ${NEW_DOMAIN}"
echo "============================================================"

# ----------------------------------------------------------------------------
# 1) Update shared backend + ezunitap.com using your existing deploy (fix.sh)
#    fix.sh pulls latest code, updates the backend and restarts it on :8007.
# ----------------------------------------------------------------------------
echo ">>> [1/3] Updating shared backend + ezunitap.com (fix.sh) ..."
sudo -u "${SRC_USER}" bash "${REPO}/deploy/fix.sh"

# ----------------------------------------------------------------------------
# 2) Publish the SAME frontend + .htaccess into the ezunitech account
# ----------------------------------------------------------------------------
echo ">>> [2/3] Publishing frontend to ${PH} ..."
if [ ! -f "${REPO}/frontend/build/index.html" ]; then
  echo "  X frontend/build missing — click 'Save to GitHub' first, then re-run."
  exit 1
fi
mkdir -p "${PH}"
rm -rf "${PH}/static" "${PH}/index.html" "${PH}/asset-manifest.json"
cp -r "${REPO}/frontend/build/." "${PH}/"
cp "${REPO}/deploy/htaccess" "${PH}/.htaccess"
chown -R "${NEW_USER}:${NEW_USER}" "${PH}"
find "${PH}" -type f -exec chmod 644 {} \;
find "${PH}" -type d -exec chmod 755 {} \;
echo "  ✅ ezunitech.com frontend + .htaccess deployed (backend is SHARED on :8007)"

# ----------------------------------------------------------------------------
# 3) Issue SSL (AutoSSL) for the new domain
# ----------------------------------------------------------------------------
echo ">>> [3/3] Requesting SSL (AutoSSL) for ${NEW_DOMAIN} ..."
if [ -x /usr/local/cpanel/bin/autossl_check ]; then
  /usr/local/cpanel/bin/autossl_check --user "${NEW_USER}" \
    || echo "  (!) AutoSSL returned non-zero — issue it manually: WHM > Manage AutoSSL > Run AutoSSL."
else
  echo "  (!) autossl_check not found — issue SSL manually: WHM > Manage AutoSSL > Run AutoSSL."
fi

# ----------------------------------------------------------------------------
# Verify
# ----------------------------------------------------------------------------
echo ">>> Verifying shared backend ..."
if curl -skf "http://127.0.0.1:8007/api/" >/dev/null; then
  echo "  ✅ backend OK on :8007"
else
  echo "  (!) backend not responding on :8007 — check $REPO output above."
fi

echo ""
echo "============================================================"
echo "  ✅ DONE — open https://${NEW_DOMAIN}"
echo "  (If you see a cert warning, give AutoSSL a few minutes.)"
echo "  Quick check:  curl -A 'WhatsApp' https://${NEW_DOMAIN}/c/<your-slug>"
echo "============================================================"
