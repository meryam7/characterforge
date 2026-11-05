import uuid
from typing import Literal

import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Response
from PIL import Image
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import current_user
from ..models import Character, Design
from ..ratelimit import limit
from ..schemas import DesignOut, EditIn, GenerateIn, SegmentIn, SegmentOut
from ..services import ai, export, history, storage
from .characters import get_owned

router = APIRouter(tags=["studio"])
MASK_TTL = 6 * 3600  # selections older than this are cleaned up


def design_out(d: Design) -> DesignOut:
    return DesignOut(
        id=d.id, character_id=d.character_id, parent_id=d.parent_id, kind=d.kind, prompt=d.prompt,
        consistency=d.consistency, image_url=storage.url_for(d.image_path), is_public=d.is_public,
        created_at=d.created_at,
    )


def get_owned_design(db: Session, user: str, did: int) -> tuple[Design, Character]:
    d = db.get(Design, did)
    if d is None:
        raise HTTPException(404, "Design not found")
    return d, get_owned(db, user, d.character_id)  # ownership check through the character


def anchor_image(ch: Character) -> Image.Image | None:
    """The picture that defines who this character is: the uploaded reference, else the first design."""
    path = ch.reference_path or (ch.designs[0].image_path if ch.designs else None)
    return storage.load_image(path) if path else None


def score_and_store_identity(ch: Character, img: Image.Image) -> float:
    emb = ai.embed(img)
    if ch.embedding is None:
        ch.embedding = emb
        return 1.0
    if len(ch.embedding) != len(emb):
        # Stored vector came from the other AI mode (mock histogram vs CLIP): rebuild it from the anchor.
        anchor = anchor_image(ch)
        ch.embedding = ai.embed(anchor) if anchor is not None else emb
    return round(ai.similarity(ch.embedding, emb), 3)


# ------------------------------------------------------------------ list / generate
@router.get("/api/characters/{cid}/designs", response_model=list[DesignOut])
def list_designs(cid: int, db: Session = Depends(get_db), user: str = Depends(current_user)):
    return [design_out(d) for d in get_owned(db, user, cid).designs]


@router.post("/api/characters/{cid}/generate", response_model=DesignOut, status_code=201)
def generate(cid: int, body: GenerateIn, db: Session = Depends(get_db), user: str = Depends(current_user)):
    limit(f"gen:{user}", 30, 60)
    ch = get_owned(db, user, cid)
    anchor = anchor_image(ch) if body.lock_identity else None
    prompt = ai.build_prompt(ch.description or ch.name, ch.style, body.prompt)
    img = ai.generate(prompt, ai.NEGATIVE, ch.seed, anchor)
    design = Design(
        character_id=ch.id, kind="generate", prompt=body.prompt.strip() or "base design",
        image_path=storage.save_image(img, "designs"), consistency=score_and_store_identity(ch, img),
    )
    db.add(design)
    db.flush()
    history.record(db, user, "generated", ch, design, detail=design.prompt, image=img)
    db.commit()
    return design_out(design)


# ------------------------------------------------------------------ segment + edit
@router.post("/api/designs/{did}/segment", response_model=SegmentOut)
def segment(did: int, body: SegmentIn, db: Session = Depends(get_db), user: str = Depends(current_user)):
    limit(f"seg:{user}", 120, 60)
    design, _ = get_owned_design(db, user, did)
    storage.delete_prefix(f"masks/{did}/", older_than=MASK_TTL)
    img = storage.load_image(design.image_path)
    pts = [(min(max(p.x, 0), img.width - 1), min(max(p.y, 0), img.height - 1), p.positive) for p in body.points]
    mask = ai.segment(img, pts)

    mask_id = uuid.uuid4().hex
    storage.save_image(mask, f"masks/{did}", mask_id)  # bound to this design: edit only looks here
    overlay = Image.new("RGBA", mask.size, (168, 85, 247, 0))
    overlay.putalpha(mask.point(lambda v: 130 if v > 127 else 0))
    overlay_rel = storage.save_image(overlay, f"masks/{did}", f"{mask_id}_overlay")
    coverage = round(float((np.asarray(mask) > 127).mean()), 4)
    return SegmentOut(mask_id=mask_id, overlay_url=storage.url_for(overlay_rel), coverage=coverage)


@router.post("/api/designs/{did}/edit", response_model=DesignOut, status_code=201)
def edit(did: int, body: EditIn, db: Session = Depends(get_db), user: str = Depends(current_user)):
    limit(f"gen:{user}", 30, 60)
    design, ch = get_owned_design(db, user, did)
    img = storage.load_image(design.image_path)
    try:
        mask = storage.load_image(f"masks/{did}/{body.mask_id}.png", "L")
    except FileNotFoundError:
        raise HTTPException(404, "Selection expired - select the area again")
    prompt = ai.build_prompt(ch.description or ch.name, ch.style, body.prompt)
    out = ai.inpaint(img, mask, prompt, ai.NEGATIVE, ch.seed)
    new = Design(
        character_id=ch.id, parent_id=design.id, kind="edit", prompt=body.prompt.strip(),
        image_path=storage.save_image(out, "designs"), consistency=score_and_store_identity(ch, out),
    )
    db.add(new)
    db.flush()
    history.record(db, user, "edited", ch, new, detail=new.prompt, image=out)
    db.commit()
    storage.delete_prefix(f"masks/{did}/")  # selection used up
    return design_out(new)


# ------------------------------------------------------------------ export
@router.get("/api/designs/{did}/export")
def export_design(
    did: int, format: Literal["png", "transparent"] = "png", preview: bool = False,
    db: Session = Depends(get_db), user: str = Depends(current_user),
):
    design, ch = get_owned_design(db, user, did)
    img = storage.load_image(design.image_path)
    if format == "transparent":
        img = export.remove_background(img)
    if not preview:  # the 3D preview fetches this too; don't log that as an export
        history.record(db, user, "exported", ch, design, detail=f"{format} PNG")
        db.commit()
    name = f"{export.slug(ch.name)}_{design.id}{'_transparent' if format == 'transparent' else ''}.png"
    return Response(
        export.png_bytes(img), media_type="image/png",
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


@router.get("/api/characters/{cid}/export")
def export_character(
    cid: int, target: Literal["godot", "sheet"] = "godot",
    db: Session = Depends(get_db), user: str = Depends(current_user),
):
    ch = get_owned(db, user, cid)
    if not ch.designs:
        raise HTTPException(400, "Generate at least one design first")
    data = export.build_godot_zip(ch, ch.designs) if target == "godot" else export.build_sheet_zip(ch, ch.designs)
    history.record(db, user, "exported", ch, detail="Godot pack" if target == "godot" else "sprite sheet")
    db.commit()
    name = f"{export.slug(ch.name)}_{target}.zip"
    return Response(data, media_type="application/zip", headers={"Content-Disposition": f'attachment; filename="{name}"'})
