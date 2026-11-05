"""File storage behind one small API. Two backends, picked by STORAGE_BACKEND:
- local: files under STORAGE_DIR (development, docker-compose)
- s3:    any S3-compatible bucket (Cloudflare R2 in production). Needed on hosts with an ephemeral disk (Render).

The DB stores *relative keys* like "designs/<hex>.png". The API serves them at /files/<key> (see main.py),
so the frontend never needs to know which backend is used."""
from __future__ import annotations

import io
import re
import time
import uuid
from functools import lru_cache
from pathlib import Path

from PIL import Image

from ..config import settings

_KEY = re.compile(r"^[a-z]+(/[A-Za-z0-9_-]+)+\.png$")


def _check(rel: str) -> str:
    if not _KEY.match(rel) or ".." in rel:
        raise ValueError("Invalid storage path")
    return rel


def _use_s3() -> bool:
    return settings.storage_backend.lower() == "s3"


# --------------------------------------------------------------------------- local backend
def root() -> Path:
    p = Path(settings.storage_dir).resolve()
    p.mkdir(parents=True, exist_ok=True)
    return p


def _local(rel: str) -> Path:
    path = (root() / _check(rel)).resolve()
    if root() not in path.parents:
        raise ValueError("Invalid storage path")
    return path


# --------------------------------------------------------------------------- s3 backend
@lru_cache(maxsize=1)
def _s3():
    import boto3  # only needed when STORAGE_BACKEND=s3
    from botocore.config import Config

    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url or None,
        aws_access_key_id=settings.s3_access_key_id,
        aws_secret_access_key=settings.s3_secret_access_key,
        region_name=settings.s3_region,
        config=Config(signature_version="s3v4", retries={"max_attempts": 3}),
    )


# --------------------------------------------------------------------------- public API
def write_bytes(rel: str, data: bytes) -> str:
    _check(rel)
    if _use_s3():
        _s3().put_object(Bucket=settings.s3_bucket, Key=rel, Body=data, ContentType="image/png")
    else:
        path = _local(rel)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    return rel


def read_bytes(rel: str) -> bytes:
    """Raises FileNotFoundError if missing."""
    _check(rel)
    if _use_s3():
        try:
            return _s3().get_object(Bucket=settings.s3_bucket, Key=rel)["Body"].read()
        except _s3().exceptions.NoSuchKey as exc:
            raise FileNotFoundError(rel) from exc
    return _local(rel).read_bytes()


def save_image(img: Image.Image, folder: str, name: str | None = None) -> str:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return write_bytes(f"{folder}/{name or uuid.uuid4().hex}.png", buf.getvalue())


def load_image(rel: str, mode: str = "RGB") -> Image.Image:
    with Image.open(io.BytesIO(read_bytes(rel))) as im:
        return im.convert(mode)


def url_for(rel: str | None) -> str | None:
    return f"/files/{rel}" if rel else None


def delete(rel: str | None) -> None:
    if not rel:
        return
    try:
        _check(rel)
    except ValueError:
        return
    if _use_s3():
        _s3().delete_object(Bucket=settings.s3_bucket, Key=rel)
    else:
        path = _local(rel)
        if path.exists():
            path.unlink()


def delete_prefix(prefix: str, older_than: float | None = None) -> int:
    """Delete every file under prefix (e.g. "masks/12/"), optionally only files older than N seconds."""
    if not re.match(r"^[a-z]+/([A-Za-z0-9_-]+/)*$", prefix):
        raise ValueError("Invalid prefix")
    cutoff = time.time() - older_than if older_than is not None else None
    n = 0
    if _use_s3():
        paginator = _s3().get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=settings.s3_bucket, Prefix=prefix):
            keys = [
                {"Key": o["Key"]}
                for o in page.get("Contents", [])
                if cutoff is None or o["LastModified"].timestamp() < cutoff
            ]
            if keys:
                _s3().delete_objects(Bucket=settings.s3_bucket, Delete={"Objects": keys, "Quiet": True})
                n += len(keys)
        return n
    base = root() / prefix
    if not base.exists():
        return 0
    for f in base.rglob("*.png"):
        if cutoff is None or f.stat().st_mtime < cutoff:
            f.unlink(missing_ok=True)
            n += 1
    for d in sorted((p for p in base.rglob("*") if p.is_dir()), reverse=True):  # prune empty dirs
        if not any(d.iterdir()):
            d.rmdir()
    return n
