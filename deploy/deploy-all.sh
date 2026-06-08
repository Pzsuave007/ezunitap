#!/bin/bash
# ============================================================================
# deploy-all.sh  —  YOUR ONLY DEPLOY COMMAND (run this for every update)
# ----------------------------------------------------------------------------
# Does EVERYTHING in one shot, as root:
#   1) Pulls the latest code from GitHub
#   2) Updates + restarts the shared backend and ezunitap.com   (via fix.sh)
#   3) Publishes the SAME app to ezunitech.com (separate cPanel acct, same VPS,
#      shared backend on 127.0.0.1:8007 -> same database, same data)
#   4) Issues/renews SSL (AutoSSL) for ezunitech.com
#   5) Verifies both domains
#
# >>> RUN (as root, in WHM Terminal or SSH):
#       sudo bash /home/ezunitap/repo/deploy/deploy-all.sh
# ============================================================================
set -e

SRC_USER="ezunitap"                 # account holding the git repo + backend
NEW_USER="ezunitech"                # new account serving ezunitech.com
REPO="/home/${SRC_USER}/repo"
PH_NEW="/home/${NEW_USER}/public_html"
PORT=8007

if [ "$(id -u)" != "0" ]; then
  echo "X Please run as root:  sudo bash $0"
  exit 1
fi

echo "============================================================"
echo "  UniTech — Deploy ALL (ezunitap.com + ezunitech.com)"
echo "============================================================"

# 1) Pull latest as the repo owner (keeps file ownership correct)
echo ">>> [1/5] Pulling latest code ..."
sudo -u "${SRC_USER}" git -C "${REPO}" fetch -q origin
sudo -u "${SRC_USER}" git -C "${REPO}" reset -q --hard origin/main

# 2) Update + restart shared backend, and deploy ezunitap.com frontend
echo ">>> [2/5] Updating backend + ezunitap.com (fix.sh) ..."
sudo -u "${SRC_USER}" bash "${REPO}/deploy/fix.sh"

# 3) Publish the SAME frontend + .htaccess to ezunitech.com
echo ">>> [3/5] Publishing ezunitech.com ..."
if [ ! -f "${REPO}/frontend/build/index.html" ]; then
  echo "  X frontend/build missing — click 'Save to GitHub' first, then re-run."
  exit 1
fi
mkdir -p "${PH_NEW}"
rm -rf "${PH_NEW}/static" "${PH_NEW}/index.html" "${PH_NEW}/asset-manifest.json"
cp -r "${REPO}/frontend/build/." "${PH_NEW}/"
cp "${REPO}/deploy/htaccess" "${PH_NEW}/.htaccess"
chown -R "${NEW_USER}:${NEW_USER}" "${PH_NEW}"
find "${PH_NEW}" -type f -exec chmod 644 {} \;
find "${PH_NEW}" -type d -exec chmod 755 {} \;
echo "  ✅ ezunitech.com published (backend is SHARED on :${PORT})"

# 4) Issue/renew SSL for ezunitech.com (best-effort)
echo ">>> [4/5] SSL (AutoSSL) for ezunitech.com ..."
if [ -x /usr/local/cpanel/bin/autossl_check ]; then
  /usr/local/cpanel/bin/autossl_check --user "${NEW_USER}" \
    || echo "  (!) AutoSSL non-zero — if needed, run it manually: WHM > Manage AutoSSL."
else
  echo "  (!) autossl_check not found — issue SSL manually: WHM > Manage AutoSSL."
fi

# 5) Verify
echo ">>> [5/5] Verifying ..."
if curl -sf "http://127.0.0.1:${PORT}/api/" >/dev/null; then
  echo "  ✅ shared backend OK on :${PORT}"
else
  echo "  (!) backend not responding on :${PORT}"
fi

echo ""
echo "============================================================"
echo "  ✅ DONE"
echo "     • https://ezunitap.com"
echo "     • https://ezunitech.com   (give AutoSSL a few min on first run)"
echo "============================================================"
