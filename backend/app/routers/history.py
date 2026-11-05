from fastapi import APIRouter, Depends, Query
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import current_user
from ..models import Activity, Character
from ..schemas import ActivityOut, HistoryPage
from ..services import storage

router = APIRouter(prefix="/api/history", tags=["history"])


@router.get("", response_model=HistoryPage)
def list_history(
    before: int | None = None,
    limit: int = Query(30, ge=1, le=100),
    character_id: int | None = None,
    db: Session = Depends(get_db),
    user: str = Depends(current_user),
):
    q = select(Activity).where(Activity.user_id == user)
    if before is not None:
        q = q.where(Activity.id < before)
    if character_id is not None:
        q = q.where(Activity.character_id == character_id)
    rows = db.scalars(q.order_by(Activity.id.desc()).limit(limit + 1)).all()
    page, more = rows[:limit], len(rows) > limit
    ids = {a.character_id for a in page if a.character_id is not None}
    alive = (
        set(db.scalars(select(Character.id).where(Character.id.in_(ids), Character.user_id == user)).all())
        if ids else set()
    )
    items = [
        ActivityOut(
            id=a.id, action=a.action, character_id=a.character_id, character_name=a.character_name,
            design_id=a.design_id, detail=a.detail, thumb_url=storage.url_for(a.thumb_path),
            character_exists=a.character_id in alive, created_at=a.created_at,
        )
        for a in page
    ]
    return HistoryPage(items=items, next_before=page[-1].id if more else None)


@router.delete("")
def clear_history(db: Session = Depends(get_db), user: str = Depends(current_user)):
    db.execute(delete(Activity).where(Activity.user_id == user))
    db.commit()
    storage.delete_prefix(f"history/{user}/")
    return {"ok": True}
