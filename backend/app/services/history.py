"""Activity log ("history"). Call record() inside the same transaction as the action it describes."""
from PIL import Image
from sqlalchemy.orm import Session

from ..models import Activity, Character, Design
from . import storage

ACTIONS = {
    "created", "reference", "generated", "edited", "exported", "published", "unpublished", "deleted",
}
THUMB = (160, 240)


def record(
    db: Session,
    user: str,
    action: str,
    character: Character,
    design: Design | None = None,
    detail: str = "",
    image: Image.Image | None = None,
) -> Activity:
    assert action in ACTIONS, action
    thumb = None
    if image is not None:  # own copy, so the entry keeps its picture after the character is deleted
        small = image.convert("RGB")
        small.thumbnail(THUMB)
        thumb = storage.save_image(small, f"history/{user}")
    act = Activity(
        user_id=user, action=action, character_id=character.id, character_name=character.name,
        design_id=design.id if design is not None else None, detail=detail[:500], thumb_path=thumb,
    )
    db.add(act)
    return act
