"""Reel (vertical 9:16 video) renderer.

Turns a user's photos + AI copy + Smart Card branding into a ~10s animated
MP4 reel: Ken Burns zoom on each photo, crossfade transitions, an animated
(fade-in) branded text overlay with CTA, and optional background music.

Pure FFmpeg via subprocess. The branded text overlay is composed with Pillow
(reusing social_service helpers). 100%-original bundled music lives in
assets/music/ so there are no copyright claims on social platforms.
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
MUSIC_DIR = os.path.join(os.path.dirname(__file__), "assets", "music")

MUSIC_TRACKS = [
    {"id": "energetica", "label": "Energética", "desc": "Animada y motivadora"},
    {"id": "corporativa", "label": "Corporativa", "desc": "Profesional y tranquila"},
    {"id": "lofi", "label": "Lo-Fi Chill", "desc": "Relajada y moderna"},
]
_MUSIC_IDS = {t["id"] for t in MUSIC_TRACKS}


def ffmpeg_bin() -> str:
    return os.environ.get("FFMPEG_BIN") or shutil.which("ffmpeg") or "ffmpeg"


def bundled_music_path(track_id: str) -> Optional[str]:
    if track_id not in _MUSIC_IDS:
        return None
    p = os.path.join(MUSIC_DIR, f"{track_id}.mp3")
    return p if os.path.exists(p) else None


def build_overlay(copy: dict, brand: dict) -> bytes:
    """Transparent 1080x1920 PNG: bottom scrim + headline/sub + CTA pill + accent bar."""
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    canvas.alpha_composite(ss._bottom_scrim((W, H), ss._darken(brand["brand"], 0.3), start_frac=0.58, max_alpha=215))
    draw = ImageDraw.Draw(canvas)
    margin = int(W * 0.075)
    accent = brand["accent"]

    y = H - margin
    cta = copy.get("cta", "") or "Contáctanos"
    cta_font = ss._font("bold", int(W * 0.045))
    cta_h = cta_font.size + 28
    y_cta = y - cta_h
    ss._pill(draw, (margin, y_cta), cta, cta_font, accent, ss._text_on(accent))
    y = y_cta - int(H * 0.03)

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

    buf = io.BytesIO()
    canvas.save(buf, format="PNG")
    return buf.getvalue()


def render_reel(photo_paths: List[str], overlay_path: str, out_path: str,
                music_path: Optional[str] = None, duration: float = 10.0) -> None:
    """Render the reel with FFmpeg. Raises CalledProcessError on failure."""
    n = max(1, len(photo_paths))
    td = 0.6 if n > 1 else 0.0
    per_clip = duration if n == 1 else (duration + (n - 1) * td) / n
    frames = max(1, round(per_clip * FPS))

    inputs: List[str] = []
    for p in photo_paths:
        inputs += ["-i", p]  # single still frame each
    inputs += ["-loop", "1", "-t", f"{duration:.3f}", "-i", overlay_path]
    overlay_idx = n
    music_idx = None
    if music_path:
        inputs += ["-i", music_path]
        music_idx = n + 1

    parts: List[str] = []
    for i in range(n):
        # Upscale (1.5x) so the slow zoom stays crisp without huge memory use.
        parts.append(
            f"[{i}:v]scale=1620:2880:force_original_aspect_ratio=increase,crop=1620:2880,"
            f"zoompan=z='min(zoom+0.0012,1.18)':d={frames}:"
            f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={W}x{H}:fps={FPS},"
            f"setsar=1,format=yuv420p[v{i}]"
        )

    if n == 1:
        last = "[v0]"
    else:
        prev = "[v0]"
        for i in range(1, n):
            off = i * (per_clip - td)
            out = f"[x{i}]"
            parts.append(f"{prev}[v{i}]xfade=transition=fade:duration={td:.3f}:offset={off:.3f}{out}")
            prev = out
        last = prev

    parts.append(f"[{overlay_idx}:v]format=rgba,fade=in:st=0.4:d=0.7:alpha=1[ov]")
    parts.append(f"{last}[ov]overlay=0:0:format=auto,format=yuv420p[outv]")
    filter_complex = ";".join(parts)

    cmd = [ffmpeg_bin(), "-y", *inputs, "-filter_complex", filter_complex, "-map", "[outv]"]
    if music_idx is not None:
        cmd += [
            "-map", f"{music_idx}:a",
            "-c:a", "aac", "-b:a", "128k",
            "-af", f"afade=out:st={max(0.0, duration - 1.2):.3f}:d=1.2",
        ]
    else:
        cmd += ["-an"]
    cmd += [
        "-t", f"{duration:.3f}", "-r", str(FPS),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", out_path,
    ]
    subprocess.run(cmd, check=True, capture_output=True)


def render_reel_from_images(images: List[Image.Image], copy: dict, brand: dict,
                            music_path: Optional[str] = None, duration: float = 10.0) -> bytes:
    """Convenience: write PIL images + overlay to a tempdir, render, return MP4 bytes."""
    tmp = tempfile.mkdtemp(prefix="reel_")
    try:
        photo_paths = []
        for idx, im in enumerate(images):
            p = os.path.join(tmp, f"p{idx}.jpg")
            im.convert("RGB").save(p, format="JPEG", quality=92)
            photo_paths.append(p)
        overlay_path = os.path.join(tmp, "overlay.png")
        with open(overlay_path, "wb") as f:
            f.write(build_overlay(copy, brand))
        out_path = os.path.join(tmp, "reel.mp4")
        render_reel(photo_paths, overlay_path, out_path, music_path=music_path, duration=duration)
        with open(out_path, "rb") as f:
            return f.read()
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
