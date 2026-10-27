"""A contact sheet of every PNG in a folder (sorted by name), each labelled with its file name.

    uv run --with pillow python .claude/skills/visual-check/sheet.py <dir> <out.jpg> [--cols 4] [--width 400]
"""
import argparse
import glob
import os

from PIL import Image, ImageDraw

ap = argparse.ArgumentParser()
ap.add_argument("dir")
ap.add_argument("out")
ap.add_argument("--cols", type=int, default=4)
ap.add_argument("--width", type=int, default=400)
a = ap.parse_args()

files = sorted(f for f in glob.glob(os.path.join(a.dir, "*.png")))
if not files:
    raise SystemExit(f"no PNGs in {a.dir}")
first = Image.open(files[0])
w = a.width
h = round(w * first.height / first.width)
rows = (len(files) + a.cols - 1) // a.cols
sheet = Image.new("RGB", (a.cols * w, rows * (h + 16)), "white")
draw = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert("RGB")
    im.thumbnail((w, h))
    x, y = (i % a.cols) * w, (i // a.cols) * (h + 16)
    sheet.paste(im, (x, y + 16))
    draw.text((x + 4, y + 2), os.path.basename(f), fill="black")
sheet.save(a.out, quality=85)
print(f"{len(files)} frames -> {a.out}")
