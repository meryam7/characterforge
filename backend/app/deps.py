from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from .database import get_db
from .models import User
from .security import decode_token


def current_account(authorization: str = Header(default=""), db: Session = Depends(get_db)) -> User:
    """The logged-in user, from 'Authorization: Bearer <token>'. 401 otherwise."""
    scheme, _, token = authorization.partition(" ")
    uid = decode_token(token) if scheme.lower() == "bearer" and token else None
    user = db.get(User, uid) if uid is not None else None
    if user is None:
        raise HTTPException(401, "Please log in", headers={"WWW-Authenticate": "Bearer"})
    return user


def current_user(user: User = Depends(current_account)) -> str:
    """Owner key stored in Character.user_id / Activity.user_id (string form of User.id)."""
    return str(user.id)
