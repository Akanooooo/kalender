#!/usr/bin/env python3
"""App-Icons für die PWA. Ergebnis landet in public/icons/."""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1] / "public" / "icons"
BLUE = "#0A84FF"
RED = "#FF3B30"
WHITE = "#FFFFFF"
GREEN = "#34C759"
AMBER = "#FF9F0A"
BAR = "#E5E5EA"


def icon(size: int, scale: float = 1.0) -> Image.Image:
    image = Image.new("RGB", (size, size), BLUE)
    draw = ImageDraw.Draw(image)
    margin = (1 - scale) / 2

    def x(fraction: float) -> float:
        return size * (margin + scale * fraction)

    left, top, right, bottom = x(0.16), x(0.22), x(0.84), x(0.86)
    radius = (right - left) * 0.14
    ring_w = (right - left) * 0.075
    ring_top = top - (bottom - top) * 0.11
    ring_bottom = top + (bottom - top) * 0.08
    for center in (x(0.38), x(0.62)):
        draw.rounded_rectangle(
            [center - ring_w / 2, ring_top, center + ring_w / 2, ring_bottom],
            radius=ring_w / 2,
            fill=WHITE,
        )
    draw.rounded_rectangle([left, top, right, bottom], radius=radius, fill=WHITE)
    header_h = (bottom - top) * 0.24
    draw.rounded_rectangle([left, top, right, top + header_h + radius], radius=radius, fill=RED)
    draw.rectangle([left, top + header_h, right, top + header_h + radius], fill=RED)

    row_top = top + header_h + (bottom - top) * 0.1
    row_h = (bottom - top) * 0.075
    gap = (bottom - top) * 0.055
    colors = [GREEN, BLUE, AMBER]
    widths = [0.72, 0.56, 0.64]
    for index, (color, width) in enumerate(zip(colors, widths)):
        y = row_top + index * (row_h + gap)
        dot = row_h * 0.72
        dot_x = left + (right - left) * 0.1
        draw.ellipse([dot_x, y, dot_x + dot, y + dot], fill=color)
        bar_x = dot_x + dot + row_h * 0.45
        bar_y = y + dot * 0.18
        bar_r = max(2, size * 0.012)
        draw.rounded_rectangle(
            [bar_x, bar_y, left + (right - left) * width, bar_y + dot * 0.64],
            radius=bar_r,
            fill=BAR,
        )
    return image


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    icon(192).save(ROOT / "icon-192.png", optimize=True)
    icon(512).save(ROOT / "icon-512.png", optimize=True)
    icon(180).save(ROOT / "apple-touch-icon.png", optimize=True)
    icon(32).save(ROOT / "favicon-32.png", optimize=True)
    icon(512, scale=0.78).save(ROOT / "icon-maskable-512.png", optimize=True)
    print(f"Icons geschrieben nach {ROOT}")


if __name__ == "__main__":
    main()
