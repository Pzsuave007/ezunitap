#!/bin/bash
# ============================================================================
# droplet-setup.sh — set up a DigitalOcean (Ubuntu 22.04/24.04) droplet as the
#                    UniTech custom-domain edge (Caddy + On-Demand TLS).
# ----------------------------------------------------------------------------
# Run as root on a FRESH small droplet ($6/mo is plenty):
#   ssh root@<DROPLET_IP>
#   # copy the app build + this repo's deploy/droplet/Caddyfile up (see README)
#   bash droplet-setup.sh
# ============================================================================
set -e

echo ">>> Installing Caddy ..."
apt update
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update
apt install -y caddy
caddy version

echo ">>> Installing Caddyfile ..."
install -d /etc/caddy /var/www/unitech
# Expect the Caddyfile to already be uploaded next to this script:
if [ -f "./Caddyfile" ]; then cp ./Caddyfile /etc/caddy/Caddyfile; fi
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile

echo ">>> Starting Caddy ..."
systemctl enable caddy
systemctl restart caddy
sleep 2
systemctl --no-pager status caddy | head -n 8 || true

echo ""
echo "  ✅ Edge is up. Put the React build in /var/www/unitech (rsync from the main server)."
echo "     Example (run on the cPanel server):"
echo "       rsync -az /home/ezunitap/public_html/ root@<DROPLET_IP>:/var/www/unitech/"
echo "  ✅ Then customers only add an A record -> <DROPLET_IP> and Verify in UniTech."
echo ">>> droplet-setup.sh DONE"
