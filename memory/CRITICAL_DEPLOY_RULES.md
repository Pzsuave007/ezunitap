# 🚨🚨🚨 REGLAS DE DEPLOY CRÍTICAS — LEER ANTES DE COMPILAR EL FRONTEND 🚨🚨🚨
# 🚨🚨🚨 CRITICAL DEPLOY RULES — READ BEFORE BUILDING THE FRONTEND 🚨🚨🚨

> **ESTE DOCUMENTO ES OBLIGATORIO PARA TODO AGENTE (incluyendo forks / cambio de agente).**
> **THIS DOCUMENT IS MANDATORY FOR EVERY AGENT (including forks / agent handoffs).**
>
> El usuario (Paul) exigió explícitamente que esto NUNCA vuelva a pasar.
> The user (Paul) explicitly demanded this must NEVER happen again.

---

## ⛔ LA REGLA DE ORO / THE GOLDEN RULE

La app es **MULTI-DOMINIO**: se sirve en **`ezunitap.com`** Y **`ezunitech.com`** desde el mismo build.
The app is **MULTI-DOMAIN**: served on **both `ezunitap.com` AND `ezunitech.com`** from the same build.

➡️ El build SIEMPRE debe usar **`/api` RELATIVO** (variable `REACT_APP_BACKEND_URL` VACÍA).
➡️ The build MUST ALWAYS use a **RELATIVE `/api`** (EMPTY `REACT_APP_BACKEND_URL`).

### ✅ CORRECTO / CORRECT — compila así, SIEMPRE:
```bash
cd /app/frontend && rm -rf build && yarn build
```
(`.env.production` ya tiene `REACT_APP_BACKEND_URL=` vacío → `API_BASE = "/api"` relativo.)

### ❌ PROHIBIDO / FORBIDDEN — NUNCA hagas esto:
```bash
# ❌ NO ❌  — esto hornea un dominio absoluto y ROMPE el otro dominio (CORS)
REACT_APP_BACKEND_URL=https://ezunitap.com yarn build
REACT_APP_BACKEND_URL=https://ezunitech.com yarn build
```

---

## ¿POR QUÉ? / WHY?

`src/lib/api.js` hace: `API_BASE = ${REACT_APP_BACKEND_URL}/api`.
- Si `REACT_APP_BACKEND_URL` está **vacío** → `API_BASE = "/api"` (relativo) → funciona en CUALQUIER dominio (mismo origen). ✅
- Si horneas `https://ezunitap.com` → `API_BASE = "https://ezunitap.com/api"` → cuando el usuario entra a **ezunitech.com**, el navegador hace una llamada cruzada a ezunitap.com y la **BLOQUEA por CORS** → **el login falla en ezunitech.com**. ❌

**Esto pasó (Jun 2026):** un agente compiló con `REACT_APP_BACKEND_URL=https://ezunitap.com` y dejó a los usuarios SIN poder entrar a `ezunitech.com`. Tardó en detectarse porque `ezunitap.com` sí funcionaba.

---

## VERIFICACIÓN OBLIGATORIA ANTES DE HACER COMMIT / MANDATORY CHECK BEFORE COMMIT

```bash
JS=$(ls /app/frontend/build/static/js/main.*.js)
# 1) NO debe haber NINGUNA URL absoluta de API (debe salir VACÍO):
grep -oE "https://(ezunitap\.com|ezunitech\.com|unitech-preview[^\"',]*)/api" "$JS" | sort -u
# 2) NO debe filtrarse la URL de preview (debe salir VACÍO):
grep -oE "unitech-preview[^\"',]*" "$JS" | sort -u
# 3) DEBE existir el "/api" relativo (debe imprimir "/api"):
grep -oE '"/api"' "$JS" | head -1
```
- Si (1) o (2) imprimen algo → **EL BUILD ESTÁ MAL → recompila con `yarn build` plano**.
- (3) debe imprimir `"/api"`.

---

## PASOS COMPLETOS DE DEPLOY / FULL DEPLOY STEPS

1. `cd /app/frontend && rm -rf build && yarn build`  ← **plano, sin variables**
2. Correr la verificación de arriba (los 3 greps).
3. `cd /app && git add -f frontend/build/`  ← forzar (la carpeta build puede estar untracked).
4. La plataforma Emergent hace auto-commit de archivos trackeados.
5. Decirle al usuario: **"Save to GitHub"** y luego en el VPS:
   ```bash
   cd /home/ezunitap/repo && git pull && cp -r frontend/build/. /home/ezunitap/public_html/
   ```
6. El usuario hace **hard refresh** (`Cmd/Ctrl + Shift + R`) en AMBOS dominios y prueba el login.

> El VPS tiene MUY poca RAM y NO puede correr `yarn build`. El build DEBE llegar precompilado por git.
> The VPS has VERY low RAM and CANNOT run `yarn build`. The build MUST arrive pre-compiled via git.

---

## NOTAS / NOTES

- El "preview URL leak" (May 2026) ya está arreglado en `craco.config.js` (solo carga `.env` en dev). Por eso un `yarn build` plano ahora SÍ usa `.env.production` (vacío) correctamente. NO vuelvas a "arreglarlo" forzando un dominio.
- Los links para compartir (tarjeta, reseñas, invoices públicos) usan `window.location.origin` y el backend usa `_public_base_from_request` → se adaptan solos al dominio. Por eso `/api` relativo es seguro.
- Auth es Bearer token en localStorage (no cookies) → funciona idéntico en ambos dominios.
- CORS del backend (`CORS_ORIGINS`) incluye ambos dominios, pero con `/api` relativo ni siquiera se necesita cross-origin.
