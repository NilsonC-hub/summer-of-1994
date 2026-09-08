# i486 scene material sources

Retrieved and verified on 2026-09-08. Assets are local copies; the scene does not need a live asset API connection.

## Dark Wood — desk veneer

- Provider: [Poly Haven](https://polyhaven.com/a/dark_wood)
- Creators: Dario Barresi (baking), Dimitrios Savva (photography), Rico Cilliers (tiling).
- License: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/). [Provider license statement](https://polyhaven.com/license).
- Attribution, retained voluntarily: “Dark Wood by Dario Barresi, Dimitrios Savva and Rico Cilliers via Poly Haven (CC0).”
- Original library folder: `E:/3D-Asset-Library/downloads/polyhaven/dark_wood/`; contains original downloaded maps, source metadata, hashes and LICENSE.txt.
- Project files (all 2048 × 2048):
  - `/assets/textures/dark_wood_diff_2k.jpg` — base color, sRGB.
  - `/assets/textures/dark_wood_rough_2k.jpg` — roughness, non-color / linear.
  - `/assets/textures/dark_wood_nor_gl_2k.jpg` — OpenGL tangent-space normal, non-color / linear.
- Provider physical coverage: **2 × 2 metres** per tile. For a 1.5 × 0.75 m desk top with normalized planar UVs, start at repeat **(0.75, 0.375)**; choose the UV rotation so wood grain follows the long edge. Use the same UV transform for all maps.
- Rendering recommendation: non-metal (metalness 0). The source roughness averages ~0.628; a satin furniture finish can use roughness map multiplier **0.68–0.8**, yielding typical roughness **0.43–0.50**. Keep subtle normal strength around **0.12–0.22** and optional clearcoat **0.12**, clearcoat roughness **0.32**. These are artistic starting points, not measured provider values.
- Avoid deep displacement: this is a smooth veneered desk, not a rough plank floor. The source is warm reddish brown; keep base color multiplication neutral so it does not become orange under a warm lamp.

## Lebombo — soft indoor window illumination

- Provider: [Poly Haven](https://polyhaven.com/a/lebombo)
- Creator: Greg Zaal.
- License: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/). [Provider license statement](https://polyhaven.com/license).
- Attribution, retained voluntarily: “Lebombo by Greg Zaal via Poly Haven (CC0).”
- Original library folder: `E:/3D-Asset-Library/downloads/polyhaven/lebombo/`; includes original HDR, source metadata, hash and LICENSE.txt.
- Project file: `/assets/textures/lebombo_1k.hdr`.
- Intended use: low-contrast indoor environment illumination and reflections. This provides soft morning window light and warm wall-light reflections. Use the modeled room as the visible background. Rotate the environment so the bright curtain/window reflection agrees with the modeled window. For Three.js, process with RGBELoader + PMREMGenerator and begin with environment intensity **0.3–0.5**; tune together with exposure and local light intensity. For Blender, use as an Environment Texture with a comparable subtle world contribution.
- HDR reflections do not produce the modeled window's cast shadow; a separate area or directional light should provide that shadow.

## Verification and download budget

- Four selected source files downloaded: **8,299,835 bytes** (7.92 MiB), below the 20 MB budget.
- Every file's byte size and MD5 matched the official Poly Haven files API metadata.
- JPEG dimensions verified with Pillow; base-color map visually inspected and confirmed to be continuous furniture wood grain with no floorboard seams.
- The library contained no suitable wood, wall or indoor HDR assets before this selection. No additional wall material was downloaded: a neutral paint material with very subtle procedural roughness is sufficient for the background wall.
- API metadata is cached under `E:/3D-Asset-Library/catalog/polyhaven/`; the API was called with a descriptive User-Agent. [Current API policy](https://polyhaven.com/our-api).
- No Meshy generation was performed and no credits were consumed by this asset task.
