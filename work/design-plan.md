# Summer '94: The borrowed disk

First-person desktop computer experience for a child who has never used DOS. The visual target is a realistic American rock-loving teenager's bedroom in 1994, with editable Blender hardware and set dressing. The room should carry the story; a small English interface and a scrappy note from a friend provide the necessary wayfinding.

## Visual target

- Reference: 1993 Compaq ProLinea family; horizontal beige 486 chassis, separate CRT, substantial keyboard, 3.5-inch floppy drive.
- Visual reference website: [Centre for Computing History — Compaq Prolinea 4/25S](https://www.computinghistory.org.uk/cgi-bin/sitewise.pl?act=det&p=7799). The original MICROLINE model borrows the era's proportions; it is not a dimensionally exact branded reproduction.
- Composition references: the two user-supplied bedroom screenshots inform the dense personal arrangement of posters, music equipment, books and everyday clutter. Their pixels, watermarks and identifiable poster artwork are not used as project textures.
- Palette: aged paper, yellowed ABS, dark wood, denim blue, muted red print and green lamp enamel. Warm practical lights contrast with a weak cool indoor fill.
- Light: indoor only. The desk lamp illuminates the computer and tabletop, a lava lamp adds a small warm pool, and weak cool room fill keeps the surroundings readable. The powered CRT adds subtle local light. There is no window, blind, sunlight beam or external HDR image in the runtime lighting setup.
- Set dressing: fictional band and gig posters, a wall-mounted skateboard, bed with denim cover, books and cassettes, stereo, headphones and informal notes. This is a lived-in bedroom, with the computer still the visual and interactive center.
- Signature: a physical disk goes into the drive and becomes files on the CRT.
- UI: full-bleed room, a small `SUMMER '94` entrance and `Enter room` action. Persistent objectives and progress bars are hidden. Computer controls are compact icons with English names revealed on hover or keyboard focus; `Back to room` remains plainly labeled. Ordinary tutorial notifications are suppressed; required error feedback stays brief.
- Note: an optional folded-paper impression with crooked handwriting, tape and a little star doodle. The voice is one teenager lending another a disk: “yo dude” and “don't trash my high score. — J.” Commands remain readable, without exposing the hidden images.
- Model authoring: Blender, metres, Z up; GLB exports Y up. Independent named interactive objects.
- Hardware refinement: a complete 101-key layout, keybed and keycap rows sharing one slope, and seated key skirts; a continuous two-button mouse shell with restrained seams and period-appropriate proportions.
- Runtime: Three.js, PBR, indoor environment reflections, soft shadows, ambient occlusion and a readable live screen texture. Judge actual browser pixels and interactions, not just offline renders. The target is realism; this document is not a claim of photographic fidelity.

## Scope

Desktop browsers with a mouse and physical keyboard only. No mobile edition is in scope.

Computer/monitor power, boot POST, insert/eject floppy, focus screen, real command entry, original short game with persistent score, return to DOS, power off. The existing game/room exit behavior remains unchanged. Local-only storage. No remote model service is required at runtime.

Two image Easter eggs are discoverable on the virtual C drive through directory exploration and the bundled `VIEW` program. Viewing and loading/error states return to the same DOS directory with Esc. Existing saved files and scores take precedence; updates only add missing content. Maintenance locations are documented in a collapsed section of the README rather than in player-facing UI.

## Asset policy

Core hardware and room geometry are custom authored. `blender/build_scene.py` builds the hardware; `blender/teen_room.py` provides the bedroom dressing. Wood maps reuse the existing Poly Haven CC0 material. The old Lebombo HDR is retained as an unused historical asset, not a lighting dependency.

The two hidden images and the Static Youth poster were created for this project with OpenAI's native image generation tool; band names and imagery are fictional. User reference images inform composition only. No Meshy generation was performed or credits spent. No credentials enter source control.

## Validation record

Use `work/visual-review.md` for the actual browser review and verified checks. Use the current `work/model-export.json` and GLB file for exported model statistics; avoid fixed size or triangle claims in this design plan as the model evolves.
