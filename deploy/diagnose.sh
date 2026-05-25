#!/bin/bash
# ============================================================================
# diagnose.sh — One-command full diagnostic for Unitap production
# Run as root:   bash /home/ezunitap/repo/deploy/diagnose.sh
# Or one-liner:  curl -sSL https://raw.githubusercontent.com/Pzsuave007/ezunitap/main/deploy/diagnose.sh | bash
# ============================================================================
CPANEL_USER="ezunitap"
PORT=8007
DOMAIN="ezunitap.com"

BLUE='\033[0;34m'; GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}✅ $1${NC}"; }
fail() { echo -e "  ${RED}❌ $1${NC}"; }
warn() { echo -e "  ${YELLOW}⚠️  $1${NC}"; }
sec()  { echo -e "\n${BLUE}===== $1 =====${NC}"; }

REPO="/home/${CPANEL_USER}/repo"
PROD="/opt/${CPANEL_USER}/backend"
PH="/home/${CPANEL_USER}/public_html"

sec "1. Backend process"
PID=$(pgrep -af "uvicorn.*:${PORT}" | head -1)
if [ -n "$PID" ]; then ok "running: $PID"; else fail "uvicorn NOT running on port ${PORT}"; fi

sec "2. Backend local health"
LOCAL=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PORT}/api/")
if [ "$LOCAL" = "200" ]; then ok "GET 127.0.0.1:${PORT}/api/ → 200"; else fail "GET 127.0.0.1:${PORT}/api/ → ${LOCAL}"; fi

sec "3. public_html contents"
if [ -f "${PH}/index.html" ]; then ok "index.html present"; else fail "index.html MISSING"; fi
if [ -d "${PH}/static" ]; then ok "static/ present"; else fail "static/ MISSING"; fi
ls -la "${PH}/" 2>/dev/null | head -10

sec "4. .htaccess"
if [ -f "${PH}/.htaccess" ]; then
  ok ".htaccess present"
  grep -q "127.0.0.1:${PORT}" "${PH}/.htaccess" && ok "proxy rule for port ${PORT} found" || fail "proxy rule for port ${PORT} MISSING in .htaccess"
  grep -q "index.html" "${PH}/.htaccess" && ok "SPA fallback present" || fail "SPA fallback MISSING"
else
  fail ".htaccess NOT FOUND in ${PH}/"
fi

sec "5. Permissions"
PERM_HOME=$(stat -c "%a" "/home/${CPANEL_USER}")
[ "$PERM_HOME" = "711" ] || [ "$PERM_HOME" = "755" ] && ok "/home/${CPANEL_USER} = ${PERM_HOME}" || fail "/home/${CPANEL_USER} = ${PERM_HOME}  (should be 711)"
PERM_PH=$(stat -c "%a" "${PH}")
[ "$PERM_PH" = "755" ] || [ "$PERM_PH" = "750" ] && ok "${PH} = ${PERM_PH}" || warn "${PH} = ${PERM_PH}  (should be 755)"
[ -f "${PH}/index.html" ] && stat -c "  index.html = %a" "${PH}/index.html"

sec "6. External HTTPS — root"
EXT=$(curl -s -o /dev/null -w "%{http_code}" "https://${DOMAIN}/" --max-time 10)
echo "  https://${DOMAIN}/   →   HTTP ${EXT}"
[ "$EXT" = "200" ] && ok "Frontend loads" || fail "Frontend NOT loading"

sec "7. External HTTPS — /api/"
EXT_API=$(curl -s -o /dev/null -w "%{http_code}" "https://${DOMAIN}/api/" --max-time 10)
echo "  https://${DOMAIN}/api/   →   HTTP ${EXT_API}"
[ "$EXT_API" = "200" ] && ok "API proxied OK" || fail "API NOT proxied (mod_proxy?)"

sec "8. SSL certificate"
SSL_INFO=$(echo | timeout 5 openssl s_client -connect "${DOMAIN}:443" -servername "${DOMAIN}" 2>/dev/null | openssl x509 -noout -subject -dates 2>/dev/null)
if [ -n "$SSL_INFO" ]; then ok "SSL active"; echo "$SSL_INFO" | sed 's/^/  /'; else fail "SSL handshake failed"; fi

sec "9. Apache modules"
for mod in proxy proxy_http rewrite headers; do
  if httpd -M 2>/dev/null | grep -q "${mod}_module" || apachectl -M 2>/dev/null | grep -q "${mod}_module"; then
    ok "mod_${mod} enabled"
  else
    fail "mod_${mod} NOT enabled  (WHM → EasyApache 4)"
  fi
done

sec "10. .env in prod"
if [ -f "${PROD}/.env" ]; then
  ok "${PROD}/.env exists"
  grep -E "^(DB_NAME|CORS_ORIGINS|APP_NAME|SUPER_ADMIN_EMAIL|MONGO_URL)" "${PROD}/.env" | sed 's/^/  /'
else
  fail "${PROD}/.env NOT FOUND"
fi

sec "11. MongoDB local"
if pgrep -af mongod >/dev/null; then
  ok "mongod running"
  mongosh --quiet --eval "db.adminCommand('ping').ok" 2>/dev/null || mongo --quiet --eval "db.adminCommand('ping').ok" 2>/dev/null || warn "mongo client not callable but daemon up"
else
  fail "mongod NOT running"
fi

sec "12. Last 30 backend log lines"
if [ -f "${PROD}/backend.log" ]; then
  tail -n 30 "${PROD}/backend.log"
else
  fail "${PROD}/backend.log MISSING"
fi

sec "13. Last 15 Apache error lines"
for LOG in /usr/local/apache/logs/error_log /var/log/apache2/error_log /etc/apache2/logs/error_log; do
  if [ -f "$LOG" ]; then echo "  --- $LOG ---"; tail -n 15 "$LOG"; break; fi
done

sec "DONE"
echo "  Copy this entire output and paste it to the chat."
