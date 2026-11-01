#!/usr/bin/env bash
# Turns a green-screen Seedance clip into a seamless transparent animated WebP loop.
# Usage: .claude/skills/video-generator/scripts/export-loop.sh <input.mp4> <output-base> [width=416] [fps=15] [quality=60] [blend-frames=6]
# Outputs: <base>.webp (animated, alpha, infinite loop) and <base>-preview-3x.mp4 (dark background)
set -euo pipefail

input="$1"
base="$2"
width="${3:-416}"
fps="${4:-15}"
quality="${5:-60}"
blend="${6:-6}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

ffmpeg -v error -i "$input" -vf "fps=$fps" "$work/f_%04d.png"

# Fade the last frames into the first so the loop has no visible jump, then key
# out the green. Alpha comes from how much green exceeds red/blue, and spill is
# removed by capping green at max(red, blue), which keeps yellows and skin intact.
python3 - "$work" "$blend" "$width" <<'EOF'
import glob, sys
import numpy as np
from PIL import Image

frames = sorted(glob.glob(f"{sys.argv[1]}/f_*.png"))
blend = int(sys.argv[2])
width = int(sys.argv[3])
load = lambda path: np.asarray(Image.open(path).convert("RGB")).astype(float)
first = load(frames[0])

for index, path in enumerate(frames):
    rgb = load(path)
    tail = index - (len(frames) - blend)
    if tail >= 0:
        weight = (tail + 1) / (blend + 1)
        rgb = (1 - weight) * rgb + weight * first

    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    limit = np.maximum(r, b)
    alpha = np.clip(1 - (g - limit - 40) / 80, 0, 1)
    rgb[..., 1] = np.minimum(g, limit)
    rgba = np.dstack([rgb, alpha * 255]).round().astype(np.uint8)
    image = Image.fromarray(rgba, "RGBA")
    height = round(image.height * width / image.width / 2) * 2
    image.resize((width, height), Image.LANCZOS).save(path)
EOF

ffmpeg -v error -y -framerate "$fps" -i "$work/f_%04d.png" -c:v libwebp_anim -lossless 0 \
  -quality "$quality" -compression_level 4 -loop 0 -pix_fmt yuva420p "$base.webp"

size="$(python3 -c "from PIL import Image; print('%dx%d' % Image.open('$work/f_0001.png').size)")"
ffmpeg -v error -y -f lavfi -i "color=c=0x181818:s=$size:r=$fps" -framerate "$fps" -i "$work/f_%04d.png" \
  -filter_complex "[1:v]loop=2:32767:0[fg];[0:v][fg]overlay=shortest=1,format=yuv420p" \
  -c:v libx264 -crf 18 "$base-preview-3x.mp4"

echo "Exported $base.webp ($(( $(stat -f%z "$base.webp") / 1024 )) KB), $base-preview-3x.mp4"
