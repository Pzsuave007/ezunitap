/**
 * First-party demo analytics. Fires lightweight, anonymous events to OUR backend
 * so we can see the full funnel of /demo-flujo (steps reached, drop-off, WhatsApp
 * & checkout intent, completion) WITHOUT depending on Meta. Fully non-blocking
 * and safe — it never throws and never blocks the demo.
 */
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const TRACK_URL = `${BACKEND_URL}/api/public/demo/track`;
const SID_KEY = "sf_demo_sid";

export const getDemoSessionId = () => {
  try {
    let sid = sessionStorage.getItem(SID_KEY);
    if (!sid) {
      sid = `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(SID_KEY, sid);
    }
    return sid;
  } catch {
    return `d_${Date.now().toString(36)}`;
  }
};

const device = () =>
  typeof navigator !== "undefined" &&
  /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "")
    ? "mobile"
    : "desktop";

export const trackDemo = (event, data = {}) => {
  try {
    const body = JSON.stringify({
      session_id: getDemoSessionId(),
      event,
      step: typeof data.step === "number" ? data.step : null,
      trade: data.trade || "",
      device: device(),
      ref: data.ref || "",
      demo: data.demo || "",
      meta: data.meta || {},
    });
    // keepalive lets the request survive a page unload (abandon tracking).
    if (typeof fetch === "function") {
      fetch(TRACK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    /* never break the demo for analytics */
  }
};
