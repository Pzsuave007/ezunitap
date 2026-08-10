# UniTech — Reglas de UX obligatorias (leer SIEMPRE antes de construir)

## ❌ NADA de popups/modales normales (regla del dueño, Ago 2026)
El dueño lo pidió explícitamente y es INNEGOCIABLE:

- **PROHIBIDO** usar modales/diálogos centrados con fondo gris (overlay) para CUALQUIER
  función del webapp (agregar/editar/crear/confirmar/ver detalle, etc.).
  Motivo real: en ciertas laptops/ventanas el modal no cabe y esconde botones
  (ej. "Guardar"), y su comportamiento varía entre navegadores. No es confiable.
- **TODA función se hace en una PÁGINA propia (estática, con su ruta)**, con el
  layout normal de la app y scroll normal del documento. Ej: agregar cliente =
  `/clientes/nuevo` (página), NO un `<Dialog>`.
- Al construir algo nuevo: crear ruta + página dedicada. NUNCA meter un
  `Dialog`/`AlertDialog`/`DialogContent` centrado con overlay gris.

### ✅ Únicas excepciones permitidas (NO tocar)
Estos son bottom-sheets que suben desde abajo (slide-up), NO popups centrados:
1. Los avisos de "la IA está trabajando" (ej. `BusySheet` en DemoFlow/DemoFlujo,
   `GeneratingOverlay`, drawers de "Preparando…" en Marketing).
2. Los resultados del **Marketing Studio** que se muestran como panel slide-up
   (result drawer/sheet con el post generado, personalización, etc.).

Si dudas si algo cuenta como excepción: si sube desde abajo (Sheet/Drawer bottom)
y es "IA trabajando" o "resultado de Marketing Studio" → OK. Cualquier otra cosa
centrada con overlay gris → convertir a página.

## Historial de conversión (modal → página)
- Ago 2026: "Agregar cliente" pasó de `<Dialog>` en `Clients.js` a página
  `pages/ClientForm.js` (rutas `/clientes/nuevo`). `Clients.js` ahora solo navega.
  Pendiente de barrido: revisar y convertir otros `<Dialog>` de acción del app
  (Clientes ✅ add). Editar cliente ya era inline (OK). Otros por revisar:
  Calendar, Jobs, InvoiceDetail, QuoteDetail, AgreementDetail, CardAdmin,
  AdminAccounts, componentes SendDocumentDialog/ClientScopeDialog, etc.
