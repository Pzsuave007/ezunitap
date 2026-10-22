#!/usr/bin/env bash
# =====================================================================
#  DIAGNÓSTICO DEL ASISTENTE (POST) EN PRODUCCIÓN
#  Reproduce el flujo real: pedir post -> elegir opción 2 -> subir foto
#  -> confirmar. Muestra en qué punto se pierde la "acción pendiente".
#
#  USO (en tu servidor):
#     1) Edita EMAIL y PASS abajo con una cuenta real tuya.
#     2) bash diag_assistant_prod.sh
# =====================================================================
set -u

# ---- EDITA ESTO ----
EMAIL="pzsuave007@gmail.com"
PASS="PON_TU_PASSWORD"
# --------------------

BACKEND_DIR="/opt/ezunitap/backend"
API="http://127.0.0.1:8001"     # backend local (salta nginx y el frontend)
SID="diag-$(date +%s)"

line(){ echo "============================================================"; }

line
echo ">> 1) ¿Qué modelo/IA usa el backend de producción?"
cd "$BACKEND_DIR" 2>/dev/null || { echo "NO existe $BACKEND_DIR"; exit 1; }
if [ -f .env ]; then
  echo -n "OPENAI_API_KEY presente: "; grep -q "^OPENAI_API_KEY=" .env && echo "SÍ" || echo "NO (usaría Emergent)"
  echo -n "OPENAI_OWN_MODEL: "; (grep "^OPENAI_OWN_MODEL=" .env || echo "(no fijado -> default gpt-6-luna)")
  echo -n "MONGO_URL fijado: "; grep -q "^MONGO_URL=" .env && echo "SÍ" || echo "NO"
  echo -n "DB_NAME: "; grep "^DB_NAME=" .env || echo "(no fijado)"
else
  echo "NO existe $BACKEND_DIR/.env"
fi

line
echo ">> 2) ¿El código desplegado tiene las últimas correcciones?"
echo -n "server.py tiene manejo de 'sí/no' tipeado: "; grep -q "honor it directly" server.py && echo "SÍ (actualizado)" || echo "NO (código viejo!)"
echo -n "server.py crea posts como borrador (draft): "; grep -q "assistant/execute" server.py && echo "SÍ" || echo "NO"
echo -n "assistant_service.py modelo gpt-6-luna: "; grep -q "gpt-6-luna" assistant_service.py && echo "SÍ" || echo "NO"
echo -n "assistant_pages.json en backend: "; [ -f assistant_pages.json ] && echo "SÍ" || echo "NO (falta)"

line
echo ">> 3) Login en el backend local"
TOKEN=$(curl -s -X POST "$API/api/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" | python3 -c "import sys,json;print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
if [ -z "$TOKEN" ]; then echo "LOGIN FALLÓ (revisa EMAIL/PASS)"; exit 1; fi
echo "Login OK (token ${TOKEN:0:14}...)"

# imagen de prueba
python3 - <<'PY'
from PIL import Image
Image.new('RGB',(400,400),(90,140,210)).save('/tmp/diagpost.png')
PY
[ -f /tmp/diagpost.png ] || python3 - <<'PY'
open('/tmp/diagpost.png','wb').write(bytes.fromhex('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000100ffff03000006000557bfabd40000000049454e44ae426082'))
PY

line
echo ">> 4) PASO A: pedir un post"
curl -s -X POST "$API/api/assistant/chat" -H "Authorization: Bearer $TOKEN" \
  -F "session_id=$SID" -F "message=hazme un post para promover mi negocio" -F "lang=es" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print('reply:',d.get('reply','')[:200]);print('needs_confirmation:',d.get('needs_confirmation'),'action:',d.get('action'))"

echo ">> PASO B: responder '2'"
curl -s -X POST "$API/api/assistant/chat" -H "Authorization: Bearer $TOKEN" \
  -F "session_id=$SID" -F "message=2" -F "lang=es" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print('reply:',d.get('reply','')[:200]);print('needs_confirmation:',d.get('needs_confirmation'),'action:',d.get('action'))"

echo ">> PASO C: subir foto + 'hazme el post'"
curl -s -X POST "$API/api/assistant/chat" -H "Authorization: Bearer $TOKEN" \
  -F "session_id=$SID" -F "message=aqui esta la foto, hazme el post" -F "lang=es" \
  -F "files=@/tmp/diagpost.png;type=image/png" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print('reply:',d.get('reply','')[:200]);print('needs_confirmation:',d.get('needs_confirmation'),'action:',d.get('action'))"

line
echo ">> 5) ¿Quedó guardada la 'acción pendiente' en la base de datos?"
python3 - "$SID" <<'PY'
import sys, os
sys.path.insert(0, "/opt/ezunitap/backend")
from dotenv import load_dotenv
load_dotenv("/opt/ezunitap/backend/.env")
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
sid = sys.argv[1]
async def main():
    c = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = c[os.environ["DB_NAME"]]
    s = await db.assistant_sessions.find_one({"id": sid}, {"_id":0,"pending":1,"last_image_ids":1})
    if not s:
        print("NO se encontró la sesión en Mongo (id distinto o DB distinta!)")
    else:
        print("pending:", s.get("pending"))
        print("last_image_ids:", s.get("last_image_ids"))
asyncio.run(main())
PY

line
echo ">> 6) PASO D: confirmar (execute) — aquí es donde fallaba con 400"
curl -s -w "\nHTTP:%{http_code}\n" -X POST "$API/api/assistant/execute" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"session_id\":\"$SID\",\"lang\":\"es\"}"

line
echo ">> 7) ¿Cuántos workers corre el backend? (si son >1 y la sesión estuviera en memoria, se perdería)"
ps aux | grep -E "uvicorn|gunicorn" | grep -v grep | head
echo "FIN DEL DIAGNÓSTICO."
