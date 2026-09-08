# DOS terminal font

- Font: **VT323 Regular**, internal family **VT323**, normal weight **400**.
- Designer: **Peter Hull**; copyright 2011, The VT323 Project Authors.
- Source: [Google Fonts family page](https://fonts.google.com/specimen/VT323), [official Google Fonts distribution repository](https://github.com/google/fonts/tree/main/ofl/vt323).
- Upstream: [phoikoi/VT323](https://github.com/phoikoi/VT323), Google metadata references commit `9bd4b3f69887fd960d51d07602db60a28a789145`.
- Downloaded on 2026-09-08, unchanged TTF: `E:/i486/public/assets/fonts/VT323-Regular.ttf` (153,116 bytes).
- Browser path: `/assets/fonts/VT323-Regular.ttf`.
- SHA-256: `cf4de751ada78ceac033dbe16a687742939995b77bc2a052ae17a4957958594d`.
- License: **SIL Open Font License 1.1**. Complete original license and copyright notice retained in `E:/i486/public/assets/fonts/VT323-OFL.txt`.
- Redistribution: keep the font's copyright notice and OFL with the font; embedding in the application is allowed. The font must not be sold by itself. Modified font versions remain under OFL and must respect any reserved font names. The application itself is not required to use OFL.

## Visual and loading notes

VT323 is a monospaced retro terminal typeface with rectangular pixel-like strokes and compact character width. It removes Courier New's typewriter serifs. It is a terminal-inspired fallback rather than an exact IBM VGA ROM reconstruction, so do not describe it as authentic VGA firmware lettering. DOS text stays Latin; Chinese guidance should retain the surrounding UI font.

Load before the first DOS Canvas draw, e.g. a FontFace named `VT323` with `url('/assets/fonts/VT323-Regular.ttf')`, add it to `document.fonts`, await its `load()`, then use `400 32px VT323` (or an integer multiple chosen for the canvas resolution). Avoid synthetic bold. A chosen glyph's width can be measured with `measureText('M')` to set a consistent text grid instead of keeping Courier's previous character width.

The INT10h Oldschool PC collection was also checked. Its own documentation states CC BY-SA 4.0 and requires credit to VileR with a link to the site; distributed adaptations must keep a compatible license. The official host returned HTTP 403 to direct retrieval, so this task chose the straightforward OFL fallback and did not fetch a mirror or add another font.
