"""Export optimized editorial photos from the two generated source images.

Requires Pillow. Source PNGs live in _dev/img-src and are not used by the
published page; only the optimized outputs in assets/img/editorial are loaded.
"""

from pathlib import Path
from PIL import Image


site = Path(__file__).resolve().parents[2]
output = site / "assets/img/editorial"
output.mkdir(parents=True, exist_ok=True)

with Image.open(site / "_dev/img-src/hero-care-source.png") as original:
    frame = original.convert("RGB")

exports = {
    "hero-care": ((0, 15, 1122, 1386), (900, 1100)),
    "hero-care-520": ((0, 15, 1122, 1386), (520, 636)),
    "hero-care-mobile": ((0, 150, 1122, 1023), (900, 700)),
}

for name, (box, size) in exports.items():
    image = frame.crop(box).resize(size, Image.Resampling.LANCZOS)
    image.save(output / f"{name}.webp", "WEBP", quality=82, method=6)
    if name != "hero-care-520":
        image.save(output / f"{name}.jpg", "JPEG", quality=86, optimize=True, subsampling=0)

with Image.open(site / "_dev/img-src/quiet-portrait-source.png") as original:
    portrait = original.convert("RGB").resize((720, 900), Image.Resampling.LANCZOS)
    portrait.save(output / "quiet-portrait.webp", "WEBP", quality=82, method=6)
    portrait.save(output / "quiet-portrait.jpg", "JPEG", quality=86, optimize=True, subsampling=0)
