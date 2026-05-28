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

- **Feb 2026 (Stripe Phase 2 — Live Test Keys + NFC Shipments Admin)** — Replaced Emergent Stripe proxy with the user's real Stripe Test API keys (`sk_test_51TbDk...`, `whsec_0bwErtRxKzTS...`). Verified `cs_test_...` checkout sessions are created end-to-end with 14-day trial + card-on-file + `shipping_address_collection` (US/MX/CA/PR). Webhook endpoint correctly returns 200 `{received:false}` on bad signatures (not 500) and persists shipping_address + `card_shipping_status='pending'` on `checkout.session.completed`. New Phase-2 admin section `/admin/envios` lets the owner see every paying user awaiting their physical NFC Google Reviews card, with status filter (pending/shipped/delivered), stat cards, address copy, tracking # + internal note, and one-click status transitions that auto-stamp `card_shipped_at` / `card_delivered_at`. New endpoints: `GET /api/admin/shipments?status=...`, `POST /api/admin/shipments/{user_id}`. `GET /api/admin/users` now also surfaces all 6 shipment fields. **Tested 17/17 backend** (iteration_13.json). Files: `/app/backend/server.py` (lines 2434-2540 admin/shipments routes), `/app/frontend/src/pages/AdminShipments.js` (new), `/app/frontend/src/components/AdminTabs.js` (added "Envíos NFC" tab), `/app/frontend/src/App.js` (new route), `/app/backend/tests/test_stripe_shipments.py` (new — covers Stripe + shipments).

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
