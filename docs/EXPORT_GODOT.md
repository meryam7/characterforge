# Exports and Godot integration (`backend/app/services/export.py`)

| Export | Function | Output |
|---|---|---|
| PNG | `png_bytes` | the design as stored |
| Transparent PNG | `remove_background(img, tolerance=28)` | flood-fills from the 4 corners to magenta, then alpha = not background, with a 0.8px Gaussian blur on the alpha |
| Sprite sheet zip | `build_sheet_zip` | `sheet.png` (all designs side by side, transparent, frame = max w×h) and `atlas.json` `{character, frame_width, frame_height, frames:[{design_id,x,y,w,h}]}` |
| Godot pack zip | `build_godot_zip` | `sprites/design_<id>.png` (transparent), `character.json` `{name, style, designs:[{id,file,prompt,kind,consistency}]}`, `CharacterLoader.gd`, `README.txt` |

`slug(name)`: lowercase, non-alphanumerics become `_`, falls back to `"character"`. The frontend duplicates it in `ExportPanel`.

## CharacterLoader.gd (Godot 4)
- The source the zip uses is `backend/app/assets/CharacterLoader.gd` (`export.LOADER`). `godot/CharacterLoader.gd` is an
  identical copy for users, so keep both in sync.
- `class_name CharacterLoader extends Node2D`, with `@export_file("*.json") var character_json`.
- `_ready` creates a `Sprite2D` and calls `load_character(path)`, which parses the JSON and loads each `file` relative
  to the JSON's directory.
- API: `show_design(i)` (wraps around), `cycle()`, `current_label()`. `ui_accept` (Enter/Space) cycles designs.
- Usage: unzip into `res://characters/<slug>/`, attach the script to a Node2D and set `character_json`.

Background removal assumes a plain near-white background that touches the corners. Characters touching the edges,
or white clothing connected to the border, will be cut.
