#!/usr/bin/env python3
from __future__ import annotations

import math
import shutil
from pathlib import Path
from subprocess import run

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
ICONS = ROOT / "src-tauri" / "icons"

SVG = """<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <title>Curation logo</title>
  <defs>
    <linearGradient id="bg" x1="96" y1="72" x2="438" y2="458" gradientUnits="userSpaceOnUse">
      <stop stop-color="#123B3B"/>
      <stop offset="1" stop-color="#082323"/>
    </linearGradient>
    <linearGradient id="cyan" x1="95" y1="358" x2="333" y2="137" gradientUnits="userSpaceOnUse">
      <stop stop-color="#2DE2E6"/>
      <stop offset="1" stop-color="#57F6B5"/>
    </linearGradient>
    <linearGradient id="amber" x1="227" y1="123" x2="407" y2="255" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FFE16A"/>
      <stop offset="1" stop-color="#FFAA1B"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.12 0 0 0 0 0.93 0 0 0 0 0.86 0 0 0 0.35 0"/>
      <feBlend in="SourceGraphic"/>
    </filter>
  </defs>
  <rect x="32" y="32" width="448" height="448" rx="108" fill="url(#bg)"/>
  <path d="M372 199A136 118 0 0 1 155 343" stroke="url(#cyan)" stroke-width="42" stroke-linecap="round"/>
  <path d="M236 167A91 86 0 0 1 377 274" stroke="url(#amber)" stroke-width="42" stroke-linecap="round"/>
  <path d="M181 337L139 369" stroke="#5AF7CC" stroke-width="28" stroke-linecap="round" opacity=".82"/>
  <path d="M154 182A99 97 0 0 1 263 142" stroke="#D6FFF4" stroke-width="12" stroke-linecap="round" opacity=".5"/>
  <circle cx="256" cy="256" r="50" fill="#112F2F"/>
  <circle cx="256" cy="256" r="31" fill="#F4C542"/>
  <circle cx="256" cy="256" r="13" fill="#FFF7C2"/>
  <circle cx="236" cy="170" r="20" fill="#FFB724"/>
  <circle cx="357" cy="151" r="13" fill="#FFE680"/>
  <circle cx="384" cy="274" r="22" fill="#FFB724"/>
  <circle cx="139" cy="340" r="12" fill="#35E6E6" filter="url(#glow)"/>
</svg>
"""


def rounded_rect_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return mask


def lerp(a: int, b: int, t: float) -> int:
    return round(a + (b - a) * t)


def gradient_bg(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size))
    px = img.load()
    c1 = (18, 59, 59)
    c2 = (8, 35, 35)
    for y in range(size):
        for x in range(size):
            t = (x * 0.45 + y * 0.75) / (size * 1.2)
            t = max(0, min(1, t))
            px[x, y] = (*[lerp(c1[i], c2[i], t) for i in range(3)], 255)
    img.putalpha(rounded_rect_mask(size, round(size * 0.21)))
    return img


def add_glow(layer: Image.Image, base: Image.Image, radius: int, opacity: float) -> None:
    glow = layer.filter(ImageFilter.GaussianBlur(radius))
    alpha = glow.getchannel("A").point(lambda p: round(p * opacity))
    glow.putalpha(alpha)
    base.alpha_composite(glow)


def arc_points(cx: float, cy: float, rx: float, ry: float, start: float, end: float, n: int) -> list[tuple[float, float]]:
    if end < start:
        end += 360
    pts = []
    for i in range(n):
        angle = math.radians(start + (end - start) * i / (n - 1))
        pts.append((cx + rx * math.cos(angle), cy + ry * math.sin(angle)))
    return pts


def arc_endpoint(cx: float, cy: float, rx: float, ry: float, angle: float) -> tuple[float, float]:
    rad = math.radians(angle)
    return cx + rx * math.cos(rad), cy + ry * math.sin(rad)


def draw_ellipse_arc(
    draw: ImageDraw.ImageDraw,
    cx: float,
    cy: float,
    rx: float,
    ry: float,
    start: float,
    end: float,
    width: int,
    fill: tuple[int, int, int, int],
) -> None:
    bbox = (cx - rx, cy - ry, cx + rx, cy + ry)
    if end < start:
        end += 360
    if end <= 360:
        draw.arc(bbox, start=start, end=end, fill=fill, width=width)
    else:
        draw.arc(bbox, start=start, end=360, fill=fill, width=width)
        draw.arc(bbox, start=0, end=end - 360, fill=fill, width=width)

    cap_radius = width / 2
    for angle in (start, end):
        x, y = arc_endpoint(cx, cy, rx, ry, angle)
        draw.ellipse((x - cap_radius, y - cap_radius, x + cap_radius, y + cap_radius), fill=fill)


def draw_logo(size: int) -> Image.Image:
    scale = size / 512
    ss = 4 if size <= 512 else 2
    canvas_size = size * ss
    img = gradient_bg(canvas_size)

    def s(value: float) -> float:
        return value * scale * ss

    glow_layer = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_layer)
    draw = ImageDraw.Draw(img)

    cyan_w = round(s(42))
    amber_w = round(s(42))
    tail_w = round(s(28))

    draw_ellipse_arc(glow_draw, s(253), s(256), s(136), s(118), 331, 496, cyan_w, (45, 226, 230, 145))
    draw_ellipse_arc(glow_draw, s(302), s(225), s(91), s(86), 224, 395, amber_w, (255, 196, 52, 115))
    add_glow(glow_layer, img, max(2, round(s(7))), 0.45)

    draw_ellipse_arc(draw, s(253), s(256), s(136), s(118), 331, 496, cyan_w, (45, 226, 230, 255))
    draw_ellipse_arc(draw, s(302), s(225), s(91), s(86), 224, 395, amber_w, (255, 183, 36, 255))
    draw.line([(s(181), s(337)), (s(139), s(369))], fill=(90, 247, 204, 212), width=tail_w)

    draw_ellipse_arc(draw, s(226), s(246), s(99), s(97), 222, 292, round(s(12)), (214, 255, 244, 128))

    for cx, cy, radius, color in [
        (256, 256, 50, (17, 47, 47, 255)),
        (256, 256, 31, (244, 197, 66, 255)),
        (256, 256, 13, (255, 247, 194, 255)),
        (357, 151, 13, (255, 230, 128, 255)),
        (139, 340, 12, (53, 230, 230, 255)),
    ]:
        draw.ellipse((s(cx - radius), s(cy - radius), s(cx + radius), s(cy + radius)), fill=color)

    return img.resize((size, size), Image.Resampling.LANCZOS)


def save_png(path: Path, size: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    draw_logo(size).save(path)


def build_icns() -> None:
    iconset = ICONS / "icon.iconset"
    if iconset.exists():
        shutil.rmtree(iconset)
    iconset.mkdir(parents=True)
    for name, size in [
        ("icon_16x16.png", 16),
        ("icon_16x16@2x.png", 32),
        ("icon_32x32.png", 32),
        ("icon_32x32@2x.png", 64),
        ("icon_128x128.png", 128),
        ("icon_128x128@2x.png", 256),
        ("icon_256x256.png", 256),
        ("icon_256x256@2x.png", 512),
        ("icon_512x512.png", 512),
        ("icon_512x512@2x.png", 1024),
    ]:
        save_png(iconset / name, size)
    run(["iconutil", "-c", "icns", str(iconset), "-o", str(ICONS / "icon.icns")], check=True)
    shutil.rmtree(iconset)


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    ICONS.mkdir(parents=True, exist_ok=True)
    (PUBLIC / "logo.svg").write_text(SVG, encoding="utf-8")

    save_png(PUBLIC / "logo.png", 512)
    save_png(ICONS / "icon.png", 512)
    save_png(ICONS / "32x32.png", 32)
    save_png(ICONS / "128x128.png", 128)
    save_png(ICONS / "128x128@2x.png", 256)

    for name, size in {
        "Square30x30Logo.png": 30,
        "Square44x44Logo.png": 44,
        "StoreLogo.png": 50,
        "Square71x71Logo.png": 71,
        "Square89x89Logo.png": 89,
        "Square107x107Logo.png": 107,
        "Square142x142Logo.png": 142,
        "Square150x150Logo.png": 150,
        "Square284x284Logo.png": 284,
        "Square310x310Logo.png": 310,
    }.items():
        save_png(ICONS / name, size)

    draw_logo(256).save(ICONS / "icon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    build_icns()


if __name__ == "__main__":
    main()
