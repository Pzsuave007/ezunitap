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

---

## 🔜 Backlog
- 🟡 P1: Programa de referidos ("Invita un compa → ambos 1 mes gratis"); recordatorios al cliente (SMS/Email) 1 día antes; exportar Agenda `.ics`.
- 🟢 P2: Botón "📲 Enviarme esto por WhatsApp" al final de cada rama del demo (captura lead + entrega sample); upsell 1-clic en Perfil→Suscripción; auto-enviar links de pago.
- 🟢 P3/Tech-debt: refactor `server.py` (6100+ líneas) en routers; script dedupe clientes/usuarios.
- 🔵 Bloqueado: GMB Legacy API 403 (whitelisting Google, proyecto scenic-healer-468818-h5).
- Futuro: Stripe webhook para marcar facturas pagadas de forma robusta.
