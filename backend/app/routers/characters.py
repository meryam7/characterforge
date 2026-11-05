import io
import random

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import current_user
from ..models import Character
from ..schemas import CharacterCreate, CharacterOut
from ..services import ai, history, storage

router = APIRouter(prefix="/api/characters", tags=["characters"])
MAX_UPLOAD = 8 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 40_000_000  # refuse decompression bombs


def get_owned(db: Session, user: str, cid: int) -> Character:
    ch = db.get(Character, cid)
    if ch is None or ch.user_id != user:
        raise HTTPException(404, "Character not found")
    return ch


def to_out(ch: Character) -> CharacterOut:
    cover = ch.designs[-1].image_path if ch.designs else ch.reference_path
    return CharacterOut(
        id=ch.id, name=ch.name, description=ch.description, style=ch.style, seed=ch.seed,
        reference_url=storage.url_for(ch.reference_path), cover_url=storage.url_for(cover),
        design_count=len(ch.designs), created_at=ch.created_at,
    )


def delete_character_files(ch: Character) -> None:
    """Designs, their selection masks and the reference. History thumbnails are kept on purpose."""
    for d in ch.designs:
        storage.delete(d.image_path)
        storage.delete_prefix(f"masks/{d.id}/")
    storage.delete(ch.reference_path)


@router.get("", response_model=list[CharacterOut])
def list_characters(db: Session = Depends(get_db), user: str = Depends(current_user)):
    rows = db.scalars(select(Character).where(Character.user_id == user).order_by(Character.id.desc())).all()
    return [to_out(c) for c in rows]


@router.post("", response_model=CharacterOut, status_code=201)
def create_character(body: CharacterCreate, db: Session = Depends(get_db), user: str = Depends(current_user)):
    ch = Character(
        user_id=user, name=body.name.strip(), description=body.description.strip(),
        style=body.style, seed=random.randint(1, 2**31 - 1),
    )
    db.add(ch)
    db.flush()  # assigns ch.id for the history entry
    history.record(db, user, "created", ch, detail=f"{ch.style} · {ch.description[:200]}".strip(" ·"))
    db.commit()
    return to_out(ch)


@router.get("/{cid}", response_model=CharacterOut)
def get_character(cid: int, db: Session = Depends(get_db), user: str = Depends(current_user)):
    return to_out(get_owned(db, user, cid))


@router.delete("/{cid}")
def delete_character(cid: int, db: Session = Depends(get_db), user: str = Depends(current_user)):
    ch = get_owned(db, user, cid)
    cover = ch.designs[-1].image_path if ch.designs else ch.reference_path
    image = storage.load_image(cover) if cover else None
    history.record(db, user, "deleted", ch, detail=f"{len(ch.designs)} designs", image=image)
    delete_character_files(ch)
    db.delete(ch)
    db.commit()
    return {"ok": True}


@router.post("/{cid}/reference", response_model=CharacterOut)
def upload_reference(cid: int, file: UploadFile, db: Session = Depends(get_db), user: str = Depends(current_user)):
    ch = get_owned(db, user, cid)
    data = file.file.read(MAX_UPLOAD + 1)
    if len(data) > MAX_UPLOAD:
        raise HTTPException(413, "Image too large (max 8 MB)")
    try:
        img = Image.open(io.BytesIO(data)).convert("RGB")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise HTTPException(400, "File is not a valid image")
    img.thumbnail((768, 768))
    storage.delete(ch.reference_path)
    ch.reference_path = storage.save_image(img, "references")
    ch.embedding = ai.embed(img)  # the reference defines the identity vector
    history.record(db, user, "reference", ch, detail="reference image uploaded", image=img)
    db.commit()
    return to_out(ch)
