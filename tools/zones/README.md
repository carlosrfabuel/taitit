# tools/zones

Internal tool (no client-facing UI) that turns a full-size product photo into what the app's
recolor renderer needs, and uploads it.

For each model it produces, in `out/<model>/`:

- `base.jpg`: the photo with every customizable zone cleared to the background color (clear parts such
  as nose pads lose the frame color they reflect)
- `<zone>.png`: one layer per zone (max 4): alpha = zone mask, gray = the photo's light and shadow:
  up to 0.86 the shadows (0.86 = the zone's typical brightness, the color drawn as itself), above it
  how far toward white (lit faces, a temple seen through the lens). See `shared/src/render.ts`.
- `debug.png`: zones painted in flat colors over the photo, to check the masks
- `preview.jpg`: the zones recolored in four test colorways (dark, light, gloss, translucent)
- `manifest.json`: what `upload` sends to the database

`input/` (photos) and `out/` are git-ignored. Model configs in `models/` are versioned.

## Adding a model

1. Put the full-size photo (3/4 view, white background) in `input/`, e.g. `input/karl.jpg`.
2. Find its colors and crop:

   ```bash
   npm run zones -- analyze input/karl.jpg
   ```

3. Copy `models/phileas.json` to `models/karl.json` and edit it:
   - `zones`: up to 4, each with `id`, Spanish `label` (shown in the app), `material` (`metal` | `acetate`),
     and optionally `defaultRef` (swatch reference) and `defaultFinish`.
   - `groups`: which photo colors belong to which zone. A group can `split` its connected regions
     (e.g. the 2 largest are the rims, the rest are temple tips), or `attach` (highlights that join the
     zone they touch; isolated regions such as shadows are ignored). `minSaturation` keeps grayish
     shadows and clear parts out.
     `within: [x1, y1, x2, y2]` limits a group to one rectangle (e.g. the grey gloss of one tip, a
     color that elsewhere would catch the nose pads). `ownShading` shades a group against its own
     color: a part photographed in another color than it is made in (KARL's black temples, gold in
     production) then looks like the rest of its zone.
   - `fixes`: rectangles (`rect`, output pixels) or polygons (`poly: [[x, y], ...]`) where one zone
     must become another (or `"none"`: no zone, e.g. a floor shadow the color of white metal), for
     cases color and regions can't resolve. They apply in order. Use a polygon where the boundary is
     slanted (a tip ending where a rim passes in front of it): a rectangle leaves a square notch. With
     `piecesInside: true` only connected pieces lying entirely inside the area change (a white lens
     bevel next to a white frame piece). Pixels set to `"none"` stay out of every zone. With
     `shadeAsZone: true` the changed pixels shade with their new zone, not with an `ownShading` group
     they matched (the dark grain of a gold part, matched as the black front).
   - `edgeGrow` (model option, default 1): passes of growth into anti-aliased edge pixels. 3 also
     closes the dark 3-4 px seams between two zones, which otherwise keep the photo's color as a thin
     line in light colorways.
   - `smooth` (zone option, patterned originals such as tortoiseshell): the light on the part is taken
     from its light patches only (bright reflections capped, dark spots filled from the brightest pixels
     nearby, then a blur of this sigma), so the pattern doesn't show through solid colors as blotches. `shadow` (default 0.8): how much of the photo's shadows shows
     (exponent of the darkness ratio; 1 = as photographed). Highlights always show as photographed.
     (`contrast`, the earlier linear model, was replaced by it on 2026-10-20.)
   - Edges: a pixel at a part's border is partly clear only where it mixes with the background or a
     clear lens; between two parts, or next to something dark outside the zones, it is opaque (else
     the background shows through as dotted lines in other colors). Gaps of 1-3 px between two
     different parts (a bright bevel line where they meet) join the nearer part.
   - `crossings` (model option): where two parts of the same color cross (LUKA's orange tip behind its
     orange rim), color can't tell which is in front. `{ "box": [x1, y1, x2, y2], "front": "metal",
     "behind": "terminales" }`: inside the box, the front part keeps its straight band and the part
     behind it stops at the band's edges.
   - Automatic, after the fixes (pixels a fix or a crossing changed are left alone):
     anti-aliased rims: a thin strip of one zone along the background whose color is only the blend
     of the background and the zone next to it joins that zone (a light outline around a mint tip
     that matched the white metal would show as a black line in black metal); holes up to 60 px
     enclosed by one part join it, before and again after edge growth (highlight dots, the core of
     an unmatched shade). A hole next to an area a fix took out (a clear nose pad) stays out.
   - To check a model for boundary errors: render it with strong, different colors per zone (main
     white, secondary red or blue, tips black, and the reverse) and look where two zones meet.
4. Build and check `debug.png` and `preview.jpg`; adjust the config and rebuild until clean:

   ```bash
   npm run zones -- build models/karl.json
   ```

5. Upload (as an admin account; same access rules as the admin panel, no secret keys):

   ```bash
   ZONES_ADMIN_EMAIL=... ZONES_ADMIN_PASSWORD=... npm run zones -- upload out/karl
   ```

   Re-running upload updates the same model, zones and files (matched by model name and zone label).
   New models are uploaded unpublished unless the config sets `"published": true`.
   Before writing anything, upload checks that every layer has the base image size and that every
   default color exists and is active; if not, it stops and nothing changes.
   Files are stored under content-based names (`base-<hash>.jpg`), so the app never gets a stale cached
   copy; files no longer used are removed at the end.
   A published model stays published during a re-upload, unless its image size changes or a zone is
   removed: then it is unpublished while uploading and published again at the end (if that fails, it
   stays unpublished and the tool says so).

## Tortoiseshell patterns (havana colors)

Every acetate zone also gets `<zone>-pattern.jpg`: how real tortoiseshell differs from its average
color, per pixel (brightness in red, colorfulness in green, light and shadow included). When the
customer picks a havana color, the app, the admin and the preview draw that pattern in the color
(`shared/src/render.ts`), so the spots look real instead of a flat brown.

- `"pattern": "own"` (zone option) for parts that are tortoiseshell in the photo (DAFT, SONNIE, the
  tips of KARL, PINTO, SOFIE, PAUL): the photo's own pattern. A havana of exactly the zone's average
  color (shown in the admin, "Carey de la foto") gives the part as photographed.
- Default for other acetate zones: borrowed from `textures/tortoise.jpg`, a texture quilted from TAITIT's
  havana sample chip "1":

  ```bash
  npm run zones -- texture-image "<path>/colores acetatos.jpeg" 720,440,900,1190 --scale 0.3 --patch 24
  ```

  (`npm run zones -- texture <models/x.json> <zone>` makes it from a model's tortoiseshell zone instead.)

- `"pattern": "none"`: plain havana color. A havana color with its own texture (admin, Paletas) uses
  that texture on borrowed zones; own patterns always win.

## Notes

- Background detection assumes studio white (`backgroundThreshold`, default 235).
- Output width is 1600 px by default (`outputWidth`).
- Zone limit (4) is checked here and enforced again in the database.
