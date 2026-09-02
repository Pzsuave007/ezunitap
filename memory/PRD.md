## 🖼️✨ Jun 2026 — "Recent Work" clickable con detalle (imagen + descripción IA + CTA) en tarjeta y website [COMPLETO; verificado curl+screenshot, SIN testing_agent]
- **Petición dueño**: al tocar una foto de "Recent Work" que se abra igual que el detalle de servicio (modal), con una descripción del trabajo que él escribe (en ES o EN) y la IA refina a inglés, + botón "Pedir cotización". Aplicar en tarjeta Y website.
- **Datos**: nuevo campo `caption` en el doc de foto. Endpoints: `POST /photos/{id}/caption` (guardar) y `POST /photos/caption-ai` (refinar texto del dueño en cualquier idioma → inglés limpio, con reglas anti-claims/anti-marketing). `caption` incluido en payload de tarjeta y website.
- **IA** (`ai_service.refine_work_caption` + `WORK_CAPTION_SYSTEM`): 1-2 frases, solo lo que el dueño menciona, sin inventar resultados/precios/garantías ni frases de marketing.
- **Editor** (`WebsiteEditor` → pestaña Photos → galería "Recent Work"): cada foto mostrada tiene ahora un textarea de descripción (guarda onBlur) + botón "IA"/"AI" que refina el texto a inglés y lo guarda. Helpers `saveCaption/aiCaption`, estado `caps/capBusy`. i18n `workCaption*` (ES/EN). testids `website-gallery-caption-{i}`, `website-gallery-caption-ai-{i}`.
- **Tarjeta** (`SmartCard`): las fotos de "Recent Work" ahora abren `WorkDetail` (imagen grande + caption + botón "Request a Free Estimate" que abre el QuoteForm). testids `card-work-{i}`, `card-work-detail`, `card-work-caption`, `card-work-quote`.
- **Website** (`ContractorSite`): modal compartido `SiteWorkModal` (imagen + caption + "Get a Free Quote" → scroll a contacto) abierto por **delegación de clicks** en imágenes dentro de `#gallery` (cubre los 10 templates sin editar cada galería). CSS `#gallery img{cursor:zoom-in}`.
- **Verificado**: curl (IA ES→EN "We painted the entire exterior... two coats..."; guardar/leer caption OK) + screenshots (modal en tarjeta y en website con caption + CTA). Datos de prueba limpiados. Build main.f61e40b4.js + `git add -f frontend/build/*`.
- ⚠️ DESPLIEGUE: **backend + frontend** → "Save to GitHub" + `git pull && bash deploy.sh`.


- **Petición dueño**: quería controlar qué fotos salen en la sección "Recent Work" de la TARJETA DIGITAL (elegir/quitar) pero no sabía dónde.
- **Causa**: el payload de la tarjeta (`/public/card/{slug}`) sacaba esa galería de `label in [before/during/after]` o `on_card=True`, una fuente distinta al editor del Website (que usa `gallery_photo_ids`), así que no había un lugar claro para gestionarla.
- **Fix** (`server.py` handler `/public/card/{slug}`): ahora la galería de la tarjeta usa PRIMERO `website.gallery_photo_ids` (la lista curada y ordenada que ya se gestiona en el editor del Website → pestaña **Photos** → "Recent Work": subir/elegir/reordenar/quitar). Si no hay lista curada, cae al comportamiento anterior (before/during/after u `on_card`). Una sola fuente para website + tarjeta.
- **Verificado curl**: `card.photos` == `website.gallery_photo_ids` (mismos 7 ids, mismo orden). Backend-only (sin rebuild frontend).
- **Dónde gestionarla**: Editor del Website → pestaña **Photos** → tarjeta "Recent Work" (`website-gallery-*` testids). Ahí sube fotos nuevas, reordénalas o quítalas; se reflejan en el website y en la tarjeta.
- ⚠️ DESPLIEGUE: solo backend → "Save to GitHub" + `git pull && bash deploy.sh`.


- **Petición dueño**: no encontraba dónde elegir qué ejemplos de trabajo aparecen en su tarjeta digital; quiere que al tocar un servicio en la tarjeta se abra una "página" con la descripción completa + imágenes de ejemplo de ese servicio, igual que en el website. (La tarjeta y el website ya comparten `services`.)
- **Dónde se eligen las fotos**: en el editor del Website → pestaña **Services** → "Work photos for this service" (feature ya existente). Esas `service.photos` se sincronizan a la tarjeta vía PUT `/website` (escribe services a website y card).
- **Fix** (`SmartCard.js`, `/c/:slug`): cada tarjeta de servicio ahora es clickable (con chevron, `data-testid=card-service-{i}`) y abre un modal-sheet `ServiceDetail` (mismo estilo dark que QuoteForm) con: nombre, precio si hay, descripción COMPLETA (whitespace-pre-line), sección "Examples of this work" con las `service.photos` (badges Before/After/Completed) — fallback al `image_id` del servicio si no hay photos; si no hay ninguna, solo descripción. Cada foto abre un zoom fullscreen. Botón "Request a Free Estimate" (`card-service-quote`) que abre el QuoteForm con el servicio **preseleccionado** (nuevo prop `initialService`). i18n `serviceExamples`/`tapForDetails` (EN/ES). testids: card-service-detail, card-service-detail-close, card-service-photos, card-service-photo-{i}, card-service-zoom.
- **Verificado screenshot** (puse fotos de prueba en "Digital Business Cards"): modal abre con descripción + 2 fotos (AFTER/BEFORE) + CTA; datos de prueba revertidos. Build main.0adf1d96.js + `git add -f frontend/build/*`.
- ⚠️ DESPLIEGUE: solo frontend → "Save to GitHub" + `git pull && bash deploy.sh`.


- **Petición dueño**: en mobile, el botón CTA del hero (después de "Call Now") se repetía con el CTA del formulario que queda justo debajo (mismo texto), se veía dos veces seguidas.
- **Fix** (`ProblemPage.js` línea 111): el botón `#lead {ctaLabel}` del hero ahora es `hidden md:inline-flex` → oculto en mobile (<768px), visible en desktop (donde el form va al lado, sin duplicación). En mobile quedan solo "Call Now" + el formulario. Build main.f70200ad.js + `git add -f frontend/build/*`.
- ⚠️ DESPLIEGUE: solo frontend → "Save to GitHub" + `git pull && bash deploy.sh`.


- **Petición dueño** (2 ajustes finales): (1) el slug salía del headline/problema (`car-interior-needs-cleaning`); debe salir del tema de búsqueda primario (`interior-car-detailing`). Además, NO cambiar slugs ya publicados/indexados al regenerar (solo en la 1ª creación); si se cambia a propósito, redirect. (2) nunca inventar resultados/garantías (financieras, resale value, rankings, %/stats, leads/ventas/timeframes garantizados) salvo que estén en los datos del negocio: describir el beneficio, no garantizar el resultado.
- **Prompt** (`ai_service.py`): regla `page_slug` reescrita → PRIMARY SEARCH TOPIC ('[qualifier]-[service]', 2-4 palabras), con los ejemplos del dueño (Interior Detailing→interior-car-detailing, Pre-Sale→pre-sale-car-detailing, Exterior Painting→exterior-house-painting, Graphic Design→small-business-graphic-design, SEO→local-seo); explícito "NO el headline/problema". Regla anti-claims añadida en CRITICAL RULES con rewrites seguros (car resale, Google rankings, home value) y "prefer can/helps/works to over will/guaranteed". Hero/estructura/lógica intactos.
- **Backend** (`server.py` `_generate_problem_pages_for_user`): al regenerar (`existing` presente) se PRESERVA el `page_slug` existente → URLs publicadas/indexadas nunca se rompen. El slug del AI solo se usa en la 1ª creación (create y `_pp_add_one`).
- **Verificado curl** (servicio temporal "Interior Detailing", creado→inspeccionado→borrado): slug `interior-car-detailing` (tema de búsqueda, no el problema), hero "Car interior dirty and smells?", 0 claims arriesgados; y regenerar mantuvo el slug idéntico (SLUG PRESERVED). Datos temporales limpiados.
- Nota: las páginas existentes conservan su slug actual (basado en problema) por diseño; si el dueño quiere migrarlas al estilo tema-de-búsqueda, hará falta redirect 301 del slug viejo → nuevo (ofrecido).
- ⚠️ DESPLIEGUE: **solo backend** → "Save to GitHub" + `git pull && bash deploy.sh`.


- **Petición dueño**: el slug era `/p/graphic-designer` (nombre del servicio); mejor para SEO algo del problema, p.ej. `/p/outdated-or-unprofessional-visuals`.
- **Fix** (`ai_service.py`, solo la regla `page_slug`): el slug ahora describe el PROBLEMA (2-5 palabras, sin nombre de marca ni el servicio pelado ni "near me"); ejemplos: roof-leaking, clogged-drain, no-hot-water, outdated-or-unprofessional-visuals, website-confuses-customers, cant-find-on-google. Prohibido `graphic-designer`/`roof-repair`.
- **Verificado curl** (regeneré 3): Website Design → `website-confuses-customers`, Digital Marketing → `marketing-feels-random`, Branding → `business-looks-unprofessional`.
- ⚠️ DESPLIEGUE: **solo backend** → "Save to GitHub" + `git pull && bash deploy.sh`. Regenerar cada página para actualizar su slug/URL.


- **Reporte dueño**: el hero ya salía natural, pero secciones de apoyo recaían en jerga de marketing/AI ("How We Elevate Your Brand's Impact", "convey your professionalism effortlessly", "aligned with your brand's voice").
- **Fix** (`ai_service.py` `PROBLEM_PAGE_SYSTEM`, SOLO prompt): (1) lista de prohibidas ampliada (Effortlessly, Engaging/Engaging visuals, "brand's impact", "brand's voice", "aligned with your brand", "convey your professionalism", "How We Elevate…"); (2) nuevo bloque "PLAIN LANGUAGE APPLIES TO EVERY SECTION" con el test "¿lo diría el dueño/cliente en una conversación?" aplicado a s_problem/s_why_matters/s_how/why_choose/how_steps/faqs/final_cta y los contrastes del dueño (Design That Fits Your Business > How We Elevate…, give customers the right impression > convey professionalism effortlessly, etc.); (3) SELF-CHECK final ahora verifica EVERY heading AND paragraph. Estructura/diseño/schema/lógica de Search Intent intactos.
- **Verificado curl** (regeneré Branding): s_how_title "Get a clear message and a consistent look", why_choose "clarity that works in the real world—not trendy buzzwords", how_steps "Share what's messy"/"Get the message tight"/"Make it consistent", final_cta "Make it easy for customers to understand you". 0 frases prohibidas en todo el JSON.
- ⚠️ DESPLIEGUE: **solo backend** → "Save to GitHub" + `git pull && bash deploy.sh`. Regenerar cada Conversion Page para aplicar.


- **Reporte dueño**: la IA seguía convirtiendo el NOMBRE del servicio en copy de marketing ("Need Help with Graphic Design?", "ENHANCE MY BRAND", "Struggling with Visuals?") en vez de partir de la intención de búsqueda del cliente; y la 2ª sección repetía el hero.
- **Fix** (`ai_service.py` `PROBLEM_PAGE_SYSTEM`, SOLO el prompt — diseño/estructura/schema/funcionalidad intactos): reescrito con (1) STEP 0 obligatorio de 4 preguntas internas (Servicio → Situación real → Qué buscaría en Google, con "near me" → Qué quiere realmente) ANTES de escribir; (2) lista de prohibidas ampliada (Stunning/Stunning visuals, Capture attention, "Need Help with <servicio>?", "Struggling with <cualquier cosa>?", + las anteriores) y prohibición explícita de hacer el headline un rephrase del nombre del servicio; (3) regla dura "LA 2ª SECCIÓN NO REPITE EL HERO" (hero=identifica el problema; s_problem_title/s_problem=por qué importa/consecuencia con info NUEVA) con ejemplo; (4) 10 ejemplos de LÓGICA (roof leak, drain, drywall, water heater, painting, cleaning, graphic design y SEO — con la nota de NO inventar urgencia en servicios sin emergencia) marcados como "reproduce la lógica, no copies"; (5) FINAL SELF-CHECK de 4 puntos ("¿lo diría un cliente real? ¿parte de la situación, no del servicio? ¿la 2ª sección avanza? ¿suena a agencia/AI?"). Schema JSON idéntico.
- **Verificado curl** (regeneré Website Design y Branding): HERO "Does your website confuse customers?" / CTA "FIX MY WEBSITE" / S2 "People judge your business in seconds" (avanza); HERO "Why doesn't my business sound consistent?" / CTA "FIX MY BRAND MESSAGE" / S2 "When people don't 'get it' fast, they leave". Sin frases prohibidas, centrado en el cliente.
- ⚠️ DESPLIEGUE: **solo backend** (`ai_service.py`) → "Save to GitHub" + `git pull && bash deploy.sh`. Para actualizar páginas ya creadas, el dueño debe tocar **"Regenerar"** en cada Conversion Page.


- **Petición dueño**: (1) en "Recent Work" salía por defecto la imagen de fondo del servicio (`image_id`); quitarla, y si no hay fotos de trabajo, ocultar la sección (sin fallback a stock/generales). (2) la galería debe ser clickable y abrir un popup (lightbox) con sombra detrás.
- **Backend** (`_problem_page_payload`): la Proof/Recent Work ahora usa ÚNICAMENTE las fotos de trabajo subidas al servicio (`service.photos`). Ya NO incluye `image_id` (que es el fondo del hero) ni cae a fotos generales/stock. Sin fotos de trabajo → `photos=[]` → la sección se oculta. El hero conserva su fondo (hero_photo_id = override → svc.image_id → 1ª foto de trabajo). Verificado curl: sin photos → proof `[]`, hero mantiene image_id; con photos → proof = solo esas (excluye image_id).
- **Frontend** (`ProblemPage.js`): cada foto de "Recent Work" es un botón (`pp-gallery-photo-{i}`, cursor-zoom-in + hover zoom) que abre un **lightbox** (`pp-lightbox`): fondo `bg-black/85` + blur, imagen grande centrada, botón cerrar `pp-lightbox-close` (X) y flechas prev/next (`pp-lightbox-prev/next`) que ciclan (máx 8). Click en el fondo cierra; click en la imagen no. Imports `X/ChevronLeft/ChevronRight`. Verificado screenshot: lightbox abre con sombra, imagen grande, flechas y cerrar.
- Datos de prueba revertidos. Build main.3905e293.js + `git add -f frontend/build/*`.
- ⚠️ DESPLIEGUE: **backend + frontend** → "Save to GitHub" + `git pull && bash deploy.sh`.


- **Petición dueño** (2 mejoras, extender sin rediseñar): (1) que la IA piense "¿qué problema hizo que el cliente abriera Google y qué escribiría?" y con eso escriba headline/agitación/solución/CTA/SEO/slug en el lenguaje REAL del cliente (no jerga de marketing); banear frases genéricas (Elevate/Transform/Enhance/Unlock/Comprehensive solutions/Take your business to the next level…); y que la sección "El Problema" AVANCE la historia en vez de repetir el hero. (2) subir MÚLTIPLES fotos por servicio (con tipo opcional Antes/Después/Terminado/General) y que la Proof/Recent Work de cada Conversion Page use PRIMERO las fotos de ESE servicio.
- **IA** (`ai_service.py` `PROBLEM_PAGE_SYSTEM`): añadido "STEP 0 — THINK BEFORE YOU WRITE" con la cadena Service → Customer Problem → How the customer searches → Search intent → Conversion copy + SEO; ejemplos ("Can't Find Your Business on Google?" vs "Struggling with Online Visibility?", "Drain Clogged or Backing Up?", "Roof Leaking?"); lista de BANNED words/phrases; `s_problem` debe AVANZAR la historia (síntomas/causas concretas, no parafrasear el hero); slug/seo_title/meta reflejan la búsqueda del cliente, sin keyword-stuffing. **Schema JSON idéntico** (frontend intacto). Verificado regenerando 1 página: headline "People lose your contact info?", cta "MAKE IT EASY TO SAVE MY INFO", s_problem con señales concretas (tarjetas de papel en el carro, notas mal tecleadas, link nunca abierto), SEO natural, 0 frases prohibidas.
- **Fotos por servicio** (extensión simple):
  - Modelo: cada `service` ahora puede tener `photos: [{id, kind}]` (kind ∈ before/after/completed/general), ADEMÁS del `image_id` existente (que NO se tocó). Se persiste tal cual vía PUT `/website` (lista cruda) y se sincroniza a la card.
  - Editor (`WebsiteEditor.js` tab Services): debajo de la foto principal existente, nueva fila "Work photos for this service" con botón "Add photos" (multi-upload a `/photos?label=service`), thumbnails con `<select>` de tipo (General/Before/After/Completed) y borrar. Helpers `svcPatch/addServicePhotos/setServicePhotoKind/delServicePhoto`. testids `website-service-photos-add-{i}`, `website-service-photos-{i}`, `website-service-photo-kind-{i}-{pi}`, `website-service-photo-del-{i}-{pi}`. i18n `website.workPhotos/addWorkPhotos/photoKind.*` (ES/EN).
  - Backend (`_problem_page_payload`): la Proof/Recent Work ahora prioriza **fotos del servicio** (image_id + photos[]) → si no hay, override `pp.photo_ids` → si no, fotos generales del negocio → si nada, la sección se oculta (frontend ya la esconde con `photos.length===0`). Nunca inventa: solo usa fotos reales asignadas. Verificado curl: al poner photos en un servicio, el payload devuelve esas fotos primero (image_id + galería), excluyendo las stock generales.
- **Verificado**: screenshot del editor (tab Services) con "Work photos for this service"/"Add photos" en cada servicio; curl del copy nuevo y de la prioridad de fotos. Datos de prueba revertidos. Build main.acf4f44e.js + `git add -f frontend/build/*`.
- ⚠️ DESPLIEGUE: **backend + frontend** → "Save to GitHub" + `git pull && bash deploy.sh`. Para que las páginas viejas usen el copy nuevo, el dueño debe **Regenerar** cada Conversion Page.


- **Petición dueño**: en su dominio propio la Conversion Page se veía `growthally.uni2mkt.com/sitio/uni2-marketing-agency/p/need-brand-identity`; debe verse `growthally.uni2mkt.com/p/need-brand-identity`.
- **Backend** (`server.py`): nuevo `GET /public/problem-page-by-domain/{domain}/{page_slug}` (resuelve website por `custom_domain` verificado → `_problem_page_payload`, respeta preview/published, quita `www.`). Sitemap: las Problem Pages de sitios con dominio verificado ahora se listan como `https://{dom}/p/{slug}` (antes `/sitio/{slug}/p/{slug}`).
- **Frontend**: `App.js` nueva ruta `/p/:pageSlug` → `<ProblemPage byDomain />` (no choca con `/p/quote|agreement|invoice|pay/:id`, que son de 3 segmentos; `/p` ya está en el whitelist de sitio público → sin banners). `ProblemPage.js`: prop `byDomain` → fetch al endpoint por dominio (hostname), canonical `/p/{slug}` y back-link a `/` en modo dominio. `ContractorSite.js`: `ctx.ppHref(ps)` = `injected ? /p/{ps} : /sitio/{slug}/p/{ps}` (los sitios en dominio custom se renderizan vía `injected` en `HomeOrAuth`); aplicado en `ProblemsSection` (tarjetas) y en los chips del footer.
- **Verificado**: curl by-domain → 200 (Branding page, how_steps=3), `www.` → 200, slug malo → 404. Screenshot preview (`/sitio/...`, sin dominio): links siguen `/sitio/...` y la Problem Page renderiza tras click (sin regresión). El path de dominio custom no es e2e-testeable en preview (host no es custom) pero backend verificado + lógica por `injected`. Build main.eb8b41a6.js + `git add -f frontend/build/*`.
- ⚠️ DESPLIEGUE: **backend + frontend** → "Save to GitHub" + `git pull && bash deploy.sh`. El SPA ya sirve index.html para paths no-/api (igual que `/sitio`, `/c`, `/r`) → `/p/...` funciona en el dominio custom.


- **Petición dueño**: la sección que conecta con las Conversion/Problem Pages estaba hasta abajo (pegada al ContactBlock); estratégicamente debe ir más arriba para captar más clientes.
- **Fix** (`ContractorSite.js`): desacoplé `ProblemsSection` del `ContactBlock` (quité el render `id==="contact"` de abajo) y la inserté en los **10 templates** justo antes de `AboutBlock` (o sea, después del hero+servicios, cerca del tope). 3 `replace_all` cubrieron las 3 variantes de AboutBlock (plain / `bg="#FAF5EA"` / `light`) → 10 inserts confirmados. Solo se renderiza si `data.problem_pages.length > 0`.
- **Verificado**: screenshot del home → "Problems We Solve" ahora es el 3er bloque (tras hero y form), en y≈1459 de 9575 (~15% del alto, antes era casi al final). 6 tarjetas enlazando a `/sitio/{slug}/p/{pageSlug}`, sin duplicado. Build main.1f48413c.js recompilado (REACT_APP_BACKEND_URL='') + `git add -f frontend/build/*`.
- ⚠️ DESPLIEGUE: solo frontend → "Save to GitHub" + `git pull && bash deploy.sh`.


- **Reporte dueño**: aplicó el update pero NO veía en el home la sección que conecta con las Conversion/Problem Pages.
- **Causa raíz**: el payload público del home (`server.py` `_website_payload`) solo incluye `problem_pages` con `published: True`. Todas las Problem Pages del dueño estaban en `needs_review` / `published: False` → la sección "Common problems we solve" (`ContractorSite.js` `site-problem-links` + `ProblemsSection`) se ocultaba (renderiza solo si `data.problem_pages.length > 0`).
- **Fix** (`server.py`): las Problem Pages ahora se **publican automáticamente al generarse** (default `published: True` en `_generate_problem_pages_for_user` y en el endpoint `add`), alineado con la filosofía de la app ("todo listo y publicado"). El dueño puede despublicar cualquiera desde el editor (pestaña Problemas, switch `pp-publish-{slug}`).
- **Datos**: publiqué las 6 Problem Pages existentes del dueño en preview vía PUT. Verificado: payload público ahora trae 6 problem_pages; screenshot del home muestra la fila de chips "COMMON PROBLEMS WE SOLVE" con las 6 enlazadas a `/sitio/{slug}/p/{pageSlug}`.
- ⚠️ DESPLIEGUE: **backend** (Save to GitHub + `git pull && bash deploy.sh`). En producción, las Problem Pages ya creadas están sin publicar → el dueño debe (a) tras el redeploy, tocar "Regenerar" (auto-publica) o (b) simplemente activar el switch de publicar en cada página desde el editor.

## 🎯 Jun 2026 — Problem Pages: "Cómo funciona" + reorden de secciones (Conversion Optimization Update FINAL) [COMPLETO; verificado curl+screenshot, SIN testing_agent]
- **Contexto**: la sesión anterior actualizó el prompt del backend (`ai_service.py` `PROBLEM_PAGE_SYSTEM`) para generar copia optimizada + nuevo bloque `how_steps` (3 pasos), pero NO alcanzó a actualizar el frontend.
- **Frontend** (`ProblemPage.js`): reordenadas las secciones al orden pedido por el dueño → 1. Hero (Problema+Agitación+Solución+CTA, con formulario a la derecha), 2. El Problema (s_problem + s_why_matters como callout con borde de acento, una sola sección limpia para no saturar), 3. La Solución (s_how), 4. Prueba/Trabajos recientes (galería), 5. Por qué elegirnos (why_choose), 6. Reseñas de clientes, 7. **Cómo funciona (how_steps, NUEVO: 3 pasos numerados)**, 8. FAQ, 9. CTA final. testids `pp-how-steps`, `pp-how-step-{i}`. El formulario se mantiene en el hero (decisión del dueño).
- **Backend**: ya generaba `how_steps` (en `_PP_CONTENT_KEYS`). Las páginas viejas se regeneraron con `force=true` para poblar `how_steps`.
- **Verificado**: curl regenerando → Deck Building/Fence Install ahora traen `how_steps=3` (ej. "Share What's Wrong"/"Get a Clear Plan"/"Schedule the Build"), why_choose=4, faqs=6. Screenshot del sitio público (`/sitio/uni2-marketing-agency/p/deck-falling-apart?preview=1`): orden de headings correcto, "How it works" con 3 pasos numerados, hero con formulario. Build main.c284de73.js recompilado (REACT_APP_BACKEND_URL='') + `git add -f frontend/build/*`.
- ⚠️ DESPLIEGUE: solo frontend → "Save to GitHub" + `git pull && bash deploy.sh`. (El backend ya estaba desplegado con el prompt nuevo; el dueño solo debe REGENERAR sus Problem Pages desde el editor para poblar los 3 pasos.)


## 🔤 Jun 2026 — Contraste del HeroForm (texto legible) [COMPLETO; verificado screenshot]
- **Reporte dueño**: el texto/placeholder del formulario del hero era muy tenue.
- **Fix** (`ContractorSite.js` HeroForm): texto sólido (#fff en oscuro, #0f172a en claro), placeholders `placeholder-white/80` (oscuro) / `placeholder-slate-500` (claro), inputs `font-medium`, fondos y bordes más marcados (dark bg .16, border .45). Verificado screenshot Bento: "Maria Lopez"/teléfono blancos nítidos, placeholder legible. Build main.5c61549c.js (63 staged).

## 🎬 Jun 2026 — Cinematic pulido (font, servicios, texto, secciones crema) [COMPLETO; verificado screenshots, SIN testing_agent]
- Font Anton legible: `.wh` con `letter-spacing:.04em` cuando la fuente es Anton (cinematic/responder). Verificado.
- Servicios: quitado el truco `gap-px`+bg gris (mostraba celda vacía gris si no era múltiplo de 3) → `gap-4` + borde por tarjeta + bg #0d0d10. Verificado (2 servicios sin cuadro gris).
- Texto de contacto genérico (no "project"): ContactBlock + textarea + defaults.
- Secciones crema para contraste: `lightCtx` (cream #FBF7F0/#F3ECE0, ink oscuro) aplicado a **FeatureBlock** ("Why choose us", envuelto en div crema porque SectionLight sin alt es transparente) y a la **Galería** ("Our craft/Recent Work" → SectionLight alt con lightCtx). FeatureBlock verificado crema; galería mismo patrón (no había fotos en la cuenta de prueba para captura).
- Build main.0a5d22fe.js (63 staged).

# UniTech — PRD (resumen vivo)

## 🧩 Jun 2026 — Formulario del hero: reposicionado para no agrandar el hero (2-col o band debajo) [COMPLETO; verificado screenshots, SIN testing_agent]
- **Reporte dueño**: el HeroForm que quedaba DEBAJO del texto en heros de 1 columna agrandaba el hero. Idea del dueño: en algunos, poner el form en un band NUEVO justo debajo del hero con texto al lado.
- **Fixes** (`ContractorSite.js`):
  - Single-col heros (Craftsman) → 2-col (texto izq + form der). Verificado (hero 640px, se ve bien).
  - Neon: imagen del hero ahora se ESTIRA (h-full/self-stretch + items-stretch) → sin hueco; form en columna izquierda balanceado. Verificado.
  - Responder/Slider ya balanceaban (imagen absolute fill) → sin cambios.
  - **Nuevo `HeroFormBand`**: sección debajo del hero con kicker + titular + bullets a un lado y `HeroForm` al otro. Aplicado a **Cinematic** y **Luxe** (heros full-screen): su hero quedó limpio (imagen+texto+CTA) y el form pasó al band inmediatamente debajo. Verificado screenshot Cinematic ("Reserve your spot in seconds" + form a la derecha).
  - In-hero form se conserva en Bento, OnePage, Playful, Craftsman (2-col) y Trust (todos se ven bien).
- Build recompilado (main.763fe0f2.js, 63 staged). ⚠️ DESPLIEGUE: solo frontend → Save to GitHub + `git pull && bash deploy.sh`.


## 🖼️ Jun 2026 — Templates TANDA 3: hero con imagen de fondo (Bento/Craftsman/OnePage/Playful) + formulario arriba en los 10 [COMPLETO; verificado screenshots, SIN testing_agent]
- **Feedback dueño**: (1) hero con imagen de fondo completa para Bento, Organic Craftsman, Minimal OnePage y Colorful&Friendly Playful (mapeo confirmado vía i18n en.json); (2) formulario de agendar/estimado ARRIBA en TODOS los templates (posición libre), sin quitar el de abajo.
- **Nuevo componente `HeroForm`** (`ContractorSite.js`): tarjeta compacta glass (nombre + teléfono + servicio → POST `/public/website/{slug}/lead`), etiqueta adaptable (booking → "Request Appointment" / estimado → "Get My Free Quote"), variantes dark/light.
- **Heros convertidos a imagen de fondo completa + HeroForm**: Bento (era mosaico plano → full-bleed rounded + form), OnePage (era split minimal → full-bleed 90svh overlay + form), Playful (era pastel plano → full-bleed + blobs + form). Craftsman ya era full-image → + HeroForm.
- **HeroForm agregado arriba** también en Cinematic, Responder, Slider, Neon, Luxe. Trust ya tenía formulario arriba. → 10/10 con form arriba. El formulario de abajo (`ContactBlock`) se mantiene intacto.
- **Verificado screenshots**: Bento y Playful con hero de imagen completa + form "Book your appointment"; `site-hero-form` presente. Build compila OK (main.efdcd54c.js, 63 staged).
- ⚠️ DESPLIEGUE: solo frontend → Save to GitHub + `git pull && bash deploy.sh`.


## ✨ Jun 2026 — Templates TANDA 2: Neon diferenciado + móvil Luxe/Slider/Craftsman + animaciones al scroll [COMPLETO; verificado screenshots, SIN testing_agent]
- **Neon rediseñado** (`ContractorSite.js` hero): ahora es cyber real y distinto de Cinematic — glow blobs rosa/cyan, scanlines, hero split con la FOTO en duotono/color-burn (mix-blend-color + grayscale/contrast) y borde glow, titular con degradado brillante (bg-clip-text) + drop-shadow, badge "SYSTEM ONLINE · 24/7" con pulse, subheadline mono. Verificado screenshot.
- **Móvil** (break-words + tamaños): Luxe `text-4xl sm:text-5xl lg:text-7xl break-words`; Slider `text-4xl sm:text-5xl lg:text-6xl break-words`; Craftsman h1 `break-words`. Verificado móvil Luxe sin overflow (scrollWidth==clientWidth).
- **Animaciones al scroll**: hook `useReveal()` (IntersectionObserver) + CSS `.wreveal/.wshow` (respeta prefers-reduced-motion). Aplicado a `SectionLight` y `SectionDark` → cubre about/how/why/gallery/reviews/faq/areas/contact + servicios de Responder/Trust/Playful/Bento/Cinematic/Neon en todos los templates. Secciones custom (Craftsman/Luxe/OnePage services) no cubiertas (aceptable).
- Build recompilado (main.60fc7081.js, 63 staged). ⚠️ DESPLIEGUE: solo frontend → Save to GitHub + `git pull && bash deploy.sh`.


## 🎨 Jun 2026 — Auditoría de templates TANDA 1: fotos en servicios + CTA arriba/abajo + rediseños [COMPLETO tanda 1; verificado screenshots, SIN testing_agent]
- **Feedback dueño** (verbatim en trayectoria): fotos protagonistas en TODOS los templates; servicios con foto en todos; CTA/formulario arriba Y abajo sin excepción. Responder (sin foto en servicios), Bento (plano, sin impacto, pero le gustan los servicios), Trust (favorito; quiere servicios estilo Bento), OnePage (foto+desc al abrir servicio), Neon (idéntico a Cinematic), Playful (el que menos le gusta, plano).
- **Diseñador**: se generó `/app/design_guidelines.json` (patrones service-card-with-photo, bento-grid, accordion photo reveal, hero top-CTA + bottom form, art direction por template, motion). Ingerido.
- **Implementado** (`ContractorSite.js`): 2 componentes reutilizables `ServiceBento` (bento fotos con overlay) y `ServiceCardsBold` (neo-brutalist con foto). 
  - Responder → `ServiceCardsBold` (fotos + borde grueso + sombra dura). ✅ verificado screenshot.
  - Trust → `ServiceBento` para servicios + `ContactBlock id="contact2"` al final (form arriba flotante Y abajo). ✅ verificado (#contact2 presente + bento).
  - OnePage → `OneAccordion` ahora revela FOTO + descripción + CTA al abrir (grid-rows animación). ✅ verificado.
  - Playful → tarjetas de servicio con FOTO + borde 3px + hard shadow neo-pop. ✅ verificado.
  - Bento → hero mosaic más grande (auto-rows 190px) + 2 tiles extra con fotos de servicios.
  - `ContactBlock` acepta prop `id` (default "contact") para permitir form arriba y abajo sin id duplicado.
- **PENDIENTE tanda 2** (aún NO hecho): diferenciar **Neon** de Cinematic (hero cyber/duotone/scanlines), y auditar Cinematic/Slider/Craftsman/Luxe en móvil. Animaciones de entrada al scroll (IntersectionObserver) globales — no implementadas aún.
- Build recompilado (main.81078230.js, 63 archivos staged). ⚠️ DESPLIEGUE: solo frontend → Save to GitHub + `git pull && bash deploy.sh`.


## 🔘 Jun 2026 — CTAs adaptables al tipo de negocio (Book Now vs Get a Free Quote) en todos los templates [COMPLETO; verificado screenshots, SIN testing_agent]
- **Petición dueño**: el botón "Get a Quote" por servicio y la banda inferior "Ready when you are / Let's get your project done right / Get your free estimate" no aplican a todos los negocios de servicio; poner algo genérico que funcione con todos.
- **Fix** (`ContractorSite.js`): CTAs centralizados en el `ctx` según el modo — `ctx.cta = bookingOn ? "Book Now" : "Get a Free Quote"`, `ctx.ctaShort` para la barra móvil. Reemplazados TODOS los CTAs hardcodeados de los 10 templates (heros: Get a Free/Fast Quote, Request an Estimate/Quote; por-servicio "Get a quote"; CtaBand; barra móvil "Free Quote"; footer "Get Your Free Estimate" + link "Request Quote"). Footer h2 ahora genérico ("Let's get you booked in." / "Let's get you taken care of."). Se conservan CTAs de carácter por template (slider "See Your Transformation", luxe "Request a Consultation"). Los títulos del formulario ya eran adaptables (booking → "Book an Appointment").
- **Bug corregido en el mismo turno**: el replace_all global de "Get a Free Quote" pisó la propia definición `ctx.cta` (quedó `"{ctx.cta}"` literal renderizando en el hero) → corregido a "Get a Free Quote".
- **Verificado screenshots**: uñas (booking) → "Book Now" / "Request Appointment"; roofing (estimado) → "Get a Free Quote"; sin texto literal `{ctx` en la página. Build recompilado (main.4bb0998e.js, 63 archivos staged).
- ⚠️ DESPLIEGUE: solo frontend → Save to GitHub + `git pull && bash deploy.sh`.


## 🎯 Jun 2026 — Templates enfocados a negocios de servicio: booking vs estimado por oficio + descripciones de servicio + foto About sin cortar [COMPLETO; verificado e2e curl+screenshots, SIN testing_agent]
- **Petición dueño**: todos los usuarios son negocios de servicio → cada sitio debe VENDER servicios y tener por defecto un "Get a Free Estimate" (ej. roofing) O un "Booking Calendar" (ej. car detail/uñas) según el oficio; la IA decide cuál. Además: (a) las descripciones de servicio no salían tras el onboarding; (b) la foto de About se cortaba.
- **Booking vs Estimado por oficio** (`server.py` `_build_full_website`): heurística `_BOOKING_HINTS` (nail/salon/spa/barber/lash/makeup/hair/tattoo/massage/car detail/pet groom/clinic/dental/fitness/etc.) → `sections.booking=True` (calendario) para negocios de cita; resto → `False` (formulario de estimado gratis). En modo booking activa el calendario de la tarjeta por defecto (`appt_enabled`, días L-S, 09:00-18:00, 60min) para que funcione al instante. Los 10 templates ya renderizan `ContactBlock` (booking o lead) + Trust en su hero.
- **Descripciones de servicio automáticas** (`ai_service.describe_services` — 1 sola llamada LLM → {nombre: descripción}; `_build_full_website` paso 1b): rellena la descripción de CADA servicio que el dueño dejó sin descripción en el wizard.
- **Foto About sin cortar** (`ContractorSite.js` AboutBlock): foto única (personal) ahora `h-auto max-h-[620px] object-contain` (se ve completa); el collage múltiple sigue con aspecto fijo.
- **Verificado**: curl 2 cuentas → Nail Art: template craftsman, booking=True, servicios CON descripción; Roofing: cinematic, booking=False, servicios CON descripción. Screenshots: sitio de uñas con calendario real (fechas Ago 26–Sep 10 + form), roofing con About collage + Call CTA, y foto About única sin recorte (ratio render=natural). Build recompilado (63 archivos staged).
- ⚠️ DESPLIEGUE: backend + frontend → Save to GitHub + `git pull && bash deploy.sh`.


## 🎉 Jun 2026 — Pantalla de Bienvenida post-onboarding + defaults de factura aplicados [COMPLETO; verificado e2e curl+screenshot, SIN testing_agent]
- **Petición dueño**: al terminar el onboarding, mostrar "¡Tu negocio está en línea!" con link para compartir + WhatsApp, y decir que la tarjeta digital está lista y las facturas ya tienen su info/branding. Listar todo lo que queda listo.
- **Frontend** (`Onboarding.js`): nuevo estado `done` → pantalla de celebración: hero cohete, tarjeta "Tu sitio web está EN VIVO" (URL + copiar + "Ver mi sitio" + botón "Compartir" WhatsApp verde `wa.me`), checklist de 5 (Sitio publicado / Tarjeta digital / Facturas con branding / Servicios+precios+pagos guardados / Reseñas y redes), botones "Mi tarjeta", "Cambiar diseño", "Ir a mi panel". testids `onb-done`, `onb-view-site`, `onb-wa-share`, `onb-ready-*`, etc.
- **Backend** (`onboarding/complete`): ahora devuelve `card_slug`, `business_name`, `whatsapp` (además de site_slug/published) para armar los links de la pantalla.
- **Defaults de factura AHORA SÍ se aplican** (`server.py` `create_invoice`): si la factura no viene de quote/agreement y no trae tax/deposit/notes, aplica los `invoice_defaults` del onboarding (tax %, deposit %, payment_terms) y recalcula tax_amount/total. Verificado curl: factura de $100 sin tax → tax 8% ($8), total $108, depósito 50% ($54), notes "Payment due on receipt." (Task 1 P1 → HECHO.)
- **Verificado**: screenshot móvil de la pantalla de bienvenida (link real, 5 checks, botón Compartir) + curl de factura con defaults.
- ⚠️ DESPLIEGUE: backend + frontend (build recompilado, 63 archivos staged) → Save to GitHub + `git pull && bash deploy.sh`.


## 🚀 Jun 2026 — Onboarding ahora DEJA EL SITIO 100% HECHO y PUBLICADO (IA + fotos + logo + foto personal) [COMPLETO; verificado e2e curl+screenshots, SIN testing_agent]
- **Petición dueño**: con solo llenar el onboarding, el cliente debe salir con sitio web TERMINADO y publicado, tarjeta digital, e invoices con branding. Antes tenía que llenar cada sección a mano; la IA no jalaba; no pedía foto personal; el logo no salía.
- **Bugs de IA arreglados**: (1) `writeAbout` mandaba `{field,prompt}` pero `/website/ai-write` espera `{kind,name}` → 400 siempre. Ahora manda `{kind:"bio",name,business_type,business_name,context}` (nuevo kind "bio" en `ai_service.write_field`). (2) `/website/ai-suggest-services` usaba `card.business_type` (no guardado aún en el wizard) → ahora acepta override `{business_type,brief}` en el body. Ambos endpoints aceptan override para funcionar durante el wizard.
- **Backend nuevo** (`server.py` `_build_full_website(user_id, publish)`): genera contenido IA (headline/subheadline/about/how/why/faqs/areas/SEO + servicios si faltan), elige y aplica template+accent con `suggest_website_design`, rellena fotos de stock (hero/why/band/about/servicios), y PUBLICA. Best-effort por paso. `/onboarding/complete` ahora acepta `personal_photo_id`, `build_site`, `publish`: cablea la foto personal a `team_photo_id`+`about_photo_ids` (para que salga en "Sobre nosotros" y el stock no la pise) y corre el build completo.
- **Frontend** (`Onboarding.js`): nuevo paso "photo" (foto personal, opcional/saltable, sube a `/photos?label=team`); IA arreglada; `finish()` sube logo → foto personal → `PUT /card/settings` → `POST /onboarding/complete {build_site:true, publish:true}` con mensajes de progreso ("Construyendo tu sitio web con IA…"); al terminar navega a `/pagina-web`. 7 pasos: business, brand, about, **photo**, services, payments, reviews.
- **Verificado e2e** (cuenta Nail Art de prueba, curl): onboarding/complete build_site → 27s → publicado. GET /website: template `onepage`, accent `#D81B60` (rosa), about 787 chars, 4 how / 6 why / 7 faqs / 6 áreas, hero+why+band+team+3 about + foto por servicio, SEO. Screenshot del sitio público: se ve pro (hero manicure, servicios, tema rosa). AI helpers: suggest-services 12 servicios, bio cálida. Screenshot wizard: paso "Tu foto (opcional)" renderiza (Paso 4 de 7).
- ⚠️ PENDIENTE (Task 1 P1, aún NO hecho): `invoice_defaults` (tax/deposit/payment_terms) y `payment_prefs` se GUARDAN pero todavía NO se aplican automáticamente al crear cada factura. El branding (logo/nombre) del PDF ya existía.
- ⚠️ DESPLIEGUE: backend + frontend (build recompilado, 63 archivos staged) → Save to GitHub + `git pull && bash deploy.sh`.


## 🐛 Jun 2026 — FIX real: fotos del oficio no se guardaban en PRODUCCIÓN (PermissionError en uploads) [ARREGLADO en deploy.sh; confirmado por log de prod]
- **Reporte dueño**: "Traer fotos del oficio" no traía nada; sitio Vanessa's Creations (Nail Art) con 0 imágenes.
- **Descartado en orden** (con comandos en el server del dueño): llave Pexels PRESENTE en `/opt/ezunitap/backend/.env`; server→Pexels `HTTP 200` (red OK, llave válida). NO era Pexels.
- **Causa raíz REAL** (log de prod): `WARNING - stock photo store failed: PermissionError(13, 'Permission denied')`. `/home/ezunitap/uploads` raíz era de `ezunitap` pero una SUBCARPETA interna la creó `root` → el backend (corre como `ezunitap`) no podía escribir → `_store_stock_url` devolvía None → `filled:0`.
- **Fix permanente** (`deploy.sh`, corre como root cada deploy): `mkdir -p /home/ezunitap/uploads && chown -R ezunitap:ezunitap && chmod -R 775`. Así se auto-corrige en cada actualización.
- **Bonus** (`pexels_service.py`): búsquedas específicas nail/uñas/manicure/salon/beauty/spa/lash/makeup/hair/barber/tattoo/foto/catering/bakery.
- **Bonus** (`server.py` `/website/stock-photos`): reason ahora distingue `pexels_down` vs `no_slots` (antes ambos "none") + campo `pexels_ok`.
- **Acción del dueño**: Save to GitHub + `cd /home/ezunitap/repo && git pull && bash deploy.sh`. Backend-only + script (sin rebuild de frontend para este fix).


## 🖼️ Jun 2026 — Fotos del oficio no funcionan en PRODUCCIÓN (falta PEXELS_API_KEY) + búsquedas de belleza [DIAGNOSTICADO + mejora código]
- **Reporte dueño**: "Traer fotos del oficio" dice "No hay espacios de foto vacíos por rellenar (o no se encontraron)". Negocio = Nail Art. Pasa en el sitio de PRODUCCIÓN.
- **Causa raíz**: producción NO tiene `PEXELS_API_KEY` en su `.env` (viene de `/home/ezunitap/public_html/keys.txt` vía `fix.sh`; el ejemplo de prod la trae comentada). En preview SÍ está → funciona (verificado: Pexels devuelve 14 fotos para "Nail Art"; endpoint `/website/stock-photos` admin → filled=6). Sin llave, la búsqueda vuelve vacía → filled=0 → mensaje "none".
- **Mejora código** (`pexels_service.py` `_TRADE_QUERIES`): agregadas búsquedas específicas para nail/uñas/manicure/pedicure/salon/beauty/spa/lash/makeup/hair/barber/tattoo/photo/catering/bakery → antes "Nail Art" caía a búsqueda genérica; ahora "nail salon manicure". Verificado trade_query.
- **Acción del dueño**: (1) agregar `PEXELS_API_KEY=kEUzeNfuB0bYiHBxe0P8LVcqqp7yiIqdMFkYYGCgWnGLEDlfkauh7u2k` a `keys.txt`; (2) Save to GitHub; (3) `cd /home/ezunitap/repo && git pull && bash deploy.sh`.


## ✅ Jun 2026 — Bug de tipeo en Onboarding VERIFICADO arreglado + build recompilado para servidor [COMPLETO; verificado screenshot en vivo, SIN testing_agent]
- El componente `Field` ya estaba fuera de `Onboarding` (línea 38). Verificado en vivo (móvil 390px, login admin → /onboarding): escribí "Gonzalez Painting LLC" y "7135550142" letra por letra con delay → valor completo, sin pérdida de foco. Bug RESUELTO.
- Recompilado `frontend/build` con `REACT_APP_BACKEND_URL=''` (URL relativa `/api`, sin dominio preview) + `git add -f frontend/build/*`. Listo para "Save to GitHub" + `deploy.sh`.


## 🚀 Jun 2026 — Wizard de Onboarding único (deja TODO listo) [MVP COMPLETO; verificado screenshot+curl, SIN testing_agent]
- **Problema del dueño**: onboarding regado por muchas páginas; el usuario nuevo no sabe navegar para llenar lo que alimenta Tarjeta/Web/Facturas. Quiere un cuestionario único que al terminar deje todo listo y funcional.
- **Decisiones**: obligatorio hasta terminar; Stripe = botón opcional (métodos manuales sí quedan); logo casi-obligatorio con **monograma de iniciales** como fallback; una pregunta por pantalla; **ayudante IA** en el proceso.
- **Frontend** `pages/Onboarding.js` (`/onboarding`): 6 pasos (business, brand+logo, about, services, payments, reviews). Monograma canvas→PNG subido a `/card/logo` si no suben logo. IA: `onb-ai-services` (POST /website/ai-suggest-services) y `onb-ai-about` (POST /website/ai-write). Al terminar: sube logo → `PUT /card/settings` (card+servicios+business_type+marca+social, que ya sincroniza a la web) → `POST /onboarding/complete` (phone, business_address, payment_prefs, invoice_defaults + marca onboarding_state.completed). testids `onb-*`.
- **Backend** `server.py`: nuevo `POST /onboarding/complete`. `/onboarding/status` ahora devuelve `completed=True` también si `onboarding_state.completed`/`dismissed` (para el gating).
- **Gating** (`Dashboard.js`): al montar consulta `/onboarding/status`; si `!completed` → redirige a `/onboarding`. Ruta registrada en `App.js`.
- Verificado: screenshot (paso 1 → paso "Tu marca" con monograma "GP") + curl (`/onboarding/complete` 200, status `completed=True`).
- **PENDIENTE/FOLLOW-UP**: (1) wiring de `invoice_defaults`/`payment_prefs` dentro del builder de facturas (se guardan pero aún no se aplican automáticamente en cada factura); (2) subida de FOTOS de trabajos (galería) — el wizard hoy cubre logo+datos, no galería; (3) confirmar que cuentas nuevas tengan feature "card" para permitir subir logo. (4) `/website/ai-write` puede no existir — el botón "Escribir con IA" degrada con toast si falla.
- ⚠️ DESPLIEGUE: backend + frontend → "Save to GitHub" + `deploy.sh`.



## 📉 Jun 2026 — Analíticas: lista larga → gráfica compacta "Cómo terminaron" [COMPLETO; verificado screenshot, SIN testing_agent]
- **Petición del dueño**: la tabla larga "Sesiones recientes" al fondo no aportaba nada; hacerla más chica o gráfica.
- **Fix** (`AdminDemoAnalytics.js`): se reemplazó la tabla por una tarjeta `demo-outcomes` con barra segmentada + 3 métricas: Terminaron el demo (verde), Pidieron ayuda WhatsApp (ámbar), Se fueron antes (gris), con conteo y %. Calculado de `totals` (completed / whatsapp_clicks / resto).
- Verificado screenshot: gráfica visible (8/28%, 0/0%, 21/72%), tabla larga eliminada.
- ⚠️ DESPLIEGUE: solo frontend → "Save to GitHub" + `deploy.sh`.



## 📊 Jun 2026 — Analíticas del Demo actualizadas al flujo corto (sin cotización/contrato) [COMPLETO; verificado curl+screenshot, SIN testing_agent]
- **Petición del dueño**: la página de analíticas seguía mostrando pasos de Cotización y Contrato del flujo viejo; quiere ver el flujo nuevo. (Conversión ya subió de 22 → 28/29 con los cambios.)
- **Backend** (`server.py`): `DEMO_STEP_LABELS_CORTO` reescrito a 4 pasos reales — 0 Entró al demo, 1 Describió el trabajo, 2 Creó su factura con IA, 3 Vio la oferta/terminó. `DEMO_VARIANTS["corto"].max = 3`.
- **Frontend** (`DemoFlow.js`): pasos de tracking corregidos al nuevo flujo — demo_completed/contact_captured/whatsapp_click/checkout_click ahora step 3 (antes 4). (`AdminDemoAnalytics.js`): variant por defecto = "corto"; color verde en el último paso (antes fijo step===10); textos "/demo-flujo" → "/demo".
- Verificado: curl funnel corto (29→15→13→8, sin Cotización/Contrato) + screenshot (abre en Demo corto, embudo nuevo, sin contrato/cotización).
- ⚠️ DESPLIEGUE: backend + frontend → "Save to GitHub" + `deploy.sh`.



## 📄 Jun 2026 — Descripción del trabajo en el PDF de factura + "gratis" en cierre [COMPLETO; verificado extrayendo texto del PDF real, SIN testing_agent]
- **Peticiones del dueño**: (1) el PDF de factura no mostraba la descripción del trabajo (el párrafo `quote.description` que sí sale en pantalla); (2) agregar "gratis" a "¿Te gustó? Te ayudamos a montarlo gratis en tu negocio 🙌".
- **Fix #1** (`lib/pdf.js` `generateInvoicePDF`): renderiza `invoice.description` (párrafo) justo después del job_title y antes del Scope of Work. Antes solo salía título/scope/líneas.
- **Fix #2** (i18n `demoFlow.helpTitle` es/en): agregado "gratis"/"free".
- Verificado con pypdf extrayendo el texto del PDF descargado del demo: contiene Bill To completo (nombre/dirección/tel/email), el párrafo de descripción del trabajo y el Scope of Work.
- ⚠️ DESPLIEGUE: solo frontend → "Save to GitHub" + `deploy.sh`.



## 🤝 Jun 2026 — Cierre del demo Opción B: WhatsApp/ayuda como CTA principal, registro secundario [COMPLETO; verificado screenshot, SIN testing_agent]
- **Decisión del dueño**: en vez de empujar la suscripción de primero (mucho compromiso para tráfico frío), poner WhatsApp + "Te ayudamos a montarlo gratis" + captura de datos como acción PRINCIPAL (captura el lead aunque no compre hoy); el registro/Precio Fundador queda como secundario.
- **Fix** (`DemoFlow.js` `FinalCTA`): arriba = encabezado helpTitle/helpDesc + botón WhatsApp (primario) + captura nombre/email (`demo-capture-*`). Abajo (borde superior) = "¿List@ para empezar hoy?" + Precio Fundador inline + botón registro `demo-final-cta` en estilo secundario (contorno) + trust. `FinalCTA` ahora usa `i18n`/`es`.
- Verificado screenshot móvil (390×844): WhatsApp primario en y≈368 (visible sin scroll), registro secundario en y≈706 (abajo).
- ⚠️ DESPLIEGUE: solo frontend → "Save to GitHub" + `deploy.sh`.



## 🎯 Jun 2026 — Pantalla de cierre del demo compacta (CTA sin scroll) [COMPLETO; verificado screenshot, SIN testing_agent]
- **Queja del dueño**: la página CTA del demo repetía mensajes (subtítulo + nota azul + 4 tarjetas + tarjeta azul "Eso fue todo" con lo mismo) y el botón de crear cuenta quedaba enterrado (había que hacer scroll, peor en móvil).
- **Fix** (`DemoFlow.js` `DemoClose` + `FinalCTA`): hero compacto (sin ícono gigante, título text-2xl/3xl, 1 subtítulo). `FinalCTA` reordenado: oferta fundador + **botón "Crear cuenta" full-width ARRIBA** + línea de confianza; ayuda/contacto/WhatsApp DEBAJO. Se quitó el texto redundante (`finalTitle`/`finalDesc`/`helpDesc` y la nota azul duplicada). Beneficios + "también Estimados/Contratos" (one-liner) van al final.
- Verificado screenshot móvil (390×844): CTA `demo-final-cta` en y≈339, bottom≈395 → VISIBLE sin scroll.
- ⚠️ DESPLIEGUE: solo frontend → "Save to GitHub" + `deploy.sh`.

## 🧾 Jun 2026 — Demo: cliente ficticio completo + Scope en PDF + auto-relleno de descripción [COMPLETO]
- `DEMO_CLIENT` {name,address,phone,email} en Bill To (pantalla + PDF). `generateInvoicePDF` ahora incluye Scope of Work. `GuidedJobForm` prop `autoWork` → al elegir servicio auto-rellena la descripción (sin sobrescribir lo tecleado). Demo pasa ambos.



## 🧾 Jun 2026 — Demo: cliente ficticio completo + Scope en PDF + auto-relleno de descripción [COMPLETO; verificado screenshot, SIN testing_agent]
- **Peticiones del dueño** (viendo el PDF del demo): (1) la factura debe traer info completa del cliente ficticio (nombre, dirección, teléfono, email); (2) el invoice no mostraba Scope of Work; (3) al escoger un servicio en la 1ª página, la descripción del trabajo no se auto-rellenaba.
- **Fix #1 cliente** (`DemoFlow.js`): nuevo `DEMO_CLIENT` {name, address, phone, email}. `InvoiceStep` acepta prop `client`, muestra Bill To completo en pantalla y lo pasa al PDF (`generateInvoicePDF(invoice, business, {name,address,email,phone})`). El demo pasa `client={DEMO_CLIENT}`.
- **Fix #2 scope en PDF** (`lib/pdf.js`): `generateInvoicePDF` ahora renderiza bloque "Scope of Work" (antes solo lo tenía `generateQuotePDF`). En pantalla ya se mostraba.
- **Fix #3 auto-relleno** (`GuidedJobForm.js`): nuevo prop `autoWork`; `pickTrade()` al elegir un chip auto-rellena la descripción vía `autoWork(trade)` sin sobrescribir texto tecleado por el usuario (solo si vacío o igual al último auto). El demo pasa `autoWork={(tr)=>jobRequestText(tr,t)}`.
- Verificado screenshot demo: cambiar de servicio actualiza la descripción; Bill To con dirección/tel/email; Scope of Work visible; factura simple con Enviar/insignia.
- ⚠️ DESPLIEGUE: solo frontend → "Save to GitHub" + `deploy.sh`.



## 🧾 Jun 2026 — Demo simplificado: solo FACTURA (alinear con el anuncio) [COMPLETO; verificado screenshots e2e, SIN testing_agent]
- **Insight del dueño**: el anuncio promete "haz invoices" pero el demo hacía pasar por cotización → contrato → invoice → pago (demasiado, causa abandono). Quiere: preguntas → SOLO factura → cierre; mencionar en el cierre que también hay Estimados y Contratos + WhatsApp/formulario.
- **Fix** (`DemoFlow.js`): flujo nuevo = step 0 start, step 1 DescribeStep (asistente guiado), step 2 `InvoiceStep simple`, step 3 `DemoClose`. Se quitaron del flujo QuoteStep/AgreementStep/paso de pago (componentes siguen exportados para DemoAll.js). `goClose()` reemplaza genAgreement/signNow/payNow. `GuideBar` solo en step 2 ("¡Tu factura está lista!" → Continuar). `StepBar` ahora 2 pasos (Describe / Factura).
- **InvoiceStep `simple`**: insignia "Tus clientes pueden pagar con tarjeta 💳" (sin proceso de pago), botón "Enviar factura al cliente" abre `DemoSendSheet` (bottom sheet): Descargar PDF FUNCIONA (real), WhatsApp/Texto/Email en gris con candado 🔒 "Con tu plan" + nota de crear cuenta. `Sheet` de shadcn (side=bottom).
- **DemoClose**: nota `demo-close-also` "UniTech también hace Estimados (cotizaciones) y Contratos de Servicio — pregúntanos." (ya tenía form de contacto + WhatsApp). i18n `close.subtitle` e `invoiceBanner` actualizados (ya no mencionan contrato/pago).
- Verificado screenshots e2e: start → preguntas → Crear con IA → factura INVOICE con insignia + Enviar (sheet con Descargar PDF real + canales en gris) → Continuar → cierre con nota de Estimados/Contratos + WhatsApp + form.
- ⚠️ DESPLIEGUE: solo frontend → "Save to GitHub" + `deploy.sh`.



## 🔗 Jun 2026 — Servicios sincronizados: Tarjeta ↔ Página Web ↔ Quotes/Facturas [COMPLETO; verificado curl+screenshot, SIN testing_agent]
- **Petición del dueño**: hay 2 lugares con servicios (Tarjeta y Página Web); prefiere el de la Web (sugiere más servicios + descripciones). Quiere que ambos estén SINCRONIZADOS y que quotes/facturas los tomen de ahí.
- **Backend** (`server.py`): sincronización bidireccional al guardar. `update_card_settings` (PUT /card/settings): si manda `services` y es la card primaria → espeja a `websites`. `update_website` (PUT /website): si manda `services` → espeja a la card primaria (`is_primary`). Misma forma `{name, description, starting_price, icon}`, sin loop (escritura directa a la otra colección).
- **Frontend** (`QuoteBuilder.js` + `InvoiceDetail.js`): el fetch de servicios ahora lee primero `GET /website` (preferido, más rico), fallback a `/card/settings` (y a `business_type`). Pasa a `GuidedJobForm` como `serviceOptions`.
- Verificado: curl (editar Web → refleja en Tarjeta y viceversa) + screenshot (chips del quote = servicios de la Web: Deck Building, Fence Install; los viejos de solo-tarjeta ya no salen).
- ⚠️ DESPLIEGUE: backend + frontend → "Save to GitHub" + `deploy.sh`.
- NOTA: en preview la cuenta admin quedó con servicios de prueba (Deck Building, Fence Install) — el dueño puede cambiarlos desde su Tarjeta/Web.

## 🧰 Jun 2026 — Chips de oficio = servicios del perfil del dueño [COMPLETO]
- `GuidedJobForm` usa `serviceOptions` (servicios del perfil) como chips, pre-selecciona el primero, mantiene "Otro". Demo mantiene lista genérica TRADES.



## 📋 Jun 2026 — Pregunta "¿Una línea o desglose?" en el asistente (página 1) [COMPLETO]
- `GuidedJobForm` Q6 `guided-detail-single`(default)/`guided-detail-breakdown`; `onResult(data, detail)` → handlers cargan 1 línea o desglose. Toggle en borrador sigue disponible.

## 🪜 Jun 2026 — Crear Quote/Factura en 2 pasos + cliente en página 1 [COMPLETO]
- 2 fases (`phase` input→draft, `goDraft()` scrollTo 0). Fase input = preguntas + select de cliente arriba (facturas: `inv-client-select-input`). Al generar → borrador editable arriba. Botón "Volver a las preguntas".







## 🎬 Jun 2026 — Asistente guiado también en el DEMO (`/demo`) [COMPLETO; verificado curl+screenshots, SIN testing_agent]
- **Petición del dueño**: aplicar el asistente guiado al demo. Decisiones: preguntas PRE-RELLENADAS (1 tap "Crear con IA"), precio default = "que la IA sugiera" (momento wow).
- **Backend** (`server.py`): `POST /public/demo/quote-guided` + `DemoGuidedQuoteIn` (público, sin auth). Usa `ai_service.generate_quote_from_answers`. Devuelve `quote` con `line_items=[summary_item]` (1 línea default) + `detailed_line_items` (desglose) + total/deposit/scope/price_estimated. Respeta `DEMO_MAX_QUOTES`.
- **Frontend** `components/GuidedJobForm.js`: ahora reusable — props nuevos `initial` (pre-rellena respuestas), `request` (override del API call, usado por el demo público) y `ctaLabel`.
- **Frontend** `DemoFlow.js`: `DescribeStep` (paso 1) ahora muestra el asistente guiado PRE-RELLENADO como opción principal + "describir yo mismo" secundario (el select+textarea viejo). `demoGuidedRequest` llama al endpoint público (setea loading del padre → BusySheet). `onGuidedQuote` setea quote y avanza a paso 2. GuideBar oculto en paso 1 (el asistente tiene su propio CTA). `QuoteStep` tiene toggle `demo-quote-breakdown` (una línea ↔ desglose).
- Verificado: curl (sin precio → IA sugiere $2150, 8 líneas suman 2150) + screenshots móvil e2e (paso 1 asistente pre-rellenado "Pintura" → tap Crear con IA → quote 1 línea "Interior Painting" → "Mostrar desglose" expande y colapsa → sigue a paso 3). Build recompilado + `git add -f`.
- ⚠️ DESPLIEGUE: backend + frontend → "Save to GitHub" + `deploy.sh`.



## 🧙 Jun 2026 — Asistente guiado de Quotes/Facturas: "Contéstame unas preguntas" + resultado de UNA sola línea [COMPLETO; verificado curl+screenshots e2e, SIN testing_agent]
- **Insight del dueño** (de su gente real): (1) la mayoría de contratistas hispanos NO quieren desglose de líneas — prefieren UNA sola línea con el detalle + el total (su amigo borró las líneas de la IA y dejó una sola); (2) se ATORAN describiéndole el trabajo a la IA (no saben qué escribir). Decisiones: resultado = 1 línea por defecto + botón "Mostrar desglose"; asistente en quotes Y facturas; si el contratista sabe el precio lo pone y la IA solo redacta; si no, la IA sugiere; voz = después; preguntas = todas en una pantalla.
- **Backend** (`ai_service.py` `generate_quote_from_answers` + `GUIDED_QUOTE_SYSTEM`; `server.py` `POST /ai/quote-guided` + `AIGuidedQuoteRequest`): recibe trade, work_es, total_price(opcional), includes_materials(yes/no/unsure), deposit_kind(none/half/custom)+percent. Devuelve `summary_line` (1 línea profesional en inglés), `summary_item` (la línea única default), `line_items` (desglose 4-8), scope, notes, payment_terms, total, deposit_amount, price_estimated. Normaliza números server-side: si hay precio, el desglose se re-escala para SUMAR exacto al total; si no, la IA estima. Depósito calculado (half=50%, custom=%).
- **Frontend nuevo** `components/GuidedJobForm.js`: cuestionario de 1 pantalla (chips de oficio, qué hacer, precio sí/no, materiales, depósito) → `/ai/quote-guided` → `onResult(data)`. testids `guided-*`.
- **Frontend** `QuoteBuilder.js` + `InvoiceDetail.js`: switch de modo "Contéstame preguntas" (default) vs "Describir yo mismo" (el flujo libre existente). `applyGuided` mete la línea única por defecto; botón `qb-toggle-breakdown`/`inv-toggle-breakdown` intercambia entre 1 línea y desglose (recalcula totales). Aviso `qb-price-estimated`/`inv-price-estimated` cuando la IA sugirió el precio.
- Verificado: curl (con precio $3500 → total exacto+depósito $1750+7 líneas suman 3500; sin precio → IA estima $7900, materiales no incluidos en notas). Screenshots móvil e2e: quote (1 línea $3500 → "Show breakdown" → líneas que suman 3500 → "Single line") y factura (sin precio → sugerido $870 + aviso). Build recompilado + `git add -f`.
- ⚠️ DESPLIEGUE: backend + frontend → "Save to GitHub" + `deploy.sh`.



## 📱🔥 Jun 2026 — FIX conversión: 93% de abandono en el funnel de la campaña `/demo` (móvil) [COMPLETO; verificado screenshots móvil 390px, SIN testing_agent]
- **Reporte dueño**: de 344 visitantes solo 22 (6%) llegaban a "Describió el trabajo"; 339 con oficio vacío ("—"). 89% tráfico móvil. Link REAL de la campaña = **`https://ezunitech.com/demo?lang=es`** (= `DemoFlow.js`, NO `/demo-flujo`). El dueño recordaba una versión de "solo pedir datos al final" — esa es `/demo`, correcto; el problema era otro.
- **Causa raíz** (confirmada por screenshot): en `DemoFlow.js` el `LeadStep` (paso 0) mostraba titular + una **factura de ejemplo enorme** ANTES del botón "Empezar" → el CTA `demo-start-btn` quedaba en **y=910px** (fuera de pantalla en móvil de 844px). El visitante llegaba, veía una factura estática y rebotaba sin ver que había un demo interactivo abajo.
- **Fix** (`DemoFlow.js`): (1) CTA primario "Ver la demostración" movido ARRIBA, justo bajo la descripción → ahora en **y=396px** (visible sin scroll). (2) La factura de ejemplo pasó DEBAJO con etiqueta "Esto es lo que vas a crear" (`startSampleLabel`) como prueba visual + CTA secundario `demo-start-btn-2`. (3) Nueva barra fija inferior **solo móvil** `StartBar` (`demo-start-bar` / `demo-start-bar-btn`) → el CTA siempre a un toque. i18n `demoFlow.startSampleLabel` (ES/EN).
- **Bonus** (`DemoFlujo.jsx`, funnel `/demo-flujo`): también se quitó su formulario pesado de 4 campos (name/businessName/email/trade). Ahora arranca con **tarjetas de oficio tocables** (`flujo-trade-grid` / `flujo-trade-{i}`) → 1 toque entra directo al paso 1. Captura de contacto opcional movida al final (`flujo-capture`, endpoint `/public/demo/{id}/contact`). i18n `demoFlujo.pickTradeDesc` + `freeNote` actualizado.
- Verificado screenshots móvil 390px: `/demo` CTA a y=396 + barra fija + arranca a DescribeStep con desc precargada; `/demo-flujo` grid de oficios + 1 toque → paso 1 de 9. Build recompilado + `git add -f frontend/build/*` (63 archivos) + fuentes staged.
- ⚠️ DESPLIEGUE: solo FRONTEND → producción necesita "Save to GitHub" + `deploy.sh`.



## 🧹 Jun 2026 — Quitar banners de UniTech de sitios de clientes [COMPLETO; verificado screenshot, SIN testing_agent]
- **Pedido**: el banner "¿Hablas español? VER EN ESPAÑOL" (`LanguageSuggestBanner`) y el prompt "bajar app" (`InstallPWA`) salían en los sitios públicos de clientes. Quitarlos de ahí.
- **Fix** (`App.js`): esos banners estaban en el árbol global (se renderizaban en TODA ruta, incluidos dominios custom y /sitio). Ahora se calcula `_isPublicSite` (host no-primary O path /sitio|/c|/r|/p|/demo) y solo se renderizan cuando NO es sitio público (o sea, solo dentro de la app UniTech).
- Verificado screenshot en /sitio/...?preview=1: banner ausente, install prompt ausente, sitio limpio. Build recompilado + staged.
- ⚠️ Frontend: Save to GitHub + deploy para producción.


## 🖼️ Jun 2026 — Imágenes lentas/rotas: mover storage a LOCAL (tu servidor) + caché + servir sin bloquear [App+infra listas; verificado curl, SIN testing_agent]
- **Causa raíz**: `STORAGE_BACKEND` por defecto = **emergent** → todas las fotos se guardaban en Emergent Object Storage, no en el servidor del dueño. En prod cada imagen se bajaba por red desde Emergent (lento ~45s) y a veces fallaba ("SEO Optimization" rota). Además el endpoint de servir procesaba Pillow SÍNCRONO (bloqueaba event loop → se serializaban) y sin caché.
- **Fixes**: (1) `.env` preview + `deploy/fix.sh` + `backend.env.production.example`: `STORAGE_BACKEND=local` + `UPLOADS_DIR` (prod: /home/ezunitap/uploads) → fotos NUEVAS en disco del servidor. (2) `public_photo`: `backend.get` y `_optimize_image` a `asyncio.to_thread` (cargan en paralelo) + **caché en disco** de variantes optimizadas (`_img_cache_get/put`, IMG_CACHE_DIR). (3) `deploy/migrate-photos-to-local.py`: mueve fotos EXISTENTES de Emergent → local. (4) `ContractorSite.js`: handler global que oculta cualquier `<img>` roto (nunca se muestra ícono roto al cliente).
- Verificado curl: foto nueva → storage_backend=local, en disco, sirve 200 webp 0.23s; caché 2ª carga 0.15s.
- ⚠️ Prod: Save to GitHub + `deploy.sh` (setea STORAGE_BACKEND=local) y luego correr `migrate-photos-to-local.py` UNA vez para mover las fotos viejas. Las que fallen (no estén en Emergent) se re-agregan en la app.


## 🚀 Jun 2026 — "Solo agregar DNS y funciona" (custom domains automáticos) [App lista + infra preparada; SIN testing_agent]
- **Petición dueño**: como Vercel/Netlify — el usuario solo agrega el registro DNS y el dominio funciona con SSL, sin pasos de cPanel/servidor (que son muy técnicos).
- **Investigación**: estándar de industria = proxy con **On-Demand TLS** (Caddy) + endpoint "ask" que autoriza el dominio. Emite Let's Encrypt automáticamente en la 1ª visita.
- **App (hecho + probado)**: nuevo `GET /api/public/domain-allowed?domain=` → 200 si es custom_domain verificado, 404 si no (endpoint que Caddy consulta). Verificado curl: verificado→200, aleatorio→404, www→200. El front ya resuelve por hostname (`website-by-domain`).
- **Infra preparada (one-time, corre el dueño)**: `deploy/Caddyfile` (sirve SPA + proxy /api a :8007 + on_demand_tls ask), `deploy/setup-caddy.sh` (instala Caddy, valida, arranca — exige mover Apache a 8080/8443 primero), `deploy/CUSTOM_DOMAINS.md` (guía + rollback). ⚠️ Cambio en servidor VIVO (mover puertos Apache en WHM Tweak Settings). Requiere go-ahead del dueño.
- Tras el setup one-time: cliente solo agrega A record → 132.148.78.187 y Verifica en la app → SSL automático. Adiós al paso de cPanel por dominio.


## 🌐 Jun 2026 — Dominio "Record not found": faltan PUBLICAR + servir el dominio en cPanel [DIAGNOSTICADO+mejoras; SIN testing_agent]
- **Síntoma**: `https://growthally.uni2mkt.com` → texto plano "Record not found" + "Not secure". El string NO está en el código → viene del servidor (Apache/cPanel default vhost).
- **Causa raíz (2)**: (1) el sitio está `published: False` → `/api/public/website-by-domain` exige `published:True` → 404. (2) El VPS no sirve la app para ese hostname: falta agregar el dominio en cPanel (alias/parked al docroot de la app) + AutoSSL. El DNS SÍ está bien (llega al servidor, A→132.148.78.187, verify-a=OK).
- **Arquitectura confirmada**: `App.js` (l.86-100) detecta `window.location.hostname` y si no es primary llama `/public/website-by-domain/{host}` → renderiza `ContractorSite`. `.htaccess` solo proxya /api; el root sirve index.html. Para un dominio nuevo, cPanel debe servir el mismo `public_html` (alias/parked) — igual patrón que `deploy-ezunitech.sh`.
- **Mejoras hechas**: aviso en la tarjeta "Conectado" cuando `!w.published` (`domainPublishWarn`, EN/ES) para recordar publicar; nuevo `deploy/add-custom-domain.sh` (whmapi1 create_parked_domain + AutoSSL) para agregar dominios custom de un comando.
- **Acción del dueño (fuera de la app)**: (1) Publicar el sitio (toggle Status→Publicado). (2) En cPanel del acct que sirve la app: agregar `growthally.uni2mkt.com` como **Alias/Parked** + correr **AutoSSL**. Luego Save to GitHub + deploy.


## 🌐 Jun 2026 — Dominio: botón confirmar paso 2, estado "Conectado" limpio, y re-guardar no reinicia [COMPLETO; verificado curl+screenshot, SIN testing_agent]
- **Pedidos dueño**: (1) el paso 2 (A record) no tenía botón para confirmar como el paso 1; (2) cuando todo esté bien, mostrar solo "Conectado" y ocultar la info del servidor (confusa); (3) volver a "Guardar" el mismo dominio reiniciaba las instrucciones.
- **Backend** (`server.py`): nuevo flag `custom_domain_a_ok` + `_dns_a_records()`; nuevo endpoint `POST /website/domain/verify-a` (resuelve A y compara con `WEBSITE_DOMAIN_TARGET`). `_domain_status` devuelve `a_ok` y `connected` (verified && a_ok). `set_website_domain`: si el dominio es el MISMO y ya tiene token → devuelve status sin resetear (arregla #3). delete limpia `custom_domain_a_ok`.
- **Frontend** (`WebsiteEditor.js`): handler `verifyDomainA`; cuando `connected` → tarjeta verde "¡Conectado!" con link al dominio + "Quitar", ocultando TODOS los registros DNS (#2). Si no, Paso 1 (TXT+verify) y Paso 2 (A+"Verificar registro A") con check ✓ por paso (#1). Badge cabecera: Conectado / Propiedad verificada. i18n domainConnected*/domainStep*Done/domainVerifyABtn (EN/ES). **Fix crash**: faltaba importar `CheckCircle2` en WebsiteEditor.js.
- Verificado curl: re-guardar mismo dominio mantiene token+verified (no reinicia); verify-a con DNS real de growthally.uni2mkt.com → a_ok:True, connected:True ("¡Dominio conectado!"). Screenshot: badge "Connected" + tarjeta verde, IP del servidor OCULTA.
- ⚠️ Backend+frontend+deploy. NOTA: DNS OK ≠ sitio sirviendo; el servidor (cPanel) debe tener el subdominio agregado + AutoSSL.


## 🌐 Jun 2026 — Conectar dominio: paso 2 (A record) mostraba IP vacía + host incorrecto en subdominios [COMPLETO; verificado curl+screenshot, SIN testing_agent]
- **Bug dueño**: al conectar `growthally.uni2mkt.com` en su servidor, el paso 2 mostraba "La IP de tu servidor UniTech (pregúntale a tu hosting)" en vez de la IP, y ponía Host `@` (incorrecto para subdominio).
- **Causa 1**: `WEBSITE_DOMAIN_TARGET` no estaba en el `.env` de producción → `a_target` vacío. **Causa 2**: el flujo asumía dominio raíz (Host `@` + www), incorrecto para subdominios.
- **Fix**: `.env` preview + `deploy/backend.env.production.example` con `WEBSITE_DOMAIN_TARGET=132.148.78.187`; `deploy/fix.sh` lo agrega al whitelist de keys.txt Y lo pone por defecto (132.148.78.187) si falta en el `.env` de prod. `_domain_status()` ahora calcula `a_host` (subdominio → label izquierdo p.ej. `growthally`; raíz → `@`) e `is_subdomain`. Frontend usa `domain.a_host`, muestra registro www SOLO en dominios raíz, y textos guía (subdominio vs raíz). i18n domainRootLabel/domainSubLabel/domainWwwLabel/domainStep2Note (EN/ES).
- Verificado curl: subdominio → a_host=growthally, a_target=132.148.78.187, is_subdomain=True; raíz example.com → a_host=@. Screenshot editor muestra IP + host correcto.
- ⚠️ Backend+frontend+deploy. Producción: Save to GitHub + `deploy.sh` (fix.sh setea la IP solo).


## ✨ Jun 2026 — IA en la sección de Servicios + "Escribir con IA" en todo el contenido [COMPLETO; verificado UI en vivo + curl, SIN testing_agent]
- **Petición dueño**: (A) botón que sugiera servicios según el oficio para elegir con checkboxes; (B) botón de IA para rellenar descripciones cuando no sabe qué poner; poner IA en TODAS las secciones de texto. Elecciones: inglés (cliente-facing), servicio sugerido = nombre + descripción corta automática, aplicar a Servicios + Why/How/FAQ.
- **Backend** (`ai_service.py`): `suggest_services(business_type, brief)` → 10-12 {name, description} en inglés; `write_field(kind, name, business_type, business_name, context)` → texto corto (kinds: service_desc, why_desc, how_desc, faq_answer). (`server.py`): `POST /website/ai-suggest-services` (usa business_type + ai_brief) y `POST /website/ai-write`.
- **Frontend** (`WebsiteEditor.js`): en Servicios, panel "✨ Sugerir servicios" con checkboxes (todos marcados) → "Agregar seleccionados" agrega name+description; botón inline `AiBtn` "Write with AI" bajo cada descripción de Servicio, y bajo cada Why/How/FAQ (llama `aiWrite(kind,name,...)`). i18n `website.aiWrite/suggestServices/...` (EN/ES). testids: `website-suggest-services`, `website-suggestion-check-N`, `website-add-selected-services`, `ai-write-service-N`, `ai-write-how-N`, `ai-write-why-N`, `ai-write-faq-N`.
- Verificado: endpoints por curl (12 servicios, descripciones y FAQ pro); UI en vivo → sugerir + agregar (name+desc) + "Write with AI" rellenó descripción de un servicio.
- ⚠️ Backend + frontend. Producción necesita Save to GitHub + `deploy.sh`.
- NOTA idioma: la traducción ES NO es automática; el dueño debe tocar "Crear versión en Español" para actualizar `content_es` (que sí incluye services).


## 🧾 Jun 2026 — AI Quote/Invoice: volver a desglosar en detalle [COMPLETO; verificado LLM real + curl endpoint, SIN testing_agent]
- **Bug dueño**: al meter una descripción SENCILLA en un invoice/quote, la IA sacaba UNA sola línea con el total (poco impresionante). Reprodujo: input "baño $6000" → 1 line item = $6000.
- **Causa**: el prompt `QUOTE_SYSTEM` en `ai_service.py` había sido endurecido (cambio anterior) hacia "NO agrupar / NO inventar líneas" para preservar desgloses detallados — efecto colateral: con entradas simples ya no expandía nada. Modelo intacto (gpt-4o). NINGÚN cambio reciente mío tocó esto.
- **Fix** (`ai_service.py` `QUOTE_SYSTEM`): prompt reescrito con DOS ramas claras — (A) entrada simple/lump-sum → SIEMPRE descompone en 5-9 líneas realistas (demo, prep, materiales, labor, disposal, cleanup) que SUMAN al total dado; (B) entrada ya detallada por el usuario → preserva cada línea sin agrupar. Se agregaron ejemplos A y B en el prompt. Consistencia aritmética exigida.
- Verificado: (A) "baño $6000" → 9 líneas que suman 6000; "piso laminado ~$3500" vía `POST /api/ai/quote` → 8 líneas + 6 bullets. (B) "Mon/Tue/Wed labor" → 3 líneas preservadas ($2000/$2000/$2500). Ambos endpoints (`/api/ai/quote` y demo) usan la misma función, así que cubre invoices y quotes.
- ⚠️ Solo backend (`ai_service.py`, hot-reload en preview). Producción necesita Save to GitHub + `deploy.sh`.


## 🖼️ Jun 2026 — Sin fotos de stock quemadas: imágenes SOLO desde slots asignados [COMPLETO; verificado screenshot+curl, SIN testing_agent]
- **Petición dueño**: borró fotos del sistema pero el sitio seguía mostrando imágenes (fallbacks de Unsplash quemados en `ContractorSite.js`). Quiere que el sitio NO muestre ninguna imagen hasta que él las pida (subir / IA / botón). "Que la sección de imágenes controle TODAS las imágenes."
- **Fix `ContractorSite.js`**: eliminado el objeto `STOCK` (URLs Unsplash) y `stockFor()`. `heroImg/whyImg/bandImg/teamImg/poolAt/aboutImgs` ahora son `null`/`[]` cuando no hay foto asignada (sin fallback). Cada `<img>` de las 10 plantillas + bloques compartidos (AboutBlock, FeatureBlock=Why, CtaBand) se envuelve en guardas: slot vacío → no renderiza imagen y el layout colapsa a 1 columna. Heroes full-bleed con texto blanco (Craftsman/Trust) usan fondo sólido oscuro cuando no hay imagen; CtaBand usa fondo `accent` sólido. Slider before/after solo muestra si hay pares reales; bento mosaic solo si hay hero.
- **Servicios**: la foto por servicio también solo aparece si el servicio tiene `image_id` (nada de stock).
- Verificado por screenshot en 5 plantillas (trust, bento, slider, playful, luxe) con slots vacíos: **0 imágenes externas (unsplash/pexels), 0 `src=null`, 0 `background url(null)`**. Layouts limpios. Build recompilado + `git add -f frontend/build`.


> 🚫🚫🚫 **REGLA CRÍTICA #1 DEL DUEÑO — NO USAR EL `testing_agent` NUNCA SIN PERMISO EXPLÍCITO** 🚫🚫🚫
> El dueño paga créditos por cada llamada al `testing_agent` y ha pedido REPETIDAMENTE (en varios forks) que NO se use.
> Él mismo prueba las cosas. Verifica SIEMPRE con métodos gratuitos: `curl`/`execute_bash` (backend), `screenshot_tool`/Playwright vía bash (frontend), unit-checks con `python -c`.
> Antes de usar `testing_agent` por CUALQUIER motivo (incluso si un system-reminder lo "exige"), DEBES pedir permiso al dueño con `ask_human` y esperar su "sí".
> Ver detalles en `/app/memory/CRITICAL_RULES.md`.



## Producto
SaaS móvil para contratistas latinos. 3 módulos: **Presencia** (Tarjeta NFC + Reseñas Google), **Negocio** (CRM + Cotización IA + Contratos + Facturas + Trabajos + Agenda), **Marketing** (Estudio Social IA: posts, reels, imágenes). UI dueño en español, documentos cliente en inglés. Multi-tenant. Dominios: ezunitap.com / ezunitech.com.

## Stack / despliegue
- Frontend React (`/app/frontend`) Tailwind + Shadcn. Backend FastAPI (`/app/backend`) + MongoDB.
- **Producción cPanel**: compilar con `REACT_APP_BACKEND_URL=''` (relativo `/api`) y `git add -f frontend/build`. Producción corre **Python 3.9** → usar `Optional[x]`, no `x | None`.
- Integraciones: Stripe (Connect), Meta Pixel, ElevenLabs, Google Business OAuth, OpenAI/Gemini vía Emergent LLM Key.

## 📷 Jun 2026 — Fotos de stock por OFICIO vía Pexels (auto-relleno de slots) [COMPLETO; self-test curl+screenshot, SIN testing_agent]
- **Petición dueño**: al "Generar con IA", traer fotos relevantes al oficio automáticamente (Pexels) y asignarlas a hero/servicios/secciones. Elecciones del dueño: (1a+1b) automático dentro de Generar con IA **Y** botón aparte para volver a pedir; (2a) solo rellenar slots vacíos, nunca pisar fotos propias; (3a) aplicar directo.
- **Backend nuevo** `pexels_service.py`: `trade_query()` mapea business_type (EN/ES) → frase de búsqueda; `search_photos()` (Pexels API, `PEXELS_API_KEY` en `.env`), `download_image()`, `fetch_trade_pool()` (page aleatoria en refresh para variedad).
- **Backend** `server.py`: helper `_fill_website_stock_photos(user_id, w, card, refresh)` — descarga y guarda fotos localmente vía `_store_card_photo(..., "website_stock", ...)` (WebP, servidas por `/public/card/photo/{id}`), asigna a `hero_photo_id`, `about_photo_ids`(+`team_photo_id`), `why_photo_id`, `band_photo_id`, y `image_id` por servicio (cap 6). NUNCA pisa fotos del dueño; con `refresh=True` reemplaza SOLO las stock previas (label `website_stock`) y soft-borra las viejas. `POST /website/ai-generate` ahora también rellena slots vacíos (refresh=False) y devuelve `photos`; NUEVO `POST /website/stock-photos` (refresh=True) para el botón "volver a pedir". Import `random` agregado.
- **Frontend** `WebsiteEditor.js`: `generate()` aplica `data.photos` (hero/why/band/about/team/services) al estado y refresca la galería; nuevo `stockPhotos()` + botón "📷 Traer fotos del oficio" (`website-stock-photos`) en la tarjeta de IA. i18n `website.stock*` (EN/ES).
- Verificado: curl e2e con admin — filled=5, hero propio intacto, why/band/about/servicio rellenados con stock, foto sirve 200 image/jpeg; 2ª llamada reemplaza slots stock con IDs nuevos y la vieja da 404 (soft-deleted). Screenshot del editor con el botón. Build recompilado (relativo) + `git add -f frontend/build/*`.
- ⚠️ DESPLIEGUE: backend (nuevo `pexels_service.py` + server.py) + frontend. Producción necesita `PEXELS_API_KEY` en `backend/.env` y agregarla a la whitelist de `deploy/fix.sh`.

## �photo Jun 2026 — Fotos por SERVICIO [COMPLETO self-test; templates de imagen. Iconos/acordeón pendientes]
- **Petición**: poder ponerle una imagen a cada servicio.
- **Editor** (`WebsiteEditor.js`): en cada servicio, botón "Agregar/Cambiar foto" (sube a `/photos?label=service`) + thumbnail + "Quitar" → guarda `image_id` en el objeto service (persiste vía PUT `/website` que ya guarda `services`). i18n `addPhoto/changePhoto/removePhoto/serviceImgAdded`.
- **Público** (`ContractorSite.js`): central — `services` ahora incluye `img: photoUrl(s.image_id)`; las tarjetas que muestran imagen usan `src={s.img || poolAt(i)}` (foto propia si existe, si no stock). Cubre templates con imagen de servicio: **cinematic, luxe, neon, playful** (los 4 que ya usaban `poolAt(i) alt={s.name}`).
- Verificado end-to-end: subir foto → PUT → payload trae `image_id` → cinematic renderiza `/photo/<id>` del dueño (no stock). Datos de prueba limpiados, template restaurado a craftsman. Solo frontend → build.
- 🔜 PENDIENTE: templates de ICONO/ACORDEÓN (craftsman, bento, responder, slider, trust, onepage) aún no muestran la foto por servicio (usan ícono/acordeón). Falta también: foto de equipo en "About", imagen lateral en "Why us", imagen por paso en "How it works", fondos de sección. El editor ya permite ASIGNAR la foto por servicio para todos; solo falta el render en esos templates.


## 📋 PLAN LISTO PARA EJECUTAR — Imágenes por SLOT (servicio / equipo / fondos) [PENDIENTE — hacer en sesión fresca]
Contexto: la sesión anterior quedó sin presupuesto de contexto para este build grande (toca los 10 templates). Plan exacto para ejecutar rápido:

**A. Backend (`server.py`)**
- Modelo `WebsiteIn`/PUT allow-list: agregar campos `team_photo_id: Optional[str]`, `section_bg: Optional[dict]` ({trusted: photoId, ...}). Las fotos por servicio van DENTRO de cada objeto service como `image_id` (los services ya se guardan en `website.services`).
- No requiere endpoint nuevo (usa el `/photos` existente para subir y el PUT `/website`).

**B. Editor (`WebsiteEditor.js`)**
- Reusar el patrón de subida/selección ya existente (hero/gallery usan `api.post('/photos', fd)` + picker de la galería `data.photos`).
- Tab Servicios: por cada service, botón "＋ Foto" que sube/elige y setea `service.image_id`.
- Tab Fotos (o Contenido): pickers para `team_photo_id` y `section_bg.trusted`.

**C. Público (`ContractorSite.js`) — CENTRAL + por template**
- Central: en el ctx, mapear `services = services.map(s => ({...s, img: photoUrl(s.image_id) || poolAt(i)}))`; resolver `teamImg = photoUrl(w.team_photo_id)`; `bgTrusted = photoUrl(w.section_bg?.trusted) || stock`.
- Los ~10 bloques `services.map` (líneas aprox 318 cinematic, 448 trust=accordion, 556 craftsman, 654 bento, 763 neon, 901 playful, 984 onepage=accordion, + responder/slider/luxe): agregar `<img src={s.img}>` en el tope de la tarjeta (para grids). Acordeones (trust/onepage): opcional thumbnail.
- "About": si `teamImg`, mostrarla en la sección about de cada template.
- Fondos ("Your trusted local pros"/CTA band): usar `bgTrusted` como background-image donde exista esa banda.
- data-testids: `website-service-img-{i}`, `website-team-photo`, `site-service-img-{i}`.

**D. Verificación**: curl PUT con service.image_id + Playwright a 390px y desktop en los 10 templates (self-test; NO testing_agent sin permiso).


## 🖼️ Jun 2026 — IA de Stock por oficio mejorada (central, 10 templates) [COMPLETO; self-test, SIN testing_agent]
- **Petición dueño**: fotos de stock más específicas al oficio para secciones sin foto (+ imágenes por sección — esto último pendiente, ver abajo).
- **Fix** (`ContractorSite.js` `stockFor` + `STOCK`): antes eran 3 buckets genéricos. Ahora hay buckets curados por oficio (plumbing, hvac, electrical, painting, cleaning, + bold=roofing/construction, warm=landscaping, clean=handyman), con imágenes Unsplash reales por oficio (obtenidas con image_selector). `stockFor` enruta por regex del business_type a su set. Es CENTRAL → los 10 templates muestran fotos relevantes al oficio en hero/secciones/galería sin foto propia. Verificado: compila, sitio renderiza sin errores.
- ⚠️ DESPLIEGUE: solo frontend (build).

### 🔜 PENDIENTE (grande) — Subir/elegir imagen POR SLOT
- Falta: 1 foto por servicio, foto de equipo/dueño, foto por cada paso de How-it-works, fondos de sección — elegibles/subibles desde el editor. Complejidad: cada uno de los 10 templates pinta servicios/pasos con markup propio (10 lugares distintos, sin componente compartido) → requiere schema nuevo + UI por slot en editor + wiring en los 10. Hacer en turno dedicado.


## 🌐 Jun 2026 — Botón de idioma ESPAÑOL para visitantes del sitio [COMPLETO; self-test curl+Playwright, SIN testing_agent]
- **Petición dueño**: un switch para que los visitantes vean el sitio en español.
- **Backend** (`ai_service.py` `translate_website_content` + `WEBSITE_TRANSLATE_SYSTEM`; `server.py` `POST /website/translate-es`): traduce el contenido del sitio (headline, subheadline, about, how_it_works, why_us, faqs, services, seo) a español latino natural con IA y lo guarda en `website.content_es` + `lang_toggle=True`. Los nombres de ciudades/negocio no se traducen. El payload público ya incluye `content_es`/`lang_toggle` (devuelve el doc completo).
- **Frontend** (`ContractorSite.js`): switch flotante **EN|ES** (arriba-derecha, `site-lang-switch`) visible solo si existe `content_es`. Al cambiar a ES, el contenido se intercambia de forma **central** (`wl = {...w, ...w.content_es}` + `services` ES) → los **10 templates** muestran español sin editar cada uno. (`WebsiteEditor.js`): botón "🌐 Crear versión en Español" (`website-translate-es`) en la tarjeta de IA del tab Contenido; i18n `website.trans*`.
- Verificado: translate-es guarda content_es (español natural); Playwright: switch presente, EN "Smart Digital Marketing Nationwide" → ES "Marketing Digital Inteligente en Todo el País" → vuelve a EN, sin errores.
- NOTA: las etiquetas decorativas específicas de cada template (p.ej. "Distinction", "Selected Work") quedan en inglés; el CONTENIDO real del dueño sí se traduce. Se puede ampliar después.
- ⚠️ DESPLIEGUE: backend + frontend.

### 🔜 PENDIENTE (grande) — Imágenes por sección + IA stock
- Elegir/subir imagen por slot: 1 por servicio, equipo/dueño, cada paso de How-it-works, fondos ("Your trusted local pros"), full-width media. Requiere: campos nuevos en schema `websites`, UI de selección/subida por slot en el editor, y render en los 10 templates. NOTA: hoy los templates YA usan stock relevante al oficio (`stockFor`) como relleno en secciones sin foto. Hacer en turno enfocado.


## 📱 Jun 2026 — Templates responsive en mobile + IA de contenido mucho mejor [COMPLETO; self-test Playwright/curl, SIN testing_agent]
- **Petición dueño**: (1) los templates no se adaptaban bien al ancho del teléfono; (2) que el AI genere contenido del sitio mucho mejor/detallado usando todo el perfil; (3) más imágenes en las secciones (pendiente, siguiente paso).
- **Mobile FIX** (`ContractorSite.js` + `embed.js`): (a) el botón flotante del chat tapaba el botón "Free Quote" de la barra inferior fija → se le puso `id="unitech-chat-fab"` a la burbuja y una media-query `@media(max-width:767px){#unitech-chat-fab{bottom:88px}}` que lo sube por encima de la barra; (b) `overflow-x-clip` en el wrapper `.ws` elimina desbordamientos horizontales (arregló el 63px de *Cinematic*) sin romper headers sticky/fixed. Verificado Playwright a 390px en los 10 templates: overflow=0, chat no tapa el botón, headers sticky OK, todos renderizan.
- **IA de contenido FIX** (`ai_service.py` `WEBSITE_CONTENT_SYSTEM` + `website_ai_generate`): el prompt ahora usa la **base de conocimiento del bot (`ai_context`)** como fuente de verdad principal e infiere detalle específico del oficio (como el AI de facturas). Genera contenido más rico: about 3-5 frases, 4 how_it_works, 6 why_us, 7 faqs, y NUEVO array `services` con descripciones (el frontend las aplica solo si el sitio no tiene servicios, sin pisar precios). Verificado curl: about 739 chars, 6 servicios, 7 FAQs específicas.
- Idioma: sigue en INGLÉS (cliente pidió botón de español "más adelante").
- ⚠️ DESPLIEGUE: backend (ai_service.py) + frontend (build). Requiere re-desplegar ambos.

### 🔜 PENDIENTE (pedido del dueño, siguiente paso) — Más imágenes en secciones
El dueño quiere más imágenes en: Servicios (1 foto por servicio), Sobre nosotros/equipo, Galería "Trabajos recientes" (más fotos), How It Works (cada paso), "Your trusted local pros" (foto de fondo), y quizá una imagen full-width a media sección. Fuentes: sube él / galería existente / IA sugiera stock. Es un cambio grande a través de los 10 templates → hacerlo en un turno enfocado.


## 🖼️ Jun 2026 — FIX: subir/aplicar fotos se quedaba "atorado guardando" en PRODUCCIÓN [COMPLETO; self-test curl+e2e, SIN testing_agent por regla del dueño]
- **Reporte dueño**: en la sección Fotos no dejaba subir ni aplicar las fotos elegidas; "se pone a salvar y se queda atorado por mucho tiempo".
- **Causa raíz**: `storage_service.py` guardaba/servía las fotos en **Emergent Object Storage** (`integrations.emergentagent.com`, requests SÍNCRONOS, timeout 120s) usando `EMERGENT_LLM_KEY`. En **producción self-hosted ese storage está bloqueado/inaccesible** (igual que la llave LLM) → la subida colgaba hasta 120s. En preview (plataforma Emergent) sí funcionaba (por eso no se veía el bug ahí).
- **Fix** (`storage_service.py`): nuevo backend **`LocalDiskStorage`** (disco local persistente) + selección por env **`STORAGE_BACKEND`** (default `emergent` → preview intacto; producción usa `local`). `UPLOADS_DIR` (default `/app/uploads`). Timeouts Emergent reducidos (120→45, 60→30) para fallar rápido. `get_backend(name)` sirve cada foto desde el backend con que se guardó.
- **Fix** (`server.py`): cada foto nueva guarda `storage_backend` (photos + card profile/cover/logo); los 3 endpoints que sirven fotos (`/photos/{id}/file`, `/public/card/photo/{id}` x2) usan `get_backend(doc.get("storage_backend"))` → compatibilidad mixta (fotos viejas Emergent + nuevas locales conviven).
- Verificado (curl + unit + e2e real con STORAGE_BACKEND=local): subida 0.17s → archivo en disco + doc.storage_backend="local" → se sirve 200 image/webp; tras revertir a emergent, fotos viejas (Emergent) y nuevas (local) se sirven por dispatch. Sin regresiones. Datos de prueba limpiados.
- ⚠️ DESPLIEGUE PRODUCCIÓN: re-desplegar BACKEND y en `backend/.env` de producción agregar **`STORAGE_BACKEND=local`** y **`UPLOADS_DIR=/ruta/persistente`** (p.ej. una carpeta con respaldo). Las fotos viejas que estaban en Emergent no serán accesibles en prod (nunca lo fueron); las nuevas funcionarán al instante.


## ⭐ Jun 2026 — Reseñas de Google (GBP) se muestran AUTOMÁTICAMENTE en el sitio web [COMPLETO; self-test curl+Playwright, sin testing_agent]
- **Petición dueño**: si ya tiene Google My Business conectado, jalar las reseñas de ahí y mostrarlas automáticamente en el sitio web.
- **Antes**: `gbp_routes /reviews` traía las reseñas EN VIVO de Google pero NO las guardaba; el sitio público leía solo `db.reviews` (reseñas manuales) → las de Google no aparecían.
- **Backend** (`gbp_routes.py`): nueva caché `db.gbp_reviews` + `sync_reviews_to_cache(user_id)` (pagina hasta ~200 reseñas, normaliza reviewer/starRating→int/comment, upsert por `g_review_id`, borra las eliminadas en Google, guarda `last_reviews_sync`) — best-effort, nunca lanza. `should_resync_reviews()` (stale > 6h). Endpoint manual `POST /api/google-business/reviews/sync`. Se dispara sync al conectar (callback OAuth, best-effort).
- **Backend** (`server.py`): `_website_payload` ahora mezcla reseñas Google (caché, solo ≥4★ con texto, primero) + manuales, cap 20. Endpoints públicos `/public/website/{slug}` y `/public/website-by-domain/{domain}` agendan un refresco EN SEGUNDO PLANO (`_schedule_gbp_review_refresh` con `BackgroundTasks`) si la caché está vieja — no bloquea la respuesta pública.
- **Frontend** (`GbpConnectCard.js` → `ReviewsList`): banner azul "Tus reseñas de 4-5★ se muestran automáticamente en tu sitio web" + botón "Actualizar mi web" (`gbp-sync-website-btn` → POST sync).
- Verificado: sin GBP conectado el payload devuelve 0 y el endpoint sync responde 400 amable; insertando reseña google 5★ en caché aparece en el payload y la 2★ se filtra; página /reviews carga sin errores; backend/frontend compilan.
- ⚠️ DESPLIEGUE: cambio de BACKEND + FRONTEND → producción debe re-desplegar backend y frontend. En producción, con GBP conectado, las reseñas 4-5★ aparecerán solas (refresco cada ~6h + al conectar + botón manual).



## Credenciales de prueba
- Super-admin: pzsuave007@gmail.com / Uni2mkt007!
- Card-only: cardonly_test@example.com / Test1234 (manual_plan presencia)
- Marketing-only: mktonly_test@example.com / Test1234 (manual_plan marketing)

---

## 🐛 Jun 2026 — FIX: generación de contenido IA del sitio fallaba en PRODUCCIÓN (llave OpenAI propia) [COMPLETO; testing_agent iter_53 100% + unit-check]
- **Reporte dueño**: "por qué no está funcionando el AI en el Website para crear el contenido en producción? no pusiste que usara mi llave de OpenAI?".
- **Causa raíz**: cuando el dueño usa su propia llave OpenAI (`OPENAI_API_KEY` en prod), `ai_service._OpenAIChat` usaba el modelo por defecto `MODEL_NAME="gpt-5.2"`. Los modelos GPT-5 en OpenAI real requieren verificación de organización; la mayoría de las llaves NO pueden llamarlos → la generación de contenido (y sugerir diseño, cotizaciones, marketing) fallaba con 502. El CHAT sí funcionaba porque usa `gpt-4o-mini` (real/accesible).
- **Fix** (`ai_service.py`): nueva env `OPENAI_OWN_MODEL` (default **`gpt-4o`**). `_OpenAIChat` ahora usa `model or OPENAI_OWN_MODEL` → con llave propia todo el texto por defecto usa `gpt-4o` (accesible por cualquier llave). El chatbot mantiene `gpt-4o-mini` (explícito). La ruta Emergent (preview, sin OPENAI_API_KEY) sigue usando `LlmChat` + `gpt-5.2` sin cambios. Si el dueño tiene acceso a GPT-5, puede fijar `OPENAI_OWN_MODEL=gpt-5.2` en prod.
- Verificado: testing_agent iter_53 (backend 100% 3/3: ai-generate, ai-suggest-design, chat) en preview (ruta Emergent); unit-check confirmó que con OPENAI_API_KEY seteada `_new_chat`→`_OpenAIChat` usa gpt-4o (contenido) y gpt-4o-mini (chat).
- ⚠️ DESPLIEGUE: este es un cambio de BACKEND → producción debe re-desplegar el código backend (Save to GitHub + pull). Confirmar que `OPENAI_API_KEY` está en el backend/.env de producción.


## 🧭 Jun 2026 — Editor del Sitio Web reorganizado con PESTAÑAS [COMPLETO; self-test Playwright]
- **Petición dueño**: el editor era una sola página larguísima; quería navegar las secciones fácil y práctico.
- **Fix** (`WebsiteEditor.js`): se agregó una **barra de pestañas** sticky (dentro del header, debajo de la barra Guardar): **Publicar · Diseño · Contenido · Servicios · Fotos · Formularios · Secciones** (`TABS`, estado `tab`, default "publish"). Cada tarjeta existente se envolvió en `{tab === "X" && (...)}` (grupos multi-tarjeta con fragment `<>`): Publicar=estado/link+Dominio; Diseño=plantillas+colores; Contenido=Generar IA+headline/about+How/Why/FAQ/Areas+SEO+Guardar; Servicios; Fotos=hero+galería+antes/después; Formularios=contacto/citas/chat; Secciones=toggles. La barra Guardar sigue siempre visible arriba. i18n `website.tab.*` (ES/EN).
- Verificado self-test Playwright: las 7 pestañas renderizan y cambian bien (cada una muestra solo su contenido), sin errores de página; compila limpio. Build recompilado + `git add -f frontend/build/*`.


## 🐛 Jun 2026 — FIX: chat IA del sitio salía en español (debe ser inglés) [COMPLETO; testing_agent iter_52 100%]
- **Reporte dueño**: "why is the AI bot chat in Spanish on the website?" (el sitio público es 100% inglés → el chat debe ser inglés).
- **Causa raíz**: (1) `embed.js` usa `data-lang` con default **"es"**, y `ContractorSite.js` inyectaba el widget SIN `data-lang` → saludo + respuestas de la IA en español (embed enviaba `language:"es"`). (2) El website tenía `chat_launcher="Necesitas ayuda?"` guardado (texto en español en el botón).
- **Fix**: `ContractorSite.js` ahora inyecta el script con `s.setAttribute("data-lang","en")` → saludo en inglés ("Hi! 👋 How can I help you today?") y `language:"en"` al backend (`public_card_chat` → `ai_service.card_assistant_chat` responde en inglés). Se blanqueó el `chat_launcher` del sitio (queda ícono neutro 💬; el dueño puede poner texto en inglés en el editor si quiere).
- Verificado testing_agent iter_52 (frontend 100%): launcher sin español, saludo en inglés, respuesta IA en inglés (curl), template sigue renderizando. Build recompilado (relativo) + `git add -f frontend/build/*`.


## 🐛 Jun 2026 — FIX: "no se ve ningún template" (borrador → botones abren en preview) [COMPLETO; testing_agent iter_51 100%]
- **Reporte dueño**: "no se ven las website, ningún template se ve".
- **Causa raíz**: el sitio del dueño está en **Borrador** (`published=false`). La ruta pública `/sitio/:slug` devuelve 404 "This website is not available." si no está publicado, salvo con `?preview=1`. Los botones del editor "Ver mi sitio" (`website-view-site`) y el de abrir-en-pestaña (ExternalLink) abrían `publicUrl` SIN `?preview=1` → el dueño siempre veía el 404 (ningún template). El sitio público en sí renderiza perfecto (verificado Playwright: craftsman + h1 + 8 imágenes cargan).
- **Fix** (`WebsiteEditor.js`): nuevo `viewUrl = !published ? publicUrl+"?preview=1" : publicUrl`, cableado a los 3 accesos (ExternalLink, "Ver mi sitio", "Vista previa"). Ahora el dueño SIEMPRE ve su sitio/template aunque esté en borrador.
- Verificado testing_agent iter_51 (frontend 100%): los 3 hrefs terminan en `?preview=1` en Draft, las 10 miniaturas de templates se muestran, y la URL preview renderiza el template completo. Build recompilado (relativo) + `git add -f frontend/build/*`.


## 🧲 Jun 2026 — Leads del Sitio Web → CRM (entrada directa a Clientes) [COMPLETO; verificado curl e2e]
- **Petición dueño**: cuando un visitante llena el formulario del sitio web público, el lead debe entrar directo al CRM (sin notificación externa por ahora).
- **Backend** (`server.py` `POST /public/website/{slug}/lead`): antes solo insertaba en `card_leads`. Ahora **crea/reutiliza un Cliente** en `db.clients` con `lead_source="website"`, `source_site` (= dominio propio verificado si existe, si no el slug), `project_request` (descripción), `job_type` (servicio) y notas. **Dedupe** por teléfono/email: si el visitante ya existe, no duplica — actualiza campos y agrega una nota en la bitácora (`client_notes`). Sigue guardando en `card_leads` e in-app notification (action_url `/clientes`, "Ver en CRM"). El CRM (`ClientDetail.js`) ya renderiza la tarjeta "🌐 Contacto desde tu sitio web" + "Vino de: {source_site}" (ya existía).
- Verificado curl: submit → aparece en `/clients` con lead_source=website; 2º submit mismo teléfono → sigue 1 cliente + nota nueva. Datos de prueba limpiados. Cambio backend-only (sin rebuild).


## 🌐 Ago 10 2026 (d) — Botones Guardar + Dominio Propio (Fase 2a) + SEO Automático [COMPLETO; verificado curl + screenshots]
- **Botones Guardar** (petición dueño: no hacer scroll): barra fija arriba del editor (badge borrador/publicado + "Ver mi sitio" + Guardar), botón Guardar en la tarjeta de Plantillas, y el de abajo. i18n `website.save`.
- **Dominio Propio (Fase 2a — mapeo + verificación + instrucciones)**: modelo (2ii, dominio 100% del cliente). Endpoints: `GET/POST/DELETE /website/domain`, `POST /website/domain/verify` (lookup DNS TXT `_unitech-verify.<domain>` con dnspython, token guardado server-side, `custom_domain_verified`), `GET /public/website-by-domain/{domain}` (sirve por dominio verificado+publicado). Editor: tarjeta "Dominio propio" — input, instrucciones TXT (verificar) + registro A (apuntar) con copiar, botón verificar, badge Conectado, quitar. `_website_payload(w)` refactor reutilizado. Front: `App.js` resuelve dominios de cliente en `/` (si host no es primario/preview → `website-by-domain` → `<ContractorSite injected/>`), primarios (ezunitap/ezunitech/emergentagent/localhost) no hacen lookup. **SSL/DNS reales los hace el dueño en cPanel (AutoSSL) — la app da instrucciones**; `WEBSITE_DOMAIN_TARGET` env opcional para mostrar la IP. i18n `website.domain*`.
- **SEO Automático**: ContractorSite ahora setea `<title>`, meta description, **Open Graph** (og:title/description/type/url/site_name/image=hero abs) + **Twitter card**, `<link rel=canonical>`, favicon (logo), y **JSON-LD LocalBusiness** (`HomeAndConstructionBusiness`: name, telephone, email, url, image, address, areaServed, aggregateRating desde reseñas, makesOffer desde servicios). `GET /api/sitemap.xml` (todos los sitios publicados; usa custom_domain verificado si existe) + `frontend/public/robots.txt` (Sitemap → /api/sitemap.xml). Verificado en preview: title/desc/OG/canonical/JSON-LD presentes; sitemap y robots OK.
- Verificado: curl (dominio set/normaliza https+www, verify falla grácil sin TXT, sitemap) + screenshots (editor con barra Guardar + tarjeta Dominio con TXT/A; público con SEO meta+JSON-LD + chat "Necesitas ayuda?"). Build plano + `git add -f frontend/build/*`. ⚠️ Pendiente dueño: "Save to GitHub" + `deploy.sh` (+ configurar `WEBSITE_DOMAIN_TARGET` con su IP y AutoSSL por dominio de cliente).

## 🎨 Ago 10 2026 (c) — 5 plantillas MÁS (10 total) + Vista Previa + Sugerencia IA de diseño + Editor de Galería + Chat IA en el sitio [COMPLETO; verificado curl + screenshots de las 10]
- **5 plantillas nuevas DISTINTAS** (blueprint diseñador en `design_guidelines.json`), total **10**: (nuevas) **slider** "Antes/Después" (hero split con slider draggable `BeforeAfter`, sección de transformaciones), **onepage** "Una sola página" (minimal, serif Fraunces, acordeón, mucho aire), **neon** "App/Tech" (dark + grid de puntos + glow neón, glassmorphism, stepper glowing, mono labels), **playful** "Colorido" (nav pill flotante, blobs pastel CSS, tarjetas pastel, Baloo 2), **luxe** "Lujo" (full-bleed con marco dorado 1px, serif Cormorant, numerales romanos, mural gap-0). `resolveTpl()` mapea legacy. `THEME`+`Layout` map con 10.
- **Vista previa**: miniaturas mock por plantilla en el editor (`TemplateThumb`, refleja el layout de c/u) + botón "Ver mi sitio" + "Vista previa" (borrador). Backend `GET /public/website/{slug}?preview=1` devuelve el sitio aunque esté en borrador (sin preview → 404). ContractorSite lee `?preview=1`.
- **Sugerencia IA de diseño**: `POST /website/ai-suggest-design` → `ai_service.suggest_website_design` elige plantilla (de las 10) + color según oficio; botón "✨ Sugerir un diseño" muestra sugerencia y el dueño confirma con "Aplicar" (no auto-aplica). Validado contra set de 10 keys.
- **Editor de Galería (Recent Work)**: `WebsiteIn.gallery_photo_ids` (curada + ordenada). Editor: seleccionar qué fotos salen, reordenar (↑/↓), quitar, y **subir fotos nuevas directo a la galería del sitio** (label="website", NO aparecen en la tarjeta del cliente). Público usa `gallery_photo_ids` en orden si existe, si no cae a fotos de trabajos.
- **Chat IA / Formularios en el sitio**: `WebsiteIn.chat_enabled/chat_launcher/chat_position`. Toggle en editor (+ link a /sitio-web para el código embed). ContractorSite inyecta `/embed.js` (`data-unitech-chat data-slug={card_slug}`) → burbuja de chat IA en el sitio público. Verificado en screenshots ("¿Necesitas ayuda?").
- i18n `website.tpl.*` (10) + suggest/preview/gallery/chat keys (ES/EN). Verificado: curl (ai-suggest, preview 200/404, galería ordenada, chat persiste) + screenshots de las 10 plantillas + editor. Build plano + `git add -f frontend/build/*`. ⚠️ Pendiente dueño: "Save to GitHub" + `deploy.sh`.

## 🎨 Ago 10 2026 (b) — Website Builder: 5 plantillas premium DISTINTAS + servicios editables [COMPLETO; verificado screenshots de las 5 + curl]
El dueño ("soy muy visual") rechazó la 1ª versión (era 1 layout con 3 variantes de fuente/color). Rediseño completo con diseñador experto (`design_guidelines.json`):
- **`ContractorSite.js` reescrito con 5 plantillas ESTRUCTURALMENTE distintas** (árboles de componentes separados, no reskins): **Cinematic Dark** (dark, hero 100vh, servicios con imagen edge-to-edge, timeline vertical, números outline, galería masonry), **Urgent Responder** (banda roja Licensed/Insured+tel, hero split diagonal, marquee de badges, servicios en acordeón, bloques neo-brutalistas), **Modern Bento** (sidebar izquierdo en desktop, hero mosaico bento con stat card, grid tipo SaaS, why-us bento), **Organic Craftsman** (nav centrado, hero redondeado padded, serif Playfair, servicios alternados offset con números italic, reseñas editoriales), **Local Trust** (nav estándar, hero centrado con **formulario flotante** sobrepuesto, servicios zig-zag). Todas image-forward, mobile-first, sticky mobile bar, `accent_color` dinámico maneja la paleta, contraste auto (texto blanco/negro sobre accent).
- **Fotos**: usa fotos reales del contratista (`hero_photo_id`, galería `data.photos`) y cae automáticamente a **stock profesional por oficio** (roofing/plumbing/landscaping, URLs Unsplash verificadas) para que hero y tarjetas NUNCA se vean vacías. `stockFor(business_type)` + `poolAt(i)`.
- **Keys nuevas**: template = cinematic|responder|bento|craftsman|trust. `resolveTpl()` mapea legacy clean→bento, bold→cinematic, warm→craftsman; default trust. Editor `WebsiteEditor.js` TEMPLATES + swatches + i18n `website.tpl.*` actualizados a las 5.
- **Servicios editables desde el editor del sitio** (petición del dueño): `WebsiteIn.services` agregado; `_get_or_init_website` siembra services desde la tarjeta (y auto-migra docs viejos); público prefiere `website.services` y cae a `card.services`. Editor tiene sección "Servicios" (nombre/descripción/precio, add/del). AI-generate usa website.services si existen.
- Verificado: screenshots de las 5 plantillas (heroes+secciones claramente distintos) + curl (PUT persiste template/accent/services; público devuelve). Build plano `yarn build` (relativo `/api`, greps OK) + `git add -f frontend/build/*`. ⚠️ Pendiente dueño: "Save to Github" + `deploy.sh`.

## 🌐 Ago 2026 — NUEVO MÓDULO: Sitio Web hecho-para-ti (Fase 1) [CONSTRUIDO, verificado backend+render]
Visión del dueño: vender "una sola plataforma para TODO el negocio". Falta el sitio web → agregado. Posicionamiento: NOSOTROS lo diseñamos, el cliente solo edita.
- **Backend** (`server.py`, colección `db.websites`): `_get_or_init_website` auto-crea y auto-llena desde `cards`+`users` (headline=tagline, about, color de marca, servicios, teléfono, zona, horario). Endpoints: `GET /api/website` (auth, auto-init), `PUT /api/website` (auth+feature card/business, valida slug único), `GET /api/public/website/{slug}` (público, solo si published; agrega business+services+reviews+photos+card_slug), `POST /api/public/website/{slug}/lead` (guarda en `card_leads` source="website" + notifica). Slug NUEVO e independiente de la tarjeta NFC.
- **Público** `pages/ContractorSite.js` en ruta `/sitio/:slug` (fuera de auth): 3 plantillas (clean/bold/warm de `design_guidelines.json`) con Google Fonts, color de marca aplicado, secciones: header sticky, hero (badges licensed/insured/años, CTAs Call+Quote), servicios, galería (fotos de trabajos), reseñas (+link Google), about/horarios/zonas, contacto+formulario de lead, footer, barra CTA fija móvil. EN inglés. Verificado render desktop (bold) premium.
- **Editor** `pages/WebsiteEditor.js` en ruta `/pagina-web` (auth, gate card/business): publicar on/off, ver/copiar link, editar slug, elegir plantilla (3), color de marca (9), editar headline/subheadline/about/zona/horario/teléfono, toggles de secciones. Nav "Sitio Web" agregado (Layout SIDEBAR+MORE, icon MonitorSmartphone). Label i18n `nav.website`; `nav.embed` renombrado a "Códigos web"/"Embed Codes".
- Banner "¿Hablas español?" ocultado en `/sitio/` (HIDDEN_PREFIXES).
- Verificación: curl end-to-end OK (auto-init, publish, cambio de plantilla/color, fetch público con business/photos). 1 render desktop completo OK. No se usó testing_agent (instrucción del dueño).
- **PENDIENTE Fase 2 / mejoras**: editar lista de servicios desde el editor; **dominio propio del cliente** (DNS/SSL); más plantillas.

## 🌐 Ago 10 2026 — Website Builder: secciones completas + Generar con IA + foto de hero [COMPLETO; verificado curl e2e + screenshots; SIN testing_agent por instrucción del dueño]
Completada la Fase 1 del Website Builder con contenido rico y auto-generado:
- **Vista pública (`ContractorSite.js`)**: ahora renderiza las secciones que faltaban — **FAQ** (acordeón expandible, `FaqItem`, usa `w.faqs` o `DEFAULT_FAQ`) y **Areas We Serve** (chips de ciudades desde `w.areas` + "Proudly serving {service_area}"). "How It Works" y "Why Choose Us" ya existían. Toggles `sec.faq`/`sec.areas` (default ON).
- **Editor (`WebsiteEditor.js`) reescrito**: agregados editores de listas para How It Works (título+desc), Why Choose Us (título+desc), FAQ (Q+A), Areas We Serve (chips), y campos SEO (page title + meta description). Helpers `listSet/listAdd/listDel/areasSet`. `pick()` ahora incluye how_it_works, why_us, faqs, areas, seo_title, seo_description. Toggles de secciones ampliados a how/why/faq/areas (checked = `!== false`).
- **Selector de foto de Hero**: grilla de fotos del usuario (`GET /photos`) + botón subir (`POST /photos`, multipart) → setea `hero_photo_id`. Preview vía `/api/public/card/photo/{id}`.
- **Botón "✨ Generar con IA"** (tarjeta violeta arriba): `POST /api/website/ai-generate` (auth + feature card/business) → `ai_service.generate_website_content()`. La IA escribe headline, subheadline, about, how_it_works(3), why_us(4), faqs(5), areas(4-8), seo_title, seo_description en inglés SEO-rich. NO guarda: llena los campos del editor para que el dueño revise y toque "Guardar contenido".
- **La IA usa TODA la Tarjeta Digital** (idea del dueño): el endpoint pasa business_name, business_type, tagline, about_me, years_in_business, is_licensed/insured, hours, servicios (con descripción+precio), reseñas reales (tono/temas, sin inventar) y `ai_context` (base de conocimiento privada del dueño). Así el contenido sale personalizado y preciso. Verificado: generó "25+ years in business", mencionó CRM/digital cards del contexto.
- **Nota**: los datos estructurados (servicios, reseñas, fotos, logo, licensed/insured/años, teléfono) ya se leen EN VIVO de la tarjeta en `/public/website/{slug}`. Solo los textos editables (headline/sub/about/service_area/hours) se snapshotean al init o via IA.
- i18n `website.*` ampliado (ES/EN): aiTitle/aiDesc/aiBtn/aiWorking/aiDone/aiError, heroPhoto/heroPhotoDesc, how/why/faq/areas/seo labels + placeholders. `sec.how/why/faq/areas` agregados.
- Verificación: curl e2e (ai-generate devuelve JSON completo; PUT persiste faqs/areas/how/why/seo; público los devuelve) + screenshots (FAQ+Areas en sitio público; editor completo; click "Generar" llena campos con "25+ years"). Build `yarn build` (usa `.env.production` con REACT_APP_BACKEND_URL='' → relativo) + `git add -f frontend/build/*` hecho. ⚠️ Pendiente dueño: "Save to Github" + deploy.

---


## ✅ Ago 2026 (c) — Compartir documentos: PDF adjunto + Email + slide-up [COMPLETO, verificado por el dueño en su teléfono]
- **PDF adjunto real**: `lib/pdf.js` (generateQuotePDF/InvoicePDF/AgreementPDF) ahora acepta `opts.returnBlob` y devuelve `{blob, filename}` en vez de `doc.save()`. `SendDocumentDialog` tiene botón "Enviar con PDF adjunto" que usa Web Share API (`navigator.share({files})`) en móvil, con fallback a descarga + mailto en desktop. `getPdfBlob` cableado en InvoiceDetail/QuoteDetail/AgreementDetail.
- **`SendDocumentDialog` → slide-up**: pasó de `<Dialog>` centrado a `<Sheet side="bottom">` (regla no-popups del dueño).
- **Botón Email arreglado 2 veces**: (1) ya no queda deshabilitado si el cliente no tiene email (abre mailto siempre); (2) BUG `[object Object]` en el cuerpo — causa: `onClick={openEmail}` pasaba el evento como `bodyText`; fix: `onClick={() => openEmail()}`.
- **Mensaje adaptado**: `attachMessage` menciona el documento adjunto según tipo (invoice/quote/service agreement).
- **Copia email del cliente** al portapapeles al compartir (Web Share no permite pre-llenar "Para") + toast. El dueño confirmó: copia auto + pegar = perfecto.
- Verificación: compila OK; el dueño probó en su teléfono y confirmó que funciona. (No se usó testing_agent por instrucción del dueño.)

---


## ✅ Ago 2026 — Regla "NO popups": convertir modales de acción a páginas [add cliente + add trabajo hechos]
- **Regla del dueño (INNEGOCIABLE, ver `/app/memory/UX_RULES.md`)**: nada de modales/diálogos centrados con overlay gris para funciones del app (causan botones cortados y varían entre navegadores). Toda función = página propia con su ruta. Únicas excepciones: bottom-sheets de "IA trabajando" y los resultados slide-up del Marketing Studio.
- **Fix urgente**: "Agregar cliente" (bug: modal no cabía en laptop, escondía Guardar) → nueva página `pages/ClientForm.js`, ruta `/clientes/nuevo`. `Clients.js` ahora solo navega (Dialog eliminado). Dashboard step1 y atajo actualizados. Editar cliente ya era inline (OK).
- **Agregar trabajo** → nueva página `pages/JobForm.js`, ruta `/trabajos/nuevo`. `Jobs.js` Dialog de nuevo trabajo eliminado; botones navegan. (Quedan popups menores en Jobs: agendar/foto/SendDocument — solo si el dueño los pide.)
- Verificación: compila OK; `POST /clients` y `POST /jobs` confirmados por curl (200). ⚠️ NO se pudo screenshotear la pantalla autenticada (la tool de captura re-navega en contexto nuevo y descarta el login). ⚠️ NO se usó testing_agent por instrucción explícita del dueño (créditos). Build + `git add -f build/*`. Usuario: Save to Github + deploy.

---


## ✅ Ago 3 2026 (b) — Demo corto: página de cierre dedicada + quitar FAB WhatsApp + texto guía más grande [COMPLETO; verificado screenshots]
- **Página de cierre como landing de venta (paso 5)**: al tocar "Pagar (demo)", `payNow` ahora hace `setStep(5)` (antes el `FinalCTA` se apilaba DEBAJO del invoice → página larguísima y confusa en móvil). Nuevo componente `DemoClose` (data-testid `demo-close`): hero de éxito ("Demo completado / Now do it with YOUR business"), grid de 4 beneficios (`demo-close-benefit-{i}`: cotizaciones IA en inglés, cobra Card/Venmo/Zelle/CashApp/PayPal, contratos con firma, todo en una app), reutiliza `FinalCTA` (captura de contacto + WhatsApp + oferta Fundador + checkout) y línea de garantía. StepBar se oculta en paso 5 (`step <= 4`). `InvoiceStep` ahora recibe `hideFinalCta` en /demo (el cierre vive en su propia pantalla). i18n `demoFlow.close.*` (badge/title/subtitle/trust/benefits[]) ES/EN.
- **Bug móvil: FAB de WhatsApp tapaba los botones de avanzar** → removido `WhatsAppFab` del import y del render de `DemoFlow.js` (sigue existiendo solo en `/demo-flujo`). El WhatsApp del cierre (dentro de FinalCTA) se mantiene.
- **Texto de la barra guía agrandado**: stepLabel `text-sm`, instrucción `text-base` (16px), botón `h-14` (56px) `text-base`. Confirmado legible.
- Verificación: screenshots via `?pv=` temporal (ya removido) de Quote/Agreement/Invoice/Close. `yarn build` OK + `git add -f build/*`. ⚠️ Usuario: "Save to Github" + deploy.
- Nota: usuario pidió NO usar testing_agent (créditos). Se usó una vez por error (iter_50, confirmó fixes 100%) y se acordó no volver a usarlo.

---


## ✅ Ago 3 2026 — Demo corto (/demo): factura de ejemplo realista + guía paso a paso [COMPLETO; verificado screenshots ?pv=2/4]
Objetivo: reducir la caída del tráfico Meta (móvil) en quote/factura. 3 mejoras en `DemoFlow.js`:
1. **Ejemplo de factura hiper-realista en el paso 0** (nuevo `SampleInvoicePreview`): encabezado del negocio (nombre/tel/ciudad), Bill To (María González), fechas, tabla con columnas reales (Description·Qty·Price·Amount) + filas cebra, totales (Subtotal $1,450 · Tax 8% $116 · TOTAL $1,566) + línea verde "Deposit due today $783" + métodos de pago. Reemplaza la mini-preview anterior. Así ven de inmediato el tipo de documento antes de arrancar.
2. **Bottom-sheet "La IA está creando tu cotización…"** (nuevo `BusySheet`, estilo `/demo-flujo`): sube desde abajo al tocar "Generar cotización" (condición `loading && step===1`). ANTES el `GeneratingOverlay` tenía `loading && step===2` → NUNCA se mostraba durante la generación (bug). Barra de progreso animada (keyframe `busybar` global) + "no cierres esta pantalla". i18n `demoFlow.busyTitle/busyWait/busyStay`.
3. **Barra guía fija abajo (`GuideBar`)** en pasos 1-4: explica qué ven y da UN botón obvio para avanzar sin cazar el botón dentro del documento. Textos i18n `demoFlow.guide.*` (stepLabel "Paso X de 5", s1..s4 + ctas). Handlers extraídos en el padre (`signNow`, `payNow`, `guideNext`). Los botones dentro de los documentos (Accept/Sign/Pay) SE QUEDAN (decisión del usuario: realismo). Se ocultan al pagar (step 4 + paid). Padding del contenedor a `pb-32` para no tapar contenido.
- Verificación: tool de screenshot RE-NAVEGA tras el script (no refleja interacciones); se usó inyección temporal `?pv=2|4` (ya removida) para capturar Quote ("STEP 3 OF 5 → Continue") y Factura ("STEP 5 OF 5 → Pay (demo)") con la GuideBar. Backend `/public/demo/start` + `/quote` verificados por curl (quote total $1,315, 4 líneas). `yarn build` OK + `git add -f build/*`.
- ⚠️ Pendiente usuario: "Save to Github" + deploy para publicar en el sitio en vivo.

---


## ✅ Jul 28 2026 — Botón "Escríbeme por WhatsApp" (rescate de prospectos) [COMPLETO; verificado screenshot]
- Nuevo componente `components/WhatsAppButton.js` → abre `wa.me/19712270595` con mensaje pre-escrito ("¡Hola! Vi el demo de UniTech y tengo unas preguntas…"). Número del dueño: +1 971-227-0595.
- Colocado en: pantalla FINAL del demo (`DemoFlujo.jsx` FinalCTA, testid `flujo-final-whatsapp`) y en la página de precios (`Pricing.js`, testid `pricing-whatsapp`), para rescatar a quien no se convence de suscribirse solo.
- i18n `whatsapp.*` (es/en): cta, prefill (mensaje pre-escrito, se adapta al idioma), demoPrompt, pricingPrompt.
- Build regenerado + `git add -f frontend/build/` (main.1c40aad8.js).


## ✅ Jul 27 2026 — Trial 14 días CON tarjeta (modelo opt-out estilo Netflix) [COMPLETO; verificado vía Stripe API]
- **Decisión de negocio:** el usuario eligió el modelo "trial con tarjeta": se pide la tarjeta en el checkout, NO se cobra hoy, y se cobra el día 15 si no cancela. Mayor conversión trial→pago (~40-60% vs ~15-25% del trial sin tarjeta).
- **Backend (`payments_service.py`):**
  - `trial_period_days = 14` en TODOS los planes (módulos, combos, bundle y `bundle_founder`).
  - `create_checkout_session`: agregado `custom_text.submit` en español ("Prueba GRATIS 14 días — hoy no se te cobra… cargo empieza el día 15, cancela cuando quieras"). Ya usaba `payment_method_collection="always"`.
  - `user_features`: ahora "trialing" CON `stripe_subscription_id` otorga acceso completo al plan → **un cliente que paga NUNCA queda bloqueado** si un webhook se pierde o al convertir el trial→activo el día 15.
  - Webhook `customer.subscription.trial_will_end` (dispara ~3 días antes): crea notificación in-app de recordatorio pre-cobro (fecha exacta + precio + link a cancelar). Idempotente vía `trial_notifs: "precharge"`.
- **Textos claros (i18n es/en):** badge de registro "14 días gratis · Cancela cuando quieras" (quitado "sin tarjeta"); pasos de `/precios` reescritos (tarjeta hoy, $0 hoy, aviso antes de terminar, cobro día 15, cancela cuando quieras); notif de bienvenida sin "sin tarjeta".
- **Frontend ya soportaba** el estado `isPayingTrial` (trial con `stripe_customer_id`) mostrando banner amistoso de bienvenida + envío de tarjeta NFC.
- **Verificación Stripe API:** sesión checkout → `mode=subscription`, `amount_total=0` (hoy $0), `payment_method_collection=always`, `custom_text` presente. ✅
- **FIX crítico handoff registro→Stripe:** antes el usuario se registraba pero caía al Dashboard SIN pasar por Stripe (race condition en Pricing.js con `start=1`). Ahora `Register.js` llama DIRECTO a `/payments/checkout` tras registrar y hace `window.location.assign(url)`. Fallback a `/precios` si founder está agotado.
- **Auto-redirect suave:** `PaymentSuccess.js` navega al panel 5s tras el éxito (botón "Ir al panel" sigue disponible).
- **i18n limpiado:** eliminadas TODAS las afirmaciones falsas "sin tarjeta / no credit card" (noCard, bundleNote, finalNote, finalDesc, upsellFootnote, offerRegularNote) en es/en.
- **E2E verificado (agente de pruebas, aprobado por usuario):** registro → Stripe ($0 hoy, 14 días gratis) → pago con 4242 → `/pago/exito` → Dashboard con acceso completo (Marketing/Quotes sin bloqueo) + banner `isPayingTrial`. `GET /api/payments/subscription` = trialing + stripe_customer_id + features [business,card,marketing]. Backend 9/9 pytest. Frontend 100%. `yarn build` OK.


## ✅ Jul 20 2026 — Optimización de imágenes (carga rápida) [COMPLETO; verificado curl + screenshot]
- **Bug carga lenta del demo resuelto**: imágenes pesadas convertidas a WebP y alojadas localmente:
  - `nfc-sample.png` 665KB → `nfc-sample.webp` 30KB
  - chatbot IA (remota ~987KB) → `/chatbot-demo.webp` 44KB (ahora local)
  - `nfc-google-review.png` 185KB → `nfc-google-review.webp` 33KB
  - Referencias actualizadas en `DemoFlujo.jsx` y `Landing.js`.
- **Compresión automática de TODAS las imágenes subidas/generadas** (petición usuario): nuevo helper `_compress_image()` en `server.py` (WebP, max 1920px, calidad 85, preserva transparencia/alpha). Aplicado en:
  - `upload_photo` (fotos de trabajo/CRM)
  - `_upload_card_asset` (logo, foto perfil, portada de tarjeta)
  - `_store_card_photo` (imágenes IA `ai_gen`, posts sociales `social_out`/`social_src`, fotos mejoradas)
  - Fallback: si falla compresión o el WebP resulta mayor, guarda el original.
  - Verificado: PNG 148KB→19KB webp; logo con alpha preservado (RGBA WebP).


## ✅ Jul 9 2026 — Rediseño legibilidad + mejoras UX del demo `/demo-flujo` [COMPLETO; verificado screenshots; testing_agent PROHIBIDO por usuario]
- **Legibilidad 40+**: iconos de cada paso ARRIBA (centrados) con título/explicación abajo; todos los textos <12px subidos a mínimo 14-16px; documentos (DemoFlow.js) labels a 14px. Precio/CTA responsivos.
- **Paso 1 visual**: canales NFC/QR/Web/Chat como tarjetas de imagen (NFC = `/nfc-sample.png`, QR foto genérica, formulario laptop, chatbot generado). 
- **Paso 3**: checklist "qué detalles necesita la IA" (medidas, materiales, precios, depósito, tiempos); botón "Generar cotización" full-width; placeholder detallado.
- **Popup IA (BusySheet)**: sube desde abajo mientras genera cotización/contrato ("no cierres esta pantalla").
- **Popup pago (NoticeSheet)**: al pagar sale "¡Esto es un demo!" con botón "Continuar con el demo" (`flujo-demo-notice-continue`).
- **Paso 8 social**: usa template real `/social-previews/before_after.jpg` + caption con hashtags + galería deslizable de templates reales.
- **Nombre del negocio**: nuevo campo `flujo-business-name` en intro → cotización/contrato/factura/tarjeta usan el nombre del negocio (fallback a nombre personal). CTA final personalizado: "Activa {negocio} — $59/mes de por vida".
- **Landing**: botón flywheel (post 9 pasos) ahora → `/demo-flujo` con copy "Experiméntalo tú mismo — demo gratis de 2 min".
- Job detail (paso 6) filas apiladas (label arriba/valor abajo). Etiqueta "Tu tipo de negocio" (antes "trabajo").


## ✅ Jul 8 2026 — Demo de historia guiada `/demo-flujo` (9 pasos) [COMPLETO; verificado screenshot end-to-end incl. IA real]
- Nuevo `pages/DemoFlujo.jsx` (ruta `/demo-flujo`). Simulación narrativa de una clienta ("María"/"Maria") siguiendo los 9 pasos de "Así funciona", personalizada al oficio del que ve el demo.
- Paso 3 = IA REAL (reutiliza `/public/demo/start` + `/public/demo/quote` con el oficio + descripción en español). Pasos 1,2,4-9 simulados ($0) con escenas animadas.
- Cierre dinámico: lee `/payments/founder-status` → si hay cupos muestra CTA Fundador $59 (→ /register?plan=bundle_founder); si agotado → Bundle $75.
- Landing (`nav-demo` y `hero-demo`) ahora apuntan a `/demo-flujo`. `/demo` (Meta ads) y `/demo-all` quedan intactos.
- i18n `demoFlujo.*` ES/EN. Build main.4620ec34.js.


## ✅ Jul 7 2026 — Generador de Códigos QR (dinámicos + estáticos) [COMPLETO; backend curl OK, frontend screenshot OK; build main.50144518.js; deploy pendiente]
- Motivación: cliente usa QR de HighLevel (`link.sendlink.co` = dominio de HighLevel → se apagan al cancelar). Solución: crear QR propios sobre el dominio del usuario.
- Backend NUEVO `qr_routes.py` (incluido en server.py junto a gbp): colección `qr_codes`. Endpoints: `POST/GET/PUT/DELETE /api/qr` (auth + require "card" feature vía payments_service.user_features), y PÚBLICO `GET /api/public/q/{slug}` → 302 al destino + `$inc scan_count`.
- QR dinámico: codifica `${origin}/api/public/q/{slug}` (editable sin reimprimir, cuenta escaneos). Estático: codifica el destino directo.
- Frontend `pages/QrCodes.jsx` (ruta `/qr`, FeatureGate "card"; nav "QR Codes"/"Códigos QR" en MORE_ITEMS y SIDEBAR). Destinos: URL, Mi tarjeta (`/c/{card_slug}`), Mis reseñas (`/r/{card_slug}`), WhatsApp (`wa.me`). Colores fg/bg, logo al centro (usa `logo_photo_id` vía `/public/card/photo/{id}` con crossOrigin), descargar PNG (canvas 512), copiar link, editar destino, borrar, contador de escaneos. i18n ES/EN (`qr.*`, `nav.qrCodes`). Usa qrcode.react ya instalado.
- Gating: módulo Presencia (feature "card") o Bundle.


## ✅ Jul 7 2026 — Precio FUNDADOR: Bundle a $59/mes DE POR VIDA, primeros 30 [COMPLETO + PROBADO iter_46 100%; build listo, deploy pendiente]
- Backend ya tenía `bundle_founder` ($59/mes=5900¢, mensual, cap 30 vitalicio) + `GET /payments/founder-status`.
- Frontend `Pricing.js`: al entrar con `?plan=bundle_founder` selecciona el Bundle completo, muestra banner "Oferta Fundador" con cupos restantes (X de 30), precio $59 tachando $75, badge "Precio de por vida", oculta toggle mensual/anual, CTA "Asegurar mi precio Fundador"; maneja estado SOLD OUT. `subscribe()` envía `plan_id:'bundle_founder'` al checkout.
- `Register.js` conserva `plan=bundle_founder` y reanuda checkout (`&start=1`). i18n ES/EN agregado (claves `pricing.founder*` + `auth.register.plans.bundle_founder`).
- FIX CRÍTICO (por testing agent): `payments_service.create_checkout_session` enviaba `trial_period_days:0` a Stripe (rechazado, HTTP 500) bloqueando TODOS los checkouts. Ahora se omite cuando es 0.
- Verificado: founder cobra 5900¢, bundle_monthly sigue 7500¢. Regresión OK.
- Nota de negocio: `founder_status` cuenta cupos por estado activo/trialing/past_due (un fundador que cancela libera su cupo).


## ✅ Jul 3 2026 — Personalización visual del widget embebido (formularios + chat) [CÓDIGO LISTO; deploy pendiente]
- `embed.js` reescrito: nuevos atributos `data-theme` (light/dark), `data-radius` (rounded/sharp/pill), `data-title`, `data-font` (system/inherit), `data-branding` (on/off), `data-position` (right/left, chat), `data-launcher` (texto del botón del chat). Helpers `readOpts/palette/radii`. Mantiene auto-init desde `<script>` (WordPress) y compatibilidad con `<div>`. Fix bug: se usaba `st()` con objetos planos → corregido.
- `EmbedSettings.js` reescrito con panel "Design": selector de color (swatches + color picker), Theme, Corners, Font, Custom title, branding on/off, y para chat: Position + Button text. Vista previa EN VIVO (formulario real inyectado; maqueta del chat que refleja tema/color/posición/launcher). Genera snippet con solo los atributos no-default. Fix: `key` en ramas de preview para evitar conflicto React+DOM inyectado.
- Verificado por screenshots: formulario oscuro/pastilla/azul/título custom/sin marca ✅; chat rosa "¿Necesitas ayuda?" a la izquierda ✅; ambos juntos en una página ✅; página Sitio Web con controles + preview + snippet ✅. (Auto-test por screenshots, sin testing_agent por preferencia del usuario en cambios de UI.)


- `ai_service.py`: cuando `OPENAI_API_KEY` está presente, `generate_image` usa `_openai_generate_image` (images.generate gpt-image-1) y `enhance_image` usa `_openai_edit_image` (images.edit gpt-image-1); fallback a Gemini/Emergent si no hay llave. Modelo `OPENAI_IMAGE_MODEL` (default gpt-image-1), calidad `OPENAI_IMAGE_QUALITY` (default "medium"). Size por aspect: 1x1→1024x1024, 9x16/4x5→1024x1536, landscape→1536x1024. Probado con llave real: generó imagen ~2MB OK.
- Tope mensual de imágenes YA existía: `AI_IMAGE_DEFAULT_LIMIT` (ahora env, default 30/mes por usuario; admin puede override por usuario vía users.ai_image_limit; super-admin ilimitado). Enforced en `POST /social/ai-image` (403 al exceder).
- Costo: gpt-image-1 medium ≈ $0.04/imagen → 30/mes ≈ $1.20 máx por cliente. Controlable vs planes.
- `deploy/fix.sh` whitelist: + OPENAI_IMAGE_MODEL, OPENAI_IMAGE_QUALITY, AI_IMAGE_DEFAULT_LIMIT.


- **Chatbot usa modelo barato**: `ai_service.py` → `CHAT_MODEL = os.environ.get("OPENAI_CHAT_MODEL", "gpt-4o-mini")`. `card_assistant_chat` y `unitap_assistant_chat` usan `_new_chat(system, model=CHAT_MODEL)`. Cotizaciones/marketing/visión siguen en `MODEL_NAME` (gpt-5.2). `_new_chat` y `_OpenAIChat` aceptan param `model`. Probado: path Emergent (preview) y path OpenAI (gpt-4o-mini con llave del usuario) responden en español.
- **Tope diario por cliente**: endpoint `POST /public/card/{slug}/chat` cuenta turnos role=user del card en el día; si supera `CHAT_DAILY_CAP` (env, default 150, 0=ilimitado) responde mensaje cortés con teléfono y `rate_limited:true` SIN llamar a la IA. Evita gasto descontrolado.
- `deploy/fix.sh` whitelist ampliado: `OPENAI_CHAT_MODEL`, `CHAT_DAILY_CAP` (+ `OPENAI_API_KEY`, `OPENAI_MODEL` ya agregados).
- Negocio: planes Presencia $19.99 / Marketing $29.99 / Negocio $39.99 / Bundle $59.99 mensual. Chatbot mini cuesta centavos por cliente → margen sano. Imágenes IA (Gemini) son lo caro y siguen en Emergent key.


- **Bug embed.js en WordPress**: WP borra `<div>` vacíos con atributos `data-`. Fix: `embed.js` `init()` ahora también lee `data-unitech-chat`/`data-slug`/`data-lang`/`data-accent` desde `document.currentScript` (var `SCRIPT`) y llama `startChat()` (guard `chatStarted` evita doble montaje). Snippet de chat en `EmbedSettings.js` cambiado a una sola línea `<script ... data-unitech-chat ...>` (sin div). VERIFICADO 100% por testing_agent iter_44 en preview (FAB aparece sin div + responde).
- **Bug "el chat no responde" en producción (ezunitech.com)**: causa real = Emergent Universal Key da 403 `FREE_USER_EXTERNAL_ACCESS_DENIED` fuera del preview (plan gratis). Solución elegida: usar **OpenAI key propia**. `ai_service.py` ahora: si `OPENAI_API_KEY` está presente, todo el TEXTO usa `_OpenAIChat` (wrapper sobre `AsyncOpenAI`, interfaz compatible con LlmChat: `with_model`/`with_params`/`send_message`, acumula historial interno); si no, usa Emergent (preview). Modelo por `OPENAI_MODEL` (default `gpt-5.2`). Imágenes (Gemini Nano Banana) SIGUEN en Emergent key. Wrapper validado por smoke test (401 con llave inválida = flujo correcto). NO probado e2e con llave real (usuario la puso en su keys.txt de prod).
- Formato keys.txt prod: `OPENAI_API_KEY=sk-...` (opcional `OPENAI_MODEL=gpt-5.2`).
- ACCIÓN USUARIO: Save to Github + `bash /home/ezunitap/repo/deploy.sh` (sube embed.js arreglado + ai_service.py). Build de prod regenerado y staged (resuelve "front build is missing").


## ✅ Jun 2026 — Marketing Studio: Asistente de Ideas + legibilidad + Mensajes [LISTO, probado iter 25-30; pendiente deploy]
- **Sombra automática elegante** (halo difuso, no stroke) en diseños con texto sobre foto (`social_service.py` `_shadow_lines`/`_draw_text`, `_STYLE`, `_OVERLAY_TEMPLATES`, default "medium"). Símbolos (estrellas) también con sombra (`_shape_shadow`).
- **Subtítulo en los 20 diseños**: se agregó render del subheadline a before_after, bold_bar, review_5star, framed_pro, split_diagonal, seasonal, duo_grid, clean_band.
- **Panel "Personaliza el diseño"** colapsable (Collapsible) en `SocialStudio.js`; rerender acepta style/colores/labels (`server.py` rerender_social_post + SocialStyleIn).
- **Página de bienvenida `/marketing/inicio`** (`MarketingStart.js`): asistente de ideas. Temas DINÁMICOS por industria (`GET /social/idea-topics`, `ai_service.generate_idea_topics`); si no hay industria → selector que guarda vía `POST /social/industry` (business_type en card primaria). Ideas con tip de foto + prompt imagen (`generate_post_ideas` ampliado, count 3). Guardrail: NO inventar nichos de clientes no listados. Popup drawer "Preparando ideas…".
- Idea→Crear imagen IA conserva el brief (param `brief` en URL ai mode); **Idioma del post** visible en el form principal (sacado del drawer avanzado).
- **Mensajes AI** (`Messages.js`): después de generar, botones **Mandar** WhatsApp/SMS/Email (URL schemes, prefill con el texto + tel/email del cliente), auto-guarda en historial. Guardar/Copiar secundarios.
- Nav "Marketing" → `/marketing/inicio`. Build recompilado (rutas relativas) y staged.
- PENDIENTE backlog usuario: **subir videos a Reels** (MVP: 1 clip ≤5s, normalizar con ffmpeg en cola, chunked upload). ffmpeg ya es el motor de reels.


## ✅ Jun 2026 — MARKETING STUDIO: Panel de Personalización + Legibilidad [COMPLETO + PROBADO 100% iter_25]
Texto de los posts IA a veces ilegible → se agregó control granular sobre el diseño generado (sin gastar créditos IA).
- Backend `social_service.py`: `_draw_lines`/`_draw_text` aplican contorno (stroke) auto según luminancia. `_STYLE` global (legibility: none/soft/medium/strong; text_position; stroke_color) seteado en `render_post`. `_render_showcase` y `_render_center_stage` respetan `text_position` (arriba/centro/abajo). `build_brand` acepta `style`, `label_before`, `label_after`, `promo_label_override`. Default legibility = soft (mejora todos los posts).
- Backend `server.py`: `SocialCopyIn` + `SocialStyleIn` extendidos; `rerender_social_post` acepta y persiste `brand_color`, `accent_color`, `label_before/after`, `promo_label`, `style{}`. `_social_brand` reenvía estos params.
- Frontend `SocialStudio.js`: nuevo `customize-panel` debajo del post (dentro del result drawer): legibilidad (4 niveles), posición (solo showcase/center_stage), colores (barra/fondo), etiquetas Antes/Después (before_after) y etiqueta de oferta (promo/seasonal). Botón "Aplicar cambios al diseño" → rerender con todo el payload. Estado se rehidrata desde `post` al reabrir (useEffect).
- Probado: backend curl (top/center/bottom + colores persisten) + testing agent frontend 100% (showcase/before_after/promo, payload + persistencia verificados).


## ✅ Jun 2026 — MARKETING STUDIO: +10 diseños nuevos de posts [COMPLETO]
Se agregaron 10 templates nuevos al Estudio (render server-side Pillow en `social_service.py`), distintos a los 10 existentes:
`review_5star` (Reseña 5★), `framed_pro` (Marco Pro), `split_diagonal` (Diagonal), `now_hiring` (Contratando), `quote_offer` (Cotización Gratis), `seasonal` (Temporada), `trust_badge` (Garantía, badge circular), `coupon` (Cupón con descuento), `duo_grid` (Galería Dúo, 2 fotos), `clean_band` (Cinta Limpia).
- `_RENDERERS` + `DESIGNS` actualizados; `SOCIAL_TEMPLATES` se auto-deriva. Helpers nuevos `_draw_stars`/`_brand_chip` + `import math`.
- Previews JPG 1080² generados en `/app/frontend/public/social-previews/{id}.jpg`. `TEMPLATES` del frontend (`SocialStudio.js`) actualizado con labels ES.
- Verificado: backend reinicia sin errores, render_post produce los 10, galería muestra los 20 previews. Build prod + git add -f.

## ✅ Jun 2026 — DEMO `/demo-all` unificado con ramificación [COMPLETO + PROBADO]
Ruta NUEVA separada (el `/demo` original con Pixel quedó intacto). Captura lead → selector "¿Cuál es tu mayor necesidad?" (Presencia/Negocio/Marketing, deep-link `?need=`) → momento mágico por rama → cierre `ModuleUpsell` que vende los 3 (los otros módulos son clicables para SALTAR de demo sin reiniciar).
- **Presencia**: tarjeta REAL (`LiveCardPreview`+`PhoneFrame`) personalizada, avatar = foto real sonriente; 6 beneficios "¿Por qué tu tarjeta vende por ti?".
- **Negocio**: SIN IA real (ahorra créditos). Campo de descripción SOLO LECTURA; 3 ejemplos (Techo/Pintura/Driveway) que LLENAN la descripción; loader "Generando tu cotización…"/"…Service Agreement…"; cotización+contrato+factura pre-armados; 6 beneficios al pagar.
- **Marketing**: SIN IA. Elegir 1 de 3 tipos (Trabajo terminado/Promoción/Antes y después) → `DesignedPost` (3 variantes) dentro de tarjeta IG; 6 beneficios.
- `LiveCardPreview` acepta URLs directas opcionales (`cover_photo_url`/`profile_photo_url`/`logo_photo_url`) con fallback por ID. `DemoFlow` exporta QuoteStep/AgreementStep/InvoiceStep/GeneratingOverlay (con props opcionales `hideFinalCta`, title/subtitle). Probado iteration_22 (30/30) y iteration_23 (27/27).

## ✅ Jun 2026 — ADMIN consolidado [COMPLETO + PROBADO 14/14]
Página "Cuentas" (tabla/cards + buscador + filtros) + Drawer unificado (`AdminAccountDrawer`) con tabs Plan/Tarjetas/Actividad/Acciones (set-plan, grant-comp, card-limit/seats, envíos, impersonar, eliminar). "Vista Global" (Métricas) ya NO duplica la tabla de usuarios → botón "Ir a Cuentas". Tabs: Cuentas · Vista Global · Mensajes · Leads · Envíos NFC.

## ✅ Mobile UX (tarjeta NFC)
Botón "Traducir con IA" compacto (no se desborda), popover responsivo; uploaders con `flex-wrap` (logo/foto dueño/fondo); Logo movido fuera de opciones avanzadas.

## ✅ Jun 2026 — i18n BILINGÜE EN/ES completo (Olas 1-4 + extras) [COMPLETO]
App 100% bilingüe con `react-i18next` SIN duplicar componentes. Toggle `LanguageToggle` (EN/ES) en Login + Layout; idioma persiste en `localStorage` (`i18nextLng`). Diccionarios en `/app/frontend/src/i18n/locales/{en,es}.json`.
- **Olas 1-3** (sesión previa): App/Layout/Login/Register/Dashboard, Clients/Quotes/Invoices/Agreements/StatusBadge/TourButton, QuoteBuilder/Jobs/Calendar/InvoiceDetail. Backend acepta `language` en `/ai/quote`, `/messages/generate` → IA genera inglés NATIVO sin frasing de "traducido".
- **Ola 4** (esta sesión, PROBADO testing agent iteration_31 = 100% frontend): `Landing.js` (incl. arrays vía `t(...,{returnObjects:true})`: flow/products/nfcCards/nfcSteps/results + phone mockups decorativos), `SocialStudio.js` (+PhotoSlot; templates/formatos vía t()), `CardAdmin.js` (+sub-componentes Advanced/IndustryTemplatePicker/HeroLayoutPicker/AssetUploader/NewReviewForm), `Settings.js` (Profile + AssetUploader), `MarketingStart.js`, `WelcomeModal.js`, `SetupChecklist.js`, `tours.js` (convertido a `getTours(t)`; consumer `TourButton.js` actualizado).
- **Extras (esta sesión)**: componentes de Settings traducidos para paridad 100% → `AiTranslateButton.jsx` ("Translate with AI"), `SubscriptionSection.js` (+plans), `PaymentMethodsSection.js`, `StripeConnectSection.js`. Fechas respetan idioma (`en-US`/`es-ES`).
- Namespaces nuevos en diccionarios: landing, socialStudio, cardAdmin, profile, marketingStart, welcome, setupChecklist, tours, aiTranslate, subscription, payments, stripeConnect.
- Verificado: webpack compila limpio; JSON válido; testing agent 100% (sin claves crudas, toggle funciona en todas las páginas, sin crashes). Landing + Login confirmados visualmente en inglés.

## ✅ Jun 2026 — Auto-detección de idioma + Banner "Ver en español" [LISTO, probado screenshot; pendiente deploy]
- Auto-detección del navegador YA existía en `i18n/index.js` (orden `localStorage`→`navigator`, fallback `en`, `load: languageOnly`). Visitante con navegador ES ve español; con EN ve inglés.
- NUEVO `LanguageSuggestBanner.js`: barra slim superior (montada global en `App.js` dentro de `AuthProvider`) que aparece SOLO cuando el idioma activo es inglés y no hay elección previa. Texto "¿Hablas español? Mira UniTech en tu idioma." + botón "Ver en español" (cambia TODO el sitio a `es`) + X cerrar. Marca `localStorage unitech_lang_dismiss=1` al actuar → no vuelve a molestar.
- `LanguageToggle.js`: cualquier elección explícita también setea `unitech_lang_dismiss` para silenciar el banner.
- Build prod recompilado (rutas relativas) + `git add -f frontend/build`. Pendiente: usuario "Save to Github" + `bash /home/ezunitap/repo/deploy.sh`.

---

## ✅ Jun 2026 — Demos /demo y /demo-all bilingües EN/ES [LISTO, probado iter_32 100%; pendiente deploy]
- `DemoFlow.js` (/demo) y `DemoAll.js` (/demo-all) ahora 100% bilingües con `react-i18next` (`useTranslation`/`Trans`), SIN duplicar componentes. Namespaces nuevos: `demo` (común: TopBar, lead form, badges), `demoFlow`, `demoAll` en en.json/es.json.
- **En inglés se eliminó por completo el ángulo "escribe en español → inglés"**: copy vende capacidades genéricas (Anglo). Ej: "Describe the job" (sin "en español"), "AI quote/contract/invoice", reels con "natural voiceover" (sin español nativo). Probado: CERO texto en español en modo EN en los 3 branches de /demo-all.
- Trades localizados vía `tradeLabel()` (valor interno sigue bilingüe para lookups de TRADE_META). Sello "IA"→"AI" y placeholder de email locale-aware.
- Los documentos de muestra (cotización/factura: Bill To, Scope, line items) quedan en inglés en ambos idiomas (correcto — son cara al cliente US).
- Build prod recompilado + `git add -f frontend/build`.

## ✅ Jun 2026 — CTA "📲 Mándamelo por WhatsApp/SMS" en demos [LISTO; pendiente deploy]
- Componente compartido `SendToMeCTA` (exportado de `DemoFlow.js`) al final de cada cierre: rama Negocio/Presencia/Marketing de `/demo-all` (antes de ModuleUpsell) y en el paso de factura pagada de `/demo`. Bilingüe (claves `demo.send*`).
- Prellena WhatsApp (`wa.me/<tel>`) y SMS (`sms:`) con el teléfono del lead + link a `/register` y el sample que vio (cotización/tarjeta/post). Trackea `DemoSendToMe` (canal+rama) en Pixel. Captura el lead caliente.

## ✅ Jun 2026 — Chatbots bilingües + Botón promo "Are you a contractor?" en tarjeta NFC [LISTO, probado curl+screenshot; pendiente deploy]
- **PlatformChat (landing)** ahora bilingüe: manda `language: i18n.language` al backend y todo el widget usa i18n (`platformChat.*`). Saludo se resincroniza con el idioma antes del primer mensaje.
- **Prompt del asistente de plataforma** (`ai_service.UNITAP_ASSISTANT_SYSTEM`) reescrito con TODO lo nuevo y precios reales: 3 módulos (Presencia $19.99, Negocio $39.99, Marketing $29.99; combos -30%; bundle $59.99; anual=10 meses; trial 14 días), Stripe Connect (cobro directo), Marketing Studio, reseñas, NFC, contratos, app bilingüe. Regla: en inglés NO vende el ángulo español→inglés.
- **Chatbot de tarjeta NFC** (`/c/{slug}` → `card_assistant_chat`): confirmado que responde con los datos que el dueño llena en su dashboard (servicios, área, horario, `about_me`, y `ai_context` = base de conocimiento privada). No inventa precios.
- **NUEVO botón promo** en tarjeta pública: "Are you a contractor? See how I do it →" (siempre en inglés) → `/demo-all?ref=<slug>`. Control 100% del super-admin en Admin→Cuentas→Tarjetas (Auto/ON/OFF). Default (`payments_service.demo_promo_visible`): cuenta GRATIS/comp/trial = visible, pagador real de Stripe = oculto. Override por cuenta vía `POST /admin/users/{id}/demo-promo`. El `ref` se guarda en `demo_leads` (semilla para referidos). Campo `demo_promo` (None/True/False) en user.
- Build prod recompilado + `git add -f frontend/build`. (Cambios de chatbot son backend → ya activos en preview sin re-deploy.)

## ✅ Jun 2026 — Quote desde el pedido del cliente + fix banner en tarjetas [LISTO, testing iter_33 100%; pendiente deploy]
- **BUG FIX banner idioma:** `LanguageSuggestBanner` ahora usa `useLocation` y NO se muestra en rutas cara-al-cliente (`HIDDEN_PREFIXES=['/c/','/r/','/p/']`). Sigue saliendo solo en la web/app (landing, /demo, /register, app).
- **NUEVO puente Lead→Quote:** al enviar "Request a free estimate", el backend (`public_card_lead`) ahora guarda en el cliente `project_request` (descripción) y `project_photo_path` (foto). Nuevo endpoint `GET /clients/{id}/project-photo` (auth, owner) devuelve la foto como data URL.
- **ClientDetail:** tarjeta destacada "📋 Lo que pidió el cliente" arriba (texto + foto si hay) con botón "Crear cotización con esto" → navega al QuoteBuilder con router state.
- **QuoteBuilder:** precarga la descripción del cliente (`location.state.prefillDescription`), muestra nota "Cargado del pedido del cliente", y si hay foto, botón "Usar la foto que mandó el cliente" → corre el AI photo-quote. Probado E2E (iter_33).
- Build prod recompilado + `git add -f frontend/build`.

## ✅ Jun 2026 — Tarjeta unificada "📇 Contacto desde tu tarjeta" en CRM [LISTO, testing iter_34 100%; pendiente deploy]
- **Backend `public_card_lead`** ahora guarda campos estructurados en el cliente: `lead_type` (connect/estimate), `interests[]`, `preferred_contact`, `lead_source="smart_card"` (+ `project_request`/`project_photo_path` ya existentes).
- **ClientDetail:** una sola tarjeta bonita para AMBOS formularios — badge ("Quiere conectar" / "Pidió cotización"), chips de intereses, fila "Prefiere contacto por X" con botón **Contactar** (WhatsApp `wa.me`, llamada `tel:`, SMS `sms:`, email `mailto:`), el mensaje del cliente, foto (si hay) y botón "Crear cotización con esto".
- **Backfill ejecutado:** 8 leads viejos rescatados desde sus notas a los campos estructurados (script one-off, ya corrido).
- Build prod recompilado + `git add -f frontend/build`.

## ✅ Jun 2026 — Botón Admin "Actualizar contactos viejos de tarjeta" [LISTO, probado curl+screenshot; pendiente deploy]
- Nuevo endpoint `POST /admin/backfill-card-leads` (super-admin, idempotente): parsea las notas de leads viejos de tarjeta y rellena `lead_type/interests/preferred_contact/lead_source`. Devuelve `{updated}`. Probado: migra correctamente (1 de prueba), 0 si ya está, 401 sin auth.
- Botón en Admin → Cuentas ("Actualizar contactos viejos"), muestra cuántos actualizó vía toast. Se presiona 1 vez tras el deploy en producción (la BD de prod es distinta a la de preview).
- Build prod recompilado + `git add -f frontend/build`.

## ✅ Jun 2026 — Bitácora de Notas por cliente + reorganización ClientDetail [LISTO, testing iter_35 100%; pendiente deploy]
- **Notas (bitácora):** nueva colección `client_notes`. Endpoints `GET/POST/DELETE /clients/{id}/notes` (owner-scoped). Notas con fecha/hora, apiladas (más nueva arriba), borrables.
- **Pestaña "Notas"** como SEGUNDA (después de Info) en ClientDetail. Input + "Agregar nota", lista de notas, empty state.
- **Acción por nota:** tocar una nota abre un Drawer (abajo→arriba) con: Crear cotización (precarga la nota en el generador IA), Crear invoice (abre invoice del cliente), Mandar mensaje. Acciones de quote/invoice solo si plan Negocio.
- **Tarjeta "📇 Contacto desde tu tarjeta" movida** del tope de la página → dentro de la pestaña **Info** (extraída a `const leadCard`). Arriba queda solo info del cliente + botón Crear.
- Build prod recompilado + `git add -f frontend/build`.

## ✅ Jun 2026 — Agendamiento de citas online en la tarjeta (Schedule Appointment) [LISTO, testing iter_36 100% backend + frontend críticos; pendiente deploy]
- **3 toggles en CardAdmin** (acordeón "Botones y Citas"): Let's connect · Request a free estimate · Schedule Appointment (defaults: connect/estimate ON, appt OFF). Campos nuevos en `CardSettingsIn`: `lets_connect_enabled`, `request_estimate_enabled`, `appt_enabled`, `appt_days[]`, `appt_start`, `appt_end`, `appt_duration`.
- **Disponibilidad** configurable (días, horario, duración 30/60/90/120). Backend genera slots libres.
- **Endpoints:** `GET /public/card/{slug}/availability` (slots desde mañana, -ya reservados), `POST /public/card/{slug}/appointment` (instant-confirm, anti-doble-reserva 409, crea Cliente + Job en Calendario), `GET /appointments` (+new_count), `POST /appointments/{id}/viewed`. Colección `appointments`.
- **SmartCard:** botón "Schedule Appointment" + `BookingForm` (fecha→hora→datos→confirmación con "Agregar a mi calendario" .ics). Bilingüe. Botones connect/estimate respetan toggles.
- **Página Citas del dueño** (`/citas`, nav feature card): lista próximas/pasadas, badge NUEVO (rojo), popup con Llamar/Mensaje + Ver cliente. Marca visto al abrir.
- Times = hora local (sin TZ). Build prod recompilado + `git add -f frontend/build`.

## ✅ Jun 2026 — FIX P0 pantalla en blanco en iPhone al abrir cliente/mandar mensaje [LISTO, testing iter_37 100%; pendiente deploy]
- **Causa raíz:** `Messages.js` usaba `useTranslation()` e `i18n.language` SIN importarlos → `ReferenceError` → `/mensajes` crasheaba (pantalla en blanco) para todos. Flujo de la usuaria: abrir cliente → "Mandar mensaje" → `/mensajes` → blanco. FIX: agregados `import { useTranslation } from "react-i18next"` e `import i18n from "@/i18n"` en Messages.js.
- **ErrorBoundary global NUEVO** (`/app/frontend/src/components/ErrorBoundary.js`): captura cualquier crash de render y muestra pantalla amable recuperable ("Algo salió mal" + Reintentar/Recargar/Ir al inicio + detalle del error copiable) en vez de pantalla 100% en blanco. Montado en `App.js` vía `RoutedErrorBoundary` (resetea por `location.pathname`). Sin dependencia de router/i18n para ser a prueba de fallos. Nota: la usuaria abre la app como "Add to Home Screen" (PWA standalone) → mismo motor WebKit, el fix aplica igual.
- **Blindaje ClientDetail:** `load()` normaliza `history` con arrays por defecto; `leadCard` usa `Array.isArray(client.interests)`; render de mensajes usa `(m.message_type || "")`.
- Verificado testing_agent iter_37: ambas cuentas (Negocio/Presencia), móvil 390x844 + desktop; barrido de navegación completo sin disparar el ErrorBoundary; /mensajes carga OK post-fix.
- Build prod recompilado (rutas relativas) + `git add -f frontend/build`.

## ✅ Jun 2026 — Tareas/Pendientes ("Por hacer") + Trabajos limpio (leads ya no crean Job) [LISTO, testing iter_38 100%; pendiente deploy]
- **Causa de confusión:** cada lead de la tarjeta (connect/estimate) creaba un Job `new_lead` automático → ensuciaba Trabajos. FIX: `public_card_lead` ya NO crea Job (solo Cliente/CRM). Trabajos = trabajo real.
- **Limpieza datos viejos:** endpoint `POST /admin/cleanup-lead-jobs` (super-admin, idempotente) borra Jobs `new_lead` sin quote/invoice/fecha cuyo cliente es `lead_source=smart_card`. Botón en Admin→Cuentas (`cleanup-lead-jobs-btn`). Correr 1 vez tras deploy en prod.
- **NUEVO To-Do / Tareas:** colección `tasks`. CRUD `GET/POST/PUT/DELETE /tasks` (sin feature gate, para todos). Campos: title, due_date (opcional), client_id (opcional), done. Componente compartido `TasksPanel.jsx` (quick-add con fecha + cliente, palomear, borrar, badges Hoy/Atrasado, sección Completadas colapsable). Montado arriba del Dashboard y arriba de Trabajos. i18n namespace `tasks` (ES/EN).
- Verificado: curl backend CRUD + cleanup (16 borrados) + lead no crea job; testing_agent iter_38 frontend 100% (8 flujos, móvil).
- Build prod recompilado + `git add -f frontend/build`.

## ✅ Jun 2026 — Trabajos oculta leads sueltos + "Agenda de hoy" en el panel Por hacer [LISTO, testing iter_39 100%; pendiente deploy]
- **Trabajos limpio (confiable, sin botón):** `GET /jobs` ahora OCULTA los "bare leads" (status `new_lead` sin quote/invoice/fecha y `source != manual`) → solo se ve trabajo real (con cotización/factura/agendado/avanzado). `create_job` marca `source="manual"` para que los trabajos hechos a mano NUNCA se oculten. `/admin/cleanup-lead-jobs` alineado para purgar el mismo conjunto.
- **Agenda de hoy automática:** `TasksPanel` ahora carga `/jobs` y muestra sección "Agenda de hoy" con trabajos/citas agendados para hoy + atrasados (no completados). Como las citas de la tarjeta crean un job `source=appointment status=scheduled`, sirven igual para barbero (citas) y contratista (trabajos). Cada item muestra hora y badge Hoy/Atrasado, tap → /citas o /trabajos.
- Fix UX móvil: botón borrar tarea siempre visible (antes hover-only).
- Verificado: backend pytest 5/5 + testing_agent iter_39 frontend 100% (móvil).
- Build prod recompilado + `git add -f frontend/build`.

## ✅ Jun 2026 — Trabajos completados archivados en la ficha del cliente [LISTO, testing iter_40 100%; pendiente deploy]
- **Tablero Trabajos solo activos:** `Jobs.js` filtra `status !== "completed"` (`activeJobs`) para grupos, contador y empty. El Select de estado sigue permitiendo marcar "Completado" → al recargar desaparece del tablero.
- **Pestaña "Trabajos" en ClientDetail:** nuevo tab (`history-tab-trabajos`, gated business) que lista `history.jobs` (completados primero), cards `client-job-<id>` con badge de estado, fecha y notas. Así los trabajos terminados quedan archivados en la cuenta del cliente.
- Verificado: testing_agent iter_40 9/9 + regresión TasksPanel/Agenda OK.
- Build prod recompilado + `git add -f frontend/build`.

## ✅ Jun 2026 — Blindaje global anti-desborde de botones en móvil + header Tarjeta + Pagos pendientes arriba + hero Marketing compacto [LISTO, testing iter_42 100%; pendiente deploy]
- **Botones (global):** `ui/button.jsx` — se quitó `whitespace-nowrap` y se agregó `min-w-0 [overflow-wrap:anywhere] text-center leading-tight`. Ningún botón se desborda lateralmente en móvil (texto se ajusta dentro de la caja, íconos fijos). Audit automático: 0 desbordes H/V en 10 páginas, bodyW=390. testing_agent iter_42 100% (ES/EN, flujos OK).
- **Header Tarjeta (CardAdmin):** título "Tarjeta Inteligente" en una sola línea, subtítulo a ancho completo, botón "¿Cómo funciona?" movido debajo (pastilla). Sin hueco.
- **Dashboard:** bloque "Pagos pendientes" subido al tope (lo primero que ves), compacto, con "Ver invoices" a la derecha del monto.
- **Marketing Studio:** hero de bienvenida compacto (banner horizontal ~111px vs ~220px).
- Builds prod recompilados + `git add -f frontend/build` en cada cambio.

## ✅ Jun 2026 — Citas del día en la agenda del Dashboard [LISTO; self-test con datos reales + screenshot]
- **Causa:** la agenda del panel "Por hacer" leía solo de Trabajos `source=appointment`. Como las citas se agendan solo a futuro y dependían del job linkado, podían no verse. FIX: `TasksPanel` ahora lee las citas **directo de `GET /appointments`** (las de `date == hoy`, status != cancelled) y las combina con Trabajos agendados (excluyendo `source=appointment` para no duplicar). El barbero ve sus citas de hoy al abrir la app.
- Verificado: inyectando una cita de hoy en BD → aparece "Cita: ... · Hoy · HH:MM" en la agenda (4 citas mostradas), navega a /citas.
- Build prod recompilado + git add.

## ✅ Jun 2026 — Agenda muestra hoy + mañana [LISTO; self-test + screenshot]
- "Tu agenda" (antes "Agenda de hoy") ahora incluye citas y trabajos agendados de **hoy** (badge verde "Hoy") y **mañana** (badge azul "Mañana"), para prepararse con anticipación. Atrasados en rojo. Citas leídas de `/appointments`, trabajos de `/jobs` (excluye source=appointment). Verificado con citas de prueba hoy/mañana.

## ✅ Jun 2026 — Detalle de agenda en Drawer (no navega) [LISTO; self-test + screenshot]
- Al tocar una cita/trabajo en "Tu agenda", ahora abre un **Drawer deslizante** con solo los detalles (fecha/hora, cliente, notas) + acciones rápidas Llamar/WhatsApp (si hay teléfono) + botón "Ver en Citas/Trabajos". Ya NO navega a la lista completa. Verificado: tap a cita "Juan Barberia" → Drawer con datos, URL sigue en "/".

## ✅ Jun 2026 — Embed Widget + Chatbot IA para sitios web de clientes [LISTO; self-test end-to-end + screenshots]
- **Objetivo:** que los formularios y un chat con IA en los sitios web de los clientes envíen los leads/citas DIRECTO al CRM de cada cuenta UniTech, etiquetados con el dominio de origen.
- **Widget `embed.js`** (`/app/frontend/public/embed.js`, vanilla, auto-contenido, estilos inline, ES/EN): se pega con `<div data-unitech-form data-slug data-type="contact|quote|appointment">` + `<script>`. Deriva el API de su propio origin. Citas usan `/availability` + `/appointment`. También chatbot flotante con `<div data-unitech-chat data-slug>` que usa `/public/card/{slug}/chat` (AI Q&A + captura de leads).
- **Backend:** `CardLeadIn`, `AppointmentIn`, `CardChatIn` ahora aceptan `source_site`; los leads/citas/chat-leads se guardan con `lead_source="website"` + `source_site` (dominio). NO crean trabajos visibles (el filtro de /jobs los oculta).
- **Página "Sitio Web"** (`/sitio-web`, gated card, en menú Más): selector de 4 tipos (Contacto/Cotización/Cita/Chat IA), snippet copiable y vista previa en vivo. i18n namespace `embed`.
- **CRM:** la ficha del cliente muestra "🌐 Contacto desde tu sitio web" + "Vino de: dominio" para leads web.
- Cada contratista usa su propia cuenta UniTech (slug = embed key). Sin notificaciones instantáneas (los leads aparecen en CRM/dashboard).
- Verificado: curl (lead/cita/chat con source_site → lead_source=website OK; AI responde) + página externa simulada (form envía "¡Listo!" + chatbot abre y saluda) + screenshots. CORS ya es `*`.

## ✅ Jul 2026 — Analíticas propias del Demo (funnel de /demo-flujo, sin depender de Meta) [LISTO; curl e2e + screenshot]
- **Objetivo:** panel interno para ver el comportamiento real de la gente en el demo: en qué paso se atoran, si lo terminan pero se van, clics a WhatsApp/checkout. Datos de primera mano en nuestro MongoDB, no de Meta.
- **Backend** (`server.py`): `POST /api/public/demo/track` (público, anónimo por `session_id` de sessionStorage) → guarda evento crudo en `demo_events` y mantiene resumen por sesión en `demo_sessions` (`$max` en `max_step`, flags started/completed, `$inc` whatsapp_clicks/checkout_clicks). `GET /api/admin/demo-analytics` (super-admin) agrega: totals (sesiones, terminaron, tasa, clics WA/checkout), funnel por paso 0→10 con % de caída, desglose por oficio, dispositivo, y sesiones recientes con el último paso alcanzado.
- **Frontend:** helper `lib/demoAnalytics.js` (fetch keepalive, no bloquea, no truena). `DemoFlujo.jsx` dispara: `step_view` en cada paso, `demo_start`, `quote_generated`, `demo_completed` (paso 10), `whatsapp_click` (fab + final), `checkout_click` (CTA final) y `leave` en visibilitychange (abandono). Nuevo tab **"Demo Analytics"** en `AdminTabs` + página `AdminDemoAnalytics.js` en `/admin/demo` (KPIs, embudo visual con caída en rojo, por oficio, dispositivo, sesiones recientes).
- También quedó conectado el tracking de WhatsApp y checkout que faltaba para Meta (`WhatsAppButton`/`WhatsAppFab` aceptan `onClick`).
- Verificado: curl end-to-end (5 eventos → funnel/totals correctos, WA click contado) + screenshot del panel admin renderizando bien. Datos de prueba limpiados.

## ✅ Jul 2026 — Leads del Demo: centro de acción (limpieza + convertir a cliente) [LISTO; curl e2e + screenshot]
- **Backend** (`server.py`): `PUT /api/admin/demo-leads/{id}` (status new|potential|contacted|customer|dismissed + notas), `DELETE /api/admin/demo-leads/{id}`, `POST /api/admin/demo-leads/bulk-delete` (ids[]), `POST /api/admin/demo-leads/{id}/to-client` (crea/reusa cliente en el CRM del super-admin con nota "Vino del demo").
- **Frontend** (`AdminLeads.js`, pestaña "Demo en vivo"): buscador (nombre/email/tel/oficio) para hallar pruebas propias, filtros (Todos/🔥Completaron/⭐Potenciales/En mi CRM/Descartados), resumen de "más calientes", selección múltiple + "Borrar seleccionados", y por tarjeta: WhatsApp/Email directos, Agregar a mi CRM, Potencial, Contactado, Descartar, Notas, borrar individual.
- Verificado: curl (crear lead → potential → to-client → reuse → bulk-delete OK; cliente creado y limpiado) + screenshot del panel renderizando bien.

## ✅ Jul 2026 — Demo corto (/demo) equiparado + A/B con demo completo [LISTO; testing_agent 100% + curl]
- Aplicados al demo corto (`DemoFlow.js`, ruta `/demo`) los mismos cambios del `/demo-flujo`: (1) **tracking propio de embudo** etiquetado como demo `corto` (5 pasos), (2) **Service Agreement instantáneo** (sin espera de IA, `buildDemoAgreement`), (3) **WhatsApp** (FAB flotante + botón final para dudas, con tracking), (4) **pago listo**: el CTA final va a `/register?plan=bundle[_founder]` que dispara Stripe checkout (tarjeta upfront, $0 hoy, trial 14 días) — verificado devuelve `cs_test_`.
- **Panel de Analíticas** (`AdminDemoAnalytics.js`) ahora tiene **toggle A/B** "Demo completo" vs "Demo corto (facturas)"; backend `GET /admin/demo-analytics?demo=flujo|corto` filtra por variante con labels/embudo propios. Sesiones sin etiqueta = "flujo".
- **i18n**: `?lang=es` / `?lang=en` fuerzan idioma desde el link (útil para ads) — `i18n/index.js` con `querystring` en detección.
- Verificado por testing_agent (frontend 100%, 7/7 items) + curl (analytics corto separado, path de pago Stripe). Datos de prueba limpiados.

## 🔜 Backlog

- 🟡 P1: Programa de referidos ("Invita un compa → ambos 1 mes gratis"); recordatorios al cliente (SMS/Email) 1 día antes; exportar Agenda `.ics`.
- 🟢 P2: Botón "📲 Enviarme esto por WhatsApp" al final de cada rama del demo (captura lead + entrega sample); upsell 1-clic en Perfil→Suscripción; auto-enviar links de pago.
- 🟢 P3/Tech-debt: refactor `server.py` (6100+ líneas) en routers; script dedupe clientes/usuarios.
- 🔵 Bloqueado: GMB Legacy API 403 (whitelisting Google, proyecto scenic-healer-468818-h5).
- Futuro: Stripe webhook para marcar facturas pagadas de forma robusta.
