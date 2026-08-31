# UniTech — Changelog

## Jun 2026 — Problem pages: hero image control
- Each Problem/Solution page auto-uses the **service's own image** (`services[].image_id`) as its hero background; falls back to first gallery photo.
- Owner can override the hero from the editor (thumbnail picker + "Auto (service image)"). New `hero_photo_id` on `problem_pages`, resolved in `_problem_page_payload`, editable via `PUT /website/problem-pages/{id}`. Verified via curl + screenshots.
- i18n: "Customer Pages" tab + full panel now use i18n keys (EN/ES) — no more hardcoded Spanish.

## Jun 2026 — AI Problem/Solution Conversion Pages (extends website, does NOT replace it)
Every active service can now become a dedicated customer-problem landing page (BUSINESS → SERVICE → PROBLEM PAGE(S), architected for multiple pages per service later).
- **Backend** (`server.py`): new `problem_pages` collection + endpoints:
  - `GET/POST /website/problem-pages`, `POST /website/problem-pages/generate` (all services; also auto-run after onboarding), `POST .../{id}/regenerate`, `PUT .../{id}` (edit content/seo/publish/indexable).
  - Public: `GET /public/problem-page/{slug}/{page_slug}`, `POST .../{page_slug}/lead` (attribution: source=problem_page, problem_label, page_path, utm_*, optional photos → storage; routed to card_leads + clients CRM with dedupe).
  - `sitemap.xml` extended to include published+indexable problem pages, listed under the custom domain when connected.
  - `_website_payload` now returns `problem_pages` (published) for internal linking.
- **AI** (`ai_service.py`): `generate_problem_page()` + `PROBLEM_PAGE_SYSTEM` prompt (PROBLEM→AGITATE→SOLUTION→ACTION, customer-problem focused, unique per service, only real trust signals, English). Reuses `_new_chat/_extract_json`.
- **Frontend**:
  - New `ProblemPage.js` + route `/sitio/:slug/p/:pageSlug`. Inherits brand accent/logo/phone; conversion-focused layout, sticky mobile CTA (Call | Get estimate), lead form with optional photo upload, client-side SEO (title/meta/canonical/OG + JSON-LD Service+FAQPage).
  - `WebsiteEditor.js`: new "Páginas Cliente" tab (list services + status ✓Publicada/⚠Revisar, Ver/Editar/Regenerar/Publicar).
  - `ContractorSite.js` `FooterBlock`: "Common problems we solve" internal links to published problem pages (all templates).
- Default state = draft "⚠ needs_review"; owner reviews & publishes. Verified end-to-end (generation, publish, public render, lead attribution to CRM, sitemap under custom domain, internal links) via curl + screenshots. Editor UI compiled (not screenshot-verified — needs owner login).

## Jun 2026 — Manejo de color/contraste en los 10 templates
- SectionLight props `dark`/`light`; FaqBlock/AreasBlock/AboutBlock dark/light; hero heights reduced to ~75% and mobile top-gap fixes; Organic mobile hero full-bleed; Bento/OnePage cream About+Recent Work; Neon/Luxe light About+Portfolio+FAQ; OnePage dark reviews band; Luxe portfolio Bento-style. Verified via screenshots (desktop; mobile is CSS mobile-first, not screenshot-verifiable here).

## Jun 2026 — Cinematic ContactBlock + hero pulido (verificado)
- ContactBlock alineado + párrafo invitador; heroes a 75%; Responder form band oscuro + marquee negro loop continuo.
