#!/bin/bash
# ============================================================================
# Unitap — Bootstrap (ONE-TIME on a fresh server)
# Run as ROOT:
#   curl -sSL https://raw.githubusercontent.com/Pzsuave007/ezunitap/main/bootstrap.sh | bash
# ============================================================================
set -e

REPO_URL="https://github.com/Pzsuave007/ezunitap.git"
CPANEL_USER="ezunitap"
REPO="/home/${CPANEL_USER}/repo"

[ "$EUID" -ne 0 ] && { echo "X Run as root"; exit 1; }

echo ">>> Bootstrapping Unitap deploy for $CPANEL_USER"

git config --global --add safe.directory '*' 2>/dev/null || true

# Ensure user home exists
if [ ! -d "/home/$CPANEL_USER" ]; then
    echo "X cPanel user '$CPANEL_USER' not found. Create it in WHM/cPanel first."
    exit 1
fi

# Clone repo if missing
if [ ! -d "$REPO/.git" ]; then
    rm -rf "$REPO"
    git clone "$REPO_URL" "$REPO"
    chown -R "$CPANEL_USER:$CPANEL_USER" "$REPO"
fi

chmod +x "$REPO/deploy.sh"

# Run main deploy script
bash "$REPO/deploy.sh"
