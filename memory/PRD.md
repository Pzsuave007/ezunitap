# Unitap (formerly ServicioFlow AI) — Product Requirements Document

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
- [ ] Admin dashboard to track which users need physical NFC card shipping (read `card_shipping_status='pending'`, mark as `shipped` after mailing) — Stripe Phase 2
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
