/**
 * Tours — central per-page guided tour definitions in Spanish.
 *
 * Each tour is an array of react-joyride steps. The `target` is a CSS selector
 * (we use data-testid attribute selectors so we don't depend on class names).
 *
 * Tone: warm, familiar Spanish — like a friend showing you the app.
 */

const SELECTOR = (testid) => `[data-testid="${testid}"]`;

export const TOURS = {
  dashboard: [
    {
      target: SELECTOR("quick-ai-quote"),
      content: "¡Aquí está tu botón mágico! 🪄 Toca esto para generar un quote profesional en inglés en menos de 30 segundos — solo describe el trabajo en español o sube una foto y la AI hace el resto.",
      placement: "bottom",
      disableBeacon: true,
    },
    {
      target: SELECTOR("quick-new-client"),
      content: "Agrega un nuevo cliente directo desde aquí. Cada cliente que metes acá te queda guardado con su historial completo — quotes, invoices, fotos, mensajes.",
      placement: "bottom",
    },
    {
      target: SELECTOR("quick-new-invoice"),
      content: "Crea un invoice desde cero. Si ya tenías un quote aprobado, mejor usa el botón 'Convert to Invoice' en el detalle del quote — se llena solo.",
      placement: "bottom",
    },
    {
      target: SELECTOR("stat-invoices"),
      content: "Estos números son tu pulso del negocio en tiempo real. Tócalos para entrar al detalle de cada sección.",
      placement: "top",
    },
    {
      target: SELECTOR("view-invoices-btn"),
      content: "¿Cuánto te deben? Aquí ves el total pendiente. Toca 'Ver invoices' para mandar recordatorios de pago a los clientes morosos.",
      placement: "top",
    },
    {
      target: SELECTOR("dashboard-settings-btn"),
      content: "Cuando necesites cambiar tu info de negocio, logo, dirección o teléfono — aquí está. También cambias tu password.",
      placement: "left",
    },
  ],

  clients: [
    {
      target: SELECTOR("new-client-btn"),
      content: "Agrega un cliente nuevo aquí. Solo el nombre y el teléfono son obligatorios — todo lo demás (email, dirección, notas) lo puedes llenar después.",
      placement: "bottom",
      disableBeacon: true,
    },
    {
      target: "body",
      content: "Toca cualquier cliente de la lista para ver su HISTORIAL COMPLETO: todos sus quotes, invoices, mensajes y fotos. Una sola pantalla con todo lo que has hecho con esa persona.",
      placement: "center",
    },
  ],

  quotes: [
    {
      target: SELECTOR("new-quote-btn"),
      content: "Aquí creas un quote nuevo. La AI te ayuda a redactarlo en inglés profesional aunque tú lo describas en español. Hasta una foto del trabajo se puede subir y la AI lo analiza. 🤖",
      placement: "bottom",
      disableBeacon: true,
    },
    {
      target: SELECTOR("filter-all"),
      content: "Filtra tus quotes por estado — borrador, enviados, aprobados, declinados, convertidos a invoice. Te ayuda a saber cuáles necesitan seguimiento.",
      placement: "bottom",
    },
    {
      target: "body",
      content: "Toca cualquier quote para abrir el detalle. Desde ahí copias el link público para mandar al cliente por WhatsApp, marcas como aprobado, generas el PDF, o lo conviertes en invoice.",
      placement: "center",
    },
  ],

  invoices: [
    {
      target: SELECTOR("new-invoice-btn"),
      content: "Crea un invoice nuevo. Si vienes de un quote aprobado, mejor convierte el quote desde su detalle — te llena los line items automáticamente. Y si firmaste un contrato vinculado al quote, el invoice se crea SOLO en draft.",
      placement: "bottom",
      disableBeacon: true,
    },
    {
      target: "body",
      content: "Cada invoice puede estar en draft, enviado, pagado, pago parcial o vencido. Tócalo para registrar pagos del cliente o mandar el link de cobro.",
      placement: "center",
    },
  ],

  agreements: [
    {
      target: SELECTOR("new-agreement-btn"),
      content: "Genera contratos legales en inglés con AI en 15 segundos. La AI detecta el tipo de servicio que describes y arma las cláusulas correctas — liability, cancelación, garantía, todo.",
      placement: "bottom",
      disableBeacon: true,
    },
    {
      target: "body",
      content: "Cada contrato tiene un link público que mandas al cliente. Él lo abre, firma con su dedo o el botón 'I Accept' y queda guardado con fecha, hora y firma. Válido bajo ESIGN Act. 🖋️",
      placement: "center",
    },
    {
      target: "body",
      content: "🎯 Truco pro: cuando el cliente firma un contrato vinculado a un quote, el invoice se crea SOLO en draft. Tú solo lo revisas y mandas el link. Cobrar nunca fue tan fácil.",
      placement: "center",
    },
  ],

  jobs: [
    {
      target: SELECTOR("new-job-btn"),
      content: "Programa un trabajo aquí. Le pones fecha, hora, cliente y dirección. Si es recurrente (cada lunes, semanal, mensual) lo marcas y se repite solo en el calendario.",
      placement: "bottom",
      disableBeacon: true,
    },
    {
      target: "body",
      content: "Los trabajos tienen un pipeline de estados: nuevo lead → estimate sent → aprobado → programado → en progreso → esperando pago → completado. Te ayuda a saber dónde está cada proyecto.",
      placement: "center",
    },
  ],

  calendar: [
    {
      target: SELECTOR("cal-today"),
      content: "Vuelve al día de hoy con este botón. Útil cuando estás navegando meses adelante.",
      placement: "bottom",
      disableBeacon: true,
    },
    {
      target: SELECTOR("cal-prev"),
      content: "Navega entre semanas o meses con las flechas ‹ ›.",
      placement: "bottom",
    },
    {
      target: "body",
      content: "Toca cualquier día para crear o ver los trabajos programados ese día. Los trabajos recurrentes (corte semanal de zacate, etc.) aparecen automáticamente en cada fecha que les toca.",
      placement: "center",
    },
  ],

  card: [
    {
      target: SELECTOR("card-color"),
      content: "Estos son los colores de tu marca. Cambian el header de tu tarjeta digital. Elige uno que te represente — verde, azul, lo que sea.",
      placement: "bottom",
      disableBeacon: true,
    },
    {
      target: SELECTOR("card-businesstype"),
      content: "Llena bien estas secciones — son las que tus clientes leen cuando reciben tu tarjeta. Mientras más completo, más confianza les das.",
      placement: "top",
    },
    {
      target: SELECTOR("card-add-service"),
      content: "Agrega cada servicio que ofreces con precio (o 'Quote on request'). Los clientes los ven al abrir tu tarjeta. Esto te ahorra explicar lo mismo 100 veces por WhatsApp.",
      placement: "top",
    },
    {
      target: SELECTOR("card-ai-context"),
      content: "🤖 Truco pro: aquí entrenas a la AI de tu tarjeta. Dile cómo cotizas, qué áreas atiendes, política de cancelación, etc. Cuando un cliente le pregunte algo en el chat de tu tarjeta, la AI le contesta con TU información — capturando el lead automáticamente.",
      placement: "top",
    },
    {
      target: "body",
      content: "Cuando termines, tu tarjeta vive en una URL pública (tipo `ezunitap.com/c/tu-negocio`). La compartes por WhatsApp, le imprimes un QR para tu camioneta, o se la guardan en el iPhone como un contacto. Tu marketing pasivo 24/7.",
      placement: "center",
    },
  ],

  messages: [
    {
      target: SELECTOR("msg-client-select"),
      content: "Elige el cliente al que le vas a escribir (opcional — si no eliges, escribe genérico).",
      placement: "bottom",
      disableBeacon: true,
    },
    {
      target: SELECTOR("msg-input"),
      content: "Dile a la AI qué quieres comunicar EN ESPAÑOL — por ejemplo: 'recordarle que me debe el 50% del trabajo del jueves'. La AI traduce a inglés profesional.",
      placement: "top",
    },
    {
      target: SELECTOR("msg-generate"),
      content: "Toca aquí y la AI te genera el mensaje completo en inglés — listo para copiar y pegar en WhatsApp/SMS/email. Suena profesional sin que tengas que pensar en cómo escribirlo.",
      placement: "top",
    },
    {
      target: SELECTOR("msg-copy"),
      content: "Cuando ya esté listo, copia con un toque y mándalo desde tu app de WhatsApp/SMS/email favorita. Así no dependes de nuestros servicios para mandar.",
      placement: "top",
    },
  ],

  scope: [
    {
      target: SELECTOR("scope-input"),
      content: "Describe el trabajo EN ESPAÑOL — qué incluye, qué no, materiales, tiempos. La AI te lo arma en un Scope of Work profesional en inglés, listo para anexar a tu quote o contrato.",
      placement: "bottom",
      disableBeacon: true,
    },
    {
      target: SELECTOR("scope-generate"),
      content: "Toca aquí y la AI lo redacta. Incluye 'lo que SÍ' y 'lo que NO' — esto te ahorra peleas con clientes que después dicen 'es que yo pensé que también incluía...'",
      placement: "top",
    },
    {
      target: SELECTOR("scope-copy"),
      content: "Copia el scope generado y pégalo donde lo necesites — en el campo de notas del quote, en un email al cliente, o en el contrato.",
      placement: "top",
    },
  ],
};

export default TOURS;
