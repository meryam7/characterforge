"""Public community gallery: users opt in per design. Listing needs no login."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import String, cast, select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..deps import current_account
from ..models import Character, Design, User
from ..schemas import DesignOut, GalleryPage, PublicDesignOut
from ..services import history, storage
from .studio import design_out, get_owned_design

router = APIRouter(tags=["community"])


@router.get("/api/gallery", response_model=GalleryPage)
def gallery(before: int | None = None, limit: int = Query(24, ge=1, le=60), db: Session = Depends(get_db)):
    q = (
        select(Design, Character, User)
        .join(Character, Design.character_id == Character.id)
        .join(User, cast(User.id, String) == Character.user_id)
        .where(Design.is_public.is_(True))
    )
    if before is not None:
        q = q.where(Design.id < before)
    rows = db.execute(q.order_by(Design.id.desc()).limit(limit + 1)).all()
    page, more = rows[:limit], len(rows) > limit
    items = [
        PublicDesignOut(
            id=d.id, image_url=storage.url_for(d.image_path), prompt=d.prompt, kind=d.kind,
            character_name=c.name, style=c.style, author=u.display_name, published_at=d.published_at or d.created_at,
        )
        for d, c, u in page
    ]
    return GalleryPage(items=items, next_before=page[-1][0].id if more else None)


@router.post("/api/designs/{did}/publish", response_model=DesignOut)
def publish(did: int, db: Session = Depends(get_db), account: User = Depends(current_account)):
    user = str(account.id)
    design, ch = get_owned_design(db, user, did)
    if not design.is_public:
        design.is_public = True
        design.published_at = datetime.now(timezone.utc)
        history.record(db, user, "published", ch, design, detail="shared to the community gallery")
        db.commit()
    return design_out(design)


@router.delete("/api/designs/{did}/publish")
def unpublish(did: int, db: Session = Depends(get_db), account: User = Depends(current_account)):
    """Owner can unpublish their design; admins (ADMIN_EMAILS) can take down any design."""
    user = str(account.id)
    design = db.get(Design, did)
    if design is None:
        raise HTTPException(404, "Design not found")
    ch = design.character
    is_admin = account.email.lower() in settings.admins
    if ch.user_id != user and not is_admin:
        raise HTTPException(404, "Design not found")
    if design.is_public:
        design.is_public = False
        design.published_at = None
        if ch.user_id == user:
            history.record(db, user, "unpublished", ch, design, detail="removed from the community gallery")
        db.commit()
    return {"ok": True}
