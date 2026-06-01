# Unitap (formerly ServicioFlow AI) — Product Requirements Document

## 🚨 CRITICAL DEPLOY RULE — DO NOT SKIP 🚨
**EVERY time the frontend changes (any file under `/app/frontend/src/`), the agent MUST:**
1. **ALWAYS run build with the env var EXPLICITLY** — NEVER rely on `.env.production` alone:
   ```
   cd /app/frontend && rm -rf build && REACT_APP_BACKEND_URL=https://ezunitap.com yarn build
   ```
   ⚠️ A plain `yarn build` quietly bakes the **preview URL** from `.env` instead of `.env.production`. This DID happen once (May 2026) and shipped a build that called Emergent's backend from `ezunitap.com`, showing fake test data instead of real production data. NEVER again.
2. **Verify the build was bundled with the correct URL** before commit:
   ```
   grep -oE "https://(ezunitap\.com|unitap-staging[^\"',]*)" /app/frontend/build/static/js/main.*.js | sort -u
   ```
   Must show ONLY `https://ezunitap.com`. If `unitap-staging-*.preview.emergentagent.com` appears, the build is WRONG — rebuild.
3. **FORCE-add the build folder to git**: `cd /app && git add -f frontend/build/`
4. **Explicitly commit it** (Emergent auto-commit ONLY commits already-tracked files; `frontend/build/` may be untracked after a clean): `git commit -m "Build frontend: <change summary>"`
5. Tell the user to **"Save to GitHub"** in chat input + `git pull` + `cp -r frontend/build/. /home/ezunitap/public_html/` on the VPS.

**Why:** The user's VPS has very low RAM and CANNOT run `yarn build`. The build folder MUST arrive pre-compiled via git, AND must be compiled against `ezunitap.com`, not the preview URL.

## Original Problem Statement
SaaS for Latino service contractors (roofing, drywall, construction, cleaning, painting, concrete, landscaping). UI in Spanish for the owner; quotes/invoices/messages to clients in English. Simple, mobile-first, usable by non-technical users from a phone. Production domain: **ezunitap.com**.

## Architecture
- **Backend**: FastAPI (port 8001 dev / 8007 prod) on `/api` prefix, MongoDB via motor (async)
- **Frontend**: React 19 + Tailwind + Shadcn UI components
- **AI**: OpenAI GPT-5.2 via Emergent Universal Key (`emergentintegrations`)
- **Storage**: Emergent Object Storage (abstracted in `storage_service.py`)
- **Auth**: JWT (PyJWT) Bearer token in localStorage + bcrypt password hashing
- **PDF**: Client-side via `jspdf` + `jspdf-autotable`
- **Production hosting**: GoDaddy VPS + cPanel + AlmaLinux + Apache + Python 3.9 + Node 18 + MongoDB local (mirrors La Campeona 880 AM proven pattern)

## User Persona
Latino contractor/business owner (roofing, drywall, painting, etc.), non-technical, works mostly from a smartphone on-site. Speaks Spanish; clients speak English.

## Core Requirements
1. UI 100% in Spanish, customer-facing docs 100% in English
2. Mobile-first (large touch targets, bottom nav, single-column layouts)
3. End-to-end flow: Add Client → AI Quote → Send → Convert to Invoice → Track Job → Request Review
4. AI Quote Builder (text & photo input)
5. AI Message Writer with templates
6. AI Scope of Work
7. PDF generation client-side for quotes & invoices
8. Public share link for quotes (no auth)
9. Smart Business Card System — Linktree-style premium digital card with industry templates
10. Calendar with Day/Week/Month/List views + recurring jobs

## What's Been Implemented
- Backend monolith `server.py` with auth, CRM, quotes, invoices, jobs, calendar, AI, cards, storage
- Frontend SPA with Landing, Dashboard, CRM, Calendar, AI Quote/Invoice/Message, SmartCard, CardAdmin
- Premium unauthenticated Landing Page with 5-trade rotating phone mockup carousel
- Smart Card with brand/accent colors, hero layouts (large photo / cover+avatar), 1-tap industry templates
- CardAdmin with live ScaledCanvas phone mockups in real-time
- Complete rebrand from ServicioFlow AI → Unitap
- **NEW (this session)**: Full production deployment system for self-hosted cPanel VPS
  - `deploy.sh` (root, idempotent first-install / update detection)
  - `bootstrap.sh` (one-line `curl | bash` fresh-server bootstrap)
  - `deploy/install_server.sh`, `deploy/fix.sh`, `deploy/setup-autostart.sh`
  - `deploy/htaccess` (Apache proxy `/api/*` → `127.0.0.1:8007` + SPA fallback)
  - `deploy/requirements.prod.txt` (slim, Python 3.9 compatible, no pandas/numpy)
  - `deploy/backend.env.production.example` with super-admin seed values
  - Auto-seeded super admin on first startup (idempotent, reads `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD` from env)
  - Daily MongoDB backup at 3 AM (14-day retention)
  - `@reboot` crontab so backend survives server reboots
  - `frontend/build/` committed to git (server has low RAM, no yarn build there)
  - Complete deploy README at `/app/deploy/README.md`

## Production Deploy Variables
| Item | Value |
|------|-------|
| cPanel user | `ezunitap` |
| Backend port | `8007` |
| Domain | `ezunitap.com` |
| DB name | `unitap_prod` |
| Repo path | `/home/ezunitap/repo` |
| Backend prod path | `/opt/ezunitap/backend` |
| Frontend served from | `/home/ezunitap/public_html` |
| Backup path | `/home/ezunitap/backups` |

## Prioritized Backlog
### P0 — Deploy
- [ ] User creates GitHub repo `unitap` and pushes via "Save to GitHub"
- [ ] User SSH into VPS as root and runs `curl -sSL .../bootstrap.sh | bash`
- [ ] Configure SSL + Force HTTPS + Apache mod_proxy in cPanel UI
- [ ] Verify `https://ezunitap.com/api/` returns 200

### P1
- [x] ~~Admin dashboard to track which users need physical NFC card shipping~~ → Implemented as `/admin/envios` (Feb 2026)
- [ ] Integrate user's existing Google Reviews NFC card system (widget + card) into the app — Stripe Phase 3
- [ ] Automated client reminders (SMS Twilio or Email Resend) 1 day before scheduled job
- [ ] Auto-generate invoice when marking a recurring calendar visit as completed
- [ ] Export Calendar to `.ics` format
- [ ] DB cleanup script: dedupe clients and admin users (long-standing tech debt)
- [ ] Set `STRIPE_WEBHOOK_SECRET` in production .env and configure webhook endpoint in Stripe Dashboard pointing to `https://ezunitap.com/api/webhook/stripe`

### P2
- [ ] Portfolio image carousel on public Smart Card
- [ ] "Solo Logo" 3rd hero layout for Smart Card
- [ ] Google Reviews API integration
- [ ] Refactor `server.py` (now 2350+ lines) into routers per domain

### P3
- [ ] Employee management & expense tracking

### P4
- [x] ~~Guided interactive onboarding tour~~ → Implemented as WelcomeModal + SetupChecklist (Feb 2026)

## Recently Implemented
- **Feb 2026 (Landing NFC update)** — Landing page (`/app/frontend/src/pages/Landing.js`) "¿Qué es una tarjeta NFC?" section now shows BOTH physical cards side-by-side: "Smart Business Card NFC" (`/nfc-digital.webp`) + "Tarjeta de Reseñas NFC" (`/nfc-google-review.png`). Removed the personalization promise "con tu nombre y logo" in 2 places (cards ship blank for now) → now reads "tarjeta física NFC profesional, lista para usar". Images live in `frontend/public/`. Production build rebuilt with `REACT_APP_BACKEND_URL=https://ezunitap.com` and force-added to git (`frontend/build/`). Verified via screenshot tool.

- **May 2026 (LIVE LAUNCH 🚀)** — Production switched from Stripe Test to Live keys. Confirmed first real paying customer: Paul Zacapantzi / Mirada Latina Magazine (`paul@info.growthally.agency`). End-to-end flow verified: checkout → trial → webhook → shipping address captured → appears in `/admin/envios`. Production keys loaded via `/home/ezunitap/public_html/keys.txt` (outside repo) and synced to `/opt/ezunitap/backend/.env` by `deploy.sh`. New `keys.sh` script reports mode (LIVE/TEST), key prefix, backend status, and API health at a glance.

- **May 2026 (In-app messaging system)** — Complete notification platform with 4 message kinds (info/success/warning/announcement) and 9 segments (all / one user / trial / trial expiring ≤3d / active / pro_monthly / pro_yearly / founder / comp / ship_pending / ship_shipped). Admin compose at `/admin/mensajes` with live segment-count preview before sending. User-facing `<NotificationBanner/>` polls every 60s, shows top 2 stacked at the top of every page with dismissable + action button. Full inbox at `/notificaciones`. **Auto-triggers** wired into `admin_update_shipment`: when status → shipped, sends "Tu tarjeta NFC fue enviada" with tracking number; when status → delivered, sends "Tu tarjeta NFC llegó". Backend collection `notifications` with `_create_notification()` helper + 5 endpoints (`GET /api/notifications`, `POST /notifications/{id}/dismiss`, `GET /admin/notifications`, `POST /admin/notifications`, `DELETE /admin/notifications/{id}`, `GET /admin/segments/preview`). Files: `/app/backend/server.py` (notifications block ~370 lines), `/app/frontend/src/pages/AdminMessages.js`, `/app/frontend/src/pages/NotificationsInbox.js`, `/app/frontend/src/components/NotificationBanner.js`, `/app/frontend/src/components/AdminTabs.js` (added "Mensajes" tab).

- **May 2026 (Sales-friendly trial UX)** — Removed billing-anxiety triggers from trial users' UI per user feedback ("sales psychology — don't remind them when to cancel"). TrialBanner now shows "¡Bienvenido a UniTap Pro! Tu tarjeta NFC física ya está en proceso de programación y envío" instead of countdown. SubscriptionSection badge says "Pro" (not "Trial · Pro"), renewal date still discreetly visible in Settings card if user looks for it but never anywhere prominent. Status label is "Activa" not "En prueba".

- **May 2026 (Legal pages + email infrastructure)** — Public `/terminos` and `/privacidad` pages (English, 12 + 11 sections covering Stripe billing, AI content, refunds, GDPR-style rights, Washington governing law). Register page now shows "Al crear una cuenta aceptas nuestros Términos y Política de Privacidad". `email_service.py` with dual backend: SMTP-first (for self-hosted email like cPanel), Resend fallback. Not wired up to anything yet per user choice (they'll check `/admin/metricas` for new subs instead). Owner notification function ready: `notify_owner(subject, html)` called from `_apply_subscription_to_user()` first apply only.

- **May 2026 (Admin business control center)** — New `/admin/metricas` super-admin dashboard with: MRR/ARR estimates, KPI cards (paying / trial / total / new-this-week), trials-expiring-in-3-days action list, recent signups, plan breakdown, and a filterable+searchable table of ALL users with per-row "Entrar" (impersonate) + "Eliminar cuenta" actions. New endpoints: `GET /api/admin/metrics`, `POST /api/admin/users/{user_id}/impersonate` (returns a JWT for the target user, stashes the admin's own token client-side so they can return). Global `<ImpersonationBanner/>` (red/orange gradient) shown app-wide when in impersonation mode with a "Volver a mi cuenta" button that restores the admin session. Cascading-delete confirmation flow with double-confirm for users having active Stripe subscriptions. Files: `/app/backend/server.py` (admin/metrics + impersonate routes), `/app/frontend/src/pages/AdminMetrics.js` (new), `/app/frontend/src/components/AdminTabs.js` (added "Métricas" tab as default), `/app/frontend/src/components/ImpersonationBanner.js` (new), `/app/frontend/src/context/AuthContext.js` (impersonate/endImpersonation helpers + sf_admin_token persistence).

- **May 2026 (Invoice delete)** — Added delete button to Invoices list (trash icon per row) and Invoice detail (dropdown menu item) — matches the existing Quotes UX. Backend `DELETE /api/invoices/{id}` already existed.

- **May 2026 (Smart Card unlocked during trial)** — `has_paid_subscription()` now returns True for `subscription_status="trialing"` too. The digital card was being incorrectly locked during the 14-day trial despite paywall copy saying "excepto la Tarjeta NFC física" (only the physical card should be gated). Physical NFC shipment still gated separately via `card_shipping_status` workflow.

- **May 2026 (Stripe production go-live: bug fixes)** — Fixed three production issues:
  1. `payments_service._apply_subscription_to_user()` was reading `session.shipping_details` (deprecated Stripe API 2025-02-24+); now reads `collected_information.shipping_details` with legacy fallback.
  2. `stripe_customer_id` was not being persisted to the user document during status polling — the Customer Portal button would fail. Now captured from `session.customer` and saved.
  3. `session.metadata.get("user_id")` raised `AttributeError: get` on certain Stripe SDK versions where `metadata` is a `StripeObject` without `.get()`. Added `_md()` defensive helper.
  4. `get_checkout_status` is now fully idempotent on `status=="complete"` (always re-runs apply) so older transactions backfill missing shipping_address/stripe_customer_id after fixes deploy.

- **May 2026 (Comp account UX)** — When a user is `is_comp=true` AND has no `stripe_customer_id`, the `<SubscriptionSection/>` shows a dedicated "Acceso PRO de cortesía" amber card (no Manage button, no portal CTA, with optional comp_note and comp_expires_at) instead of the broken "Gestionar suscripción" flow. `/payments/subscription` now exposes `is_comp`, `comp_note`, `comp_expires_at`. Sidebar "Suscripción" link redirects to `/ajustes#suscripcion` with auto-scroll anchor (was going to /precios which was confusing for subscribed users).

- **May 2026 (CRITICAL: prod was talking to preview DB)** — Discovered the production frontend at ezunitap.com was calling the preview backend at `unitap-staging-1.preview.emergentagent.com`, showing fake test data instead of real user data. Root cause: `yarn build` was reading `.env` (preview URL) instead of `.env.production`. Fixed by always invoking `REACT_APP_BACKEND_URL=https://ezunitap.com yarn build` explicitly. **Hard rule now enforced in CRITICAL DEPLOY RULE at top of this file.**

- **May 2026 (deploy workflow)** — `/app/deploy/fix.sh` (called by `deploy.sh`) now auto-loads `STRIPE_API_KEY` + `STRIPE_WEBHOOK_SECRET` from `/home/ezunitap/public_html/keys.txt` if present, so the user can rotate keys without committing them to git. Removed destructive `--delete` from frontend rsync (was nuking keys.txt). Cleaned up ad-hoc `f.sh`/`s.sh`/`r.sh` scripts the agent had erroneously created.

- **Feb 2026 (Trial 14 días — visibilidad, activación, extensión +7, notificaciones)** — Estrategia completa de trial→conversión (research-backed: 14 días sin tarjeta óptimo para blue-collar SMB; activación = palanca #1). (1) **Visibilidad**: badge "14 días gratis · Sin tarjeta" en `Register.js` (`trial-badge`) + toast de bienvenida + mensaje en `WelcomeModal`; **mini-pill sutil** en sidebar (`Layout.js` `TrialPill`, `sidebar-trial-pill`, ámbar en últimos ≤3 días). (2) **TrialBanner** rediseñado: prominente SOLO en últimos ≤4 días o expirado. (3) **Checklist de activación**: `onboarding_status` expandido a 4 items (business_info, smart_card, **first_quote**, **first_invoice**), título "Tus primeros pasos". (4) **Extensión +7 días** condicional: `POST /api/trial/extend` solo usuarios activos (clientes+invoices), una sola vez, cerca del final/grace; botón "Extender 7 días" en TrialBanner si `extend_eligible`. (5) **Secuencia de notificaciones in-app** (lazy, sin cron): welcome→mid(≤7d)→urgency(≤3d)→expired→post_expiry(+2d), idempotente vía `user.trial_notifs`, disparada en `GET /api/trial/status`. Campos backend nuevos: `trial_extended`, `trial_notifs`. Probado curl (welcome notif, status, elegibilidad, extend 2→9 one-time) + UI (pill+banner+extend+checklist confirmados en dashboard trial). Lint limpio, build prod + `git add -f`. Files: `/app/backend/server.py`, `/app/frontend/src/components/{Layout,TrialBanner,WelcomeModal,SetupChecklist}.js`, `/app/frontend/src/pages/Register.js`.

- **Feb 2026 (Menú dashboard reorganizado)** — Sidebar de escritorio agrupado por flujo: Inicio · Clientes · **Invoicing** (Quotes/Contratos/Invoices) · **Trabajos** (Agenda) · Google Reviews · Tarjeta Digital · sección **Cuenta** (Perfil/Suscripción). Grupos con encabezado (Invoicing no-clickeable, Trabajos clickeable→/trabajos) + hijos indentados con línea vertical. Helpers `SidebarLink`/`SidebarGroup` en `Layout.js`. Todo con íconos. Lint limpio.


- **Feb 2026 (Stripe Phase 2 — Live Test Keys + NFC Shipments Admin)** — Replaced Emergent Stripe proxy with the user's real Stripe Test API keys (`sk_test_51TbDk...`, `whsec_0bwErtRxKzTS...`). Verified `cs_test_...` checkout sessions are created end-to-end with 14-day trial + card-on-file + `shipping_address_collection` (US/MX/CA/PR). Webhook endpoint correctly returns 200 `{received:false}` on bad signatures (not 500) and persists shipping_address + `card_shipping_status='pending'` on `checkout.session.completed`. New Phase-2 admin section `/admin/envios` lets the owner see every paying user awaiting their physical NFC Google Reviews card, with status filter (pending/shipped/delivered), stat cards, address copy, tracking # + internal note, and one-click status transitions that auto-stamp `card_shipped_at` / `card_delivered_at`. New endpoints: `GET /api/admin/shipments?status=...`, `POST /api/admin/shipments/{user_id}`. `GET /api/admin/users` now also surfaces all 6 shipment fields. **Tested 17/17 backend** (iteration_13.json). Files: `/app/backend/server.py` (lines 2434-2540 admin/shipments routes), `/app/frontend/src/pages/AdminShipments.js` (new), `/app/frontend/src/components/AdminTabs.js` (added "Envíos NFC" tab), `/app/frontend/src/App.js` (new route), `/app/backend/tests/test_stripe_shipments.py` (new — covers Stripe + shipments).

- **Feb 2026 (Landing — reescritura completa con guion de venta)** — El usuario aprobó un copy (estilo ChatGPT) que muestra el flujo completo del negocio y vende el "por qué lo necesito". Se **reescribió `Landing.js` completo** (overwrite) manteniendo la marca **Unitap** y **conservando intactos los componentes visuales** (PhoneMockup, SmartCardPreview/Tarjeta NFC rotativa, CardPhoneMockup, StatCard). Nueva narrativa de arriba a abajo: (1) **Hero** "Tu negocio. Más clientes. Menos estrés." + subline del flujo completo + CTA "Crear cuenta gratis" + strip de oficios. (2) **Banda de dolor** "Olvídate de WhatsApp, notas, papeles y mil apps" (apps tachadas → Unitap). (3) **"Así Funciona" — 8 pasos** (`#como-funciona`) en timeline vertical con línea gradiente conectora, cada paso con ícono/checklist (Consigue clientes → Cotiza con AI → Acepta → Invoice auto → Pagos → Agenda → Fotos → Reseñas) + cierre flywheel. (4) **Tarjeta NFC** (`#tarjeta`, conservada) reposicionada como "Paso 1". (5) **"Todo en Español"** (`#espanol`) con visual ES→EN. (6) **Beneficios** (`#beneficios`) "Lo que antes tomaba horas ahora toma minutos" (6 beneficios + StatCards). (7) **CTA final** "Todo tu negocio. Conectado." + "Crear cuenta gratis". Botón global "Crear cuenta gratis" (decisión usuario). Lint limpio, hero verificado por screenshot, `flow-step-01`/`#tarjeta` confirmados, build prod regenerado + `git add -f frontend/build/`. **Pendiente: revisión visual del usuario.** Files: `/app/frontend/src/pages/Landing.js`.

- **Feb 2026 (Landing — narrativa de valor / venta)** — (SUPERSEDIDO por la reescritura completa de arriba) Primera iteración: se agregaron 4 secciones (antes/después, historia 6 pasos, costo, ancla de precio).

- **Feb 2026 (Reviews — link card movido arriba de stats)** — En `/reviews` el bloque "Tu link de reseñas" (Copiar/Compartir/Ver) se extrajo a un componente autónomo `ReviewLinkCard.js` y se movió ARRIBA de las stat cards (Clientes felices | Feedback | Total taps), debajo del título. Se removió del `GoogleReviewsSection` (que quedó solo como config). Lint limpio. Files: `/app/frontend/src/components/ReviewLinkCard.js` (nuevo), `/app/frontend/src/components/GoogleReviewsSection.js`, `/app/frontend/src/pages/GoogleReviewsPage.js`.

- **Feb 2026 (Reviews — estrellas + consistencia visual + anti-alarma)** — Tres mejoras pedidas por el usuario con capturas: (1) **Bloque del link en /reviews** rediseñado para igualar el estilo de la Tarjeta ("Tu link": ícono gradiente + label + url truncada + grid de 3 botones Copiar/Compartir/Ver). data-testids: `reviews-public-url`, `copy-gmb-link`, `gmb-share`, `gmb-view`. (2) **Página pública de reseñas** (`PublicReviewPage.js`): se reemplazaron las 3 caritas por un selector de **5 estrellas** con gating inteligente — 4-5★ → redirige a Google Reviews; 3★ o menos → formulario de feedback privado (sentiment mapeado: ≤2★ "sad", 3★ "neutral"). En el form de feedback se muestran las estrellas seleccionadas (read-only). (3) **Anti-alarma**: se quitó el nombre del dueño y el texto "— not public" del subtítulo del formulario (antes "...goes directly to {owner} — not public" → ahora "Tell us what happened and we'll make it right."); el thank-you ya no usa owner_name. Backend: `PublicReviewFeedbackIn` y el doc guardado ganaron campo `rating` (1-5, validado). **Verificado**: rating se guarda (curl), estrellas renderizan (DOM `star-rating`/`star-3`), lint limpio (front+back). Build de producción regenerado + `git add -f frontend/build/`. **Pendiente: prueba funcional por el usuario.** Files: `/app/backend/server.py` (PublicReviewFeedbackIn + feedback doc), `/app/frontend/src/pages/PublicReviewPage.js`, `/app/frontend/src/components/GoogleReviewsSection.js`.

- **Feb 2026 (Pedir reseña — compartir link de reviews)** — Nueva acción "Pedir reseña" que comparte el link público de la landing de reseñas (`/r/:card_slug`) vía WhatsApp / SMS / Email, reusando el `SendDocumentDialog` existente (mensaje en inglés listo para mandar). (1) Nuevo `SendDocumentDialog` kind `"review"` con plantilla de mensaje propia (pide reseña, 30 seg). (2) Nuevo componente reutilizable `RequestReviewButton.js` (botón amarillo + diálogo + guard: si no hay `google_review_url` configurado, muestra toast con CTA "Configurar" → /reviews). (3) Botón agregado en el perfil del cliente (`ClientDetail.js`, fila de acciones). (4) En `Jobs.js`: al cambiar un trabajo a "Completado" se abre automáticamente el aviso de pedir reseña (diálogo controlado), y cada tarjeta de trabajo completado muestra su propio botón "Pedir reseña". Usa `user.card_slug` y `user.business_name` del AuthContext. Lint limpio, webpack compila, `request-review-btn` verificado en ClientDetail. Build de producción regenerado + `git add -f frontend/build/`. **Pendiente: prueba funcional por el usuario** (abrir WhatsApp/SMS/Email). Files: `/app/frontend/src/components/SendDocumentDialog.js`, `/app/frontend/src/components/RequestReviewButton.js` (nuevo), `/app/frontend/src/pages/ClientDetail.js`, `/app/frontend/src/pages/Jobs.js`.

- **Feb 2026 (GMB Reviews — página dedicada)** — Migrada la sección de Google Reviews (pilar #3) desde `/ajustes` a una página dedicada `/reviews`. Nuevo enlace "Google Reviews" (icono Star) en el sidebar de escritorio, sección de cuenta (entre Tarjeta y Perfil), por elección del usuario; NO en barra inferior móvil. La página `GoogleReviewsPage.js` muestra: título, 3 stat cards (Clientes felices / Feedback negativo / Total taps con tasa de conversión), la sección de configuración embebida (`GoogleReviewsSection`: link GMB, mensaje bienvenida, switch de filtro de sentimiento, copiar link público) y la bandeja de feedback privado de clientes insatisfechos (😐/😞 vía `GET /api/review-feedback`). Sección removida de `Settings.js` (sin duplicado). Backend validado por curl (login + `/api/review-feedback` + `GET/PUT /api/google-reviews/settings`). Lint limpio. Build de producción regenerado con `REACT_APP_BACKEND_URL=https://ezunitap.com` y `git add -f frontend/build/`. **Pendiente: prueba funcional por el usuario.** Files: `/app/frontend/src/pages/GoogleReviewsPage.js`, `/app/frontend/src/App.js` (ruta /reviews), `/app/frontend/src/components/Layout.js` (ACCOUNT array), `/app/frontend/src/pages/Settings.js` (sección removida).

- **Feb 2026 (Invoice deposit + agreement terms)** — User reported quote had deposit + agreement showed it, but invoice didn't carry the deposit clause. Fix: extended `InvoiceIn` with `deposit_amount`, `deposit_paid`, `agreement_id`, `agreement_terms` (dict snapshot). Auto-invoice on agreement sign now snapshots deposit + full `agreement_terms` (title, sections, deposit, signer_name, signed_at — using the local signer_name and shared signed_at_iso so the snapshot is consistent). Manual `POST /api/invoices` auto-pulls deposit from quote_id and full agreement_terms from agreement_id when missing. `GET /api/invoices/{id}` lazy-backfills both fields on first read (matches agreement by quote_id if agreement_id absent, idempotent). Frontend InvoiceDetail: new "Deposit / Down payment" input field, orange "Deposit due upfront" + "Balance after deposit" rows in totals card, and a green "Signed agreement terms" block showing all 7 clauses (what_is_included, what_is_not_included, materials, timeline, payment_terms, warranty, change_order_note) + signer + signed date. **Tested 10/10 backend** (iteration_12.json + retest) + 100% frontend. Files: `/app/backend/server.py` (InvoiceIn, create_invoice, get_invoice, public_sign_agreement), `/app/frontend/src/pages/InvoiceDetail.js` (blank() + AgreementTermsBlock component), `/app/backend/tests/test_invoice_deposit_terms.py`.

- **Feb 2026 (Admin Add+Delete users)** — New endpoints `POST /api/admin/users` (create user manually, with optional comp grant on creation) and `DELETE /api/admin/users/{id}` (hard delete with cascade across cards/clients/quotes/invoices/agreements/jobs/calendar_events/messages/scope_drafts/onboarding_state/payment_transactions). Cannot delete self. Frontend: "+ Agregar usuario" button + dialog in AdminAccounts UsersTab. Red trash button next to each non-self user with double confirmation (window.confirm + typed-email verification).

- **Feb 2026 (Admin Panel Consolidation)** — Single "Admin" sidebar link (shield icon) replaces the previous "Cuentas gratis" + "Admin Leads" duo. New `AdminTabs` component (`/app/frontend/src/components/AdminTabs.js`) renders at top of all `/admin/*` pages with Cuentas/Leads tabs. AdminAccounts page lost its own ShieldCheck header (handled by AdminTabs). Easy to extend: add to TABS array.

- **Feb 2026 (Stripe Phase 1)** — Stripe Subscriptions integrated with real subscription mode (`stripe-python` v15.1.0, NOT the emergent one-time wrapper). 3 plans hardcoded in `payments_service.PLANS`: pro_monthly ($49/mo), pro_yearly ($390/yr), founder ($290/yr). 14-day Stripe trial with card-on-file (`trial_period_days=14`, `payment_method_collection='always'`) — auto-charge at day 15 if user doesn't cancel. Shipping address collected in Stripe Checkout (for physical NFC card mailing). User model gained `stripe_customer_id`, `stripe_subscription_id`, `subscription_status` (trialing/active/past_due/canceled), `plan_type`, `trial_ends_at`, `current_period_end`, `cancel_at_period_end`, `shipping_address`, `card_shipping_status`. New endpoints: `POST /api/payments/checkout`, `GET /api/payments/status/{id}` (with local-record fallback for stateless emergent proxy), `GET /api/payments/subscription`, `POST /api/payments/portal` (Stripe Customer Portal), `POST /api/webhook/stripe`, `GET /api/payments/plans`. New collection `payment_transactions` for audit trail. Frontend: `/precios` (3 plan cards), `/pago/exito` (status-polling success page), `SmartCardPaywall` (gates Smart Card for non-paid users — trial unlocks everything EXCEPT smart card per user requirement), `TrialBanner` (top-of-app countdown CTA, hides on /precios and /pago/exito), `SubscriptionSection` in `/ajustes` (status + manage portal). Sidebar gained "Suscripción" link. Registration now seeds 14-day local trial automatically; startup also backfills existing users. **Tested**: 12/14 backend pass + 100% frontend (iteration_9.json). Both initial bugs fixed: shipping_details expand removed, portal endpoint hardened against stale `stripe_customer_id`. Files: `/app/backend/payments_service.py`, `/app/backend/server.py` (sections: PAYMENTS, register, _user_doc, startup backfill), `/app/frontend/src/pages/Pricing.js`, `PaymentSuccess.js`, `/app/frontend/src/components/{SmartCardPaywall,TrialBanner,SubscriptionSection}.js`, App.js, Layout.js, Settings.js, CardAdmin.js.

- **Feb 2026** — Sistema de Tours guiados in-app: 10 tours con `react-joyride@3.1.0` (NAMED import `{ Joyride }`), botón flotante "¿Cómo funciona?" en cada página principal. Tours: dashboard (6 pasos), clients (2), quotes (3), invoices (2), agreements (3), jobs (2), calendar (3), card (5), messages (4), scope (3). Cada tour tiene spotlight + tooltip en español tipo familiar + botones Atrás/Siguiente/¡Listo!. **Tested 10/10 end-to-end** (iteration_8.json). Issues no bloqueantes: beacon visible en step 0 (LOW), botón "Saltar tour" no renderiza como texto (MEDIUM — X close icon funciona). Files: `/app/frontend/src/components/TourButton.js`, `/app/frontend/src/lib/tours.js`, + integración en las 10 páginas.
- **Feb 2026** — Onboarding reducido de 5→4→**2 pasos** (solo setup, no work items): business_info (incluye logo) + smart_card. La idea es que "Setup" sea solo configurar la cuenta — agregar clientes y crear quotes ya no son onboarding, son trabajo real. Tested 8/8 pytest. Files: `/app/backend/server.py:1776-1820`, `/app/frontend/src/components/WelcomeModal.js`, `/app/backend/tests/test_onboarding.py`.
- **Feb 2026** — Fix detección de paso "Smart Card" en onboarding: ahora consulta `db.cards` (collection correcta) en vez de `db.card_settings` (que no existía). Detecta cualquier personalización (foto perfil, cover, services, about_me, tagline, business_type).
- **Feb 2026** — Pipeline automático completo: (a) cliente acepta quote desde link público con botón "Accept this Quote" → respuesta instantánea (110ms) y agreement se genera en `BackgroundTask`. (b) Al firmar el contrato, si tiene `quote_id`, se auto-crea invoice en `draft` con line items copiados. Tested 18/18.
- **Feb 2026** — AI Service Agreement Generator: contratos legales en inglés (paralegal-grade) con GPT-5.2, firma digital (dedo + botón), cláusulas adaptativas por industria. Tested 10/10.
- **Feb 2026** — Onboarding celebration: confeti + modal "¡Tu negocio está listo! 🎉" al llegar a 100%. Tested 22/22.
- **Feb 2026** — Onboarding system: WelcomeModal greets new users + SetupChecklist (5 steps: business info, logo, smart card, first client, first quote) with auto-progress detection from DB. Endpoints `GET/PUT /api/onboarding/status` and `/api/onboarding/state`. Tested 100% pass (8/8 backend + 18/18 frontend assertions). Files: `/app/frontend/src/components/WelcomeModal.js`, `SetupChecklist.js`, `Dashboard.js`, `/app/backend/server.py:1773-1831`, `/app/backend/tests/test_onboarding.py`.
