#!/usr/bin/env python3
"""Genereert alle PWA-icoonbestanden uit public/icon.svg.

De geit zit als losse (transparante) PNG ingebed in icon.svg, bovenop een
achtergrond-<rect>. Dit script leest de achtergrondkleur en de geit uit de SVG
en stelt elk doelbestand opnieuw samen op die achtergrond, met dezelfde opmaak
als de SVG (geit in een 300/512-vak, gecentreerd).

Gebruik:  python scripts/gen-icons.py
Vereist:  Pillow  (pip install Pillow)
"""
import base64
import io
import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
SVG = PUBLIC / "icon.svg"

# (bestandsnaam, kantgrootte). De geit vult — net als in de SVG — 300/512 van het vlak.
TARGETS = [
    ("pwa-64x64.png", 64),
    ("pwa-192x192.png", 192),
    ("pwa-512x512.png", 512),
    ("maskable-icon-512x512.png", 512),
    ("apple-touch-icon-180x180.png", 180),
]
GOAT_RATIO = 300 / 512


def load_svg():
    svg = SVG.read_text(encoding="utf-8")
    bg = re.search(r'<rect[^>]*fill="(#[0-9A-Fa-f]{6})"', svg).group(1)
    data = re.search(r"data:image/png;base64,([A-Za-z0-9+/=]+)", svg).group(1)
    goat = Image.open(io.BytesIO(base64.b64decode(data))).convert("RGBA")
    return bg, goat


def compose(goat, bg_hex, size):
    canvas = Image.new("RGBA", (size, size), bg_hex)
    box = round(size * GOAT_RATIO)
    g = goat.resize((box, box), Image.LANCZOS)
    off = (size - box) // 2
    canvas.alpha_composite(g, (off, off))
    return canvas


def main():
    bg, goat = load_svg()
    print(f"achtergrond {bg}, geit {goat.size}")
    for name, size in TARGETS:
        img = compose(goat, bg, size).convert("RGB")
        img.save(PUBLIC / name)
        print(f"  geschreven {name} ({size}x{size})")
    # favicon.ico met meerdere maten
    ico = compose(goat, bg, 48).convert("RGB")
    ico.save(PUBLIC / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print("  geschreven favicon.ico (16/32/48)")


if __name__ == "__main__":
    main()
