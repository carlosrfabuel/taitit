# tools/zones

Internal tool (no client-facing UI) that turns a full-size product photo into what the app's
recolor renderer needs, and uploads it.

For each model it produces, in `out/<model>/`:

- `base.jpg`: the photo with every customizable zone cleared to the background color
- `<zone>.png`: one layer per zone (max 4): alpha = zone mask, gray = the photo's light and shadow
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
   - `fixes`: rectangles (output pixels) where one zone must become another, for cases color and
     regions can't resolve.
   - `smooth` (zone option): blur sigma for patterned originals (tortoiseshell), so the pattern
     doesn't show through new colors. `contrast` (default 0.55, dark metal ~0.9): how strongly the
     photo's light shows through.
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

## Notes

- Background detection assumes studio white (`backgroundThreshold`, default 235).
- Output width is 1600 px by default (`outputWidth`).
- Zone limit (4) is checked here and enforced again in the database.
