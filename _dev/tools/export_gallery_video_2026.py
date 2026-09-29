"""Reproduce the curated September 2026 gallery video stills.

Run with Python and Pillow. FFmpeg is resolved from --ffmpeg, PATH, or the
imageio-ffmpeg package. Source videos remain in latest_mat and new_mat beside
the site directory. Only the seven named gallery stills are written.

The videos were reviewed visually across multiple timestamps. These exports
use the decoder's ordinary 8-bit RGB still output, followed by the explicitly
listed modest visual corrections. No pixels are generated or retouched and
no source is enlarged.
"""

from argparse import ArgumentParser
from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter
import json
import os
import shutil
import subprocess
import tempfile


SITE = Path(__file__).resolve().parents[2]
PROJECT = SITE.parent
OUTPUT = SITE / "assets/img/gallery"

# Boxes are (left, top, right, bottom) in the upright decoded source pixels.
PLANS = [
    {"name": "reception-room", "source": "latest_mat/IMG_7577.MP4",
     "second": 34.50, "box": (0, 45, 464, 663), "size": (464, 618),
     "brightness": 1.025, "contrast": 1.025, "color": .92},
    {"name": "window-greenery", "source": "latest_mat/IMG_7577.MP4",
     "second": 48.00, "box": (0, 80, 464, 698), "size": (464, 618),
     "brightness": 1.03, "contrast": 1.025, "color": .96},
    {"name": "face-care", "source": "latest_mat/IMG_7543.MOV",
     "second": 90.00, "box": (0, 120, 1080, 1560), "size": (720, 960),
     "brightness": 1.01, "contrast": 1.025, "color": .98},
    {"name": "body-care", "source": "latest_mat/IMG_7528.MOV",
     "second": 41.00, "box": (0, 300, 1080, 1740), "size": (720, 960),
     "brightness": 1.025, "contrast": 1.045, "color": .98},
    {"name": "welcome-drink", "source": "latest_mat/IMG_7546.MOV",
     "second": 16.50, "box": (0, 120, 1080, 1560), "size": (720, 960),
     "brightness": 1.01, "contrast": 1.03, "color": .96},
    {"name": "glassware", "source": "latest_mat/IMG_7913.MP4",
     "second": 17.50, "box": (0, 70, 720, 1030), "size": (720, 960),
     "brightness": 1.04, "contrast": 1.035, "color": .97},
    {"name": "professional-cosmetics", "source": "latest_mat/IMG_7701.MP4",
     "second": 16.00, "box": (8, 100, 680, 996), "size": (600, 800),
     "brightness": 1.04, "contrast": 1.025, "color": .96},
]


def find_ffmpeg(explicit):
    candidate = explicit or os.environ.get("GALLERY_FFMPEG") or shutil.which("ffmpeg")
    if candidate:
        return candidate
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError as error:
        raise SystemExit("Install FFmpeg or supply its path with --ffmpeg.") from error


def grade(frame, plan):
    frame = ImageEnhance.Brightness(frame).enhance(plan["brightness"])
    if "balance" in plan:
        channels = frame.split()
        frame = Image.merge("RGB", tuple(
            channel.point(lambda value, gain=gain: min(255, round(value * gain)))
            for channel, gain in zip(channels, plan["balance"])
        ))
    frame = ImageEnhance.Contrast(frame).enhance(plan["contrast"])
    frame = ImageEnhance.Color(frame).enhance(plan["color"])
    if plan.get("sharpen", True):
        frame = frame.filter(ImageFilter.UnsharpMask(radius=.65, percent=30, threshold=3))
    return frame


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--ffmpeg", help="Path to the FFmpeg executable")
    args = parser.parse_args()
    ffmpeg = find_ffmpeg(args.ffmpeg)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="ladna-gallery-") as temporary:
        for plan in PLANS:
            source = PROJECT / plan["source"]
            if not source.is_file():
                raise FileNotFoundError(source)
            extracted = Path(temporary) / (plan["name"] + ".jpg")
            subprocess.run([
                ffmpeg, "-hide_banner", "-loglevel", "error",
                "-ss", str(plan["second"]), "-i", str(source),
                "-frames:v", "1", "-q:v", "2", "-map_metadata", "-1",
                "-y", str(extracted),
            ], check=True, capture_output=True)
            with Image.open(extracted) as original:
                frame = original.convert("RGB")
            left, top, right, bottom = plan["box"]
            if not (0 <= left < right <= frame.width and 0 <= top < bottom <= frame.height):
                raise ValueError(f"Crop outside {plan['name']} source: {frame.size}")
            frame = frame.crop(plan["box"])
            if plan["size"][0] > frame.width or plan["size"][1] > frame.height:
                raise ValueError(f"Upscaling is forbidden: {plan['name']}")
            if frame.size != plan["size"]:
                frame = frame.resize(plan["size"], Image.Resampling.LANCZOS)
            frame = grade(frame, plan)
            # New save operations carry no EXIF, GPS or video metadata.
            jpg = OUTPUT / (plan["name"] + ".jpg")
            webp = OUTPUT / (plan["name"] + ".webp")
            frame.save(jpg, "JPEG", quality=86, optimize=True, subsampling=0)
            frame.save(webp, "WEBP", quality=82, method=6)
            print(json.dumps({"name": plan["name"], "size": frame.size,
                              "jpeg_bytes": jpg.stat().st_size,
                              "webp_bytes": webp.stat().st_size}))


if __name__ == "__main__":
    main()
