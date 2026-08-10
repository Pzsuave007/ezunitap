# UniTech — PRD (resumen vivo)

## Producto
SaaS móvil para contratistas latinos. 3 módulos: **Presencia** (Tarjeta NFC + Reseñas Google), **Negocio** (CRM + Cotización IA + Contratos + Facturas + Trabajos + Agenda), **Marketing** (Estudio Social IA: posts, reels, imágenes). UI dueño en español, documentos cliente en inglés. Multi-tenant. Dominios: ezunitap.com / ezunitech.com.

## Stack / despliegue
- Frontend React (`/app/frontend`) Tailwind + Shadcn. Backend FastAPI (`/app/backend`) + MongoDB.
- **Producción cPanel**: compilar con `REACT_APP_BACKEND_URL=''` (relativo `/api`) y `git add -f frontend/build`. Producción corre **Python 3.9** → usar `Optional[x]`, no `x | None`.
- Integraciones: Stripe (Connect), Meta Pixel, ElevenLabs, Google Business OAuth, OpenAI/Gemini vía Emergent LLM Key.

## Credenciales de prueba
- Super-admin: pzsuave007@gmail.com / Uni2mkt007!
- Card-only: cardonly_test@example.com / Test1234 (manual_plan presencia)
- Marketing-only: mktonly_test@example.com / Test1234 (manual_plan marketing)

---

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
