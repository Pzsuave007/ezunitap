# Unitap — Production Deploy Guide

> Server profile: **GoDaddy VPS + cPanel + AlmaLinux + Apache + Python 3.9 + Node 18 + MongoDB local**

## 🎯 Settings for Unitap

| Item | Value |
|------|-------|
| cPanel user | `ezunitap` |
| Backend port | `8007` |
| Domain | `ezunitap.com` |
| DB name | `unitap_prod` |
| Repo path on server | `/home/ezunitap/repo` |
| Backend prod path | `/opt/ezunitap/backend` |
| Frontend served from | `/home/ezunitap/public_html` |

## 🚀 First-Time Deploy (5 minutes)

### 1. Pre-deploy (in Emergent)
- ✅ `frontend/build/` is committed to repo (already done — `.gitignore` updated)
- ✅ Push the latest code with **"Save to GitHub"** in the Emergent chat input
- ✅ Confirm `REPO_URL` in `deploy.sh` and `bootstrap.sh` matches your real GitHub repo URL

### 2. On the server (as root, once)
```bash
# Allow git everywhere (one-time per server)
git config --global --add safe.directory '*'

# Bootstrap → clones repo + runs deploy.sh
curl -sSL https://raw.githubusercontent.com/Pzsuave007/ezunitap/main/bootstrap.sh | bash
```

### 3. In cPanel UI (3 clicks)
1. **SSL/TLS Status** → Let's Encrypt for `ezunitap.com` + `www.ezunitap.com`
2. **Domains** → toggle **Force HTTPS Redirect** ON
3. **WHM → EasyApache 4 → Apache Modules** → enable: `mod_proxy`, `mod_proxy_http`, `mod_headers`, `mod_rewrite`

### 4. Verify
```bash
curl -i https://ezunitap.com/api/        # → HTTP 200 + JSON
```
Then open https://ezunitap.com/login and sign in with the super admin from `.env`.

## 🔄 Future Updates (always 2 lines)
```bash
cd /home/ezunitap/repo && git pull && bash deploy.sh
```

## 🛡️ Backups
A daily MongoDB backup is scheduled at **3 AM** (`mongodump --db unitap_prod`) keeping the last **14 days** in `/home/ezunitap/backups/`. Configured automatically by `setup-autostart.sh`.

To restore:
```bash
mongorestore --db unitap_prod /home/ezunitap/backups/YYYYMMDD/unitap_prod
```

## 🔑 Default Admin Credentials
Created automatically at first backend startup using the `.env` values:
- `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`
- `ADMIN_EMAIL` / `ADMIN_PASSWORD`

If the user already exists, seed is skipped (idempotent — safe to re-run).

## 🔥 Troubleshooting
| Symptom | Fix |
|---------|-----|
| `502 Bad Gateway` on `/api/*` | `bash /home/ezunitap/restart.sh` |
| Frontend changes not visible | Did you `yarn build` and commit `frontend/build/`? |
| Login works but `/auth/me` returns 401 | Check `CORS_ORIGINS` in `/opt/ezunitap/backend/.env` matches exact domain (no trailing slash) |
| Backend log | `tail -n 100 /opt/ezunitap/backend/backend.log` |
| Apache log | `tail -n 50 /usr/local/apache/logs/error_log` |
