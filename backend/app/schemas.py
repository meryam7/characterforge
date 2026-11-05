from datetime import datetime, timezone
from typing import Annotated

from pydantic import AfterValidator, BaseModel, Field, PlainSerializer


def _utc(v: datetime) -> datetime:
    return v.replace(tzinfo=timezone.utc) if v.tzinfo is None else v.astimezone(timezone.utc)


# SQLite returns naive datetimes; always send ISO-8601 with "Z" so browsers show the right local time.
UTCDateTime = Annotated[
    datetime,
    AfterValidator(_utc),
    PlainSerializer(lambda v: v.strftime("%Y-%m-%dT%H:%M:%SZ"), return_type=str),
]
EMAIL = r"^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$"


# ------------------------------------------------------------------ auth
class RegisterIn(BaseModel):
    email: str = Field(pattern=EMAIL, max_length=254)
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=2, max_length=40)


class LoginIn(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=128)


class UserOut(BaseModel):
    id: int
    email: str
    display_name: str
    is_admin: bool
    created_at: UTCDateTime


class TokenOut(BaseModel):
    token: str
    user: UserOut


# ------------------------------------------------------------------ characters / designs
class CharacterCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=2000)
    style: str = Field(default="anime", max_length=60)


class CharacterOut(BaseModel):
    id: int
    name: str
    description: str
    style: str
    seed: int
    reference_url: str | None
    cover_url: str | None
    design_count: int
    created_at: UTCDateTime


class DesignOut(BaseModel):
    id: int
    character_id: int
    parent_id: int | None
    kind: str
    prompt: str
    consistency: float | None
    image_url: str
    is_public: bool
    created_at: UTCDateTime


class GenerateIn(BaseModel):
    prompt: str = Field(default="", max_length=500)
    lock_identity: bool = True


class PointIn(BaseModel):
    x: float
    y: float
    positive: bool = True


class SegmentIn(BaseModel):
    points: list[PointIn] = Field(min_length=1, max_length=20)


class SegmentOut(BaseModel):
    mask_id: str
    overlay_url: str
    coverage: float


class EditIn(BaseModel):
    mask_id: str = Field(pattern=r"^[a-f0-9]{32}$")
    prompt: str = Field(min_length=1, max_length=500)


# ------------------------------------------------------------------ history + community gallery
class ActivityOut(BaseModel):
    id: int
    action: str
    character_id: int | None
    character_name: str
    design_id: int | None
    detail: str
    thumb_url: str | None
    character_exists: bool
    created_at: UTCDateTime


class HistoryPage(BaseModel):
    items: list[ActivityOut]
    next_before: int | None  # pass as ?before= to load older entries


class PublicDesignOut(BaseModel):
    id: int
    image_url: str
    prompt: str
    kind: str
    character_name: str
    style: str
    author: str
    published_at: UTCDateTime


class GalleryPage(BaseModel):
    items: list[PublicDesignOut]
    next_before: int | None
