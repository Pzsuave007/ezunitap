// Shared color themes for the Marketing Studio (image posts + reels).
// id "card" = use the colors from the user's Smart Card (no override sent).
export const COLOR_THEMES = [
  { id: "card", label: "Mi tarjeta", brand: null, accent: null, swatch: "#94a3b8" },
  { id: "green", label: "Verde", brand: "#0f5f46", accent: "#10b981", swatch: "#10b981" },
  { id: "blue", label: "Azul", brand: "#1e3a8a", accent: "#3b82f6", swatch: "#3b82f6" },
  { id: "navy", label: "Marino", brand: "#0f172a", accent: "#38bdf8", swatch: "#0f172a" },
  { id: "black", label: "Negro", brand: "#171717", accent: "#f59e0b", swatch: "#171717" },
  { id: "red", label: "Rojo", brand: "#7f1d1d", accent: "#ef4444", swatch: "#ef4444" },
  { id: "orange", label: "Naranja", brand: "#7c2d12", accent: "#f97316", swatch: "#f97316" },
  { id: "purple", label: "Morado", brand: "#4c1d95", accent: "#a855f7", swatch: "#a855f7" },
  { id: "teal", label: "Turquesa", brand: "#134e4a", accent: "#14b8a6", swatch: "#14b8a6" },
  { id: "gold", label: "Dorado", brand: "#3f3f46", accent: "#eab308", swatch: "#eab308" },
];

// Resolve the brand/accent hex to send to the backend for a given selection.
export function resolveColors(theme, customBrand, customAccent) {
  if (theme === "custom") return { brand: customBrand, accent: customAccent };
  const t = COLOR_THEMES.find((c) => c.id === theme);
  if (!t || t.id === "card") return { brand: "", accent: "" };
  return { brand: t.brand, accent: t.accent };
}
