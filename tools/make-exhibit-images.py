# Builds the web sizes for the Exhibitors page from the originals in source-images/exhibit
# (generated with Higgsfield Soul 2.0; kept out of git like source-images/gen). Writes
# single-channel greyscale JPEGs into public/assets/img at the widths each slot's srcset names.
# The setup photo is the retouched original (lettering on two chair backs painted out).
# Usage, from the project folder (needs Pillow):  python tools/make-exhibit-images.py
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'source-images' / 'exhibit'
OUT = ROOT / 'public' / 'assets' / 'img'

def write(img, slug, widths):
    for w in widths:
        h = round(w * img.height / img.width)
        img.resize((w, h), Image.LANCZOS).save(OUT / f'{slug}-{w}.jpg', quality=78, optimize=True, progressive=True)

def build(source, slug, widths, portrait=None):
    img = Image.open(SRC / source).convert('L')
    write(img, slug, widths)
    if portrait:   # (centre x as a fraction of the width, widths): a 3:4 crop for phones
        cx, mwidths = portrait
        w = round(img.height * 3 / 4)
        x0 = min(max(round(cx * img.width - w / 2), 0), img.width - w)
        write(img.crop((x0, 0, x0 + w, img.height)), slug + '-m', mwidths)

build('0-hero-a.png', 'exhibit-hero', (1200, 1600, 2048), portrait=(0.56, (700, 900)))
build('8-floor-c.png', 'exhibit-floor', (1200, 1600, 2048))
build('11-setup-d-clean.png', 'exhibit-setup', (560, 820, 1100))
build('7-lobby-b.png', 'exhibit-lobby', (1200, 1600, 2048))
for f in sorted(OUT.glob('exhibit-*.jpg')):
    print(f.name, Image.open(f).size, f.stat().st_size // 1024, 'KB')
