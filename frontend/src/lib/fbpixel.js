/**
 * Thin, safe wrapper around the Meta (Facebook) Pixel `fbq`.
 * The base pixel + PageView are loaded in public/index.html.
 * These helpers fire standard + custom conversion events for the funnel:
 *   PageView (auto) -> DemoStarted/Lead -> DemoQuoteGenerated ->
 *   CompleteRegistration/StartTrial -> Subscribe.
 * All calls are no-ops if fbq isn't available (e.g. blocked by an ad blocker).
 */
export const fbTrack = (event, params) => {
  try {
    if (typeof window !== "undefined" && window.fbq) {
      window.fbq("track", event, params || {});
    }
  } catch (_) {
    /* never let analytics break the app */
  }
};

export const fbTrackCustom = (event, params) => {
  try {
    if (typeof window !== "undefined" && window.fbq) {
      window.fbq("trackCustom", event, params || {});
    }
  } catch (_) {
    /* noop */
  }
};

export const fbPageView = () => fbTrack("PageView");
