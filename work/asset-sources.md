# i486 scene asset sources

Source record for 2026-09-08. Assets are local copies; the scene does not need a live asset API connection. The current bedroom uses indoor lighting and does not load an external HDR image at runtime.

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
- Provider physical coverage: **2 × 2 metres** per tile. The exporter projects wood UVs at this world scale; the browser keeps texture repeat at **(1, 1)** and applies the same UV transform to all three maps.
- Rendering: a non-metallic furniture veneer, with roughness and subtle normal maps. Current artistic material values live in `src/main.js`; Blender's authoring material is set up in `blender/build_scene.py`.
- Avoid deep displacement: this is a smooth veneered desk, not a rough plank floor. The source is warm reddish brown; keep base color multiplication neutral so it does not become orange under a warm lamp.

## Lebombo — archived lighting study, unused by the current scene

- Provider: [Poly Haven](https://polyhaven.com/a/lebombo)
- Creator: Greg Zaal.
- License: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/). [Provider license statement](https://polyhaven.com/license).
- Attribution, retained voluntarily: “Lebombo by Greg Zaal via Poly Haven (CC0).”
- Original library folder: `E:/3D-Asset-Library/downloads/polyhaven/lebombo/`; includes original HDR, source metadata, hash and LICENSE.txt.
- Project file: `/assets/textures/lebombo_1k.hdr`.
- Status: retained from the first daylight study for provenance. The window and blinds have been removed, and the runtime no longer loads this file. It is not part of the current room's lighting or reflection setup.
- Current lighting is authored from indoor sources: warm desk and lava lamps, weak cool indoor fill, and CRT light after power-on. No new environment-image asset was downloaded for this revision.

## Original generated imagery

- Tool: OpenAI native image generation, created for this project on 2026-09-08. These are generated fictional assets, not downloaded photographs or extracts from the user's reference screenshots.
- `public/assets/posters/static-youth.png`: an original poster for the fictional band Static Youth. It is used as a local Blender image material and included in the exported room model.
- `public/assets/easter/moon.png` and `public/assets/easter/garage.png`: two original hidden images used by the virtual DOS image viewer. They load locally when a player discovers and opens their virtual files.
- The images are project-specific generated work. They are not represented as Poly Haven assets or as CC0 source downloads. No third-party band's official poster or stock-photo watermark is incorporated.

## Geometry, references and fonts

- The computer, 101-key keyboard, two-button mouse and room props are original Blender geometry authored in `blender/build_scene.py` and `blender/teen_room.py`, with refinement and export scripts in the same directory.
- The two user-provided bedroom screenshots are composition and atmosphere references only: wall posters, music equipment, shelves, a bed and everyday belongings. Their image pixels and watermarks were not extracted into the scene.
- The original hardware proportions were informed by the [Centre for Computing History — Compaq Prolinea 4/25S](https://www.computinghistory.org.uk/cgi-bin/sitewise.pl?act=det&p=7799). The fictional MICROLINE computer is not an exact branded reproduction.
- The bundled VT323 terminal font and its SIL OFL 1.1 notice are documented in `work/font-sources.md`. The paper-note UI uses locally installed handwriting fonts; no additional font file was downloaded for this revision.

## Initial material download verification

- The initial four Poly Haven source files totaled **8,299,835 bytes** (7.92 MiB), below that download task's 20 MB budget. This historical figure excludes the later generated images and is not the current project's total asset size.
- Every file's byte size and MD5 matched the official Poly Haven files API metadata.
- JPEG dimensions verified with Pillow; base-color map visually inspected and confirmed to be continuous furniture wood grain with no floorboard seams.
- The library contained no suitable wood, wall or indoor HDR assets before this selection. No additional wall material was downloaded: a neutral paint material with very subtle procedural roughness is sufficient for the background wall.
- API metadata is cached under `E:/3D-Asset-Library/catalog/polyhaven/`; the API was called with a descriptive User-Agent. [Current API policy](https://polyhaven.com/our-api).
- No Meshy generation was performed and no Meshy credits were consumed. OpenAI-generated image assets are listed separately above.
