---
name: video-generator
description: Generate Better Call Pet's pixel art Saul Goodman loops using BytePlus Seedance; export transparent animated WebP for the React chat and loader.
---

# Saul video generation

Adapted from the owner's Goals-tracker video-generator skill. Scripts in `scripts/` retain the original pipeline.

Read `docs/architecture.md` for the public asset contract. Source image: `public/chibi/saul-idle.png`. Use `marketing/chibi/source/` for prepared frames, `marketing/chibi/prompts/` for prompts, and ignored `marketing/chibi/out/` for raw video and provider metadata.

- Preserve the approved pixel art identity, blue suit, orange tie and comb-over.
- First and last frame must be the same. Static full-body camera; pure `#00FF00` background with no shadows or gradients.
- 5–6 second loops, 480p generation, export width 416, 15 fps, animated transparent WebP. Use a clean still for reduced-motion/loading.
- States: idle (smoking a cigar), thinking (reviewing a receipt), approved (confident approval).
- Read `ARK_API_KEY`, `ARK_BASE_URL`, `SEEDANCE_MODEL` only from the ignored root `.env`. Never print credentials or commit task metadata/signed URLs.

```bash
python3 skills/video-generator/scripts/prepare-frame.py public/chibi/saul-idle.png marketing/chibi/source/saul-green.png
node skills/video-generator/scripts/seedance.mjs --image marketing/chibi/source/saul-green.png --prompt marketing/chibi/prompts/saul-cigar.txt --out marketing/chibi/out/saul-cigar.mp4 --duration 6
bash skills/video-generator/scripts/export-loop.sh marketing/chibi/out/saul-cigar.mp4 marketing/chibi/out/saul-idle
```

Review keyed frames on dark/light backgrounds. Copy only approved `.webp`/`.png` outputs into `public/chibi/`; raw exports and previews stay ignored. Coordinate with the app owner before replacing approved art. Do not edit app code while assigned media work.
