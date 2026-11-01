# Seated smoking loop

Created 1 November 2026 using the existing BytePlus ModelArk Seedance pipeline. Reference: the approved seated Saul, preserved in the preceding scene commit. Prompt: `prompts/saul-seated-smoking.txt`. First/last frame: `source/saul-seated-green.png`, prepared with `prepare-frame.py --scale 0.96`. Raw provider video and task metadata remain in ignored `out/`.

The export reverses the reference padding to retain the existing sprite geometry. Chroma key removes the green background and caps spill. The first frame is composited over every frame from 60% of canvas height with a 3.5% feather, holding the hips, resting hand and legs stationary. Smoke alpha fades over the top 24 pixels; canvas edges are transparent. Frame 89 copies frame 0.

Deliverables: `public/chibi/saul-seated.webm` (VP9 with alpha, no audio), `saul-seated.webp` (infinite animated fallback), `saul-seated.png` (matching first frame), all 416 × 554. Ninety frames at 15 fps make a six-second loop. Dark/light contact sheets and browser previews are kept in ignored `out/`.

Settings positions the sprite 35 pixels above the scene baseline at its full 330 × 280 size, 27 pixels lower than the previous scene. Relative dimensions keep the same seat contact on smaller screens. The Dots link remains clickable and stays stationary on hover.
