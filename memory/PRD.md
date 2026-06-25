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

## ✅ Jun 25 2026 — Embed widget WordPress fix + OpenAI propia para self-host [CÓDIGO LISTO; deploy pendiente por usuario]
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

## 🔜 Backlog

- 🟡 P1: Programa de referidos ("Invita un compa → ambos 1 mes gratis"); recordatorios al cliente (SMS/Email) 1 día antes; exportar Agenda `.ics`.
- 🟢 P2: Botón "📲 Enviarme esto por WhatsApp" al final de cada rama del demo (captura lead + entrega sample); upsell 1-clic en Perfil→Suscripción; auto-enviar links de pago.
- 🟢 P3/Tech-debt: refactor `server.py` (6100+ líneas) en routers; script dedupe clientes/usuarios.
- 🔵 Bloqueado: GMB Legacy API 403 (whitelisting Google, proyecto scenic-healer-468818-h5).
- Futuro: Stripe webhook para marcar facturas pagadas de forma robusta.
