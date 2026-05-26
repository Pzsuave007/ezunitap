#!/bin/bash
# ============================================================================
# verify-admin.sh — Full re-deploy + verify admin endpoints are live
# Run as root:  bash /home/ezunitap/repo/deploy/verify-admin.sh
# Or one-liner: curl -sSL https://raw.githubusercontent.com/Pzsuave007/ezunitap/main/deploy/verify-admin.sh | bash
# ============================================================================
CPANEL_USER="ezunitap"
PORT=8007
REPO="/home/${CPANEL_USER}/repo"
PROD="/opt/${CPANEL_USER}/backend"
DOMAIN="ezunitap.com"

BLUE='\033[0;34m'; GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
sec()  { echo -e "\n${BLUE}===== $1 =====${NC}"; }
ok()   { echo -e "  ${GREEN}✅ $1${NC}"; }
fail() { echo -e "  ${RED}❌ $1${NC}"; }
warn() { echo -e "  ${YELLOW}⚠️  $1${NC}"; }

[ "$EUID" -ne 0 ] && { fail "Run as root"; exit 1; }

sec "1. git pull (bajando lo último de GitHub)"
cd "$REPO"
git fetch origin 2>&1 | sed 's/^/  /' || true
BEFORE=$(git rev-parse HEAD)
git reset --hard origin/main 2>&1 | sed 's/^/  /'
AFTER=$(git rev-parse HEAD)
if [ "$BEFORE" = "$AFTER" ]; then
    warn "No hubo commits nuevos (HEAD: $BEFORE)"
else
    ok "Actualizado: $BEFORE → $AFTER"
fi

sec "2. ¿El código nuevo está en el repo?"
REPO_HITS=$(grep -c "is-super-admin\|platform-leads" "$REPO/backend/server.py" 2>/dev/null || echo 0)
if [ "$REPO_HITS" -gt "0" ]; then
    ok "server.py en el repo tiene $REPO_HITS coincidencias con los endpoints nuevos"
else
    fail "El repo NO tiene los endpoints nuevos. Necesitas hacer 'Save to GitHub' en Emergent primero."
    echo ""
    echo "  PASOS:"
    echo "  1. Ve al chat de Emergent"
    echo "  2. Click en 'Save to GitHub'"
    echo "  3. Espera a que termine"
    echo "  4. Vuelve aquí y corre este script de nuevo"
    exit 1
fi

REPO_BUILD=$(ls -la "$REPO/frontend/build/static/js/main."*.js 2>/dev/null | wc -l)
if [ "$REPO_BUILD" -gt "0" ]; then
    ok "frontend/build presente en el repo"
else
    fail "frontend/build NO está en el repo — re-haz 'Save to GitHub' después de 'yarn build'"
fi

sec "3. Corriendo deploy.sh"
bash "$REPO/deploy.sh" 2>&1 | tail -30

sec "4. ¿El código nuevo se copió a /opt?"
PROD_HITS=$(grep -c "is-super-admin\|platform-leads" "$PROD/server.py" 2>/dev/null || echo 0)
if [ "$PROD_HITS" -gt "0" ]; then
    ok "server.py en /opt tiene $PROD_HITS coincidencias"
else
    fail "/opt/$CPANEL_USER/backend/server.py NO tiene el código nuevo (rsync falló?)"
fi

sec "5. ¿Está corriendo uvicorn?"
PID_INFO=$(pgrep -af "uvicorn.*:${PORT}")
if [ -n "$PID_INFO" ]; then
    ok "$PID_INFO"
else
    fail "uvicorn NO está corriendo en puerto $PORT"
    echo "  --- backend.log ---"
    tail -n 30 "$PROD/backend.log" 2>/dev/null
fi

sec "6. Probando endpoints"
sleep 2

LOCAL_API=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PORT}/api/" --max-time 5)
echo "  GET /api/                    → $LOCAL_API"
[ "$LOCAL_API" = "200" ] && ok "API base responde" || fail "API base NO responde"

# is-super-admin sin token debe ser 401 o 403, no 404
SA_NOAUTH=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PORT}/api/auth/is-super-admin" --max-time 5)
echo "  GET /api/auth/is-super-admin (sin auth) → $SA_NOAUTH"
if [ "$SA_NOAUTH" = "401" ] || [ "$SA_NOAUTH" = "403" ]; then
    ok "Endpoint is-super-admin existe (auth requerida)"
elif [ "$SA_NOAUTH" = "404" ]; then
    fail "Endpoint is-super-admin NO existe → el backend aún tiene código viejo"
else
    warn "Status inesperado: $SA_NOAUTH"
fi

# Test con login real
sec "7. Login + verificar super admin"
TOKEN=$(curl -s -X POST "http://127.0.0.1:${PORT}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"pzsuave007@gmail.com","password":"Uni2mkt007!"}' \
    | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('token',''))")

if [ -n "$TOKEN" ]; then
    ok "Login OK"
    SA_RESULT=$(curl -s "http://127.0.0.1:${PORT}/api/auth/is-super-admin" \
        -H "Authorization: Bearer $TOKEN")
    echo "  is-super-admin response: $SA_RESULT"
    if echo "$SA_RESULT" | grep -q '"is_super_admin":true'; then
        ok "Eres reconocido como SUPER ADMIN"
    else
        fail "NO eres super admin — revisa SUPER_ADMIN_EMAIL en /opt/$CPANEL_USER/backend/.env"
        grep SUPER_ADMIN_EMAIL "$PROD/.env"
    fi
else
    fail "Login falló"
fi

sec "8. Probando externamente (https://${DOMAIN})"
EXT_SA=$(curl -s -o /dev/null -w "%{http_code}" "https://${DOMAIN}/api/auth/is-super-admin" --max-time 10)
echo "  https://${DOMAIN}/api/auth/is-super-admin → $EXT_SA"
if [ "$EXT_SA" = "401" ] || [ "$EXT_SA" = "403" ]; then
    ok "Apache proxy pasando bien la API nueva"
elif [ "$EXT_SA" = "404" ]; then
    fail "Externamente 404 → Apache puede tener cache o el reverse proxy no se actualizó"
fi

sec "DONE"
echo ""
echo "  Si todo está en ✅:"
echo "  1. Ve a https://${DOMAIN}/login"
echo "  2. Logout si ya estás logueado"
echo "  3. Ctrl+Shift+R (hard refresh)"
echo "  4. Login con pzsuave007@gmail.com / Uni2mkt007!"
echo "  5. Mira el sidebar — debe aparecer '📥 Leads (admin)'"
echo ""
echo "  Si sigue sin aparecer: copia esta salida completa y pégamela en el chat."
