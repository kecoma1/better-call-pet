#!/usr/bin/env python3
"""Prepares a Seedance first/last frame: the character on flat #00FF00 with margin.

Usage: prepare-frame.py <input.png> <output.png> [--scale 0.88]

Accepts a transparent PNG (finished chibi art) or a frame grabbed from a Seedance
clip that is already on green; green frames are re-keyed so the background is a
perfectly uniform #00FF00. The result keeps the input size (or 1248x1664 for
transparent art) and shrinks the character by --scale so arms and props have room.
"""
import argparse

import numpy as np
from PIL import Image

GREEN = np.array([0, 255, 0], dtype=float)


def key_green(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    limit = np.maximum(r, b)
    alpha = np.clip(1 - (g - limit - 40) / 80, 0, 1)
    rgb = rgb.copy()
    rgb[..., 1] = np.minimum(g, limit)
    return rgb, alpha


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input")
    parser.add_argument("output")
    parser.add_argument("--scale", type=float, default=0.88)
    args = parser.parse_args()

    image = Image.open(args.input).convert("RGBA")
    pixels = np.asarray(image).astype(float)
    if (pixels[..., 3] < 10).mean() > 0.05:
        canvas_size = (1248, 1664)
        character = image
    else:
        canvas_size = image.size
        rgb, alpha = key_green(pixels[..., :3])
        character = Image.fromarray(
            np.dstack([rgb, alpha * 255]).round().astype(np.uint8), "RGBA"
        )

    width, height = canvas_size
    fit = min(width / character.width, height / character.height) * args.scale
    character = character.resize(
        (round(character.width * fit), round(character.height * fit)), Image.LANCZOS
    )
    canvas = Image.new("RGBA", canvas_size, (0, 255, 0, 255))
    canvas.alpha_composite(
        character, ((width - character.width) // 2, (height - character.height) // 2)
    )
    canvas.convert("RGB").save(args.output)
    print(f"Saved {args.output} ({width}x{height})")


if __name__ == "__main__":
    main()
