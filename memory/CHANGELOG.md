# UniTech — Changelog

## Jun 2026 — Cinematic ContactBlock pulido (verificado)
- ContactBlock (`ContractorSite.js` ~L1718): texto alineado con el formulario (`items-start`) y párrafo invitador nuevo debajo de "Trusted by our community" para llenar espacio vacío.
- Frontend recompilado (`yarn build`) y staged (`git add -f build/*`). Verificado con `screenshot_tool` en `/sitio/spokane-roofing-co` (template Cinematic).


## Jul 2026 — Demo corto (/demo) optimizado para campaña de facturas
- **Fix crítico de conversión (basado en datos):** el embudo mostró -95.7% de caída en el formulario de entrada (nombre/tel/email). Se quitó el gate.
  - Intro sin fricción: solo **nombre del cliente pre-llenado** ("María González", editable, con nota "solo se usa en los documentos") + **oficio (opcional)** + botón "Ver la demostración". Sin email/teléfono.
  - Backend `/public/demo/start`: name/email ahora OPCIONALES (inicio anónimo). Guard de abuso subido a 60/día/IP.
  - Nuevo `POST /public/demo/{id}/contact`: captura de contacto OPCIONAL al final (warm-lead) → alimenta "Demo en vivo".
  - Captura opcional en la tarjeta final ("¿Te mandamos esta cotización? nombre+email").
- **Precio Fundador Negocio:** plan `negocio_founder` = $29/mes de por vida, primeros 100 (backend `negocio_founder_status`, endpoint `/payments/negocio-founder-status`). CTA del demo lo muestra si hay cupos; si no, cae a Negocio $39.99. Register.js maneja planes `*_founder`.
- **Métodos de pago visibles:** banner "Cobra como tú quieras: tarjeta, Venmo, Zelle, Cash App y PayPal" en la factura (el producto real los soporta).
- **Oficios completos (23)** + **auto-llenado de la descripción** por oficio (editable).
- **Service Agreement instantáneo** (sin espera de IA), **WhatsApp** (FAB + final), **pago listo** (register → Stripe checkout, tarjeta upfront, $0 hoy, trial 14 días).
- **Tracking A/B propio**: sesiones etiquetadas `corto` vs `flujo`; panel `/admin/demo` con toggle de variante.
- **i18n por link**: `?lang=es` / `?lang=en` fuerzan idioma.
- Verificado: curl (anon start, contact capture, founder $29 checkout Stripe) + screenshots (intro sin gate, factura con banner, final con oferta+captura).


## Jun 2026 — Website Builder: imágenes por sección + optimización de carga
- **Nuevas secciones visuales (todas las 10 plantillas, componentes compartidos y theme-aware en `ContractorSite.js`):**
  - `AboutBlock`: collage 2x2 (foto de equipo + galería + stock) + historia + badges + CTA. Se muestra si hay texto de About.
  - `FeatureBlock`: imagen al lado de un checklist de beneficios + botón "Get Started Today". Reemplaza el grid clásico de "Why" cuando está activo (sin duplicación).
  - `CtaBand`: banner full-bleed con imagen de fondo + overlay + botón "Call Now".
  - Todas se muestran **por defecto con stock del oficio** para que el sitio se vea completo (vendible); el dueño/cliente puede subir sus fotos luego.
- **Editor (`WebsiteEditor.js`):** pestaña "Photos" con 3 selectores nuevos (`team_photo_id`, `why_photo_id`, `band_photo_id`) vía componente `PhotoField`. Pestaña "Sections" con toggles `feature` y `band`.
- **Backend (`server.py`):** `WebsiteIn` + `_WEBSITE_DEFAULT_SECTIONS` + GET /website con los 3 campos nuevos (default "").
- **Fix de rendimiento (causa raíz del load lento):** las fotos se servían en tamaño/formato original (una foto = 2.6MB PNG, 3.3s). Ahora `GET /api/public/card/photo/{id}` reconvierte a **WebP** y **redimensiona al vuelo** (`?w=`), con caché en memoria y cabecera `Cache-Control: immutable` (1 año). Frontend pide tamaños exactos por sección + **lazy-load** debajo del pliegue. Reducción ~87–98% (2.6MB → 42–212KB).
  - Nota: el ingress de **preview** fuerza `no-store` (no cachea entre visitas); en **producción (Apache propio)** sí se respeta `immutable`.
- **Verificado:** testing_agent (autorizado por el dueño esta vez) — 100% frontend, backend 5/6 (1 sugerencia menor aplicada). Sin regresiones.

## Jun 2026 — Fix: fotos de galería "en todos lados" + selectores más limpios
- **Bug:** al elegir fotos de galería, aparecían en About/Feature/banda/servicios. Causa: los respaldos usaban `data.photos` (galería). **Fix (`ContractorSite.js`):** cada sección usa SOLO su foto asignada o **stock** (`pool`, `teamImg`, `whyImg`, `bandImg`, `_collage` ya no usan fotos de galería). La galería queda solo en su sección.
- **Editor (`WebsiteEditor.js`):** `PhotoField` rediseñado — muestra SOLO la foto en uso + botón "Elegir/Cambiar" que abre el chooser (carpeta o subir). Hero ahora usa `PhotoField`. Galería: grid de todas las fotos oculto tras botón "Agregar fotos". Ya no se ven todas las fotos de la cuenta en cada sección.
- Nuevas claves i18n: choosePhoto, galleryAddBtn, done. Verificado con navegador headless (0 fotos de usuario filtradas en About/banda; editor sin grid por defecto). Footer del bloque anterior queda intacto.

## Jun 2026 — Instagram para contenido con IA + booking embebido + headers con menú
- **Instagram → IA (combo pragmático):** campo `instagram_url` en el editor (tarjeta "Generate with AI"). Backend `_fetch_instagram_context()` lee el texto público (og:description/meta/title) best-effort y lo agrega al contexto de `POST /website/ai-generate` (fallback silencioso si IG bloquea). El link también alimenta `business.instagram` del sitio público (footer). NOTA: Instagram Basic Display API fue descontinuada por Meta (dic 2024); no se usan fotos de IG (upload/stock).
- **Booking embebido:** al activar booking, `ContactBlock` (9 plantillas) y Trust (form propio, modo inline) reemplazan el form de contacto por `BookingForm` (día→hora→datos, consume `/public/card/{slug}/availability` y crea cita en `/public/card/{slug}/appointment`). Verificado en las 10 plantillas + envío end-to-end.
- **Headers de las 10 plantillas:** se quitaron TODOS los botones del top (Call Now / Free Quote / Get Quote) y se reemplazaron por menú hamburguesa compartido `NavMenu`. Nombre del negocio siempre completo (flex-1 min-w-0). Toggle EN/ES movido a abajo-izquierda.
- **Mobile Cinematic:** fuente Anton (condensada), títulos sin overflow. **Craftsman/OnePage/Luxe/Playful:** nombre a la izquierda legible; reseñas a tamaño normal.
- **Rendimiento imágenes:** endpoint de fotos reconvierte a WebP + resize on-the-fly (?w=) + lazy-load. About collage respeta exactamente las fotos elegidas (1→1, 4→4) con multi-selector.
