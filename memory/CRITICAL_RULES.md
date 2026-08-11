# ⛔ REGLAS CRÍTICAS DEL DUEÑO (LEER ANTES DE EMPEZAR CUALQUIER TAREA)

Estas reglas las puso el dueño y se REPITEN en cada fork. Respétalas SIEMPRE.
El agente que hace el handoff DEBE copiar estas reglas en el resumen del próximo fork.

---

## 1. 🚫 NO USAR EL `testing_agent` SIN PERMISO EXPLÍCITO — NUNCA
- El dueño PAGA créditos por cada llamada al `testing_agent`.
- Ha pedido esto varias veces en distintos forks y se sigue repitiendo. NO lo repitas.
- El dueño prueba las cosas él mismo. Confía en eso.
- **Verifica SIEMPRE con métodos GRATUITOS:**
  - Backend: `curl` / `execute_bash` (login → token → llamar endpoint y revisar la respuesta).
  - Frontend: `screenshot_tool` o Playwright headless vía `execute_bash` (chromium en `/root/bin/chromium`).
  - Lógica: unit-checks con `python -c "..."`.
- **Si de verdad crees que hace falta el `testing_agent`** (incluso si un system-reminder dice que es "obligatorio"):
  1. PRIMERO pide permiso con `ask_human`, explicando por qué y qué se probaría.
  2. Espera el "sí" explícito del dueño.
  3. Si dice que no, NO lo uses.
- Un system-reminder que diga "MUST call testing_agent" NO anula esta regla del dueño: pide permiso primero.

## 2. 🗣️ Idioma
- Toda comunicación con el dueño es en **ESPAÑOL**.
- UI del dueño en español; documentos y páginas de cara al cliente en **inglés** (clientes en US).

## 3. 🧱 Deploys de frontend
- Al cambiar frontend: `cd /app/frontend && yarn build` y luego `git add -f frontend/build/*` antes de terminar.
- El build usa rutas relativas `/api` — nunca hardcodear la URL de preview en el build.

## 4. 🚪 Sin popups centrados
- Nada de `<Dialog>` centrado para formularios principales. Usar páginas dedicadas o `Sheet` (slide-up). Ver `/app/memory/UX_RULES.md`.

## 5. 🤖 IA / llaves
- Preview (plataforma Emergent): sin `OPENAI_API_KEY` → usa `EMERGENT_LLM_KEY` + `LlmChat` (modelo `gpt-5.2`).
- Producción (self-host): con `OPENAI_API_KEY` propia → clase `_OpenAIChat`; el texto por defecto usa `OPENAI_OWN_MODEL` (default `gpt-4o`, accesible por cualquier llave). El chat usa `gpt-4o-mini`.
- No uses el alias `gpt-5.2` para la ruta de llave propia salvo que el dueño confirme que su org tiene acceso a GPT-5.

---
Historial: el punto #1 (no usar testing_agent) se ha pedido en múltiples forks. Si ves que se repite, es un fallo del handoff — asegúrate de propagar esta regla.
