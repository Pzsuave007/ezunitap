# UniTech — Changelog

## Jun 2026 — Colores por sección (Agency) + Mapa full-width + Reviews + copiar imágenes
- **Colores por sección**: nuevo `section_colors` (WebsiteIn) — el usuario elige el color de fondo de cada sección del template Agency (hero, services, samples, logos, map, process, reviews, cta, contact, footer) desde la pestaña **Diseño** (`seccolor-*`). El texto/tarjetas se auto-ajustan por contraste vía `isLight`. Componente `Agency` reescrito para usar `S(key)` por sección; `SamplesSection/LogosStrip/ClientMap` aceptan prop `sty` (helper `secTheme`).
- **Mapa full-width**: el embed de Google My Maps ahora ocupa todo el ancho (600px alto), como el sitio original.
- **Sección Reviews** agregada al template Agency (usa `data.reviews`, `Stars`).
- **Copiar imágenes al servidor**: `POST /website/import-media` descarga todas las imágenes externas (samples/logos/covers/galerías/equipo) a storage propio y reemplaza URLs por photo ids permanentes (verificado: 24 imágenes copiadas, sirven 200 webp). Botón en pestaña Diseño (`import-media-btn`).
- Verificado por curl: import-media, section_colors persisten, fotos sirven 200, sin errores JS. Build main.be6ab572.js trackeado.

## Jun 2026 — Editor Agencia con sub-tabs + IA para escribir contenido
- `AgencyPanel` reorganizado con **sub-tabs** (Importar / Samples / Logos / Mapa / Casos / Soluciones / Nosotros): solo se muestra la sección activa, sin scroll infinito (`agency-subtab-*`).
- **IA para contenido**: `POST /website/ai-agency` (kind `case`/`about`) + `ai_service.generate_case_study()` y `generate_about_content()`. Botón ✨ por caso (`agency-case-ai-{i}`) llena resumen/cuerpo/servicios/resultados; botón ✨ en Nosotros (`agency-about-ai`) llena título/historia/logros/valores. Español o inglés según el idioma del editor.
- Testing agent (iteration_59): 100%, sin bugs (case body ~977 chars, about ~1665 chars, persistencia OK). Build main.1ae53688.js trackeado.

## Jun 2026 — Mapa Google My Maps embebido + logos del strip más grandes
- `ClientMap` ahora usa un **iframe de Google My Maps** cuando existe `map_embed` (como el sitio real del cliente); los pines quedan como fallback. Nuevo campo `map_embed` en `WebsiteIn` y editor (`agency-map-embed`) con normalizador que acepta URL embed/viewer/edit o `<iframe>` pegado. `UNI2_DEFAULTS.map_embed` = My Map real (mid 152Uf65...).
- **Logos del strip** agrandados: chips h-24 (antes h-16), imágenes h-14/md:h-16 (antes h-8/9), max-w-220px.
- Build regenerado (main.a680a1fe.js) y trackeado. Verificado: compila, map_embed persiste, sitio renderiza.

## Jun 2026 — Galería por caso + Traducción EN (base flip) + Sitemap ampliado
- **Galería por caso**: editor `AgencyPanel` permite agregar/editar/quitar varias fotos por Case Study (`agency-case-{i}-photo-{pi}`); se muestran en la página de detalle (`CaseDetail` ya renderiza `c.photos`).
- **Traducción a Inglés (base flip)**: nuevo `POST /website/translate-en` — traduce TODO el contenido (incl. casos, about, equipo, servicios, milestones, valores) al inglés con IA, deja **inglés como idioma base** y guarda el español en `content_es` (capa). Así growthally.agency (EN) muestra base y uni2mkt.com (ES) muestra la capa. `_restore_protected()` conserva URLs/slugs/ids y los `value` numéricos de resultados. `ai_service.translate_website_content_to_en()` + `WEBSITE_TRANSLATE_EN_SYSTEM`. Botón `website-translate-en` en el editor (con confirm). i18n transEnBtn/transEnDone/transEnConfirm.
- **Sitemap**: `GET /api/sitemap.xml` (per-domain y global) ahora incluye `/soluciones`, `/nosotros`, `/casos` y `/caso/{slug}` por cada caso, con hreflang en la versión per-domain.
- Testing agent (iteration_58): 5/5 PASS, 100% frontend, sin bugs. Sitemap verificado por curl. Build regenerado y trackeado.

## Jun 2026 — FASE 2 Agency: Case Studies + Solutions + About (multi-página, todos los templates)
- Backend `WebsiteIn`: nuevos campos `case_studies`, `about_title`, `about_story`, `milestones`, `about_values`, `team`, `solutions_intro`.
- Rutas nuevas (App.js) en TODOS los templates: `/sitio/:slug/casos`, `/caso/:caseSlug`, `/soluciones`, `/nosotros` (+ versiones byDomain `/casos` etc). `ContractorSite` acepta props `page` y `byDomain`; fetch usa `website-by-domain` cuando byDomain.
- `ContractorSite.js`: componentes `SubPageRouter`, `SubNav`, `SubFooter`, `SubHero`, `CaseList`, `CaseDetail`, `SolutionsPage`, `AboutPage`, `RichText` (### → h3), `PageLinks`. Todo theme-aware (funciona en cualquier template). CTA de subpáginas navega a home#contact.
- Samples del Home ahora enlazan al detalle interno del caso vía `s.caseSlug` + `ctx.pageHref`. Nav de Agency incluye enlaces a Casos y Nosotros. `SharedExtras` (templates no-agency) añade `PageLinks`.
- Editor `AgencyPanel`: editores de Case Studies (cover/cliente/categoría/slug/resumen/servicios/resultados/body), Solutions intro, y About (título/historia/milestones/valores/equipo). `UNI2_DEFAULTS` extendido con casos, about (historia 25+ años), 4 milestones, 3 valores, 7 miembros de equipo (contenido real de uni2mkt.com). `pick()` incluye los campos nuevos.
- Testing agent (iteration_57): 8/8 features PASS, 100% frontend, sin bugs. Build regenerado y trackeado.
- Nota (deuda técnica): ContractorSite.js ~2670 líneas — candidato a dividir por template/subpágina.

## Jun 2026 — Template "Agency" seleccionable + rediseño HOME (réplica uni2mkt.com)
- FIX: el template `agency` existía en `ContractorSite.js` pero NO estaba en `TEMPLATES` de `WebsiteEditor.js`, por eso no aparecía como opción. Agregado a TEMPLATES, TPL_SWATCH, PALETTES, thumbnail y i18n (agencyName/agencyDesc).
- Rediseño completo de la función `Agency()` en `ContractorSite.js` replicando uni2mkt.com: nav sticky, hero+formulario, servicios numerados, Samples, franja de logos, mapa de clientes, proceso, banner CTA, contacto, footer. Textos bilingües (helper `agT`).
- NUEVAS SECCIONES REUTILIZABLES (theme-aware, toggleables): `SamplesSection`, `LogosStrip`, `ClientMap` + `SharedExtras` (se inyectan en templates no-agency tras el Layout). Mapa usa imagen NA generada (AGENCY_MAP_BG) + proyección equirectangular `_mapXY` (bbox lng −125..−78, lat 14..50).
- Backend `WebsiteIn`: campos `samples`, `client_logos`, `client_pins`; `_WEBSITE_DEFAULT_SECTIONS` + `samples/logos/map`.
- Editor: nueva pestaña "Agency" (visible solo si template=agency) → `AgencyPanel` con editores de Samples/Logos/Pines + botón "Importar contenido de mi sitio" (`UNI2_DEFAULTS` con contenido real de uni2mkt.com). Toggles nuevos en Sections: samples/logos/map. `pick()` incluye los 3 campos nuevos.
- Testing agent (iteration_56): 7/7 features PASS, 100% frontend, sin bugs. Build regenerado y trackeado (`git add -f`).
- PENDIENTE FASE 2 (acordado con usuario): páginas dedicadas Case Studies (con detalle por proyecto), Solutions y About Us; y cablear las 3 secciones reutilizables en la posición ideal de cada template no-agency.

## Jun 2026 — BUG FIX raíz: sync tarjeta→sitio borraba fotos de servicios
- Causa real (confirmada, NO era "memoria del browser"): al guardar los servicios de la TARJETA, `update_card_settings` sobrescribía `websites.services` con los servicios de la tarjeta, que NO llevan `image_id`/`photos`/`hero_photo_id` → borraba TODAS las fotos de servicios del sitio (hero + galería por servicio). Se disparaba al guardar la tarjeta o al regenerar.
- Fix (`server.py`): nuevo `_merge_service_media(incoming, existing)` que preserva `image_id`/`photos`/`hero_photo_id` de los servicios existentes del sitio (match por nombre, luego índice) al sincronizar desde la tarjeta. Aplicado en el sync de `update_card_settings`.
- Fix frontend (`WebsiteEditor.js`): `uploadServiceImg`, `addServicePhotos`, `setServicePhotoKind`, `delServicePhoto` y el botón de quitar imagen ahora **persisten al instante** (`PUT /api/website`) — ya no dependen de un "Guardar" manual, así que sobreviven recargas/deploys.
- Verificado por curl: tras guardar servicios de tarjeta (sin fotos), el sitio CONSERVA hero + 2 fotos por servicio en los 6 servicios. Requiere Save to GitHub + deploy.


## Jun 2026 — Historial de versiones + blindaje anti-sobreescritura (protección de contenido)
- Problema: el usuario perdió descripciones (captions) de "Trabajos recientes" y descripciones de servicios (servicios pasaron 7→6→5) porque la regeneración del sitio / guardados desde build viejo sobrescribieron su contenido curado.
- Backend (`server.py`): sistema de snapshots automáticos de contenido. `_snapshot_content(user_id, reason)` guarda card(s) completas + doc del website + caption/on_card de todas las fotos en `content_snapshots` (máx 40 por usuario). Se dispara ANTES de cada escritura destructiva: PUT /api/website ("guardar sitio"), PUT /api/card/settings cuando toca services ("guardar servicios"), y `_build_full_website` ("generar sitio"). Endpoints nuevos: `GET /api/content/versions`, `POST /api/content/versions` (guardar ahora), `POST /api/content/versions/{id}/restore` (restaura cards+website completos y re-aplica captions/on_card; hace un snapshot "antes de restaurar" para que sea reversible).
- Frontend: nueva pestaña "Historial" en el editor de Página Web (`WebsiteEditor.js` TABS += 'history'). Componente `components/VersionHistory.js`: lista de versiones con resumen (servicios/fotos/descripciones), botón "Guardar versión ahora" y "Restaurar" (con confirmación + recarga). i18n ES/EN agregado (`website.tab.history`, `website.history.*`).
- Verificado: backend por curl (list/save/auto-snapshot/restore; restore devolvió 6 servicios + 113 captions). Frontend por testing_agent end-to-end (login, pestaña Historial, guardar crea versión, restaurar con confirm + reload, sin pantalla blanca). Build compilado y `frontend/build/` staged.
- NOTA producción: aún NO desplegado. Requiere Save to GitHub + `bash /home/ezunitap/repo/deploy.sh`.

## Jun 2026 — Recuperación de datos de producción (evento en vivo)
- La tarjeta/sitio de `pzsuave007` (uni2) en producción tenía servicios reducidos y galería con stock. Se restauró del backup 20260831 (7 servicios). Las descripciones por foto (captions) NO estaban en ningún backup de 14 días. Se re-vincularon temporalmente 43 fotos de trabajo a la galería vía API y luego se revirtió a las 6 originales a petición del usuario.


## Jun 2026 — Owner-controlled Demo (template account cloning)
- `/api/demo/start` now CLONES a curated **demo-template account** (`demo-template@ezunitech.com`) instead of hardcoded data, so the demo shows real photos + rich data the owner controls by simply logging into that account and editing it. Falls back to the old hardcoded seed if the template is missing.
- New backend (`server.py`): `_seed_demo_template()` (idempotent startup seed — 6 contacts incl. 3 prospects, 3 quotes, 2 invoices incl. one deposit/partial, 2 service agreements, 4 jobs across statuses, reviews, fully-configured card w/ 4 services + licensed/insured/rating, and best-effort Pexels stock photos for cover/profile/gallery). `_clone_template_account()` deep-clones all collections, remaps cross-reference IDs, keeps photo IDs stable (shared files resolve), regenerates unique card/website/problem-page slugs, drops custom domains. Demo inherits template business identity.
- `_DEMO_COLLECTIONS` extended (reviews/tasks/scope_drafts) so expiring demos purge cleanly.
- Verified via API: clone yields 6 clients / 3 quotes / 2 invoices / 4 jobs / 2 agreements; card cover+profile+3 gallery photos all serve HTTP 200. Template login OK (bundle plan).
- Creds in `test_credentials.md`.

## Jun 2026 — Production deploy self-heals stale backend (demo 404 fix)
- Root cause of prod 404 on `/api/demo/start`: `restart.sh`/`fix.sh` killed with `pkill -f "uvicorn.*:PORT"` which never matched the real `--port 8007` process, so the OLD backend kept serving stale code. Fixed kill logic across `deploy.sh` (root-level `free_port()` before restart), `fix.sh`, `install_server.sh`; `restart.sh` is now regenerated each deploy with robust `pkill -f "uvicorn server:app"` + `fuser -k` + `ss`/`kill -9` fallback.


## Jun 2026 — Problem pages surfaced on the main website (SEO / crawlability)
- New shared **"Problems We Solve"** section (`ProblemsSection` in `ContractorSite.js`, rendered once via `ContactBlock`, all 10 templates, theme-aware) with real `<a href>` cards linking to each published problem page — crawlers follow home → problem pages. Payload `problem_pages` now includes the `headline`. Plus existing footer links + sitemap = full internal-link + indexing coverage. Verified via preview screenshot (Luxe).

## Jun 2026 — Problem pages: multiple problems per service + editable problem focus
- A single service can now have MULTIPLE problem pages (BUSINESS → SERVICE → PROBLEM PAGE(S) fully enabled).
- Editor groups pages by service; per-service **"Add problem"** (type a specific problem → creates a new page), per-page **Regenerate with this problem** (owner-provided focus, stored as `problem_hint`), plus Delete.
- Backend: `generate_problem_page(problem_hint=…)`; `_generate_problem_pages_for_user(service_filter, problem_hint)`; new `POST /website/problem-pages/add`, `DELETE /website/problem-pages/{id}`; list endpoint returns pages grouped per service. Verified via curl + authenticated screenshot.

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
