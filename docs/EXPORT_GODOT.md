# Exports and Godot (`frontend/src/lib/engine/exporting.ts`, built in the browser)

| Export | Function | Output |
|---|---|---|
| PNG | `designCanvas` + `toBlob(png)` | 512×768 design |
| Transparent PNG | `transparentPng` → `removeBackground` | flood fill from the 4 corners (step tolerance 24, seed tolerance 90), alpha 0, 0.6 px edge blur |
| Sprite sheet | `spriteSheetZip` | `sheet.png` (frames side by side) + `atlas.json` `{character, frame_width, frame_height, frames:[{design_id,x,y,w,h}]}` |
| Godot pack | `godotZip` | `sprites/design_<id>.png`, `character.json` `{name, style, designs:[{id,file,prompt,kind,consistency}]}`, `CharacterLoader.gd`, `README.txt` |

Zips use `fflate.zipSync`. Every export is recorded in the history via `POST /api/characters/:id/exported`.

## CharacterLoader.gd (`frontend/src/assets/`, single copy)
A Godot 4 `Node2D` with `@export_file character_json`. It loads every design's texture relative to the JSON.
`show_design(i)`, `cycle()`, `current_label()`. `ui_accept` (Enter/Space) cycles. Usage: unzip into `res://characters/<slug>/`,
attach the script to a Node2D and set `character_json`.

Limitation: background removal expects a plain background touching the corners. AI images sometimes have soft grey
gradients or floor shadows, so parts may remain.
