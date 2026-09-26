"""Export the September 2026 hero still from the supplied IMG_7526.MOV.

Requires Pillow and FFmpeg (imageio-ffmpeg or a system FFmpeg). The original
video stays in ../latest_mat, outside the published site.
"""

from io import BytesIO
from pathlib import Path
import shutil
import subprocess
from PIL import Image, ImageEnhance


site = Path(__file__).resolve().parents[2]
source = site.parent / "latest_mat/IMG_7526.MOV"
output = site / "assets/img/interior"
output.mkdir(parents=True, exist_ok=True)

try:
    import imageio_ffmpeg
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
except ImportError:
    ffmpeg = shutil.which("ffmpeg")
if ffmpeg is None:
    raise RuntimeError("FFmpeg is required to export the hero frame")

decoded = subprocess.run(
    [ffmpeg, "-hide_banner", "-loglevel", "error", "-ss", "9", "-i", str(source),
     "-frames:v", "1", "-f", "image2pipe", "-vcodec", "mjpeg", "pipe:1"],
    check=True, stdout=subprocess.PIPE,
).stdout
frame = Image.open(BytesIO(decoded)).convert("RGB")
frame = ImageEnhance.Color(frame).enhance(0.82)
frame = ImageEnhance.Contrast(frame).enhance(1.025)

exports = {
    "hero-ritual": ((0, 300, 1080, 1620), (900, 1100)),
    "hero-ritual-520": ((0, 300, 1080, 1620), (520, 636)),
    "hero-ritual-mobile": ((0, 375, 1080, 915), (900, 450)),
}

for name, (box, size) in exports.items():
    image = frame.crop(box).resize(size, Image.Resampling.LANCZOS)
    image.save(output / f"{name}.webp", "WEBP", quality=80, method=6)
    if name != "hero-ritual-520":
        image.save(output / f"{name}.jpg", "JPEG", quality=84, optimize=True, subsampling=0)
