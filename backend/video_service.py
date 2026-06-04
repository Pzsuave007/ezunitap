"""Reel (vertical 9:16 video) renderer — Marketing Studio Phase 2.

Turns a user's photos + AI copy + Smart Card branding into an animated MP4 reel.
Selectable options:
  - Template: showcase / before_after / promo / services / testimonial
  - Motion (per photo): zoom_in / zoom_out / pan / auto
  - Transition: fade / slide / wipe / circle / dissolve / pixelize
  - Burned subtitles (caption chunks, readable without sound)
  - Outro card (logo + business name + phone + CTA)
  - Audio: bundled royalty-free music, the user's own upload, AI voice-over, or none
  - Duration: 10 / 15 / 20 seconds

Pure FFmpeg via subprocess; overlays composed with Pillow (reusing social_service).
"""
import io
import os
import shutil
import subprocess
import tempfile
from typing import List, Optional

from PIL import Image, ImageDraw

import social_service as ss

W, H, FPS = 1080, 1920, 30
OUTRO_LEN = 2.0
TD_DEFAULT = 0.6
TD_SLIDER = 1.0
_SCALE = "scale=1620:2880:force_original_aspect_ratio=increase,crop=1620:2880,"

MUSIC_TRACKS = [
    {"id": "energetica", "label": "Energética", "desc": "Animada y motivadora"},
    {"id": "corporativa", "label": "Corporativa", "desc": "Profesional y tranquila"},
    {"id": "lofi", "label": "Lo-Fi Chill", "desc": "Relajada y moderna"},
    {"id": "epica", "label": "Épica", "desc": "Cinematográfica y poderosa"},
    {"id": "alegre", "label": "Alegre", "desc": "Positiva y rítmica"},
    {"id": "urbana", "label": "Urbana", "desc": "Moderna con ritmo"},
]
_MUSIC_IDS = {t["id"] for t in MUSIC_TRACKS}

REEL_TEMPLATES = [
    {"id": "showcase", "label": "Clásico", "min": 1, "max": 5},
    {"id": "before_after", "label": "Antes / Después", "min": 2, "max": 2},
    {"id": "promo", "label": "Oferta / Promo", "min": 1, "max": 5},
    {"id": "services", "label": "Lista de servicios", "min": 1, "max": 5},
    {"id": "testimonial", "label": "Testimonio", "min": 1, "max": 3},
]
REEL_TEMPLATE_PHOTOS = {t["id"]: (t["min"], t["max"]) for t in REEL_TEMPLATES}

TRANSITIONS = {
    "fade": "fade",
    "deslizar": "slideleft",
    "barrido": "wipeleft",
    "circulo": "circleopen",
    "disolver": "dissolve",
    "pixel": "pixelize",
}
MOTIONS = ["zoom_in", "zoom_out", "pan", "auto"]


def ffmpeg_bin() -> str:
    return os.environ.get("FFMPEG_BIN") or shutil.which("ffmpeg") or "ffmpeg"


def ffprobe_bin() -> str:
    fb = ffmpeg_bin()
    d = os.path.dirname(fb)
    cand = os.path.join(d, "ffprobe") if d else "ffprobe"
    if os.path.exists(cand) or shutil.which(cand):
        return cand
    return shutil.which("ffprobe") or "ffprobe"


def audio_duration(path: str) -> float:
    """Return the duration (seconds) of an audio file, or 0.0 on failure."""
    try:
        out = subprocess.run(
            [ffprobe_bin(), "-v", "error", "-show_entries", "format=duration",
             "-of", "default=nw=1:nk=1", path],
            capture_output=True, text=True, check=True,
        )
        return float(out.stdout.strip())
    except Exception:
        return 0.0


def bundled_music_path(track_id: str) -> Optional[str]:
    if track_id not in _MUSIC_IDS:
        return None
    p = os.path.join(os.path.dirname(__file__), "assets", "music", f"{track_id}.mp3")
    return p if os.path.exists(p) else None


# ---------------------------------------------------------------------------
# Overlay composition (Pillow)
# ---------------------------------------------------------------------------

def _png(canvas: Image.Image) -> bytes:
    buf = io.BytesIO()
    canvas.save(buf, format="PNG")
    return buf.getvalue()


def build_overlay(copy: dict, brand: dict, template: str = "showcase", show_subheadline: bool = True) -> bytes:
    """Full-duration branded text overlay (transparent PNG)."""
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    canvas.alpha_composite(ss._bottom_scrim((W, H), ss._darken(brand["brand"], 0.3), start_frac=0.58, max_alpha=215))
    draw = ImageDraw.Draw(canvas)
    margin = int(W * 0.075)
    accent = brand["accent"]

    # Top decorations per template
    if template == "before_after":
        labels = brand.get("ba_labels", ("BEFORE", "AFTER"))
        lf = ss._font("bold", 38)
        ss._chip(draw, (margin, margin), labels[0], lf, accent, ss._text_on(accent), pad_x=24, pad_y=12)
        lw = draw.textlength(labels[1], font=lf) + 48
        ss._chip(draw, (W - margin - lw, margin), labels[1], lf, accent, ss._text_on(accent), pad_x=24, pad_y=12)
    elif template == "promo":
        bf = ss._font("bold", int(W * 0.04))
        ss._chip(draw, (margin, margin), brand.get("promo_label", "SPECIAL OFFER"), bf, accent, ss._text_on(accent), pad_x=26, pad_y=14)

    y = H - margin

    if template == "testimonial":
        # Centered quote block
        cap = copy.get("caption") or copy.get("subheadline") or copy.get("headline") or ""
        cap = f"\u201c{cap}\u201d"
        qf, qlines, qlh = ss._fit_text(draw, cap, "semibold", W - margin * 2, int(H * 0.35), int(W * 0.072), 34)
        author = (brand.get("business_name") or "").strip()
        block = qlh * len(qlines) + int(H * 0.06)
        y2 = (H - block) // 2
        for ln in qlines:
            draw.text((W // 2, y2), ln, font=qf, fill=(255, 255, 255), anchor="ma")
            y2 += qlh
        if author:
            af = ss._font("bold", int(W * 0.04))
            draw.text((W // 2, y2 + int(H * 0.02)), f"\u2014 {author}", font=af, fill=accent, anchor="ma")
        # small CTA pill at bottom
        cta = copy.get("cta", "") or "Contáctanos"
        cf = ss._font("bold", int(W * 0.042))
        tw = draw.textlength(cta, font=cf)
        ss._pill(draw, (W // 2 - (tw + 88) / 2, H - margin - cf.size - 28), cta, cf, accent, ss._text_on(accent), pad_x=44)
        return _png(canvas)

    # Default bottom block (showcase / before_after / promo / services)
    cta = copy.get("cta", "") or "Contáctanos"
    cta_font = ss._font("bold", int(W * 0.045))
    cta_h = cta_font.size + 28
    y_cta = y - cta_h
    ss._pill(draw, (margin, y_cta), cta, cta_font, accent, ss._text_on(accent))
    y = y_cta - int(H * 0.03)

    if template != "services" and show_subheadline:
        sub = copy.get("subheadline", "")
        if sub:
            sf, slines, slh = ss._fit_text(draw, sub, "semibold", W - margin * 2, int(H * 0.12), int(W * 0.05), 30)
            y -= slh * len(slines)
            ss._draw_lines(draw, slines, sf, margin, y, slh, (235, 240, 245))
            y -= int(H * 0.012)

    head = copy.get("headline", "") or brand.get("business_name", "")
    hf, hlines, hlh = ss._fit_text(draw, head, "extrabold", W - margin * 2, int(H * 0.30), int(W * 0.115), 48)
    y -= hlh * len(hlines)
    bar_y = y - int(H * 0.022)
    draw.rounded_rectangle([margin, bar_y, margin + int(W * 0.14), bar_y + 10], radius=5, fill=accent)
    ss._draw_lines(draw, hlines, hf, margin, y, hlh, (255, 255, 255))
    return _png(canvas)


def build_segment_overlay(text: str, brand: dict, idx: int, total: int) -> bytes:
    """Per-photo service line (services template): a centered chip near the middle."""
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    accent = brand["accent"]
    margin = int(W * 0.09)
    text = (text or "").strip()
    if not text:
        return _png(canvas)
    f, lines, lh = ss._fit_text(draw, text, "extrabold", W - margin * 2, int(H * 0.22), int(W * 0.10), 40)
    total_h = lh * len(lines)
    box_pad = int(W * 0.05)
    box_w = max(draw.textlength(ln, font=f) for ln in lines) + box_pad * 2
    box_h = total_h + box_pad * 1.4
    cy = int(H * 0.44)
    x0 = (W - box_w) / 2
    y0 = cy - box_h / 2
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rounded_rectangle([x0, y0, x0 + box_w, y0 + box_h], radius=28, fill=ss._darken(brand["brand"], 0.25) + (210,))
    canvas.alpha_composite(overlay)
    draw = ImageDraw.Draw(canvas)
    # accent counter chip (e.g. 1/3)
    cf = ss._font("bold", int(W * 0.03))
    ss._chip(draw, (x0 + box_pad, y0 - cf.size - 26), f"{idx + 1}/{total}", cf, accent, ss._text_on(accent), pad_x=18, pad_y=10)
    ty = cy - total_h / 2
    for ln in lines:
        draw.text((W // 2, ty), ln, font=f, fill=(255, 255, 255), anchor="ma")
        ty += lh
    return _png(canvas)


def build_subtitle_overlay(text: str, brand: dict) -> bytes:
    """Burned subtitle chunk: white text on a translucent rounded band, lower-center."""
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    text = (text or "").strip()
    if not text:
        return _png(canvas)
    margin = int(W * 0.10)
    f, lines, lh = ss._fit_text(draw, text, "bold", W - margin * 2, int(H * 0.16), int(W * 0.058), 30)
    total_h = lh * len(lines)
    box_w = max(draw.textlength(ln, font=f) for ln in lines) + int(W * 0.08)
    box_h = total_h + int(H * 0.025)
    cy = int(H * 0.30)
    x0 = (W - box_w) / 2
    y0 = cy - box_h / 2
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(overlay).rounded_rectangle([x0, y0, x0 + box_w, y0 + box_h], radius=22, fill=(0, 0, 0, 175))
    canvas.alpha_composite(overlay)
    draw = ImageDraw.Draw(canvas)
    ty = cy - total_h / 2
    for ln in lines:
        draw.text((W // 2, ty), ln, font=f, fill=(255, 255, 255), anchor="ma")
        ty += lh
    return _png(canvas)


def build_outro(brand: dict, cta: str = "") -> bytes:
    """Final branded card: logo + business name + phone + CTA on a solid brand background."""
    canvas = Image.new("RGBA", (W, H), brand["brand"] + (255,))
    canvas.alpha_composite(ss._bottom_scrim((W, H), ss._darken(brand["brand"], 0.45), start_frac=0.6, max_alpha=180))
    draw = ImageDraw.Draw(canvas)
    accent = brand["accent"]
    fg = ss._text_on(brand["brand"])
    cx = W // 2
    y = int(H * 0.30)

    logo = brand.get("logo")
    if logo is not None:
        lh = int(H * 0.13)
        lw = int(logo.size[0] * (lh / logo.size[1]))
        lg = logo.resize((lw, lh), Image.LANCZOS)
        canvas.alpha_composite(lg, (cx - lw // 2, y))
        y += lh + int(H * 0.045)

    name = (brand.get("business_name") or "").strip()
    if name:
        nf, nlines, nlh = ss._fit_text(draw, name, "extrabold", int(W * 0.84), int(H * 0.22), int(W * 0.105), 44)
        for ln in nlines:
            draw.text((cx, y), ln, font=nf, fill=fg, anchor="ma")
            y += nlh
        y += int(H * 0.02)

    phone = (brand.get("phone") or "").strip()
    if phone:
        pf = ss._font("semibold", int(W * 0.052))
        draw.text((cx, y), phone, font=pf, fill=accent, anchor="ma")
        y += pf.size + int(H * 0.05)

    cta = cta or "Contáctanos hoy"
    cf = ss._font("bold", int(W * 0.05))
    tw = draw.textlength(cta, font=cf)
    ss._pill(draw, (cx - (tw + 96) / 2, y), cta, cf, accent, ss._text_on(accent), pad_x=48)
    return _png(canvas.convert("RGBA"))


# ---------------------------------------------------------------------------
# Motion + helpers
# ---------------------------------------------------------------------------

def _zoompan(mode: str, frames: int, idx: int) -> str:
    cx = "iw/2-(iw/zoom/2)"
    cy = "ih/2-(ih/zoom/2)"
    if mode == "auto":
        mode = ["zoom_in", "zoom_out", "pan"][idx % 3]
    if mode == "zoom_out":
        z = "if(eq(on,0),1.18,zoom-0.0012)"
        x, y = cx, cy
    elif mode == "pan":
        z = "1.12"
        x = f"(iw-iw/zoom)*on/{max(1, frames - 1)}"
        y = cy
    else:  # zoom_in
        z = "min(zoom+0.0012,1.18)"
        x, y = cx, cy
    return f"zoompan=z='{z}':d={frames}:x='{x}':y='{y}':s={W}x{H}:fps={FPS}"


def _service_lines(copy: dict, n: int) -> List[str]:
    raw = copy.get("subheadline") or copy.get("headline") or ""
    parts = []
    for sep in [",", "•", "·", " & ", " and ", " y "]:
        raw = raw.replace(sep, "|")
    parts = [p.strip() for p in raw.split("|") if p.strip()]
    if not parts:
        parts = [copy.get("headline", "") or "Servicio"]
    while len(parts) < n:
        parts.append(copy.get("headline", "") or parts[0])
    return parts[:n]


def _chunk_text(text: str, nchunks: int) -> List[str]:
    words = (text or "").split()
    if not words:
        return []
    nchunks = max(1, min(nchunks, len(words)))
    size = max(1, (len(words) + nchunks - 1) // nchunks)
    return [" ".join(words[i:i + size]) for i in range(0, len(words), size)]


# ---------------------------------------------------------------------------
# Render
# ---------------------------------------------------------------------------

def render_reel(photo_paths: List[str], out_path: str, *,
                main_overlay_path: Optional[str] = None,
                segment_overlay_paths: Optional[List[str]] = None,
                subtitle_specs: Optional[List[tuple]] = None,  # list of (path, start, end)
                outro_path: Optional[str] = None,
                motion: str = "auto", transition: str = "fade",
                duration: float = 10.0,
                music_path: Optional[str] = None,
                voice_path: Optional[str] = None) -> None:
    n = max(1, len(photo_paths))
    is_slider = (transition == "_slider")
    xfade_name = "slideleft" if is_slider else TRANSITIONS.get(transition, "fade")
    td_p = TD_SLIDER if is_slider else (TD_DEFAULT if n > 1 else 0.0)

    montage_dur = duration - (OUTRO_LEN - TD_DEFAULT) if outro_path else duration
    montage_dur = max(3.0, montage_dur)
    per_clip = montage_dur if n == 1 else (montage_dur + (n - 1) * td_p) / n
    frames = max(1, round(per_clip * FPS))
    outro_frames = max(1, round(OUTRO_LEN * FPS))

    # ---- inputs (order matters for stream indices) ----
    inputs: List[str] = []
    idx = 0
    photo_idx = []
    for p in photo_paths:
        inputs += ["-i", p]
        photo_idx.append(idx)
        idx += 1
    main_idx = None
    if main_overlay_path:
        inputs += ["-loop", "1", "-t", f"{montage_dur:.3f}", "-i", main_overlay_path]
        main_idx = idx
        idx += 1
    seg_idx = []
    if segment_overlay_paths:
        for sp in segment_overlay_paths:
            inputs += ["-loop", "1", "-t", f"{per_clip:.3f}", "-i", sp]
            seg_idx.append(idx)
            idx += 1
    sub_idx = []
    if subtitle_specs:
        for (sp, _s, _e) in subtitle_specs:
            inputs += ["-loop", "1", "-t", f"{montage_dur:.3f}", "-i", sp]
            sub_idx.append(idx)
            idx += 1
    outro_idx = None
    if outro_path:
        inputs += ["-loop", "1", "-t", f"{OUTRO_LEN:.3f}", "-i", outro_path]
        outro_idx = idx
        idx += 1
    music_in = None
    if music_path:
        inputs += ["-stream_loop", "-1", "-i", music_path]
        music_in = idx
        idx += 1
    voice_in = None
    if voice_path:
        inputs += ["-i", voice_path]
        voice_in = idx
        idx += 1

    # ---- video filtergraph ----
    parts: List[str] = []
    for i in range(n):
        parts.append(f"[{photo_idx[i]}:v]{_SCALE}{_zoompan(motion, frames, i)},setsar=1,format=yuv420p[v{i}]")

    if seg_idx:
        for i in range(n):
            parts.append(f"[{seg_idx[i]}:v]format=rgba,fade=in:st=0.2:d=0.5:alpha=1[so{i}]")
            parts.append(f"[v{i}][so{i}]overlay=0:0[c{i}]")

        def clip(i):
            return f"[c{i}]"
    else:
        def clip(i):
            return f"[v{i}]"

    if n == 1:
        parts.append(f"{clip(0)}null[mtg]")
        montage = "[mtg]"
    else:
        prev = clip(0)
        for i in range(1, n):
            off = i * (per_clip - td_p)
            out = f"[x{i}]"
            parts.append(f"{prev}{clip(i)}xfade=transition={xfade_name}:duration={td_p:.3f}:offset={off:.3f}{out}")
            prev = out
        montage = prev

    if main_idx is not None:
        parts.append(f"[{main_idx}:v]format=rgba,fade=in:st=0.4:d=0.7:alpha=1[mov]")
        parts.append(f"{montage}[mov]overlay=0:0[mtg1]")
        montage = "[mtg1]"

    for j, (_, st, en) in enumerate(subtitle_specs or []):
        parts.append(f"[{sub_idx[j]}:v]format=rgba[sb{j}]")
        parts.append(f"{montage}[sb{j}]overlay=0:0:enable='between(t,{st:.2f},{en:.2f})'[su{j}]")
        montage = f"[su{j}]"

    if outro_idx is not None:
        parts.append(f"[{outro_idx}:v]{_SCALE}zoompan=z='min(zoom+0.0008,1.08)':d={outro_frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={W}x{H}:fps={FPS},setsar=1,format=yuv420p[outro]")
        off = montage_dur - TD_DEFAULT
        parts.append(f"{montage}[outro]xfade=transition=fade:duration={TD_DEFAULT:.3f}:offset={off:.3f}[og]")
        montage = "[og]"

    parts.append(f"{montage}format=yuv420p[outv]")

    # ---- audio filtergraph ----
    amap = None
    afo = max(0.0, duration - 1.2)
    if music_in is not None and voice_in is not None:
        parts.append(f"[{music_in}:a]volume=0.20,atrim=0:{duration:.3f},afade=out:st={afo:.3f}:d=1.2[am]")
        parts.append(f"[{voice_in}:a]adelay=250:all=1,volume=1.4[av]")
        parts.append("[am][av]amix=inputs=2:duration=longest:normalize=0[aout]")
        amap = "[aout]"
    elif music_in is not None:
        parts.append(f"[{music_in}:a]volume=0.6,atrim=0:{duration:.3f},afade=out:st={afo:.3f}:d=1.2[aout]")
        amap = "[aout]"
    elif voice_in is not None:
        parts.append(f"[{voice_in}:a]adelay=250:all=1,volume=1.4[aout]")
        amap = "[aout]"

    cmd = [ffmpeg_bin(), "-y", *inputs, "-filter_complex", ";".join(parts), "-map", "[outv]"]
    if amap:
        cmd += ["-map", amap, "-c:a", "aac", "-b:a", "128k"]
    else:
        cmd += ["-an"]
    cmd += [
        "-t", f"{duration:.3f}", "-r", str(FPS),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", out_path,
    ]
    subprocess.run(cmd, check=True, capture_output=True)


def render_reel_full(images: List[Image.Image], copy: dict, brand: dict, *,
                     template: str = "showcase", motion: str = "auto", transition: str = "fade",
                     duration: float = 10.0, subtitles: bool = False, outro: bool = False,
                     music_path: Optional[str] = None, voice_path: Optional[str] = None,
                     subtitle_text: Optional[str] = None) -> bytes:
    """High-level: write photos + overlays to a tempdir, render, return MP4 bytes."""
    n = len(images)
    tmp = tempfile.mkdtemp(prefix="reel_")
    try:
        photo_paths = []
        for i, im in enumerate(images):
            p = os.path.join(tmp, f"p{i}.jpg")
            im.convert("RGB").save(p, format="JPEG", quality=92)
            photo_paths.append(p)

        n = len(images)
        subs_on = subtitles and template in ("showcase", "promo", "before_after")

        main_overlay_path = os.path.join(tmp, "main.png")
        with open(main_overlay_path, "wb") as f:
            f.write(build_overlay(copy, brand, template, show_subheadline=not subs_on))

        segment_overlay_paths = None
        if template == "services":
            lines = _service_lines(copy, n)
            segment_overlay_paths = []
            for i in range(n):
                sp = os.path.join(tmp, f"seg{i}.png")
                with open(sp, "wb") as f:
                    f.write(build_segment_overlay(lines[i], brand, i, n))
                segment_overlay_paths.append(sp)

        # before_after uses the slider transition
        eff_transition = "_slider" if template == "before_after" else transition

        subtitle_specs = None
        if subs_on:
            montage_dur = duration - (OUTRO_LEN - TD_DEFAULT) if outro else duration
            montage_dur = max(3.0, montage_dur)
            nchunks = max(2, min(6, round(montage_dur / 3.5)))
            src = subtitle_text or copy.get("caption") or copy.get("subheadline") or copy.get("headline") or ""
            chunks = _chunk_text(src, nchunks)
            if chunks:
                seg = montage_dur / len(chunks)
                subtitle_specs = []
                for k, ck in enumerate(chunks):
                    sp = os.path.join(tmp, f"sub{k}.png")
                    with open(sp, "wb") as f:
                        f.write(build_subtitle_overlay(ck, brand))
                    subtitle_specs.append((sp, k * seg, (k + 1) * seg))

        outro_path = None
        if outro:
            outro_path = os.path.join(tmp, "outro.png")
            with open(outro_path, "wb") as f:
                f.write(build_outro(brand, copy.get("cta", "")))

        out_path = os.path.join(tmp, "reel.mp4")
        render_reel(
            photo_paths, out_path,
            main_overlay_path=main_overlay_path,
            segment_overlay_paths=segment_overlay_paths,
            subtitle_specs=subtitle_specs,
            outro_path=outro_path,
            motion=motion, transition=eff_transition, duration=duration,
            music_path=music_path, voice_path=voice_path,
        )
        with open(out_path, "rb") as f:
            return f.read()
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
