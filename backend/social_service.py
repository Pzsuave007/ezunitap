"""Social post renderer.

Composes branded, scroll-stopping social media graphics (Pillow) from a user's
photos + AI-generated copy + their Smart Card branding (logo, colors). Outputs
PNG bytes for 9:16 (1080x1920) and 1:1 (1080x1080).

Pure local rendering — no external API. AI copy lives in ai_service.
"""
import io
import os
import math
from typing import List, Optional

from PIL import Image, ImageDraw, ImageFont, ImageFilter

FONT_DIR = os.path.join(os.path.dirname(__file__), "assets", "fonts")

SIZES = {
    "9x16": (1080, 1920),
    "1x1": (1080, 1080),
}

_FONT_FILES = {
    "extrabold": "Poppins-ExtraBold.ttf",
    "bold": "Poppins-Bold.ttf",
    "semibold": "Poppins-SemiBold.ttf",
    "regular": "Poppins-Regular.ttf",
}
_font_cache: dict = {}

# Active render style (set per render_post call) controlling text legibility via
# an elegant soft drop shadow (blur radius, y-offset, alpha — all relative to the
# font size) and vertical text position on supported designs.
_STYLE: dict = {}
# (blur, y_offset, alpha, spread) all relative to font size. `spread` thickens the
# glyph before blurring → a soft dark halo/gradient that hugs the text so letters
# always sit inside a darker zone (not just a thin drop shadow).
_SHADOW = {
    "soft":   (0.090, 0.030, 130, 0.10),
    "medium": (0.140, 0.040, 150, 0.16),
    "strong": (0.190, 0.050, 175, 0.22),
}

# Designs whose headline/subtext sits directly over a full-bleed photo — these
# always get an automatic outline so the text stays readable on any background.
# Designs that place text on solid color bands/cards are intentionally excluded
# (a stroke there would look worse, not better).
_OVERLAY_TEMPLATES = {
    "showcase", "center_stage", "magazine", "elegant_dark",
    "review_5star", "split_diagonal", "seasonal", "trust_badge",
}


def _font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    key = (weight, size)
    if key in _font_cache:
        return _font_cache[key]
    path = os.path.join(FONT_DIR, _FONT_FILES.get(weight, _FONT_FILES["bold"]))
    try:
        f = ImageFont.truetype(path, size)
    except Exception:
        f = ImageFont.load_default()
    _font_cache[key] = f
    return f


def _hex_to_rgb(h: str, default=(30, 58, 138)) -> tuple:
    if not h:
        return default
    h = h.strip().lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    try:
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
    except Exception:
        return default


def _luminance(rgb: tuple) -> float:
    r, g, b = [c / 255 for c in rgb]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def _text_on(rgb: tuple) -> tuple:
    return (17, 24, 39) if _luminance(rgb) > 0.62 else (255, 255, 255)


def _shadow_params(font):
    """(blur, y_offset, alpha, spread) in px for the active legibility level."""
    cfg = _SHADOW.get(_STYLE.get("legibility", "medium"))
    if not cfg:
        return None
    blur_f, off_f, alpha, spread_f = cfg
    return (max(4, int(font.size * blur_f)), int(font.size * off_f), alpha, max(0, int(font.size * spread_f)))


def _shape_shadow(draw, render_fn, blur, off=4, _force=False):
    """Composite a soft blurred shadow for arbitrary shapes (stars, badges, bars)
    so any symbol over a photo reads as clearly as the text. `render_fn(d)` draws
    the shape (in any dark color) onto a transparent layer."""
    if not _force and _STYLE.get("legibility", "medium") not in _SHADOW:
        return
    canvas = getattr(draw, "_image", None)
    if canvas is None or canvas.mode != "RGBA":
        return
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    render_fn(ImageDraw.Draw(layer))
    layer = layer.filter(ImageFilter.GaussianBlur(max(2, int(blur))))
    canvas.alpha_composite(layer, (0, max(0, off)))


def _shadow_lines(draw, lines, font, x, y, line_h, anchor="la"):
    """Composite ONE soft, blurred drop-shadow/halo behind a block of text lines —
    elegant and ensures letters sit inside a darker gradient zone."""
    canvas = getattr(draw, "_image", None)
    p = _shadow_params(font)
    if p is None or canvas is None or canvas.mode != "RGBA":
        return
    blur, off, alpha, spread = p
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    yy = y
    for ln in lines:
        if spread:
            ld.text((x, yy), ln, font=font, fill=(0, 0, 0, alpha), anchor=anchor,
                    stroke_width=spread, stroke_fill=(0, 0, 0, alpha))
        else:
            ld.text((x, yy), ln, font=font, fill=(0, 0, 0, alpha), anchor=anchor)
        yy += line_h
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    canvas.alpha_composite(layer, (0, off))


def _draw_text(draw, xy, text, font, fill, anchor="la"):
    """draw.text with an elegant soft drop shadow for legibility over photos."""
    _shadow_lines(draw, [text], font, xy[0], xy[1], font.size, anchor=anchor)
    draw.text(xy, text, font=font, fill=fill, anchor=anchor)


def _darken(rgb: tuple, factor: float = 0.55) -> tuple:
    return tuple(max(0, int(c * factor)) for c in rgb)


def _cover_crop(img: Image.Image, w: int, h: int) -> Image.Image:
    """Fit the FULL photo inside w x h WITHOUT cropping the sides. The photo is
    contained (whole image visible) over a blurred, filled background of the same
    photo, so the frame is fully covered and nothing important gets cut off."""
    img = img.convert("RGB")
    src_w, src_h = img.size
    if src_w <= 0 or src_h <= 0:
        return Image.new("RGB", (w, h), (20, 20, 25))
    # Blurred cover background fills the whole frame (no empty bars)
    bg_scale = max(w / src_w, h / src_h)
    bw, bh = max(1, int(src_w * bg_scale + 0.5)), max(1, int(src_h * bg_scale + 0.5))
    bg = img.resize((bw, bh), Image.LANCZOS)
    bl, bt = (bw - w) // 2, (bh - h) // 2
    bg = bg.crop((bl, bt, bl + w, bt + h)).filter(ImageFilter.GaussianBlur(26))
    bg = Image.blend(bg, Image.new("RGB", (w, h), (0, 0, 0)), 0.20)
    # Foreground: the complete photo, scaled to fit fully inside the frame
    fg_scale = min(w / src_w, h / src_h)
    fw, fh = max(1, int(src_w * fg_scale + 0.5)), max(1, int(src_h * fg_scale + 0.5))
    fg = img.resize((fw, fh), Image.LANCZOS)
    bg.paste(fg, ((w - fw) // 2, (h - fh) // 2))
    return bg


def _bottom_scrim(size: tuple, color: tuple, start_frac: float = 0.45, max_alpha: int = 235) -> Image.Image:
    """Vertical gradient transparent->color from start_frac down to the bottom."""
    w, h = size
    grad = Image.new("L", (1, h), 0)
    start = int(h * (1 - start_frac))
    for y in range(start, h):
        t = (y - start) / max(1, (h - start))
        grad.putpixel((0, y), int(max_alpha * (t ** 1.3)))
    alpha = grad.resize((w, h))
    overlay = Image.new("RGBA", (w, h), color + (255,))
    overlay.putalpha(alpha)
    return overlay


def _wrap(draw, text: str, font, max_w: int) -> List[str]:
    words = (text or "").split()
    if not words:
        return []
    lines, cur = [], words[0]
    for word in words[1:]:
        trial = cur + " " + word
        if draw.textlength(trial, font=font) <= max_w:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    lines.append(cur)
    return lines


def _fit_text(draw, text: str, weight: str, max_w: int, max_h: int, start: int, minimum: int = 30, line_gap: float = 1.06):
    """Return (font, lines) shrinking until the wrapped text fits the box."""
    size = start
    while size >= minimum:
        font = _font(weight, size)
        lines = _wrap(draw, text, font, max_w)
        line_h = int(size * line_gap)
        total_h = line_h * len(lines)
        if total_h <= max_h and all(draw.textlength(ln, font=font) <= max_w for ln in lines):
            return font, lines, line_h
        size -= 4
    font = _font(weight, minimum)
    return font, _wrap(draw, text, font, max_w), int(minimum * line_gap)


def _draw_lines(draw, lines, font, x, y, line_h, fill, anchor="la"):
    _shadow_lines(draw, lines, font, x, y, line_h, anchor=anchor)
    for ln in lines:
        draw.text((x, y), ln, font=font, fill=fill, anchor=anchor)
        y += line_h
    return y


def _pill(draw, xy, text, font, bg, fg, pad_x=34, radius=None):
    x, y = xy
    tw = draw.textlength(text, font=font)
    th = font.size
    h = th + 28
    w = tw + pad_x * 2
    r = radius if radius is not None else h // 2
    draw.rounded_rectangle([x, y, x + w, y + h], radius=r, fill=bg)
    draw.text((x + w / 2, y + h / 2), text, font=font, fill=fg, anchor="mm")
    return w, h


def _chip(draw, xy, text, font, bg, fg, pad_x=22, pad_y=12):
    x, y = xy
    tw = draw.textlength(text, font=font)
    w = tw + pad_x * 2
    h = font.size + pad_y * 2
    draw.rounded_rectangle([x, y, x + w, y + h], radius=14, fill=bg)
    draw.text((x + pad_x, y + h / 2), text, font=font, fill=fg, anchor="lm")
    return w, h


def _open_logo(logo_bytes: Optional[bytes]) -> Optional[Image.Image]:
    if not logo_bytes:
        return None
    try:
        return Image.open(io.BytesIO(logo_bytes)).convert("RGBA")
    except Exception:
        return None


def _paste_logo_chip(canvas, draw, logo: Optional[Image.Image], business_name: str, x: int, y: int, scale: int):
    """Top-left brand chip: logo (if any) + business name."""
    pad = int(scale * 0.5)
    name_font = _font("semibold", int(scale * 0.9))
    logo_h = int(scale * 1.6)
    items_w = 0
    logo_img = None
    if logo is not None:
        lw, lh = logo.size
        nw = int(lw * (logo_h / lh))
        logo_img = logo.resize((nw, logo_h), Image.LANCZOS)
        items_w += nw + pad
    name = (business_name or "").strip()
    name_w = draw.textlength(name, font=name_font) if name else 0
    chip_w = pad * 2 + items_w + name_w
    chip_h = logo_h + pad * 2
    draw.rounded_rectangle([x, y, x + chip_w, y + chip_h], radius=int(chip_h / 2), fill=(255, 255, 255, 235))
    cx = x + pad
    if logo_img is not None:
        canvas.paste(logo_img, (cx, y + pad), logo_img)
        cx += logo_img.size[0] + pad
    if name:
        draw.text((cx, y + chip_h / 2), name, font=name_font, fill=(17, 24, 39), anchor="lm")


def _label_chip(draw, xy, text, accent, fg=(255, 255, 255)):
    f = _font("bold", 34)
    return _chip(draw, xy, text, f, accent, fg, pad_x=24, pad_y=12)


# ---------------------------------------------------------------------------
# Templates
# ---------------------------------------------------------------------------

def _render_showcase(size, photos, copy, brand) -> Image.Image:
    w, h = size
    brand_rgb = brand["brand"]
    accent_rgb = brand["accent"]
    pos = _STYLE.get("text_position", "bottom")
    base = _cover_crop(photos[0], w, h) if photos else Image.new("RGB", (w, h), brand_rgb)
    canvas = base.convert("RGBA")
    draw = ImageDraw.Draw(canvas)
    margin = int(w * 0.075)

    # Measure the full text block first so it can be placed top / center / bottom.
    cta = copy.get("cta", "") or "Contáctanos"
    cta_font = _font("bold", int(w * 0.042))
    cta_h = cta_font.size + 28
    sub = copy.get("subheadline", "")
    sub_font = sub_lines = None
    sub_lh = 0
    if sub:
        sub_font, sub_lines, sub_lh = _fit_text(draw, sub, "semibold", w - margin * 2, int(h * 0.12), int(w * 0.05), 30)
    head = copy.get("headline", "") or brand.get("business_name", "")
    hf, hlines, hlh = _fit_text(draw, head, "extrabold", w - margin * 2, int(h * 0.30), int(w * 0.115), 48)
    htotal = hlh * len(hlines)
    sub_total = sub_lh * len(sub_lines) if sub_lines else 0

    underline_h = 10
    block_h = underline_h + int(h * 0.018) + htotal
    if sub_lines:
        block_h += int(h * 0.012) + sub_total
    block_h += int(h * 0.025) + cta_h

    if pos == "top":
        top = margin
    elif pos == "center":
        top = max(margin, (h - block_h) // 2)
    else:
        top = h - margin - block_h

    # Scrim for legibility: full bottom gradient when bottom, else a soft box.
    if pos == "bottom":
        canvas.alpha_composite(_bottom_scrim((w, h), _darken(brand_rgb, 0.35), start_frac=0.55))
    else:
        sb = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        ImageDraw.Draw(sb).rectangle(
            [0, top - int(h * 0.025), w, top + block_h + int(h * 0.025)],
            fill=_darken(brand_rgb, 0.35) + (165,),
        )
        canvas.alpha_composite(sb)
    draw = ImageDraw.Draw(canvas)

    y = top
    draw.rounded_rectangle([margin, y, margin + int(w * 0.14), y + underline_h], radius=5, fill=accent_rgb)
    y += underline_h + int(h * 0.018)
    y = _draw_lines(draw, hlines, hf, margin, y, hlh, (255, 255, 255))
    if sub_lines:
        y += int(h * 0.012)
        y = _draw_lines(draw, sub_lines, sub_font, margin, y, sub_lh, (235, 240, 245))
    y += int(h * 0.025)
    _pill(draw, (margin, y), cta, cta_font, accent_rgb, _text_on(accent_rgb))
    return canvas.convert("RGB")


def _render_before_after(size, photos, copy, brand) -> Image.Image:
    w, h = size
    brand_rgb = brand["brand"]
    accent_rgb = brand["accent"]
    labels = brand.get("ba_labels", ("BEFORE", "AFTER"))
    canvas = Image.new("RGBA", (w, h), _darken(brand_rgb, 0.3) + (255,))
    band_h = int(h * 0.26)
    photo_area_h = h - band_h
    p0 = photos[0] if photos else Image.new("RGB", (w, h), (200, 200, 200))
    p1 = photos[1] if len(photos) > 1 else p0

    vertical_split = (w >= h)  # square -> left/right; tall -> top/bottom
    if not vertical_split:
        half = photo_area_h // 2
        canvas.paste(_cover_crop(p0, w, half), (0, 0))
        canvas.paste(_cover_crop(p1, w, photo_area_h - half), (0, half))
        draw = ImageDraw.Draw(canvas)
        draw.rectangle([0, half - 4, w, half + 4], fill=accent_rgb)
        _label_chip(draw, (int(w * 0.05), int(w * 0.05)), labels[0], accent_rgb)
        _label_chip(draw, (int(w * 0.05), half + int(w * 0.05)), labels[1], accent_rgb)
    else:
        half = w // 2
        canvas.paste(_cover_crop(p0, half, photo_area_h), (0, 0))
        canvas.paste(_cover_crop(p1, w - half, photo_area_h), (half, 0))
        draw = ImageDraw.Draw(canvas)
        draw.rectangle([half - 4, 0, half + 4, photo_area_h], fill=accent_rgb)
        _label_chip(draw, (int(w * 0.04), int(w * 0.04)), labels[0], accent_rgb)
        lbl_w = draw.textlength(labels[1], font=_font("bold", 34)) + 48
        _label_chip(draw, (w - int(w * 0.04) - lbl_w, int(w * 0.04)), labels[1], accent_rgb)

    draw = ImageDraw.Draw(canvas)
    by0 = photo_area_h
    draw.rectangle([0, by0, w, h], fill=brand_rgb)
    fg = _text_on(brand_rgb)
    margin = int(w * 0.055)

    # CTA pill + phone on the RIGHT, vertically centered in the band.
    default_cta = "Cotización Gratis" if labels[0] == "ANTES" else "Free Quote"
    cta = copy.get("cta", "") or default_cta
    cta_font = _font("bold", int(w * 0.032))
    cw = draw.textlength(cta, font=cta_font) + 56
    cta_h = cta_font.size + 26
    cta_x = w - margin - int(cw)
    cta_y = by0 + (band_h - cta_h) // 2 + int(h * 0.012)
    _pill(draw, (cta_x, cta_y), cta, cta_font, accent_rgb, _text_on(accent_rgb))

    # Headline on the LEFT, width capped so it never collides with the CTA.
    head = copy.get("headline", "") or ("ANTES Y DESPUÉS" if labels[0] == "ANTES" else "BEFORE & AFTER")
    head_max_w = cta_x - margin - int(w * 0.03)
    hf, hlines, hlh = _fit_text(draw, head, "extrabold", head_max_w, band_h - int(h * 0.05), int(w * 0.056), 30)
    htotal = hlh * len(hlines)
    ty = by0 + (band_h - htotal) // 2
    _draw_lines(draw, hlines, hf, margin, ty, hlh, fg)
    return canvas.convert("RGB")


def _render_promo(size, photos, copy, brand) -> Image.Image:
    w, h = size
    brand_rgb = brand["brand"]
    accent_rgb = brand["accent"]
    top_c = brand_rgb
    bottom_c = _darken(brand_rgb, 0.55)
    grad = Image.new("RGB", (1, h))
    for y in range(h):
        t = y / h
        grad.putpixel((0, y), tuple(int(top_c[i] * (1 - t) + bottom_c[i] * t) for i in range(3)))
    canvas = grad.resize((w, h)).convert("RGBA")
    draw = ImageDraw.Draw(canvas)
    margin = int(w * 0.075)
    fg = _text_on(brand_rgb)

    # Reserve the bottom zone for the business line + CTA pill.
    cta_font = _font("bold", int(w * 0.05))
    cta_h = cta_font.size + 36
    biz_font = _font("semibold", int(w * 0.032))
    cta_y = h - margin - cta_h
    biz_y = cta_y - int(h * 0.022)
    content_bottom = biz_y - int(h * 0.03)

    # Optional photo card up top.
    top = margin
    if photos:
        card_h = int(h * (0.34 if size == SIZES["1x1"] else 0.40))
        card = _cover_crop(photos[0], w - margin * 2, card_h)
        mask = Image.new("L", card.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, card.size[0], card.size[1]], radius=40, fill=255)
        canvas.paste(card, (margin, top), mask)
        top += card_h + int(h * 0.035)

    # Offer badge
    badge_font = _font("bold", int(w * 0.038))
    _bw, bh = _chip(draw, (margin, top), brand.get("promo_label", "SPECIAL OFFER"), badge_font, accent_rgb, _text_on(accent_rgb), pad_x=26, pad_y=12)
    top += bh + int(h * 0.025)

    # Budget remaining space between badge and the bottom zone for headline + sub.
    avail = max(int(h * 0.12), content_bottom - top)
    sub = copy.get("subheadline", "")
    sub_alloc = int(avail * 0.30) if sub else 0
    head_alloc = avail - sub_alloc - int(h * 0.01)
    head = copy.get("headline", "") or "LIMITED OFFER"
    hf, hlines, hlh = _fit_text(draw, head, "extrabold", w - margin * 2, head_alloc, int(w * 0.10), 40)
    top = _draw_lines(draw, hlines, hf, margin, top, hlh, fg)
    if sub:
        top += int(h * 0.012)
        sf, slines, slh = _fit_text(draw, sub, "semibold", w - margin * 2, sub_alloc, int(w * 0.045), 26)
        _draw_lines(draw, slines, sf, margin, top, slh, (235, 240, 245))

    # Business name (no phone), then CTA pill at the bottom.
    line = brand.get("business_name", "")
    if line:
        draw.text((margin, biz_y), line, font=biz_font, fill=fg, anchor="lb")
    _pill(draw, (margin, cta_y), copy.get("cta", "") or "Call Now", cta_font, accent_rgb, _text_on(accent_rgb), pad_x=44)
    return canvas.convert("RGB")


def _accent_bar(draw, x, y, length, accent, thick=10):
    draw.rounded_rectangle([x, y, x + length, y + thick], radius=thick // 2, fill=accent)


def _render_bold_bar(size, photos, copy, brand) -> Image.Image:
    w, h = size
    brand_rgb = brand["brand"]
    accent = brand["accent"]
    bar_h = int(h * 0.32)
    photo_h = h - bar_h
    canvas = Image.new("RGBA", (w, h), brand_rgb + (255,))
    if photos:
        canvas.paste(_cover_crop(photos[0], w, photo_h), (0, 0))
    draw = ImageDraw.Draw(canvas)
    draw.rectangle([0, photo_h, w, h], fill=brand_rgb)
    draw.rectangle([0, photo_h, w, photo_h + 10], fill=accent)
    fg = _text_on(brand_rgb)
    margin = int(w * 0.07)
    cta = copy.get("cta", "") or "Contáctanos"
    cta_font = _font("bold", int(w * 0.036))
    cta_h = cta_font.size + 26
    cta_y = h - margin - cta_h
    head = copy.get("headline", "")
    head_top = photo_h + int(h * 0.045)
    head_maxh = cta_y - int(h * 0.02) - head_top
    hf, hlines, hlh = _fit_text(draw, head, "extrabold", w - margin * 2, max(int(h * 0.08), head_maxh), int(w * 0.072), 32)
    _draw_lines(draw, hlines, hf, margin, head_top, hlh, fg)
    _pill(draw, (margin, cta_y), cta, cta_font, accent, _text_on(accent), pad_x=40)
    return canvas.convert("RGB")


def _render_center_stage(size, photos, copy, brand) -> Image.Image:
    w, h = size
    brand_rgb = brand["brand"]
    accent = brand["accent"]
    base = _cover_crop(photos[0], w, h) if photos else Image.new("RGB", (w, h), brand_rgb)
    canvas = base.convert("RGBA")
    canvas.alpha_composite(Image.new("RGBA", (w, h), _darken(brand_rgb, 0.25) + (140,)))
    draw = ImageDraw.Draw(canvas)
    margin = int(w * 0.10)
    cx = w // 2
    head = copy.get("headline", "")
    hf, hlines, hlh = _fit_text(draw, head, "extrabold", w - margin * 2, int(h * 0.42), int(w * 0.125), 46)
    sub = copy.get("subheadline", "")
    sub_font = _font("semibold", int(w * 0.044))
    cta = copy.get("cta", "") or "Contáctanos"
    cta_font = _font("bold", int(w * 0.04))
    cta_h = cta_font.size + 30
    htotal = hlh * len(hlines)
    block = int(h * 0.04) + htotal + (int(h * 0.02) + sub_font.size if sub else 0) + int(h * 0.045) + cta_h
    pos = _STYLE.get("text_position", "center")
    if pos == "top":
        y = int(h * 0.10)
    elif pos == "bottom":
        y = h - block - int(h * 0.10)
    else:
        y = (h - block) // 2
    _accent_bar(draw, cx - int(w * 0.07), y, int(w * 0.14), accent)
    y += int(h * 0.04)
    for ln in hlines:
        _draw_text(draw, (cx, y), ln, hf, (255, 255, 255), anchor="ma")
        y += hlh
    if sub:
        y += int(h * 0.02)
        st = sub
        while st and draw.textlength(st, font=sub_font) > w - margin * 2:
            st = st[:-1]
        _draw_text(draw, (cx, y), st, sub_font, (235, 240, 245), anchor="ma")
        y += sub_font.size
    y += int(h * 0.045)
    tw = draw.textlength(cta, font=cta_font)
    pillw = tw + 88
    _pill(draw, (cx - pillw / 2, y), cta, cta_font, accent, _text_on(accent), pad_x=44)
    return canvas.convert("RGB")


def _render_side_panel(size, photos, copy, brand) -> Image.Image:
    w, h = size
    brand_rgb = brand["brand"]
    accent = brand["accent"]
    fg = _text_on(brand_rgb)
    canvas = Image.new("RGBA", (w, h), brand_rgb + (255,))
    horizontal = w >= h
    draw = ImageDraw.Draw(canvas)
    if horizontal:
        panel_w = int(w * 0.44)
        if photos:
            canvas.paste(_cover_crop(photos[0], w - panel_w, h), (panel_w, 0))
        draw = ImageDraw.Draw(canvas)
        draw.rectangle([0, 0, panel_w, h], fill=brand_rgb)
        draw.rectangle([panel_w - 8, 0, panel_w, h], fill=accent)
        tx = int(w * 0.05)
        maxw = panel_w - int(w * 0.08)
        region_h = h
        cy0 = 0
    else:
        panel_h = int(h * 0.38)
        photo_h = h - panel_h
        if photos:
            canvas.paste(_cover_crop(photos[0], w, photo_h), (0, 0))
        draw = ImageDraw.Draw(canvas)
        draw.rectangle([0, photo_h, w, h], fill=brand_rgb)
        draw.rectangle([0, photo_h, w, photo_h + 8], fill=accent)
        tx = int(w * 0.07)
        maxw = w - int(w * 0.14)
        region_h = panel_h
        cy0 = photo_h
    head = copy.get("headline", "")
    cta = copy.get("cta", "") or "Contáctanos"
    cta_font = _font("bold", int(w * 0.034))
    cta_h = cta_font.size + 26
    hf, hlines, hlh = _fit_text(draw, head, "extrabold", maxw, int(region_h * 0.45), int(w * 0.07), 30)
    sub = copy.get("subheadline", "")
    sub_font = _font("semibold", int(w * 0.034))
    sub_lines = _wrap(draw, sub, sub_font, maxw)[:2] if sub else []
    htotal = hlh * len(hlines)
    sub_total = int(sub_font.size * 1.1) * len(sub_lines)
    block = int(h * 0.025) + htotal + (int(h * 0.015) + sub_total if sub_lines else 0) + int(h * 0.03) + cta_h
    ty = cy0 + max(int(h * 0.02), (region_h - block) // 2)
    _accent_bar(draw, tx, ty, int(w * 0.10), accent)
    ty += int(h * 0.025)
    ty = _draw_lines(draw, hlines, hf, tx, ty, hlh, fg)
    if sub_lines:
        ty += int(h * 0.015)
        for ln in sub_lines:
            draw.text((tx, ty), ln, font=sub_font, fill=fg)
            ty += int(sub_font.size * 1.1)
    ty += int(h * 0.03)
    _pill(draw, (tx, ty), cta, cta_font, accent, _text_on(accent), pad_x=38)
    return canvas.convert("RGB")


def _render_top_banner(size, photos, copy, brand) -> Image.Image:
    w, h = size
    brand_rgb = brand["brand"]
    accent = brand["accent"]
    bar_h = int(h * 0.26)
    canvas = Image.new("RGBA", (w, h), brand_rgb + (255,))
    if photos:
        canvas.paste(_cover_crop(photos[0], w, h - bar_h), (0, bar_h))
    draw = ImageDraw.Draw(canvas)
    draw.rectangle([0, 0, w, bar_h], fill=brand_rgb)
    draw.rectangle([0, bar_h - 8, w, bar_h], fill=accent)
    fg = _text_on(brand_rgb)
    margin = int(w * 0.07)
    head = copy.get("headline", "")
    hf, hlines, hlh = _fit_text(draw, head, "extrabold", w - margin * 2, bar_h - int(h * 0.06), int(w * 0.068), 32)
    ty = (bar_h - hlh * len(hlines)) // 2
    _draw_lines(draw, hlines, hf, margin, ty, hlh, fg)
    canvas.alpha_composite(_bottom_scrim((w, h), _darken(brand_rgb, 0.4), start_frac=0.28))
    draw = ImageDraw.Draw(canvas)
    y = h - margin
    cta = copy.get("cta", "") or "Contáctanos"
    cta_font = _font("bold", int(w * 0.04))
    cta_h = cta_font.size + 28
    _pill(draw, (margin, y - cta_h), cta, cta_font, accent, _text_on(accent), pad_x=40)
    sub = copy.get("subheadline", "")
    if sub:
        sf = _font("semibold", int(w * 0.038))
        draw.text((margin, y - cta_h - int(h * 0.02)), sub, font=sf, fill=(255, 255, 255), anchor="lb")
    return canvas.convert("RGB")


def _render_boxed(size, photos, copy, brand) -> Image.Image:
    w, h = size
    brand_rgb = brand["brand"]
    accent = brand["accent"]
    base = _cover_crop(photos[0], w, h) if photos else Image.new("RGB", (w, h), brand_rgb)
    canvas = base.convert("RGBA")
    canvas.alpha_composite(Image.new("RGBA", (w, h), (0, 0, 0, 60)))
    draw = ImageDraw.Draw(canvas)
    margin = int(w * 0.07)
    pad = int(w * 0.06)
    head = copy.get("headline", "")
    sub = copy.get("subheadline", "")
    cta = copy.get("cta", "") or "Contáctanos"
    cardw = w - margin * 2
    hf, hlines, hlh = _fit_text(draw, head, "extrabold", cardw - pad * 2, int(h * 0.22), int(w * 0.072), 34)
    cta_font = _font("bold", int(w * 0.034))
    cta_h = cta_font.size + 26
    sub_font = _font("semibold", int(w * 0.038))
    sub_lines = _wrap(draw, sub, sub_font, cardw - pad * 2)[:2] if sub else []
    sub_total = int(sub_font.size * 1.1) * len(sub_lines)
    bar_gap = int(h * 0.022)
    card_h = pad * 2 + bar_gap + hlh * len(hlines) + (int(h * 0.008) + sub_total if sub_lines else 0) + int(h * 0.02) + cta_h
    cardx = margin
    cardy = h - margin - card_h
    draw.rounded_rectangle([cardx, cardy, cardx + cardw, cardy + card_h], radius=36, fill=(255, 255, 255, 242))
    tx = cardx + pad
    ty = cardy + pad
    _accent_bar(draw, tx, ty, int(w * 0.12), accent)
    ty += bar_gap
    ty = _draw_lines(draw, hlines, hf, tx, ty, hlh, (17, 24, 39))
    if sub_lines:
        ty += int(h * 0.008)
        for ln in sub_lines:
            draw.text((tx, ty), ln, font=sub_font, fill=(90, 100, 112))
            ty += int(sub_font.size * 1.1)
    ty += int(h * 0.02)
    _pill(draw, (tx, ty), cta, cta_font, accent, _text_on(accent), pad_x=40)
    return canvas.convert("RGB")


def _render_magazine(size, photos, copy, brand) -> Image.Image:
    w, h = size
    brand_rgb = brand["brand"]
    accent = brand["accent"]
    base = _cover_crop(photos[0], w, h) if photos else Image.new("RGB", (w, h), brand_rgb)
    canvas = base.convert("RGBA")
    canvas.alpha_composite(_bottom_scrim((w, h), (0, 0, 0), start_frac=0.6, max_alpha=205))
    draw = ImageDraw.Draw(canvas)
    margin = int(w * 0.07)
    y = h - margin
    cta = copy.get("cta", "") or "Contáctanos"
    cta_font = _font("bold", int(w * 0.032))
    cta_h = cta_font.size + 24
    _pill(draw, (margin, y - cta_h), cta, cta_font, accent, _text_on(accent))
    y = y - cta_h - int(h * 0.03)
    head = copy.get("headline", "")
    hf, hlines, hlh = _fit_text(draw, head, "extrabold", w - margin * 2, int(h * 0.34), int(w * 0.13), 42)
    htotal = hlh * len(hlines)
    y -= htotal
    draw.rectangle([margin, y - int(h * 0.022), w - margin, y - int(h * 0.022) + 5], fill=accent)
    _draw_lines(draw, hlines, hf, margin, y, hlh, (255, 255, 255))
    sub = copy.get("subheadline", "")
    if sub:
        sf = _font("semibold", int(w * 0.034))
        _draw_text(draw, (margin, y - int(h * 0.038)), sub.upper(), sf, accent, anchor="lb")
    return canvas.convert("RGB")


def _render_elegant_dark(size, photos, copy, brand) -> Image.Image:
    w, h = size
    accent = brand["accent"]
    base = _cover_crop(photos[0], w, h) if photos else Image.new("RGB", (w, h), (20, 20, 25))
    canvas = base.convert("RGBA")
    canvas.alpha_composite(Image.new("RGBA", (w, h), (10, 12, 18, 105)))
    canvas.alpha_composite(_bottom_scrim((w, h), (8, 10, 14), start_frac=0.55, max_alpha=235))
    draw = ImageDraw.Draw(canvas)
    m = int(w * 0.05)
    draw.rectangle([m, m, w - m, h - m], outline=(255, 255, 255, 150), width=3)
    margin = int(w * 0.10)
    y = h - int(h * 0.11)
    cta = copy.get("cta", "") or "Contáctanos"
    cta_font = _font("semibold", int(w * 0.032))
    cta_h = cta_font.size + 26
    _pill(draw, (margin, y - cta_h), cta, cta_font, accent, _text_on(accent), pad_x=42)
    y = y - cta_h - int(h * 0.03)
    head = copy.get("headline", "")
    hf, hlines, hlh = _fit_text(draw, head, "bold", w - margin * 2, int(h * 0.3), int(w * 0.10), 38)
    htotal = hlh * len(hlines)
    y -= htotal
    _draw_lines(draw, hlines, hf, margin, y, hlh, (255, 255, 255))
    sub = copy.get("subheadline", "")
    if sub:
        sf = _font("regular", int(w * 0.034))
        _draw_text(draw, (margin, y - int(h * 0.025)), sub, sf, (220, 225, 230), anchor="lb")
    return canvas.convert("RGB")


# ---------------------------------------------------------------------------
# NEW templates (batch 2)
# ---------------------------------------------------------------------------

def _star_points(cx, cy, r):
    pts = []
    for i in range(10):
        ang = math.pi / 2 + i * math.pi / 5
        rad = r if i % 2 == 0 else r * 0.42
        pts.append((cx + rad * math.cos(ang), cy - rad * math.sin(ang)))
    return pts


def _draw_stars(draw, x, y, r, n, fill):
    gap = r * 2.45
    for i in range(n):
        draw.polygon(_star_points(x + r + i * gap, y, r), fill=fill)


def _brand_chip(canvas, draw, brand, x, y, scale_frac=0.042):
    w = canvas.size[0]
    _paste_logo_chip(canvas, draw, brand.get("logo"), brand.get("business_name", ""), x, y, int(w * scale_frac))


def _render_review_5star(size, photos, copy, brand) -> Image.Image:
    w, h = size
    accent = brand["accent"]
    base = _cover_crop(photos[0], w, h) if photos else Image.new("RGB", (w, h), brand["brand"])
    canvas = base.convert("RGBA")
    canvas.alpha_composite(_bottom_scrim((w, h), (0, 0, 0), start_frac=0.66, max_alpha=228))
    draw = ImageDraw.Draw(canvas)
    margin = int(w * 0.07)
    _brand_chip(canvas, draw, brand, margin, margin)
    y = h - margin
    cta = copy.get("cta", "") or "Contáctanos"
    cta_font = _font("bold", int(w * 0.034)); cta_h = cta_font.size + 26
    _pill(draw, (margin, y - cta_h), cta, cta_font, accent, _text_on(accent), pad_x=40)
    y = y - cta_h - int(h * 0.03)
    head = copy.get("headline", "")
    hf, hlines, hlh = _fit_text(draw, '“' + head + '”', "extrabold", w - margin * 2, int(h * 0.28), int(w * 0.082), 34)
    y -= hlh * len(hlines)
    _draw_lines(draw, hlines, hf, margin, y, hlh, (255, 255, 255))
    sr = int(w * 0.028); sy = y - int(h * 0.05)
    _shape_shadow(draw, lambda d: _draw_stars(d, margin, sy, sr, 5, (0, 0, 0, 190)), blur=int(w * 0.012), off=int(h * 0.006))
    _draw_stars(draw, margin, sy, sr, 5, (255, 199, 44))
    return canvas.convert("RGB")


def _render_framed_pro(size, photos, copy, brand) -> Image.Image:
    w, h = size
    brand_rgb = brand["brand"]; accent = brand["accent"]
    canvas = Image.new("RGBA", (w, h), brand_rgb + (255,))
    inset = int(w * 0.05); bar_h = int(h * 0.20)
    if photos:
        canvas.paste(_cover_crop(photos[0], w - inset * 2, h - bar_h - inset * 2), (inset, inset))
    draw = ImageDraw.Draw(canvas)
    draw.rectangle([inset, inset, w - inset, h - bar_h - inset], outline=accent, width=12)
    _brand_chip(canvas, draw, brand, inset + int(w * 0.03), inset + int(w * 0.03))
    fg = _text_on(brand_rgb); margin = int(w * 0.07); by = h - bar_h
    head = copy.get("headline", "")
    cta = copy.get("cta", "") or "Llámanos"
    cta_font = _font("bold", int(w * 0.03)); cta_h = cta_font.size + 26
    pw = draw.textlength(cta, font=cta_font) + 72
    hf, hlines, hlh = _fit_text(draw, head, "extrabold", w - margin * 2 - pw - int(w * 0.03), bar_h - int(h * 0.05), int(w * 0.05), 28)
    ty = by + (bar_h - hlh * len(hlines)) // 2
    _draw_lines(draw, hlines, hf, margin, ty, hlh, fg)
    _pill(draw, (w - margin - pw, by + (bar_h - cta_h) // 2), cta, cta_font, accent, _text_on(accent), pad_x=36)
    return canvas.convert("RGB")


def _render_split_diagonal(size, photos, copy, brand) -> Image.Image:
    w, h = size
    brand_rgb = brand["brand"]; accent = brand["accent"]
    base = _cover_crop(photos[0], w, h) if photos else Image.new("RGB", (w, h), brand_rgb)
    canvas = base.convert("RGBA")
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(overlay).polygon([(0, int(h * 0.60)), (w, int(h * 0.48)), (w, h), (0, h)], fill=brand_rgb + (240,))
    canvas.alpha_composite(overlay)
    draw = ImageDraw.Draw(canvas)
    draw.line([(0, int(h * 0.60)), (w, int(h * 0.48))], fill=accent, width=12)
    _brand_chip(canvas, draw, brand, int(w * 0.07), int(w * 0.07))
    fg = _text_on(brand_rgb); margin = int(w * 0.07)
    y = h - margin
    cta = copy.get("cta", "") or "Contáctanos"
    cta_font = _font("bold", int(w * 0.034)); cta_h = cta_font.size + 26
    _pill(draw, (margin, y - cta_h), cta, cta_font, accent, _text_on(accent), pad_x=40)
    y = y - cta_h - int(h * 0.03)
    head = copy.get("headline", "")
    hf, hlines, hlh = _fit_text(draw, head, "extrabold", w - margin * 2, int(h * 0.22), int(w * 0.075), 32)
    y -= hlh * len(hlines)
    _draw_lines(draw, hlines, hf, margin, y, hlh, fg)
    return canvas.convert("RGB")


def _render_now_hiring(size, photos, copy, brand) -> Image.Image:
    w, h = size
    brand_rgb = brand["brand"]; accent = brand["accent"]
    base = _cover_crop(photos[0], w, h) if photos else Image.new("RGB", (w, h), brand_rgb)
    canvas = base.convert("RGBA")
    canvas.alpha_composite(Image.new("RGBA", (w, h), (0, 0, 0, 120)))
    canvas.alpha_composite(_bottom_scrim((w, h), _darken(brand_rgb, 0.4), start_frac=0.5))
    draw = ImageDraw.Draw(canvas)
    margin = int(w * 0.07)
    band_h = int(h * 0.155); by = int(h * 0.40)
    draw.rectangle([0, by, w, by + band_h], fill=accent)
    txt = (copy.get("headline", "") or "NOW HIRING").upper()
    fs = int(w * 0.10)
    while fs > 34 and draw.textlength(txt, font=_font("extrabold", fs)) > w - margin * 2:
        fs -= 4
    draw.text((w / 2, by + band_h / 2), txt, font=_font("extrabold", fs), fill=_text_on(accent), anchor="mm")
    sub = copy.get("subheadline", "")
    if sub:
        sf = _font("semibold", int(w * 0.042))
        for i, ln in enumerate(_wrap(draw, sub, sf, w - margin * 2)[:2]):
            draw.text((w / 2, by + band_h + int(h * 0.035) + i * int(sf.size * 1.2)), ln, font=sf, fill=(255, 255, 255), anchor="ma")
    cta = copy.get("cta", "") or "Aplica hoy"
    cta_font = _font("bold", int(w * 0.04)); cta_h = cta_font.size + 30
    pw = draw.textlength(cta, font=cta_font) + 88
    _pill(draw, ((w - pw) / 2, h - margin - cta_h), cta, cta_font, accent, _text_on(accent), pad_x=44)
    return canvas.convert("RGB")


def _render_quote_offer(size, photos, copy, brand) -> Image.Image:
    w, h = size
    accent = brand["accent"]
    base = _cover_crop(photos[0], w, h) if photos else Image.new("RGB", (w, h), brand["brand"])
    canvas = base.convert("RGBA")
    panel_h = int(h * 0.36); py = h - panel_h
    draw = ImageDraw.Draw(canvas)
    draw.rectangle([0, py, w, h], fill=accent)
    _brand_chip(canvas, draw, brand, int(w * 0.07), int(w * 0.07))
    fg = _text_on(accent); margin = int(w * 0.07)
    label = (copy.get("subheadline", "") or "FREE ESTIMATE").upper()
    lf = _font("bold", int(w * 0.036))
    draw.text((margin, py + int(h * 0.045)), label, font=lf, fill=fg)
    head = copy.get("headline", "")
    hf, hlines, hlh = _fit_text(draw, head, "extrabold", w - margin * 2, int(h * 0.13), int(w * 0.07), 32)
    ty = py + int(h * 0.10)
    ty = _draw_lines(draw, hlines, hf, margin, ty, hlh, fg)
    phone = brand.get("phone", "")
    if phone:
        pf = _font("extrabold", int(w * 0.072))
        draw.text((margin, h - margin - pf.size), phone, font=pf, fill=fg)
    return canvas.convert("RGB")


def _render_seasonal(size, photos, copy, brand) -> Image.Image:
    w, h = size
    accent = brand["accent"]
    base = _cover_crop(photos[0], w, h) if photos else Image.new("RGB", (w, h), brand["brand"])
    canvas = base.convert("RGBA")
    canvas.alpha_composite(_bottom_scrim((w, h), (0, 0, 0), start_frac=0.55, max_alpha=205))
    draw = ImageDraw.Draw(canvas)
    margin = int(w * 0.07)
    ribbon = (brand.get("promo_label", "") or "SPECIAL").upper()
    rf = _font("bold", int(w * 0.04))
    _chip(draw, (margin, margin), ribbon, rf, accent, _text_on(accent), pad_x=28, pad_y=16)
    y = h - margin
    cta = copy.get("cta", "") or "Contáctanos"
    cta_font = _font("bold", int(w * 0.036)); cta_h = cta_font.size + 28
    _pill(draw, (margin, y - cta_h), cta, cta_font, accent, _text_on(accent), pad_x=42)
    y = y - cta_h - int(h * 0.03)
    head = copy.get("headline", "")
    hf, hlines, hlh = _fit_text(draw, head, "extrabold", w - margin * 2, int(h * 0.30), int(w * 0.095), 36)
    y -= hlh * len(hlines)
    draw.rectangle([margin, y - int(h * 0.02), margin + int(w * 0.14), y - int(h * 0.02) + 8], fill=accent)
    _draw_lines(draw, hlines, hf, margin, y, hlh, (255, 255, 255))
    return canvas.convert("RGB")


def _render_trust_badge(size, photos, copy, brand) -> Image.Image:
    w, h = size
    accent = brand["accent"]
    base = _cover_crop(photos[0], w, h) if photos else Image.new("RGB", (w, h), brand["brand"])
    canvas = base.convert("RGBA")
    canvas.alpha_composite(_bottom_scrim((w, h), (0, 0, 0), start_frac=0.58, max_alpha=218))
    draw = ImageDraw.Draw(canvas)
    margin = int(w * 0.07)
    _brand_chip(canvas, draw, brand, margin, margin)
    # circular guarantee badge top-right
    bd = int(w * 0.26); bx = w - margin - bd; byy = margin
    draw.ellipse([bx, byy, bx + bd, byy + bd], fill=accent)
    badge = (copy.get("subheadline", "") or "100% GUARANTEE").upper().split()
    bf = _font("extrabold", int(w * 0.05))
    lines = badge[:3]
    tot = len(lines) * int(bf.size * 1.05)
    cy = byy + bd / 2 - tot / 2 + bf.size / 2
    for ln in lines:
        draw.text((bx + bd / 2, cy), ln, font=bf, fill=_text_on(accent), anchor="mm")
        cy += int(bf.size * 1.05)
    y = h - margin
    cta = copy.get("cta", "") or "Contáctanos"
    cta_font = _font("bold", int(w * 0.034)); cta_h = cta_font.size + 26
    _pill(draw, (margin, y - cta_h), cta, cta_font, accent, _text_on(accent), pad_x=40)
    y = y - cta_h - int(h * 0.03)
    head = copy.get("headline", "")
    hf, hlines, hlh = _fit_text(draw, head, "extrabold", w - margin * 2, int(h * 0.26), int(w * 0.08), 34)
    y -= hlh * len(hlines)
    _draw_lines(draw, hlines, hf, margin, y, hlh, (255, 255, 255))
    return canvas.convert("RGB")


def _render_coupon(size, photos, copy, brand) -> Image.Image:
    w, h = size
    brand_rgb = brand["brand"]; accent = brand["accent"]
    base = _cover_crop(photos[0], w, h) if photos else Image.new("RGB", (w, h), brand_rgb)
    canvas = base.convert("RGBA")
    canvas.alpha_composite(Image.new("RGBA", (w, h), _darken(brand_rgb, 0.35) + (150,)))
    draw = ImageDraw.Draw(canvas)
    margin = int(w * 0.09)
    cardx, cardy = margin, int(h * 0.27)
    cardw, cardh = w - margin * 2, int(h * 0.46)
    draw.rounded_rectangle([cardx, cardy, cardx + cardw, cardy + cardh], radius=36, fill=(255, 255, 255, 248))
    draw.rounded_rectangle([cardx + 16, cardy + 16, cardx + cardw - 16, cardy + cardh - 16], radius=26, outline=accent, width=6)
    pad = int(w * 0.05); tx = cardx + pad; ty = cardy + pad
    lf = _font("bold", int(w * 0.034))
    draw.text((tx, ty), (copy.get("subheadline", "") or "LIMITED OFFER").upper(), font=lf, fill=accent)
    ty += int(lf.size * 1.6)
    head = copy.get("headline", "")
    hf, hlines, hlh = _fit_text(draw, head, "extrabold", cardw - pad * 2, int(cardh * 0.42), int(w * 0.10), 40)
    ty = _draw_lines(draw, hlines, hf, tx, ty, hlh, (17, 24, 39))
    ty += int(h * 0.02)
    cta = copy.get("cta", "") or "Llámanos hoy"
    cta_font = _font("bold", int(w * 0.036))
    _pill(draw, (tx, ty), cta, cta_font, accent, _text_on(accent), pad_x=42)
    return canvas.convert("RGB")


def _render_duo_grid(size, photos, copy, brand) -> Image.Image:
    w, h = size
    brand_rgb = brand["brand"]; accent = brand["accent"]
    canvas = Image.new("RGBA", (w, h), brand_rgb + (255,))
    bar_h = int(h * 0.17); ph = (h - bar_h) // 2
    if photos and len(photos) >= 2:
        canvas.paste(_cover_crop(photos[0], w, ph), (0, 0))
        canvas.paste(_cover_crop(photos[1], w, ph), (0, ph))
    elif photos:
        canvas.paste(_cover_crop(photos[0], w, ph * 2), (0, 0))
    draw = ImageDraw.Draw(canvas)
    draw.rectangle([0, ph - 6, w, ph + 6], fill=accent)
    _brand_chip(canvas, draw, brand, int(w * 0.05), int(w * 0.05))
    fg = _text_on(brand_rgb); margin = int(w * 0.07); by = h - bar_h
    head = copy.get("headline", "")
    cta = copy.get("cta", "") or "Contáctanos"
    cta_font = _font("bold", int(w * 0.03)); cta_h = cta_font.size + 24
    pw = draw.textlength(cta, font=cta_font) + 72
    hf, hlines, hlh = _fit_text(draw, head, "extrabold", w - margin * 2 - pw - int(w * 0.03), bar_h - int(h * 0.04), int(w * 0.048), 28)
    ty = by + (bar_h - hlh * len(hlines)) // 2
    _draw_lines(draw, hlines, hf, margin, ty, hlh, fg)
    _pill(draw, (w - margin - pw, by + (bar_h - cta_h) // 2), cta, cta_font, accent, _text_on(accent), pad_x=36)
    return canvas.convert("RGB")


def _render_clean_band(size, photos, copy, brand) -> Image.Image:
    w, h = size
    accent = brand["accent"]
    base = _cover_crop(photos[0], w, h) if photos else Image.new("RGB", (w, h), brand["brand"])
    canvas = base.convert("RGBA")
    draw = ImageDraw.Draw(canvas)
    _brand_chip(canvas, draw, brand, int(w * 0.07), int(w * 0.07))
    head = copy.get("headline", "")
    margin = int(w * 0.08)
    hf, hlines, hlh = _fit_text(draw, head, "extrabold", w - margin * 2, int(h * 0.16), int(w * 0.062), 30)
    band_pad = int(h * 0.03)
    band_h = hlh * len(hlines) + band_pad * 2
    by = int(h * 0.64)
    band = Image.new("RGBA", (w, band_h), accent + (235,))
    canvas.alpha_composite(band, (0, by))
    draw = ImageDraw.Draw(canvas)
    ty = by + band_pad
    for ln in hlines:
        draw.text((w / 2, ty), ln, font=hf, fill=_text_on(accent), anchor="ma")
        ty += hlh
    phone = brand.get("phone", "")
    sub = copy.get("cta", "") or phone or "Contáctanos"
    sf = _font("bold", int(w * 0.038))
    draw.text((w / 2, by + band_h + int(h * 0.035)), sub, font=sf, fill=(255, 255, 255), anchor="ma")
    canvas2 = canvas.convert("RGBA")
    # subtle top scrim so brand chip pops
    return canvas2.convert("RGB")


_RENDERERS = {
    "before_after": _render_before_after,
    "showcase": _render_showcase,
    "promo": _render_promo,
    "bold_bar": _render_bold_bar,
    "center_stage": _render_center_stage,
    "side_panel": _render_side_panel,
    "top_banner": _render_top_banner,
    "boxed": _render_boxed,
    "magazine": _render_magazine,
    "elegant_dark": _render_elegant_dark,
    "review_5star": _render_review_5star,
    "framed_pro": _render_framed_pro,
    "split_diagonal": _render_split_diagonal,
    "now_hiring": _render_now_hiring,
    "quote_offer": _render_quote_offer,
    "seasonal": _render_seasonal,
    "trust_badge": _render_trust_badge,
    "coupon": _render_coupon,
    "duo_grid": _render_duo_grid,
    "clean_band": _render_clean_band,
}

# Design catalog (id -> label + how many photos it needs). Order = display order.
DESIGNS = [
    {"id": "showcase", "label": "Minimalista", "photos": 1},
    {"id": "bold_bar", "label": "Barra Bold", "photos": 1},
    {"id": "center_stage", "label": "Centro Impacto", "photos": 1},
    {"id": "boxed", "label": "Tarjeta", "photos": 1},
    {"id": "magazine", "label": "Editorial", "photos": 1},
    {"id": "elegant_dark", "label": "Elegante", "photos": 1},
    {"id": "top_banner", "label": "Banner Arriba", "photos": 1},
    {"id": "side_panel", "label": "Panel Lateral", "photos": 1},
    {"id": "before_after", "label": "Antes / Después", "photos": 2},
    {"id": "promo", "label": "Oferta / Promo", "photos": 1},
    {"id": "review_5star", "label": "Reseña 5★", "photos": 1},
    {"id": "framed_pro", "label": "Marco Pro", "photos": 1},
    {"id": "split_diagonal", "label": "Diagonal", "photos": 1},
    {"id": "now_hiring", "label": "Contratando", "photos": 1},
    {"id": "quote_offer", "label": "Cotización Gratis", "photos": 1},
    {"id": "seasonal", "label": "Temporada", "photos": 1},
    {"id": "trust_badge", "label": "Garantía", "photos": 1},
    {"id": "coupon", "label": "Cupón", "photos": 1},
    {"id": "duo_grid", "label": "Galería Dúo", "photos": 2},
    {"id": "clean_band", "label": "Cinta Limpia", "photos": 1},
]
DESIGN_PHOTOS = {d["id"]: d["photos"] for d in DESIGNS}


def render_post(template: str, size_key: str, photos: List[Image.Image], copy: dict, brand: dict) -> bytes:
    global _STYLE
    _STYLE = dict(brand.get("style") or {})
    # Auto legibility: text over a full-bleed photo always gets a clean outline so
    # it reads on any background; text on solid bands/cards stays crisp (no stroke).
    if "legibility" not in _STYLE:
        _STYLE["legibility"] = "medium" if template in _OVERLAY_TEMPLATES else "none"
    size = SIZES.get(size_key, SIZES["1x1"])
    renderer = _RENDERERS.get(template, _render_showcase)
    img = renderer(size, photos, copy, brand)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def build_brand(card: dict, user: dict, logo_bytes: Optional[bytes], language: str = "en",
                brand_override: Optional[str] = None, accent_override: Optional[str] = None,
                style: Optional[dict] = None, label_before: Optional[str] = None,
                label_after: Optional[str] = None, promo_label_override: Optional[str] = None) -> dict:
    ba_def = ("ANTES", "DESPUÉS") if language == "es" else ("BEFORE", "AFTER")
    lb = (label_before or "").strip() or ba_def[0]
    la = (label_after or "").strip() or ba_def[1]
    promo_label = (promo_label_override or "").strip() or ("OFERTA ESPECIAL" if language == "es" else "SPECIAL OFFER")
    return {
        "brand": _hex_to_rgb(brand_override or card.get("brand_color"), (30, 58, 138)),
        "accent": _hex_to_rgb(accent_override or card.get("accent_color"), (16, 185, 129)),
        "logo": _open_logo(logo_bytes),
        "business_name": user.get("business_name", "") or "",
        "phone": card.get("contact_phone") or user.get("phone", "") or "",
        "ba_labels": (lb, la),
        "promo_label": promo_label,
        "style": style or {},
    }
