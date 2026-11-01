#!/usr/bin/env python3
"""Export the Seedance desk clip as transparent, silent, seamless UI assets.

Usage: python3 marketing/chibi/export-desk-loop.py input.mp4 output-directory
Raw frames and review sheets remain next to the input in the ignored out/ folder.
"""
from pathlib import Path
import subprocess
import sys
import numpy as np
from PIL import Image, ImageDraw

source = Path(sys.argv[1])
output = Path(sys.argv[2])
output.mkdir(parents=True, exist_ok=True)
frames = source.parent / 'saul-desk-frames'
frames.mkdir(parents=True, exist_ok=True)
for old_frame in frames.glob('*.png'):
    old_frame.unlink()
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(source), '-t', '6', '-vf', 'fps=15', str(frames / 'raw-%04d.png')], check=True)
paths = sorted(frames.glob('raw-*.png'))
assert len(paths) >= 60, 'The source clip is incomplete.'
first = np.asarray(Image.open(paths[0]).convert('RGB')).astype(float)
height = first.shape[0]
# Keep the desk front, chair wheels and feet planted. Hands and case files stay animated.
freeze = np.clip((np.arange(height) - height * 0.68) / (height * 0.035), 0, 1)[:, None, None]
for index, path in enumerate(paths):
    rgb = np.asarray(Image.open(path).convert('RGB')).astype(float)
    rgb = rgb * (1 - freeze) + first * freeze
    if index >= len(paths) - 6:
        weight = (index - (len(paths) - 6) + 1) / 6
        rgb = rgb * (1 - weight) + first * weight
    red, green, blue = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    limit = np.maximum(red, blue)
    alpha = np.clip(1 - (green - limit - 40) / 80, 0, 1)
    rgb[..., 1] = np.minimum(green, limit)
    rgba = np.dstack([rgb, alpha * 255]).round().astype(np.uint8)
    image = Image.fromarray(rgba, 'RGBA').resize((416, 554), Image.Resampling.LANCZOS)
    image.save(frames / f'keyed-{index + 1:04d}.png')
# The final decoded source frame exactly matches the first at the loop boundary.
poster = Image.open(frames / 'keyed-0001.png')
poster.save(frames / f'keyed-{len(paths):04d}.png')
poster.save(output / 'saul-desk.png')
pattern = str(frames / 'keyed-%04d.png')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '15', '-i', pattern, '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '30', '-auto-alt-ref', '0', '-an', str(output / 'saul-desk.webm')], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '15', '-i', pattern, '-c:v', 'libwebp_anim', '-quality', '65', '-compression_level', '4', '-loop', '0', '-pix_fmt', 'yuva420p', str(output / 'saul-desk.webp')], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x0e131c:s=416x554:r=15', '-framerate', '15', '-i', pattern, '-filter_complex', '[0:v][1:v]overlay=shortest=1,format=yuv420p', '-c:v', 'libx264', '-crf', '18', '-an', str(source.parent / 'saul-desk-preview.mp4')], check=True)
for theme, background in [('dark', '#0e131c'), ('light', '#f4f6fa')]:
    sheet = Image.new('RGB', (416 * 3, 590 * 2), background)
    draw = ImageDraw.Draw(sheet)
    for cell, index in enumerate([0, 27, 44, 60, 78, len(paths) - 1]):
        frame = Image.open(frames / f'keyed-{index + 1:04d}.png').convert('RGBA')
        x, y = cell % 3 * 416, cell // 3 * 590
        sheet.paste(frame, (x, y), frame)
        draw.text((x + 16, y + 562), f'{index / 15:.1f}s', fill='#a0aec3' if theme == 'dark' else '#303944')
    sheet.save(source.parent / f'saul-desk-review-{theme}.png')
assert np.array_equal(np.asarray(poster), np.asarray(Image.open(frames / f'keyed-{len(paths):04d}.png')))
print(f'Exported {len(paths)} frames at 15 fps; first and last frames match exactly.')
for suffix in ['webm', 'webp', 'png']:
    target = output / f'saul-desk.{suffix}'
    print(f'{target}: {target.stat().st_size // 1024} KiB')
