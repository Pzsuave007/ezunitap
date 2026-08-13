#!/bin/bash
# ============================================================================
# add-custom-domain.sh  —  Make the VPS serve the UniTech app on a customer's
#                          custom domain / subdomain (e.g. growthally.uni2mkt.com)
# ----------------------------------------------------------------------------
# Context: the React app already detects the incoming hostname and loads the
# matching website via /api/public/website-by-domain/<host>. The only missing
# piece for a NEW custom domain is that Apache/cPanel must SERVE the app for
# that hostname. We do that by parking (aliasing) the domain onto the account
# that already hosts the app — its document root has the build + .htaccess.
#
# PREREQUISITES (customer side, already done for growthally.uni2mkt.com):
#   • An A record for the domain pointing to this server's IP (132.148.78.187).
#   • The UniTech website must be PUBLISHED (toggle Status -> Published).
#
# RUN AS ROOT (WHM/SSH):
#   sudo bash /home/ezunitap/repo/deploy/add-custom-domain.sh growthally.uni2mkt.com
#   (optional 2nd arg = cPanel user that hosts the app; defaults to ezunitap)
# ============================================================================
set -e

DOMAIN="$1"
USER="${2:-ezunitap}"

if [ -z "$DOMAIN" ]; then
    echo "Usage: sudo bash add-custom-domain.sh <domain> [cpanel_user]"
    exit 1
fi

echo ">>> Parking $DOMAIN onto cPanel account '$USER' (serves the same app) ..."
whmapi1 create_parked_domain user="$USER" domain="$DOMAIN"

echo ">>> Requesting SSL (AutoSSL) for '$USER' ..."
whmapi1 start_autossl_for_users user="$USER" || \
    echo "  (If that failed, run AutoSSL from WHM > Manage AutoSSL, or cPanel > SSL/TLS Status.)"

echo ""
echo "  ✅ Done. Now open: https://$DOMAIN"
echo "  ℹ️  Reminders:"
echo "     • The website must be PUBLISHED in the editor (Status -> Published)."
echo "     • DNS + AutoSSL can take a few minutes to propagate."
echo ">>> add-custom-domain.sh DONE"
