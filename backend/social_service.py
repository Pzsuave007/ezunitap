"""Social post renderer.

Composes branded, scroll-stopping social media graphics (Pillow) from a user's
photos + AI-generated copy + their Smart Card branding (logo, colors). Outputs
PNG bytes for 9:16 (1080x1920) and 1:1 (1080x1080).

Pure local rendering — no external API. AI copy lives in ai_service.
"""
import io
import os
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
    base = _cover_crop(photos[0], w, h) if photos else Image.new("RGB", (w, h), brand_rgb)
    canvas = base.convert("RGBA")
    canvas.alpha_composite(_bottom_scrim((w, h), _darken(brand_rgb, 0.35), start_frac=0.55))
    draw = ImageDraw.Draw(canvas)
    margin = int(w * 0.075)

    # text block bottom (clean: no top logo chip, no phone)
    y = h - margin
    cta = copy.get("cta", "")
    cta_font = _font("bold", int(w * 0.042))
    cta_h = cta_font.size + 28
    y_cta = y - cta_h
    _pill(draw, (margin, y_cta), cta or "Contáctanos", cta_font, accent_rgb, _text_on(accent_rgb))
    y = y_cta - int(h * 0.025)

    sub = copy.get("subheadline", "")
    if sub:
        sub_font, sub_lines, sub_lh = _fit_text(draw, sub, "semibold", w - margin * 2, int(h * 0.12), int(w * 0.05), 30)
        sub_total = sub_lh * len(sub_lines)
        y -= sub_total
        _draw_lines(draw, sub_lines, sub_font, margin, y, sub_lh, (235, 240, 245))
        y -= int(h * 0.012)

    head = copy.get("headline", "") or brand.get("business_name", "")
    hf, hlines, hlh = _fit_text(draw, head, "extrabold", w - margin * 2, int(h * 0.30), int(w * 0.115), 48)
    htotal = hlh * len(hlines)
    y -= htotal
    # accent underline bar
    draw.rounded_rectangle([margin, y - int(h * 0.022), margin + int(w * 0.14), y - int(h * 0.022) + 10], radius=5, fill=accent_rgb)
    _draw_lines(draw, hlines, hf, margin, y, hlh, (255, 255, 255))
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
    y = (h - block) // 2
    _accent_bar(draw, cx - int(w * 0.07), y, int(w * 0.14), accent)
    y += int(h * 0.04)
    for ln in hlines:
        draw.text((cx, y), ln, font=hf, fill=(255, 255, 255), anchor="ma")
        y += hlh
    if sub:
        y += int(h * 0.02)
        st = sub
        while st and draw.textlength(st, font=sub_font) > w - margin * 2:
            st = st[:-1]
        draw.text((cx, y), st, font=sub_font, fill=(235, 240, 245), anchor="ma")
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
        draw.text((margin, y - int(h * 0.038)), sub.upper(), font=sf, fill=accent, anchor="lb")
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
        draw.text((margin, y - int(h * 0.025)), sub, font=sf, fill=(220, 225, 230), anchor="lb")
    return canvas.convert("RGB")


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
]
DESIGN_PHOTOS = {d["id"]: d["photos"] for d in DESIGNS}


def render_post(template: str, size_key: str, photos: List[Image.Image], copy: dict, brand: dict) -> bytes:
    size = SIZES.get(size_key, SIZES["1x1"])
    renderer = _RENDERERS.get(template, _render_showcase)
    img = renderer(size, photos, copy, brand)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def build_brand(card: dict, user: dict, logo_bytes: Optional[bytes], language: str = "en",
                brand_override: Optional[str] = None, accent_override: Optional[str] = None) -> dict:
    ba = ("ANTES", "DESPUÉS") if language == "es" else ("BEFORE", "AFTER")
    promo_label = "OFERTA ESPECIAL" if language == "es" else "SPECIAL OFFER"
    return {
        "brand": _hex_to_rgb(brand_override or card.get("brand_color"), (30, 58, 138)),
        "accent": _hex_to_rgb(accent_override or card.get("accent_color"), (16, 185, 129)),
        "logo": _open_logo(logo_bytes),
        "business_name": user.get("business_name", "") or "",
        "phone": card.get("contact_phone") or user.get("phone", "") or "",
        "ba_labels": ba,
        "promo_label": promo_label,
    }
