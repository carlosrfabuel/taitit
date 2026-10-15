# tools/zones

Internal script (no client-facing UI) that turns a full-size product photo into:

- `base` image: the photo with customizable zones cleared to background
- one `layer` PNG per zone: alpha = zone mask, gray = normalized shading

Rules: max 4 zones per model; shading smoothed for tortoiseshell originals; manual check for thin metal parts and translucent originals.

Input photos go in `input/`, results in `out/` (both git-ignored). Built on Day 5.
