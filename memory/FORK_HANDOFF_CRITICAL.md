# 🚨 HANDOFF CRÍTICO PARA EL SIGUIENTE AGENTE — LEER ANTES DE TOCAR CÓDIGO 🚨

> Idioma del usuario: **ESPAÑOL**. Responde SIEMPRE en español.
> App: **Unitap** — SaaS para contratistas latinos. UI en español, documentos al
> cliente en inglés (AI). **EN PRODUCCIÓN, procesando pagos reales.** Dominio:
> **ezunitap.com**. Preview actual: tomar de `frontend/.env` → `REACT_APP_BACKEND_URL`.

---

## ⛔ REGLA #1 — DEPENDENCIAS DEL BACKEND EN PRODUCCIÓN (rompió prod el 2-jun-2026)

**Producción NO instala desde `backend/requirements.txt`. Instala desde
`deploy/requirements.prod.txt` (versión SLIM).**

➡️ **Si agregas CUALQUIER librería nueva al backend (un `import nuevo`), DEBES
agregarla TAMBIÉN a `deploy/requirements.prod.txt`.** Si no, el VPS jala el código
nuevo, no encuentra la librería al arrancar `uvicorn`, y **se cae TODO el backend
→ 503 en todo, incluido el login.**

Qué pasó hoy: se agregó `import httpx` (módulo `gbp_routes.py`) pero `httpx` no
estaba en `requirements.prod.txt` → prod 503. Arreglado: (a) `httpx` agregado a
`requirements.prod.txt`, (b) el import de `gbp_routes` en `server.py` está
envuelto en `try/except` para que un módulo opcional NUNCA tumbe el core.

**Checklist al tocar deps backend:**
1. `pip install <lib>` local + agregarla a `backend/requirements.txt`.
2. **AGREGARLA a `deploy/requirements.prod.txt`** (¡el paso que se olvida!).
3. Si es una feature opcional/nueva, considera envolver su `include_router` en
   `try/except` en `server.py` (patrón ya usado para `gbp_router`).

Libs que prod SÍ tiene (ver `deploy/requirements.prod.txt`): fastapi, uvicorn,
python-dotenv, pymongo, motor, pydantic, email-validator, pyjwt, bcrypt, passlib,
python-multipart, requests, **httpx**, tzdata, python-jose, emergentintegrations.

---

## ⛔ REGLA #2 — BUILD DEL FRONTEND (rompió prod antes, 5+ veces)

El VPS tiene poca RAM y **NO** puede correr `yarn build`. El build llega
pre-compilado por git. Por eso, tras CUALQUIER cambio en `frontend/src/`:

```bash
cd /app/frontend && REACT_APP_BACKEND_URL=https://ezunitap.com yarn build
# verificar que NO se coló la URL de preview:
grep -o "https://ezunitap.com" frontend/build/static/js/main.*.js | head -1
cd /app && git add -f frontend/build/
```
Si en el bundle aparece la URL de `*.preview.emergentagent.com` → build MAL, rehacer.

---

## 🔄 CÓMO SE DESPLIEGA (para entender el impacto de tus cambios)

VPS GoDaddy (AlmaLinux + cPanel), usuario `ezunitap`, backend en puerto **8007**.
- El usuario hace **"Save to GitHub"** en el chat → push a `github.com/Pzsuave007/ezunitap.git` (branch `main`).
- En el VPS, como root: `bash /home/ezunitap/repo/deploy.sh` → llama a
  `deploy/fix.sh` que: `git reset --hard origin/main` → `pip install -r deploy/requirements.prod.txt`
  → `rsync` del backend a `/opt/ezunitap/backend/` → copia `frontend/build/` a
  `public_html/` → reinicia uvicorn en :8007.
- `fix.sh` **excluye** `tests/`, `__pycache__`, `.env`, `venv` del rsync.
- El `.env` de producción vive en `/opt/ezunitap/backend/.env` y **NO está en git**
  (las llaves Stripe/SMTP entran vía `/home/ezunitap/public_html/keys.txt`).

➡️ Por eso: cualquier env var nueva que agregues a `/app/backend/.env` **NO llega
sola a producción**. Hay que decirle al usuario que la agregue manualmente al
`.env` del VPS (o al `keys.txt` si aplica).

---

## 🟦 ESTADO ACTUAL: Integración Google Business Profile (EN CURSO)

**Objetivo:** que cada contratista conecte SU perfil de Google Business y pueda
**publicar posts** y **responder reseñas** directo desde Unitap.

**Fase 1 — solicitud a Google: ENVIADA (RE-ENVIADA 18-jun-2026).**
- Case ID ACTIVO: `0-0022000041273` (re-enviado 18-jun-2026, revisión ~7-10 días hábiles → respuesta esperada ~30-jun a 2-jul-2026).
- Case ID anterior (2-jun, parece que no avanzó / sin correo de confirmación): `3-3261000041706`.
- Tipo: "Application For Basic API Access". Company website usado: `growthally.agency`.
- Proyecto Google Cloud: `scenic-healer-468818-h5` (number `837710659551`).
- APIs habilitadas: `mybusinessaccountmanagement` + `mybusinessbusinessinformation`.
- Perfil verificado usado para aplicar: **Growth Ally** (`growthally.agency`),
  correo dueño `pzsuave007@gmail.com`. ⚠️ Google mostró alerta de "reverificar
  perfil" — recordar al usuario completarla.
- Estado: **esperando aprobación**. Se sabe que aprobó cuando la cuota pasa de
  `0 QPM → 300 QPM` en Cloud Console.

**Código YA construido y listo (gateado por env):**
- Backend `/app/backend/gbp_routes.py` — OAuth 2.0 server-side, scope
  `business.manage`, refresh token por usuario en Mongo (`gbp_connections`),
  state CSRF (`gbp_oauth_states`), refresh transparente, manejo de `invalid_grant`.
  Endpoints (prefijo `/api/google-business`): `status`, `connect`, `callback`,
  `disconnect`, `locations`, `select-location`, `posts`, `reviews`,
  `reviews/{id}/reply`.
- Frontend `/app/frontend/src/components/GbpConnectCard.js` montado en
  `GoogleReviewsPage.js` (`/google-reviews`). 4 estados: cargando / **pendiente
  de aprobación** / conectar con Google / conectado (composer con AI ES→EN +
  lista de reseñas con respuesta).
- Tests: `/app/backend/tests/test_gbp.py` (4/4 pasan, cubren estado pre-aprobación).

**Para ACTIVARLO cuando Google apruebe (pasos para el usuario):**
1. En Cloud Console crear credenciales OAuth (tipo "Aplicación web"):
   - Redirect URI autorizado: `https://ezunitap.com/api/google-business/callback`
   - Configurar pantalla de consentimiento con scope `business.manage`.
2. Agregar al `.env` de producción (`/opt/ezunitap/backend/.env`):
   ```
   GOOGLE_GBP_CLIENT_ID=...
   GOOGLE_GBP_CLIENT_SECRET=...
   GOOGLE_GBP_REDIRECT_URI=https://ezunitap.com/api/google-business/callback
   ```
   (En el preview/pod ya existen estas 3 keys en `/app/backend/.env`, vacías salvo
   el REDIRECT_URI.)
3. Reiniciar backend. `/api/google-business/status` reportará `configured=true`.
4. **NO es testeable end-to-end hasta tener credenciales reales** (Google no tiene
   sandbox). Mientras tanto la UI muestra "pendiente" correctamente.

**Idea aprobada como mejora futura:** auto-publicar un post de Google cuando un
trabajo se marca "Completado" (con fotos antes/después).

---

## 🧱 ARQUITECTURA RÁPIDA
- Backend: FastAPI `server.py` (~4000 líneas, monolítico — pendiente refactor a
  routers). Router único `api_router` con prefijo `/api`. Auth JWT (Bearer en
  `localStorage` key `sf_token`) vía `auth_utils.get_current_user_id`. Mongo motor
  async, colecciones como `db["coleccion"]`, docs con `id` uuid + `_now_iso()`.
- Módulos backend separados: `ai_service.py` (GPT-5.2 vía Emergent LLM Key),
  `storage_service.py`, `payments_service.py` (Stripe LIVE test keys),
  `gbp_routes.py` (nuevo, Google Business).
- Frontend: React 19 + Tailwind + Shadcn (`/app/frontend/src/components/ui/`).
  Cliente API en `/app/frontend/src/lib/api.js` (axios, mete el Bearer solo).
- AI "español → inglés pulido": endpoint `POST /api/ai/translate-field` +
  componente reutilizable `AiTranslateButton.jsx`.

## ⚠️ NO TOCAR sin extrema precaución
- Lógica de Stripe / webhooks (`payments_service.py`, endpoints `/api/payments/*`,
  `/api/webhook/stripe`) — dinero real.
- Flujo público de documentos (Quote → Agreement → Invoice) y la generación
  background de agreements (`_auto_create_agreement_from_quote`).
- `.env` protegidos: `MONGO_URL`, `DB_NAME` (no borrar/renombrar).

## 🧪 CREDENCIALES DE PRUEBA (ver también /app/memory/test_credentials.md)
- Admin: `pzsuave007@gmail.com` / `Uni2mkt007!`

## ✅ ANTES DE FINALIZAR CUALQUIER TAREA
1. Si tocaste backend deps → ¿está en `deploy/requirements.prod.txt`?
2. Si tocaste `frontend/src/` → ¿rebuild con `REACT_APP_BACKEND_URL=https://ezunitap.com`
   + `git add -f frontend/build/`?
3. ¿Probaste (curl / pytest / screenshot)? El usuario prefiere probar el frontend
   él mismo, pero el backend SÍ pruébalo tú.
4. Recordar al usuario hacer **"Save to GitHub"** + correr `deploy.sh` en el VPS.
