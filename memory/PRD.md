# ServicioFlow AI - Product Requirements Document

## Original Problem Statement
SaaS para dueños de negocios latinos de servicios (roofing, drywall, construction, cleaning, painting, concrete, landscaping). Interface en español para el dueño, pero quotes/invoices/mensajes al cliente en inglés. App simple, mobile-first, fácil de usar para personas no técnicas desde el celular.

## Architecture
- **Backend**: FastAPI (port 8001) on `/api` prefix, MongoDB via motor (async)
- **Frontend**: React (port 3000) + Tailwind + Shadcn UI components
- **AI**: OpenAI GPT-5.2 (text + vision) via Emergent Universal Key (`emergentintegrations`)
- **Storage**: Emergent Object Storage (abstracted in `storage_service.py` so user can swap to self-hosted later)
- **Auth**: JWT (PyJWT) + bcrypt password hashing
- **PDF**: Client-side via `jspdf` + `jspdf-autotable`

## User Persona
Latino contractor/business owner (roofing, drywall, painting, etc.), non-technical, works mostly from a smartphone on-site. Speaks Spanish; clients speak English.

## Core Requirements (Static)
1. UI 100% in Spanish, customer-facing docs 100% in English
2. Mobile-first (large touch targets, bottom nav, single-column layouts)
3. End-to-end flow: Add Client → AI Quote → Send → Convert to Invoice → Track Job → Request Review
4. AI Quote Builder (text & photo input)
5. AI Message Writer with templates
6. AI Scope of Work
7. PDF generation client-side for quotes & invoices
8. Public share link for quotes (no auth)

## What's Been Implemented (Feb 2026)
### Backend (`/app/backend/`)
- `auth_utils.py` — JWT (30-day) + bcrypt
- `storage_service.py` — Pluggable storage (Emergent Object Storage default; abstract class ready for migration to self-hosted)
- `ai_service.py` — GPT-5.2 wrappers: `generate_quote_from_text`, `generate_scope_of_work`, `generate_message`, `analyze_photo_for_quote`
- `server.py` — full REST API:
  - Auth: register, login, me (GET/PUT)
  - Dashboard: `/dashboard/stats`
  - Clients CRUD + history
  - Quotes CRUD + status + convert-to-invoice + public share
  - Invoices CRUD + status (mark paid auto-fills amount_paid) + public
  - Jobs CRUD
  - Messages: AI generate + save + list
  - AI endpoints: `/ai/quote`, `/ai/scope`, `/ai/photo-quote`
  - Photos: upload (multipart), list, file-fetch (with `?auth=` for `<img>` tags), soft delete
  - Reminders CRUD

### Frontend (`/app/frontend/src/`)
- `context/AuthContext.js`, `lib/api.js` (axios + token), `lib/pdf.js` (jspdf)
- `components/Layout.js` — sidebar (desktop) + bottom nav (mobile) + top header
- `components/StatusBadge.js` — color-coded badges for quote/invoice/job
- Pages: Login, Register, Dashboard, Clients, ClientDetail (tabs: Info/Quotes/Invoices/Messages/Photos), Quotes, QuoteBuilder (AI text + photo), QuoteDetail (edit, PDF, share, convert), Invoices, InvoiceDetail (edit, PDF, mark paid), Jobs (kanban-by-status), Messages (AI templates), Scope (AI), Settings, PublicQuote (no auth)
- All UI in Spanish; documents/AI outputs in English

### Verified by Testing Agent (Iteration 1, Feb 2026)
- 39/39 backend tests pass
- Frontend critical flow verified (login → dashboard → AI Quote Builder generates English quote from Spanish input)
- Bug fixed: `load_dotenv` ordering so `EMERGENT_LLM_KEY` is loaded before `ai_service` module import

### Smart Business Card System (Feb 2026)
- Public premium digital card at `/c/:slug` (photo-first hero, NFT aesthetic)
- Admin at `/tarjeta`: design, QR, reviews, leads, analytics
- Lead capture form + AI chat assistant (GPT-5.2)
- Profile photo + logo upload (Emergent Object Storage)
- **Advanced color controls (Feb 24, 2026):**
  - `brand_color` (free picker) + 8 curated brand+accent palettes (Midnight, Obsidian, Ember, Forest, Royal, Steel, Crimson, Slate)
  - `accent_color` (free picker + 14 preset swatches) — drives CTAs, badges, accents
  - `hero_overlay` 0-100 slider — controls darkness over hero photo for text legibility
  - Verified end-to-end: PUT `/api/card/settings` persists, public `/api/public/card/:slug` returns fields, `SmartCard.js` applies via `CardStyles` (radial gradient, hero-gradient, mesh orbs)

### Calendar / Agenda (Feb 24, 2026)
- New `/calendario` page (4 views: Hoy / Semana / Mes / Lista), mobile-first
- Job model extended: `start_date`, `end_date`, `start_time`, `end_time`, `all_day`, `address`, `recurrence`, `recurrence_days[]`, `recurrence_end_date`
- 3 job modes in editor: **Una vez** (single day), **Proyecto** (multi-day range), **Recurrente** (weekly / biweekly / monthly with day-of-week picker)
- Endpoint `GET /api/calendar/events?start=...&end=...` expands recurrences server-side and joins client name/phone/address
- Event detail sheet with one-tap Call/WhatsApp to client
- Bottom nav: "Agenda" replaced "Quotes" (Quotes moved to sidebar extras since calendar is daily-use for contractors)
- Verified: single (1 day), project Mar 10-24 (15 days), weekly Mon+Thu Mar (9 occurrences), biweekly Wed Apr-May (5 occurrences) all expand correctly

## Test Credentials
See `/app/memory/test_credentials.md`

## Prioritized Backlog
### P0 — Polish / Bug-class
- Add atomic counter collection for quote/invoice numbering (current `count_documents` has a race under concurrent creates)
- Split `server.py` into routers per resource (file is ~840 lines)

### P1 — High-value features
- Stripe payment integration on invoices ("Pay Online" button is currently a placeholder)
- Voice recording (currently user pastes transcription)
- SMS / Email sending for quotes & invoices (currently share-link + PDF download only)
- Calendar / scheduling for jobs

### P2 — Future planned (per spec)
- WhatsApp share
- Google Reviews integration
- Employee management
- Expense tracking
- AI voice assistant

## Next Tasks
- Stripe integration on Invoice "Pay Online"
- Real voice input via OpenAI Whisper (already supported by Emergent key)
- Push reminders to SMS/Email via Twilio + SendGrid
