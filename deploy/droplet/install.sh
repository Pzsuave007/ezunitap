#!/usr/bin/env bash
# ============================================================================
# install.sh — one-shot setup of the UniTech custom-domain EDGE on a fresh
#              Ubuntu droplet. Installs Caddy + writes the Caddyfile + starts it.
#
# Design: this droplet is a PURE reverse proxy with On-Demand TLS. Every custom
# domain that points here is proxied to the main UniTech server (ezunitap.com)
# with the Host rewritten, so there is NOTHING to keep in sync here (no build
# copy). Caddy auto-issues Let's Encrypt SSL after asking the main backend
# whether the domain is a verified customer domain. Zero impact on other sites.
#
# Run once, as root, on the droplet:
#   bash install.sh
# ============================================================================
set -euo pipefail

MAIN="ezunitap.com"          # main UniTech server (serves the app + /api)
EMAIL="admin@ezunitap.com"   # for Let's Encrypt notices

echo ">>> [1/3] Installing Caddy ..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
apt-get update -y
apt-get install -y caddy
caddy version

echo ">>> [2/3] Writing /etc/caddy/Caddyfile ..."
install -d /etc/caddy
cat > /etc/caddy/Caddyfile <<EOF
{
	email ${EMAIL}
	on_demand_tls {
		ask https://${MAIN}/api/public/domain-allowed
		interval 2m
		burst 5
	}
}

# Every customer custom domain that points here: auto-SSL + proxy to the main
# UniTech server (Host rewritten so it serves the app + /api). The browser only
# ever talks to the customer domain, so no CORS issues.
https:// {
	tls {
		on_demand
	}
	reverse_proxy https://${MAIN} {
		header_up Host ${MAIN}
		header_up X-Forwarded-Host {host}
		header_up X-Forwarded-Proto https
	}
}

http:// {
	redir https://{host}{uri} permanent
}
EOF

caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile

echo ">>> [3/3] Starting Caddy ..."
systemctl enable caddy
systemctl restart caddy
sleep 2
systemctl --no-pager status caddy | head -n 6 || true

echo ""
echo "  ✅ DONE. This droplet is now the custom-domain edge."
echo "     Customers just point an A record to THIS droplet's IP and Verify in UniTech."
echo "     SSL is issued automatically on first visit. Nothing else to maintain here."
