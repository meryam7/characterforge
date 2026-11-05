from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles

from .config import settings
from .database import migrate
from .routers import auth, characters, community, history, studio
from .services import storage


@asynccontextmanager
async def lifespan(_: FastAPI):
    migrate()  # alembic upgrade head (creates/updates tables)
    yield


app = FastAPI(
    title="CharaForge API", version="2.0.0", lifespan=lifespan,
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None,
)

app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    resp = await call_next(request)
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    resp.headers.setdefault("X-Frame-Options", "DENY")
    return resp


app.include_router(auth.router)
app.include_router(characters.router)
app.include_router(studio.router)
app.include_router(history.router)
app.include_router(community.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "mock_ai": settings.mock_ai, "storage": settings.storage_backend}


@app.get("/files/{rel:path}")
def files(rel: str):
    """Images for <img> tags (local disk or S3/R2). File names are random 128-bit ids and never change."""
    try:
        data = storage.read_bytes(rel)
    except (FileNotFoundError, ValueError):
        raise HTTPException(404, "Not found")
    return Response(
        data, media_type="image/png",
        headers={"Cache-Control": "public, max-age=31536000, immutable", "Access-Control-Allow-Origin": "*"},
    )


# Production single-service deploy: the built React app is served from the same origin.
if settings.frontend_dist.joinpath("index.html").exists():
    app.mount("/", StaticFiles(directory=settings.frontend_dist, html=True), name="frontend")
