# UniTech — Changelog

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
