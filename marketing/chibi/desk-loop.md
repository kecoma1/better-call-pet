# Saul’s comic desk loop

Generated with BytePlus ModelArk Seedance, using the model configured in the ignored root `.env`. The reference sprite was prepared with the built-in ImageGen tool from the approved idle/seated Saul artwork, preserving his face, comb-over, pinstripe suit and orange tie. Approved images remain unchanged.

The six-second clip moves through five comic beats: intense writing, inspecting a case page, skeptical cheek-in-hand reading, a broad-smiled raised-finger idea, then a writing flourish returning to the first pose. The same green-screen image is supplied as both the first and last frame. The camera stays fixed.

Reference prompt/frame: `source/saul-desk-reference.png`; normalized first/last frame: `source/saul-desk-green.png`. Animation prompt: `prompts/saul-desk.txt`. Raw provider video, signed task metadata, rendered frames, dark/light review sheets and the MP4 review clip remain in ignored `out/`.

Export with:

```sh
python3 marketing/chibi/export-desk-loop.py marketing/chibi/out/saul-desk.mp4 public/chibi
```

The export keys/despills the green background, holds the lower desk/chair/feet steady, blends the final six frames back to the first and copies frame zero to the final frame. Outputs are transparent 416 × 554 VP9 WebM and animated WebP plus a matching PNG still. The WebM has no audio; the component uses autoplay, muted, playsInline and loop. Reduced motion uses the PNG; failed WebM falls back to WebP and then PNG. Chat shows this state only while loading or preparing a reply.
