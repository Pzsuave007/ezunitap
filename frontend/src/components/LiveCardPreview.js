import { useEffect, useRef, useState } from "react";
import { Globe, Phone, MessageSquare, Send, Mail, QrCode, Share2, Save, Sparkles } from "lucide-react";

// Shared phone-mockup preview of the Smart Card mini-site.
// Used in the card editor (CardAdmin) AND on the dashboard Presencia block
// so both look exactly the same.

export function PhoneFrame({ children }) {
  // Outer phone frame; inner content is rendered at 320×600 by ScaledCanvas.
  const FULL_W = 320;
  const FULL_H = 600;
  return (
    <div className="relative mx-auto w-full" style={{ aspectRatio: `${FULL_W} / ${FULL_H + 16}` }}>
      <div className="absolute inset-0 rounded-[20px] bg-slate-950 p-[3px] shadow-xl shadow-slate-900/30">
        <div className="absolute top-[3px] left-1/2 -translate-x-1/2 w-10 h-2 rounded-b-xl bg-slate-950 z-20" />
        <div className="w-full h-full rounded-[17px] overflow-hidden relative bg-slate-900">
          <ScaledCanvas fullW={FULL_W} fullH={FULL_H}>{children}</ScaledCanvas>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders children at fixed FULL_W x FULL_H and scales them down via CSS transform
 * to fit the parent container. Uses ResizeObserver so the scale is precise.
 */
function ScaledCanvas({ fullW, fullH, children }) {
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = e.contentRect.width;
        if (w > 0) setScale(w / fullW);
      }
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [fullW]);
  return (
    <div ref={wrapRef} className="absolute inset-0 overflow-hidden">
      <div
        style={{
          width: fullW,
          height: fullH,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function LiveCardPreview({ card, user, variant }) {
  const brand = card.brand_color || "#1E3A8A";
  const accent = card.accent_color || "#10B981";
  const brandDeep = adjustColor(brand, -45);
  const photoId = card.profile_photo_id;
  const logoId = card.logo_photo_id;
  const coverId = card.cover_photo_id;
  const profileUrl = photoId ? `${process.env.REACT_APP_BACKEND_URL}/api/public/card/photo/${photoId}` : null;
  const logoUrl = logoId ? `${process.env.REACT_APP_BACKEND_URL}/api/public/card/photo/${logoId}` : null;
  const coverUrl = coverId ? `${process.env.REACT_APP_BACKEND_URL}/api/public/card/photo/${coverId}` : null;
  const businessName = user?.business_name || "Mi Negocio";
  const ownerName = user?.owner_name || "";
  const role = card.role || ownerName;
  const initials = (ownerName || businessName).split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  // Real-size building blocks (rendered at 320×600 then scaled down by ScaledCanvas)
  const TopBar = () => (
    <div className="absolute top-4 inset-x-4 flex items-center justify-between z-20">
      {logoUrl ? (
        <div className="w-12 h-12 rounded-2xl bg-white shadow-md p-1.5">
          <img src={logoUrl} alt="" className="w-full h-full object-contain" />
        </div>
      ) : (
        <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25" />
      )}
      <div className="px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-white inline-flex items-center gap-1.5">
        <Globe className="w-3 h-3" />
        <span className="text-[11px] font-bold">ES</span>
      </div>
    </div>
  );

  const ActionButtons = () => (
    <div className="grid grid-cols-4 gap-1.5 px-3 py-3 rounded-2xl backdrop-blur-md" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
      {[
        { Icon: Phone, label: "Call" },
        { Icon: MessageSquare, label: "Text" },
        { Icon: Send, label: "WhatsApp" },
        { Icon: Mail, label: "Email" },
      ].map(({ Icon, label }) => (
        <div key={label} className="flex flex-col items-center gap-1">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center shadow-lg"
            style={{ background: brand, boxShadow: `0 4px 12px ${brand}66` }}
          >
            <Icon className="w-5 h-5 text-white" strokeWidth={2.2} />
          </div>
          <div className="text-[10px] text-white/85 font-semibold">{label}</div>
        </div>
      ))}
    </div>
  );

  const SaveBar = () => (
    <div className="mt-2 rounded-2xl px-3 py-2.5 flex items-center gap-2 backdrop-blur-md" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
      <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center">
        <QrCode className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center">
        <Share2 className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="flex-1 flex items-center justify-center gap-1.5 text-white text-xs font-bold">
        <Save className="w-3.5 h-3.5" />
        Save Contact
      </div>
      <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: accent }}>
        <Sparkles className="w-3.5 h-3.5 text-white" />
      </div>
    </div>
  );

  if (variant === "photo") {
    return (
      <div
        className="w-full h-full relative overflow-hidden flex flex-col"
        style={{ background: `linear-gradient(180deg, ${brand} 0%, ${brandDeep} 100%)` }}
      >
        <div className="absolute inset-0">
          {profileUrl ? (
            <img src={profileUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="font-heading font-bold text-white/85 text-7xl tracking-tight">{initials || "?"}</div>
            </div>
          )}
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 30%, rgba(5,8,16,0.6) 65%, rgba(5,8,16,0.96) 100%)" }} />
        </div>
        <TopBar />
        <div className="mt-auto relative z-10 px-3 pb-3 text-white">
          <h2 className="font-heading font-bold text-[26px] leading-[1.05] drop-shadow-lg">{businessName}</h2>
          {role && <div className="text-base text-white/85 mt-1 drop-shadow">{role}</div>}
          <div className="mt-3">
            <ActionButtons />
          </div>
          <SaveBar />
        </div>
      </div>
    );
  }

  // logo_circle
  return (
    <div
      className="w-full h-full relative overflow-hidden flex flex-col"
      style={{ background: `radial-gradient(ellipse at top, ${brand} 0%, ${brandDeep} 80%)` }}
    >
      <div className="absolute inset-0">
        {coverUrl ? (
          <>
            <img src={coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(5,8,16,0.3) 0%, transparent 20%, transparent 60%, rgba(5,8,16,0.85) 90%, rgba(5,8,16,0.98) 100%)" }} />
          </>
        ) : logoUrl ? (
          <div className="absolute inset-0 flex items-start justify-center pt-20">
            <img src={logoUrl} alt="" className="max-w-[60%] max-h-[35%] object-contain opacity-90" />
          </div>
        ) : null}
      </div>
      <TopBar />
      {/* Avatar circle centered */}
      <div className="absolute left-1/2 top-[36%] -translate-x-1/2 -translate-y-1/2 z-10">
        <div className="w-[110px] h-[110px] rounded-full p-[3px]" style={{ background: `linear-gradient(135deg, ${brand}, ${accent})` }}>
          <div className="w-full h-full rounded-full bg-white p-[3px]">
            {profileUrl ? (
              <img src={profileUrl} alt="" className="w-full h-full object-cover rounded-full" />
            ) : (
              <div className="w-full h-full rounded-full flex items-center justify-center font-heading font-bold text-white text-2xl" style={{ background: brandDeep }}>
                {initials || "?"}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="mt-auto relative z-10 px-3 pb-3 text-white text-center">
        <h2 className="font-heading font-bold text-[24px] leading-[1.05] drop-shadow-lg">{businessName}</h2>
        {role && <div className="text-base text-white/85 mt-1 drop-shadow">{role}</div>}
        <div className="mt-3 text-left">
          <ActionButtons />
        </div>
        <SaveBar />
      </div>
    </div>
  );
}

// adjustColor helper — keep in sync with SmartCard's helper.
export function adjustColor(hex, amt) {
  if (!hex) return "#000000";
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = Math.max(0, Math.min(255, parseInt(h.slice(0, 2), 16) + amt));
  const g = Math.max(0, Math.min(255, parseInt(h.slice(2, 4), 16) + amt));
  const b = Math.max(0, Math.min(255, parseInt(h.slice(4, 6), 16) + amt));
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}
