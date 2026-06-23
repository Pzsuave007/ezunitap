/**
 * Tours — central per-page guided tour definitions.
 *
 * Each tour is an array of steps. The `target` is a CSS selector
 * (we use data-testid attribute selectors so we don't depend on class names).
 * Step copy is pulled from the i18n dictionaries (tours.<page>.<index>) so the
 * tours are fully bilingual without duplicating the structure.
 */

const SELECTOR = (testid) => `[data-testid="${testid}"]`;

// Structure: targets + placement per page. Content comes from i18n via getTours(t).
const STRUCTURE = {
  dashboard: [
    { target: SELECTOR("quick-ai-quote"), placement: "bottom", disableBeacon: true },
    { target: SELECTOR("quick-new-client"), placement: "bottom" },
    { target: SELECTOR("quick-new-invoice"), placement: "bottom" },
    { target: SELECTOR("stat-invoices"), placement: "top" },
    { target: SELECTOR("view-invoices-btn"), placement: "top" },
    { target: SELECTOR("dashboard-settings-btn"), placement: "left" },
  ],
  clients: [
    { target: SELECTOR("new-client-btn"), placement: "bottom", disableBeacon: true },
    { target: "body", placement: "center" },
  ],
  quotes: [
    { target: SELECTOR("new-quote-btn"), placement: "bottom", disableBeacon: true },
    { target: SELECTOR("filter-all"), placement: "bottom" },
    { target: "body", placement: "center" },
  ],
  invoices: [
    { target: SELECTOR("new-invoice-btn"), placement: "bottom", disableBeacon: true },
    { target: "body", placement: "center" },
  ],
  agreements: [
    { target: SELECTOR("new-agreement-btn"), placement: "bottom", disableBeacon: true },
    { target: "body", placement: "center" },
    { target: "body", placement: "center" },
  ],
  jobs: [
    { target: SELECTOR("new-job-btn"), placement: "bottom", disableBeacon: true },
    { target: "body", placement: "center" },
  ],
  calendar: [
    { target: SELECTOR("cal-today"), placement: "bottom", disableBeacon: true },
    { target: SELECTOR("cal-prev"), placement: "bottom" },
    { target: "body", placement: "center" },
  ],
  card: [
    { target: SELECTOR("card-public-url"), placement: "bottom", disableBeacon: true },
    { target: SELECTOR("card-businesstype"), placement: "auto" },
    { target: SELECTOR("card-ai-context"), placement: "auto" },
    { target: SELECTOR("card-color"), placement: "auto" },
    { target: SELECTOR("card-add-service"), placement: "auto" },
  ],
  messages: [
    { target: SELECTOR("msg-client-select"), placement: "bottom", disableBeacon: true },
    { target: SELECTOR("msg-input"), placement: "top" },
    { target: SELECTOR("msg-generate"), placement: "top" },
    { target: "body", placement: "center" },
  ],
  scope: [
    { target: SELECTOR("scope-input"), placement: "bottom", disableBeacon: true },
    { target: SELECTOR("scope-generate"), placement: "top" },
    { target: "body", placement: "center" },
  ],
};

// Build the localized tours object from a translation function `t`.
export function getTours(t) {
  const out = {};
  for (const [page, steps] of Object.entries(STRUCTURE)) {
    out[page] = steps.map((s, i) => ({ ...s, content: t(`tours.${page}.${i}`) }));
  }
  return out;
}

export default getTours;
