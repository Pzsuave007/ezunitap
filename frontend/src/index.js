import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import "@/i18n";
import App from "@/App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// PWA: register the service worker so the app is installable ("Add to Home Screen").
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
  // When a new SW takes over (new build), reload once to drop any stale bundle.
  navigator.serviceWorker.addEventListener("message", (e) => {
    if (e.data && e.data.type === "SW_UPDATED" && !sessionStorage.getItem("sw_reloaded")) {
      sessionStorage.setItem("sw_reloaded", "1");
      window.location.reload();
    }
  });
}
