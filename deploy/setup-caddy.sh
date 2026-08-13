#!/bin/bash
# ============================================================================
# setup-caddy.sh — install Caddy as the front proxy for UniTech custom domains
#                  (On-Demand TLS = automatic SSL for any verified customer domain)
# ----------------------------------------------------------------------------
# RUN AS ROOT, ONCE, AFTER you have moved Apache OFF ports 80/443 in WHM
# (Tweak Settings -> System: SSL 443->8443, non-SSL 80->8080). See CUSTOM_DOMAINS.md.
#
#   sudo bash /home/ezunitap/repo/deploy/setup-caddy.sh
# ============================================================================
set -e

REPO="/home/ezunitap/repo"

echo ">>> Checking that ports 80/443 are free (Apache must be moved first) ..."
if ss -lnt | egrep -q ':80 |:443 '; then
	echo "  X Ports 80/443 are still in use (Apache?). Move Apache to 8080/8443 in"
	echo "    WHM > Tweak Settings > System, rebuild httpd, then re-run this script."
	ss -lnt | egrep ':80 |:443 ' || true
	exit 1
fi

echo ">>> Installing Caddy ..."
if ! command -v caddy >/dev/null 2>&1; then
	if command -v dnf >/dev/null 2>&1; then
		dnf install -y 'dnf-command(copr)'
		dnf copr enable -y @caddy/caddy
		dnf install -y caddy
	elif command -v yum >/dev/null 2>&1; then
		yum install -y yum-plugin-copr
		yum copr enable -y @caddy/caddy
		yum install -y caddy
	else
		echo "  X Could not find dnf/yum. Install Caddy manually: https://caddyserver.com/docs/install"
		exit 1
	fi
fi
caddy version

echo ">>> Installing Caddyfile ..."
install -d /etc/caddy
cp "$REPO/deploy/Caddyfile" /etc/caddy/Caddyfile

echo ">>> Validating config ..."
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile

echo ">>> Enabling + starting Caddy ..."
systemctl enable caddy
systemctl restart caddy
sleep 2
systemctl --no-pager status caddy | head -n 8 || true

echo ""
echo "  ✅ Caddy is running on 80/443."
echo "  ℹ️  Re-run 'systemctl reload caddy' after editing /etc/caddy/Caddyfile."
echo "  ℹ️  Now customers only add an A record -> $(echo 132.148.78.187) and Verify in UniTech."
echo ">>> setup-caddy.sh DONE"
