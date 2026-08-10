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
- Ago 2026: "Agregar trabajo" pasó de `<Dialog>` en `Jobs.js` a página
  `pages/JobForm.js` (ruta `/trabajos/nuevo`). `Jobs.js` ahora solo navega.
- Ago 2026: "Agregar/editar trabajo en Calendario" (JobEditor con modos
  único/proyecto/recurrente) pasó de `<Dialog>` en `Calendar.js` a página
  `pages/CalendarJobForm.js` (rutas `/calendario/nuevo?date=` y `/calendario/:id/editar`).
  `Calendar.js`: eliminado componente JobEditor + estados editorOpen/editingJobId +
  imports de form ya sin uso. `startNew`/`startEdit` ahora navegan. El detalle de
  evento (EventDetail) sigue como Sheet slide-up (no es popup centrado).
  Editar cliente ya era inline (OK). En `Jobs.js` QUEDAN (por decisión del dueño,
  solo pidió convertir "agregar trabajo") popups menores: agendar (scheduleJob),
  subir foto (photoJob) y SendDocumentDialog — revisar/convertir si el dueño lo pide.
- Ago 2026: `SendDocumentDialog` ("Send Invoice/Quote/Agreement") pasó de `<Dialog>`
  centrado a `<Sheet side="bottom">` (slide-up desde abajo) — patrón permitido, igual
  que EventDetail/BusySheet. Mantiene botón "Enviar con PDF adjunto" (Web Share API).
  Nota: en Jobs quedan aún scheduleJob/photoJob como Dialog centrado.
