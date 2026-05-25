# 🚀 Emergent → cPanel Deploy — Guía Completa del Próximo Proyecto

> Lecciones aprendidas del deploy de **Unitap** (Mayo 2026) sobre la base ya probada de **La Campeona 880 AM** (Feb 2026).
> Server profile: **GoDaddy VPS + cPanel + AlmaLinux + Apache + Python 3.9 + Node 18 + MongoDB local**.
>
> Esta guía resuelve los 4 problemas críticos descubiertos al deployar Unitap. Sigue al pie de la letra y tu próximo proyecto **deploya en menos de 5 minutos sin tropiezos**.

---

## 🆕 Las 4 Lecciones Críticas de Unitap (LEER PRIMERO)

Estos son los errores que rompen el deploy si no se atienden desde el inicio:

### Lección 1 ⛔ — Hay **DOS `.gitignore`** que ignoran `frontend/build/`
- `/.gitignore` (raíz del repo) — tiene la regla `/build`
- `/frontend/.gitignore` (creado por `create-react-app`) — TAMBIÉN tiene `/build`
- **Ambos deben comentarse** o `frontend/build/` NUNCA se subirá a GitHub.
- Síntoma si no lo haces: `install_server.sh` falla con "X frontend/build/index.html MISSING".

### Lección 2 ⛔ — **NUNCA correr `yarn build` en el servidor**
- El VPS de GoDaddy con cPanel tiene poca RAM y el build crashea el servidor entero (afecta a TODOS los proyectos corriendo).
- Aun usando `NODE_OPTIONS=--max-old-space-size=1536` y `GENERATE_SOURCEMAP=false`, igual hace crash.
- **Solución correcta:** Construir SIEMPRE en Emergent (`yarn build`) → commitear `frontend/build/` → en el servidor solo `cp -r build/* public_html/`.

### Lección 3 ⛔ — `rsync --delete` borra el `venv` accidentalmente
- Si tu `rsync` no excluye `venv`, va a intentar borrarlo cada update y dejar el backend roto.
- **Siempre agrega:** `--exclude 'venv' --exclude '.env' --exclude 'backend.log'`.
- Y **NO uses `--delete`** salvo que excluyas todo lo que pueda haber en destino. Mejor `rsync -a` sin `--delete`.

### Lección 4 ⛔ — Detectar first-install por **`venv/bin/activate`**, no por el directorio `venv/`
- Si un install falla a la mitad, queda una carpeta `venv/` vacía. La siguiente vez `deploy.sh` la ve y salta a UPDATE → muere porque no hay `activate`.
- **Correcto:** `if [ ! -f "$PROD/venv/bin/activate" ]; then`
- **Mal:** `if [ ! -d "$PROD/venv" ]; then`
- **Y al inicio del first-install**: `rm -rf "$PROD/venv"` (limpia estado roto antes de empezar).

---

## 📋 Antes de Empezar (Checklist Rápido)

Antes de tocar el servidor, asegúrate de tener listo:

- [ ] Cuenta cPanel creada con un usuario único (ej: `miapp`)
- [ ] Dominio apuntado al servidor (ej: `miapp.com`)
- [ ] **Un puerto libre** elegido (ver tabla abajo)
- [ ] Cuenta de GitHub con el repo creado
- [ ] El user de cPanel necesita "Normal Shell" en WHM **O** estar listo para usar `su -s /bin/bash`
- [ ] **Ambos `.gitignore` comentaron `/build`** (raíz y `frontend/`)
- [ ] **`frontend/build/` está committeado** al repo después del último `yarn build`
- [ ] **EMERGENT_LLM_KEY válido** en `deploy/backend.env.production.example`

### 🔢 Tabla de Puertos por App

| App | Puerto |
|-----|--------|
| GradeProphet | 8001 |
| OnPar Live | 8005 |
| La Campeona | 8006 |
| Unitap | 8007 |
| **TU NUEVO PROYECTO** | **8008** ← elige el siguiente libre |

⚠️ **NUNCA reutilices un puerto** — cada app tiene el suyo.

---

## 🏗️ Estructura de Archivos del Repo

```
/repo-raiz/
├── deploy.sh                    ← UN comando, lo único que corres en el server como root
├── bootstrap.sh                 ← solo primera vez en server fresco
├── .gitignore                   ← REVISADO: NO ignora frontend/build
├── backend/
│   ├── server.py
│   ├── requirements.txt          ← deps de DEV (con pandas, pytest, etc.)
│   └── .env                      ← deps de DEV (con localhost)
├── frontend/
│   ├── .gitignore                ← REVISADO: NO ignora /build
│   ├── package.json
│   ├── build/                    ← COMMITEADO al repo (yarn build en Emergent)
│   │   ├── index.html
│   │   ├── static/
│   │   └── asset-manifest.json
│   └── src/
└── deploy/                      ← scripts internos (NO los corres tú)
    ├── install_server.sh         ← lo llama deploy.sh primera vez
    ├── fix.sh                    ← lo llama deploy.sh para updates
    ├── setup-autostart.sh        ← crontab @reboot + backup diario Mongo
    ├── diagnose.sh               ← debug de un comando
    ├── htaccess                  ← Apache proxy + SPA
    ├── requirements.prod.txt     ← deps SLIM para Python 3.9
    └── backend.env.production.example  ← plantilla de .env de prod
```

---

## 📝 Reglas de Oro (NO ROMPER)

### ✅ HACER

1. **`safe.directory '*'`** desde el inicio en el server → `git config --global --add safe.directory '*'`
2. **Repo en `/home/USER/repo/`** (subcarpeta, NO en `/home/USER/`)
3. **Puerto único** por app, definido en UNA variable usado en TODOS los scripts
4. **Detectar first-install por `/opt/APP/backend/venv/bin/activate`** (NO solo por el directorio `/venv`)
5. **Al inicio del first-install: `rm -rf "$PROD/venv"`** para limpiar estado roto
6. **`su -s /bin/bash -l USER -c "..."`** para correr como cPanel user (bypassa "no shell")
7. **`requirements.prod.txt` SLIM** sin pandas/numpy/pytest/black (compatibilidad Python 3.9)
8. **`yarn install --ignore-engines`** SOLO en Emergent (Node 18 vs React 19 mismatch)
9. **`pip install --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/`** para `emergentintegrations`
10. **Generar `JWT_SECRET` automáticamente** con `openssl rand -hex 64`
11. **`REACT_APP_BACKEND_URL=https://DOMINIO`** en `frontend/.env.production` **ANTES** del `yarn build` en Emergent
12. **`yarn build` SIEMPRE en Emergent**, nunca en el VPS
13. **Commitear `frontend/build/`** con `git add -f frontend/build/` si los `.gitignore` lo bloquean
14. **`.htaccess` con proxy `[P,L]`** Y SPA fallback en el mismo archivo
15. **`chmod 711 /home/USER`** (Apache traversal)
16. **Permisos 644 archivos / 755 carpetas** en `public_html/`
17. **Operaciones de root EN `deploy.sh`**, operaciones de user EN `install_server.sh`/`fix.sh`
18. **`rsync` con `--exclude 'venv' --exclude '.env' --exclude 'backend.log'`** SIEMPRE
19. **Backup diario de MongoDB con `mongodump`** en crontab (`@daily` a las 3 AM, retención 14 días)
20. **Auto-seed de super admin en startup del backend** (idempotente, lee de env vars)

### ❌ NO HACER

1. **NO** correr `yarn build` en el servidor de producción → **HACE CRASH al servidor entero**. El frontend se construye SOLO en Emergent y `frontend/build/` se commitea al repo
2. **NO** repo en `/home/USER/` directamente (conflicto con cPanel system folders)
3. **NO** `sudo` adentro de `install_server.sh`/`fix.sh` (corren como user, sudo pide password)
4. **NO** versiones pineadas en `requirements.prod.txt` (rompe en Python 3.9)
5. **NO** `pandas`/`numpy`/`pytest` en prod (no se usan, agregan 500MB)
6. **NO** apt — usa `dnf` (AlmaLinux es RHEL)
7. **NO** supervisor/systemd — solo `nohup` + crontab `@reboot`
8. **NO** nginx — Apache via cPanel
9. **NO** `withCredentials: true` con cookies httpOnly (proxy de cPanel rompe esto — usa Bearer token en localStorage)
10. **NO** `Access-Control-Allow-Origin: *` con `credentials: true` (browser rechaza)
11. **NO** olvides commitear el `frontend/build/` actualizado antes de "Save to GitHub"
12. **NO** copies `frontend/build/` al `public_html/` sin antes hacer `rm` de `static/`, `index.html`, `asset-manifest.json` (asset hashes viejos)
13. **NO** corras git/instaladores como `root` cuando el dir es del user (dubious ownership)
14. **NO** `rsync --delete` sin excluir `venv` (te destruye el venv)
15. **NO** detectes first-install por `[ ! -d "$PROD/venv" ]` — usa `[ ! -f "$PROD/venv/bin/activate" ]`
16. **NO** dejes `.gitignore` con `/build` activo si quieres commitear el build (revisa AMBOS .gitignore)

---

## 🔑 Plantilla de `deploy.sh` (Raíz del Repo)

```bash
#!/bin/bash
set -e
# ============ AJUSTA ESTAS 4 VARIABLES ============
REPO_URL="https://github.com/TUUSUARIO/TUREPO.git"
CPANEL_USER="miapp"
PORT=8008                              # siguiente puerto libre
DOMAIN="miapp.com"
# ===================================================
REPO="/home/${CPANEL_USER}/repo"
PROD="/opt/${CPANEL_USER}/backend"

[ "$EUID" -ne 0 ] && { echo "X Run as root"; exit 1; }
git config --global --add safe.directory '*' 2>/dev/null || true

as_user() { su -s /bin/bash -l "$CPANEL_USER" -c "$1"; }

# DETECCIÓN ROBUSTA: por activate file, NO por el directorio
if [ ! -f "$PROD/venv/bin/activate" ]; then
    echo ">>> FIRST-TIME INSTALL"

    # LIMPIAR ESTADO ROTO (carpeta venv vacía de intento previo)
    rm -rf "$PROD/venv"

    if [ ! -d "$REPO/.git" ]; then
        rm -rf "$REPO" && git clone "$REPO_URL" "$REPO"
    fi
    chown -R "$CPANEL_USER:$CPANEL_USER" "$REPO"
    chmod 711 "/home/$CPANEL_USER"
    mkdir -p "$PROD"
    chown -R "$CPANEL_USER:$CPANEL_USER" "/opt/$CPANEL_USER"
    if [ ! -f "$PROD/.env" ]; then
        cp "$REPO/deploy/backend.env.production.example" "$PROD/.env"
        sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 64)|" "$PROD/.env"
        chown "$CPANEL_USER:$CPANEL_USER" "$PROD/.env"
        chmod 600 "$PROD/.env"
    fi
    as_user "bash $REPO/deploy/install_server.sh"
    as_user "bash $REPO/deploy/setup-autostart.sh"
else
    echo ">>> UPDATE"
    chown -R "$CPANEL_USER:$CPANEL_USER" "$REPO"
    as_user "bash $REPO/deploy/fix.sh"
fi

sleep 3
if curl -sf "http://127.0.0.1:$PORT/api/" >/dev/null; then
    echo "  ✅ Backend OK"
    echo "  🎉 https://$DOMAIN/"
else
    echo "  ❌ Backend not responding:"
    tail -n 20 "$PROD/backend.log" 2>/dev/null
    exit 1
fi
```

---

## 📂 Plantillas Internas (`deploy/`)

### `install_server.sh` — CRÍTICO: NO hace yarn build

```bash
#!/bin/bash
set -e
CPANEL_USER="miapp"
PORT=8008
DOMAIN="miapp.com"

REPO="/home/${CPANEL_USER}/repo"
PROD="/opt/${CPANEL_USER}/backend"
PH="/home/${CPANEL_USER}/public_html"

# 1. Python venv
python3.9 -m venv "$PROD/venv" 2>/dev/null || python3 -m venv "$PROD/venv"
source "$PROD/venv/bin/activate"
pip install --upgrade pip setuptools wheel
pip install \
    --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/ \
    -r "$REPO/deploy/requirements.prod.txt"

# 2. Copy backend (EXCLUDE venv, .env, logs)
rsync -a \
    --exclude '__pycache__' --exclude 'tests' \
    --exclude '.env' --exclude 'venv' --exclude 'backend.log' \
    "$REPO/backend/" "$PROD/"

# 3. Deploy pre-built frontend (built in Emergent, committed to git)
if [ ! -f "$REPO/frontend/build/index.html" ]; then
    echo "X frontend/build/index.html MISSING — build in Emergent and commit it"
    exit 1
fi
mkdir -p "$PH"
rm -rf "$PH/static" "$PH/index.html" "$PH/asset-manifest.json" "$PH/favicon.ico" "$PH/manifest.json" "$PH/robots.txt"
cp -r "$REPO/frontend/build/." "$PH/"
cp "$REPO/deploy/htaccess" "$PH/.htaccess"
find "$PH" -type f -exec chmod 644 {} \;
find "$PH" -type d -exec chmod 755 {} \;

# 4. Start backend
pkill -f "uvicorn.*:${PORT}" 2>/dev/null || true
sleep 1
cd "$PROD"
nohup "$PROD/venv/bin/uvicorn" server:app --host 127.0.0.1 --port "$PORT" --workers 1 \
    > "$PROD/backend.log" 2>&1 &
sleep 4
curl -sf "http://127.0.0.1:${PORT}/api/" || { tail -n 40 "$PROD/backend.log"; exit 1; }

# 5. Restart script
cat > "/home/${CPANEL_USER}/restart.sh" <<EOF
#!/bin/bash
pkill -f "uvicorn.*:${PORT}" 2>/dev/null || true
sleep 1
cd ${PROD}
nohup ${PROD}/venv/bin/uvicorn server:app --host 127.0.0.1 --port ${PORT} --workers 1 > ${PROD}/backend.log 2>&1 &
EOF
chmod +x "/home/${CPANEL_USER}/restart.sh"
```

### `fix.sh` — Updates

```bash
#!/bin/bash
set -e
CPANEL_USER="miapp"; PORT=8008
REPO="/home/${CPANEL_USER}/repo"
PROD="/opt/${CPANEL_USER}/backend"
PH="/home/${CPANEL_USER}/public_html"

cd "$REPO"
git fetch origin && git reset --hard origin/main

[ ! -f "$PROD/venv/bin/activate" ] && { echo "X venv missing — rm -rf $PROD/venv && bash $REPO/deploy.sh"; exit 1; }
source "$PROD/venv/bin/activate"
pip install --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/ -r "$REPO/deploy/requirements.prod.txt"

rsync -a --exclude '__pycache__' --exclude 'tests' --exclude '.env' --exclude 'venv' --exclude 'backend.log' "$REPO/backend/" "$PROD/"

if [ -f "$REPO/frontend/build/index.html" ]; then
    rm -rf "$PH/static" "$PH/index.html" "$PH/asset-manifest.json"
    cp -r "$REPO/frontend/build/." "$PH/"
    cp "$REPO/deploy/htaccess" "$PH/.htaccess"
    find "$PH" -type f -exec chmod 644 {} \;
    find "$PH" -type d -exec chmod 755 {} \;
fi

pkill -f "uvicorn.*:${PORT}" 2>/dev/null || true
sleep 1
cd "$PROD"
nohup "$PROD/venv/bin/uvicorn" server:app --host 127.0.0.1 --port "$PORT" --workers 1 > "$PROD/backend.log" 2>&1 &
sleep 4
curl -sf "http://127.0.0.1:${PORT}/api/" || { tail -n 40 "$PROD/backend.log"; exit 1; }
```

### `requirements.prod.txt` — SLIM (igual para todos los proyectos Emergent)

```
fastapi
uvicorn
python-dotenv
pymongo
motor
pydantic
email-validator
pyjwt
bcrypt
passlib
python-multipart
requests
tzdata
python-jose
emergentintegrations==0.1.0
```

### `htaccess` — cambia solo el puerto

```
RewriteEngine On
RewriteCond %{HTTPS} !=on
RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

RewriteCond %{REQUEST_URI} ^/api
RewriteRule ^(.*)$ http://127.0.0.1:8008/$1 [P,L]

RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

### `backend.env.production.example`

```
MONGO_URL=mongodb://localhost:27017
DB_NAME=miapp_prod
CORS_ORIGINS=https://miapp.com,https://www.miapp.com
JWT_SECRET=GENERATED_BY_DEPLOY_SCRIPT
JWT_EXPIRY_HOURS=12
SUPER_ADMIN_EMAIL=pzsuave007@gmail.com
SUPER_ADMIN_PASSWORD=CHANGE_ME
ADMIN_EMAIL=admin@miapp.com
ADMIN_PASSWORD=CHANGE_ME
EMERGENT_LLM_KEY=sk-emergent-XXXXXXXXXXXXXXXX
APP_NAME=miapp
```

### `setup-autostart.sh` — crontab @reboot + backup diario

```bash
#!/bin/bash
set -e
CPANEL_USER="miapp"
RESTART="/home/${CPANEL_USER}/restart.sh"
BACKUP_DIR="/home/${CPANEL_USER}/backups"
mkdir -p "$BACKUP_DIR"

CRON="$(crontab -l 2>/dev/null || true)"

# @reboot autostart
if ! echo "$CRON" | grep -q "$RESTART"; then
    (echo "$CRON"; echo "@reboot bash $RESTART > /home/${CPANEL_USER}/restart.log 2>&1") | crontab -
fi

# Daily Mongo backup 3 AM, 14-day retention
CRON="$(crontab -l 2>/dev/null || true)"
if ! echo "$CRON" | grep -q "mongodump --db miapp_prod"; then
    (echo "$CRON"; echo "0 3 * * * mongodump --db miapp_prod --out $BACKUP_DIR/\$(date +\\%Y\\%m\\%d) --quiet && find $BACKUP_DIR -mindepth 1 -maxdepth 1 -type d -mtime +14 -exec rm -rf {} \\;") | crontab -
fi
```

---

## 🛠️ Pasos de Despliegue (5 minutos en server fresco)

### 1️⃣ ANTES de SSH (en Emergent)

```bash
# A. Comentar las reglas /build en AMBOS .gitignore
sed -i 's|^/build|# /build|' /app/.gitignore
sed -i 's|^/build|# /build|' /app/frontend/.gitignore

# B. Construir el frontend
cd /app/frontend && yarn build

# C. Forzar git tracking del build (si quedó algún ignore residual)
cd /app && git add -f frontend/build/

# D. Click "Save to GitHub" del chat
```

### 2️⃣ En el servidor (como root, UNA sola vez)

```bash
git config --global --add safe.directory '*'
curl -sSL https://raw.githubusercontent.com/TUUSUARIO/TUREPO/main/bootstrap.sh | bash
```

### 3️⃣ En cPanel UI (3 clicks)

1. **SSL/TLS Status** → Let's Encrypt para `miapp.com` + `www.miapp.com`
2. **Domains** → toggle **Force HTTPS Redirect** ON
3. **WHM → EasyApache 4 → Apache Modules** → enable: `mod_proxy`, `mod_proxy_http`, `mod_headers`, `mod_rewrite`

### 4️⃣ Verificar

```bash
curl -i https://miapp.com/api/   # → HTTP 200 + JSON ✅
```

Abre `https://miapp.com/` → login con super admin → 🎉

### 5️⃣ Updates futuros (siempre 2-3 líneas)

En **Emergent**: terminas la feature, corres `cd /app/frontend && yarn build`, click "Save to GitHub".

En el **VPS**:
```bash
cd /home/miapp/repo && git pull && bash deploy.sh
```

O si configuras el alias (recomendado):
```bash
deployapp
```

---

## 🔥 Errores Comunes y Sus Fixes (Tabla Definitiva)

| Error | Causa | Fix |
|-------|-------|-----|
| `frontend/build/index.html MISSING` | `.gitignore` ignoró el build | Comentar `/build` en `/.gitignore` Y `/frontend/.gitignore`, `yarn build` + `git add -f frontend/build/` + Save to GitHub |
| `yarn build` crashea el server | Poca RAM en VPS cPanel | **NUNCA build en server**. Solo build en Emergent y commitea `frontend/build/` |
| `/opt/APP/backend/venv/bin/activate: No such file` | Install previo falló dejando `venv/` vacío + detección por dir | Usa `[ ! -f "$PROD/venv/bin/activate" ]` y `rm -rf "$PROD/venv"` al inicio |
| `cannot delete non-empty directory: venv/...` | `rsync --delete` sin excluir venv | Quitar `--delete` o agregar `--exclude 'venv'` |
| `dubious ownership in repository` | Git ≥2.35 + dir owner ≠ current user | `git config --global --add safe.directory '*'` |
| `Shell access is not enabled` | cPanel "no shell" para el user | `su -s /bin/bash -l USER -c "..."` |
| `sudo: a password is required` | `install_server.sh` usando sudo siendo user | Quitar `sudo`, hacer ops de root EN `deploy.sh` |
| `pip install emergentintegrations` falla | Index privado | Agregar `--extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/` |
| `yarn install` falla en engine check | Node 18 vs React 19 | `yarn install --ignore-engines` (solo en Emergent) |
| `Could not build wheels for pandas` | Versión pineada en Py 3.9 | Quitar pandas/numpy del prod, sin versiones pineadas |
| `403 Forbidden` en el dominio | Permisos del public_html | `chmod 711 /home/USER` + `find public_html -type f -exec chmod 644 {} \;` |
| `404 en /super` al recargar | Falta SPA fallback | `.htaccess` con `RewriteRule . /index.html [L]` |
| `502 Bad Gateway` en `/api/*` | Backend no corre | `pgrep -af "uvicorn.*PORT"` → si vacío, `bash /home/USER/restart.sh` |
| `mod_proxy` not enabled | EasyApache 4 default | WHM → enable mod_proxy + mod_proxy_http |
| Browser CORS error | `*` con credentials | Origin EXACTO en `CORS_ORIGINS` (https://dominio sin `/`) |
| Cookie httpOnly no se guarda | Proxy inyecta `Origin: *` | Usar Bearer token en localStorage (NO cookies) |
| Cambios del frontend no se ven | Olvidaste `yarn build` + commit | En Emergent: `yarn build` → `git add -f frontend/build/` → Save to GitHub → `deployapp` |
| Cambios del backend no aplican | Backend no se reinició | `deploy.sh` lo hace siempre con `pkill` + `nohup` |

---

## 🔧 Diagnóstico de un Comando

Cuando algo falle, corre el `diagnose.sh` (incluido en `deploy/`):

```bash
bash /home/USER/repo/deploy/diagnose.sh
```

O en un servidor fresco:
```bash
curl -sSL https://raw.githubusercontent.com/TUUSUARIO/TUREPO/main/deploy/diagnose.sh | bash
```

Te imprime 13 secciones con ✅/❌ exactamente qué está fallando.

---

## 💡 Tips de Productividad

### 1. Alias permanente para deploys rápidos
```bash
echo "alias deployapp='cd /home/USER/repo && git pull && bash deploy.sh'" >> /root/.bashrc
source /root/.bashrc
```
Luego solo: `deployapp`. 🪄

### 2. Auto-seed de Super Admin
Agregar en el `startup` del backend (FastAPI) — lee `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD` del `.env` y crea el user automáticamente si no existe. Idempotente. **Crítico** para que el primer login funcione tras deploy fresco.

### 3. Backup diario de MongoDB (configurado por `setup-autostart.sh`)
- Corre a las 3 AM, retención 14 días en `/home/USER/backups/`
- Restore: `mongorestore --db APP_prod /home/USER/backups/YYYYMMDD/APP_prod`

### 4. Logs útiles
```bash
tail -n 100 /opt/USER/backend/backend.log     # Backend
tail -n 50 /usr/local/apache/logs/error_log    # Apache
pgrep -af "uvicorn.*PORT"                       # Estado backend
```

---

## ✅ Checklist Final del Próximo Proyecto

Copia este checklist y márcalo en orden:

### En Emergent (antes de tocar el server)
- [ ] Elegir puerto único (siguiente al último: `8008`+)
- [ ] **Comentar `/build` en `/.gitignore`** (raíz)
- [ ] **Comentar `/build` en `/frontend/.gitignore`**
- [ ] `cd /app/frontend && yarn build` exitoso
- [ ] `git add -f frontend/build/` (por si quedó algún ignore residual)
- [ ] Adaptar template `deploy.sh` con 4 variables del header
- [ ] Copiar carpeta `deploy/` con todos los scripts internos
- [ ] Ajustar `requirements.prod.txt` (slim, sin versiones pineadas)
- [ ] Ajustar `htaccess` con el nuevo puerto
- [ ] Ajustar `backend.env.production.example` con dominio + credentials
- [ ] Verificar `EMERGENT_LLM_KEY` válido en el `.env.example`
- [ ] Agregar auto-seed de super admin en `server.py` startup
- [ ] Click "Save to GitHub"

### En cPanel (3 minutos)
- [ ] Crear cuenta cPanel para el nuevo user (ej: `miapp`)
- [ ] DNS apuntado al server
- [ ] Crear repo en GitHub

### En el VPS (5 minutos)
- [ ] SSH como root
- [ ] `git config --global --add safe.directory '*'` (si server fresco)
- [ ] `curl bootstrap.sh | bash`
- [ ] cPanel: SSL Let's Encrypt + Force HTTPS + Apache modules
- [ ] `curl https://dominio.com/api/` → HTTP 200 ✅
- [ ] Login con super admin → 🎉

---

**Hecho con cariño tras los deploys de La Campeona 880 AM (Feb 2026) y Unitap (Mayo 2026).**
**Pzsuave007 — el próximo deploy es de 5 minutos. Lo prometo de verdad esta vez.** 🚀
