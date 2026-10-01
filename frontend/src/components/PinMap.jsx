import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Free OpenStreetMap tiles (no API key). A CSS filter on the tile pane
// (.pinmap-dark-tiles, see index.css) gives it a dark look to match the site.
const DARK_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const dotIcon = (accent) =>
  L.divIcon({
    className: "pinmap-dot",
    html: `<span style="display:block;width:16px;height:16px;border-radius:9999px;background:${accent};border:2px solid #fff;box-shadow:0 0 12px ${accent}"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

const validPins = (pins) =>
  (Array.isArray(pins) ? pins : []).filter(
    (p) => p && p.lat != null && p.lng != null && p.lat !== "" && p.lng !== "" &&
      !Number.isNaN(Number(p.lat)) && !Number.isNaN(Number(p.lng))
  );

/**
 * Real interactive map (Leaflet + OpenStreetMap). Works in two modes:
 *  - readonly (public site): shows the pins, auto-fits bounds, no key needed.
 *  - editable (editor): click to drop a pin, drag to move; parent handles labels.
 */
export function PinMap({ pins = [], onChange, editable = false, accent = "#F5A623", height = 420 }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const pinsRef = useRef(pins);
  pinsRef.current = pins;

  // init once
  useEffect(() => {
    if (mapRef.current || !elRef.current) return;
    const map = L.map(elRef.current, {
      scrollWheelZoom: editable,
      worldCopyJump: true,
      attributionControl: true,
    }).setView([39.5, -98.35], 3);
    L.tileLayer(DARK_TILES, { attribution: ATTR, maxZoom: 19, subdomains: "abc", className: "pinmap-dark-tiles" }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    if (editable) {
      map.on("click", (e) => {
        const next = [
          ...(pinsRef.current || []),
          { label: "", lat: +e.latlng.lat.toFixed(5), lng: +e.latlng.lng.toFixed(5) },
        ];
        onChange && onChange(next);
      });
    }
    // expose a flyTo for the parent search box
    if (elRef.current) elRef.current._leaflet_map = map;
    setTimeout(() => map.invalidateSize(), 150);
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // (re)draw markers whenever pins change
  useEffect(() => {
    const map = mapRef.current;
    const grp = layerRef.current;
    if (!map || !grp) return;
    grp.clearLayers();
    const vp = validPins(pins);
    vp.forEach((p) => {
      const m = L.marker([Number(p.lat), Number(p.lng)], {
        icon: dotIcon(accent),
        draggable: editable,
        title: p.label || "",
      });
      if (p.label) m.bindTooltip(p.label, { direction: "top", offset: [0, -10], opacity: 0.95 });
      if (editable) {
        m.on("dragend", () => {
          const ll = m.getLatLng();
          const idx = pins.indexOf(p);
          const next = pins.map((x, xi) =>
            xi === idx ? { ...x, lat: +ll.lat.toFixed(5), lng: +ll.lng.toFixed(5) } : x
          );
          onChange && onChange(next);
        });
      }
      m.addTo(grp);
    });
    if (!editable && vp.length) {
      try {
        map.fitBounds(L.latLngBounds(vp.map((p) => [Number(p.lat), Number(p.lng)])).pad(0.35), {
          maxZoom: 6,
        });
      } catch (_) {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, accent, editable]);

  return <div ref={elRef} style={{ height, width: "100%" }} data-testid="pin-map" />;
}

/** Geocode an address/city with the free OpenStreetMap Nominatim service. */
export async function geocode(query) {
  if (!query || !query.trim()) return null;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query.trim())}`;
  const res = await fetch(url, { headers: { "Accept-Language": "es,en" } });
  const data = await res.json();
  if (!data || !data.length) return null;
  return { lat: +(+data[0].lat).toFixed(5), lng: +(+data[0].lon).toFixed(5), display: data[0].display_name };
}

export default PinMap;
