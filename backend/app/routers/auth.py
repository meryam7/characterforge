from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..deps import current_account
from ..models import Activity, Character, User
from ..ratelimit import client_ip, limit
from ..schemas import LoginIn, RegisterIn, TokenOut, UserOut
from ..security import create_token, hash_password, verify_password
from ..services import storage
from .characters import delete_character_files

router = APIRouter(prefix="/api/auth", tags=["auth"])


def user_out(u: User) -> UserOut:
    return UserOut(
        id=u.id, email=u.email, display_name=u.display_name,
        is_admin=u.email.lower() in settings.admins, created_at=u.created_at,
    )


@router.post("/register", response_model=TokenOut, status_code=201)
def register(body: RegisterIn, request: Request, db: Session = Depends(get_db)):
    limit(f"register:{client_ip(request)}", 10, 3600)
    email = body.email.strip().lower()
    if db.scalar(select(User).where(func.lower(User.email) == email)):
        raise HTTPException(409, "An account with this email already exists")
    user = User(email=email, display_name=body.display_name.strip(), password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    return TokenOut(token=create_token(user.id), user=user_out(user))


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    limit(f"login-ip:{client_ip(request)}", 30, 600)
    limit(f"login-email:{email}", 10, 600)
    user = db.scalar(select(User).where(func.lower(User.email) == email))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Wrong email or password")
    return TokenOut(token=create_token(user.id), user=user_out(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_account)):
    return user_out(user)


@router.delete("/me")
def delete_account(user: User = Depends(current_account), db: Session = Depends(get_db)):
    """Permanently delete the account, its characters, designs, history and files."""
    uid = str(user.id)
    for ch in db.scalars(select(Character).where(Character.user_id == uid)).all():
        delete_character_files(ch)
        db.delete(ch)
    db.execute(delete(Activity).where(Activity.user_id == uid))
    db.delete(user)
    db.commit()
    storage.delete_prefix(f"history/{uid}/")
    return {"ok": True}
