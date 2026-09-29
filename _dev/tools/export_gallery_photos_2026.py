"""Web exports of the selected real still photographs. Originals stay intact."""
from pathlib import Path
from PIL import Image, ImageOps
import pillow_heif

pillow_heif.register_heif_opener()
site = Path(__file__).resolve().parents[2]
project = site.parent
output = site / "assets/img/gallery"
output.mkdir(parents=True, exist_ok=True)

sources = {
    "entrance-gallery": (project / "latest_mat/IMG_7920.HEIC", (900, 1200), None),
    "entrance-sign": (project / "latest_mat/IMG_7916.HEIC", (900, 1200), None),
    "entrance-sign-wide": (project / "latest_mat/IMG_7916.HEIC", (900, 675), (0, 1032, 3024, 3300)),
    "coffee-candle": (site / "_dev/img-src/cosy.jpg", (720, 720), None),
}
for name, (path, size, crop) in sources.items():
    with Image.open(path) as source:
        image = ImageOps.exif_transpose(source).convert("RGB")
    if crop:
        image = image.crop(crop)
    # The original square-ish coffee photo is cropped by only 28 vertical px.
    image = ImageOps.fit(image, size, Image.Resampling.LANCZOS, centering=(.5, .5))
    image.save(output / (name + ".jpg"), "JPEG", quality=88, optimize=True)
    thumbnail = image.copy()
    thumbnail.thumbnail((640, 900), Image.Resampling.LANCZOS)
    thumbnail.save(output / (name + ".webp"), "WEBP", quality=84, method=6)
    print(name, image.size, thumbnail.size)
