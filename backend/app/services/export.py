import io
import json
import re
import zipfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from ..models import Character, Design
from . import storage

LOADER = Path(__file__).resolve().parent.parent / "assets" / "CharacterLoader.gd"


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_") or "character"


def png_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def remove_background(img: Image.Image, tolerance: int = 28) -> Image.Image:
    """Characters are generated on a plain white background -> flood-fill it from the corners."""
    rgb = img.convert("RGB")
    marker = (255, 0, 255)
    work = rgb.copy()
    w, h = rgb.size
    for xy in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        if work.getpixel(xy) != marker:
            ImageDraw.floodfill(work, xy, marker, thresh=tolerance)
    is_bg = np.all(np.asarray(work) == marker, axis=-1)
    alpha = Image.fromarray((~is_bg).astype(np.uint8) * 255).filter(ImageFilter.GaussianBlur(0.8))
    out = rgb.convert("RGBA")
    out.putalpha(alpha)
    return out


def build_godot_zip(character: Character, designs: list[Design]) -> bytes:
    meta = {"name": character.name, "style": character.style, "designs": []}
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for d in designs:
            img = remove_background(storage.load_image(d.image_path))
            fname = f"sprites/design_{d.id}.png"
            z.writestr(fname, png_bytes(img))
            meta["designs"].append(
                {"id": d.id, "file": fname, "prompt": d.prompt, "kind": d.kind, "consistency": d.consistency}
            )
        z.writestr("character.json", json.dumps(meta, indent=2))
        z.writestr("CharacterLoader.gd", LOADER.read_text(encoding="utf-8"))
        z.writestr(
            "README.txt",
            "Copy this folder into your Godot 4 project (e.g. res://characters/%s/).\n"
            "Add a Node2D, attach CharacterLoader.gd, set 'character_json' to the character.json path.\n"
            "Press the ui_accept key (Enter/Space) in-game to cycle through the designs.\n" % slug(character.name),
        )
    return buf.getvalue()


def build_sheet_zip(character: Character, designs: list[Design]) -> bytes:
    imgs = [remove_background(storage.load_image(d.image_path)) for d in designs]
    fw, fh = max(i.width for i in imgs), max(i.height for i in imgs)
    sheet = Image.new("RGBA", (fw * len(imgs), fh), (0, 0, 0, 0))
    atlas = {"character": character.name, "frame_width": fw, "frame_height": fh, "frames": []}
    for i, (d, img) in enumerate(zip(designs, imgs)):
        sheet.paste(img, (i * fw, 0), img)
        atlas["frames"].append({"design_id": d.id, "x": i * fw, "y": 0, "w": fw, "h": fh})
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("sheet.png", png_bytes(sheet))
        z.writestr("atlas.json", json.dumps(atlas, indent=2))
    return buf.getvalue()
