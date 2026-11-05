from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent  # .../backend
DEV_SECRET = "dev-only-insecure-secret-change-me"


class Settings(BaseSettings):
    # .env is read from backend/ no matter where the server is started from
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    environment: str = "development"  # development | production
    database_url: str = "sqlite:///./charaforge.db"
    mock_ai: bool = True
    device: str = "auto"  # auto | cuda | mps | cpu
    cors_origins: str = "http://localhost:5173"

    # auth
    secret_key: str = DEV_SECRET
    token_days: int = 30
    admin_emails: str = ""  # comma-separated; admins can unpublish anything in the community gallery

    # storage: "local" (disk) or "s3" (Cloudflare R2 / AWS S3 / any S3-compatible service)
    storage_backend: str = "local"
    storage_dir: Path = Path("./storage")
    s3_endpoint_url: str = ""
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    s3_bucket: str = "charaforge"
    s3_region: str = "auto"

    # built frontend served by the API in production (single-service deploy). Ignored if missing.
    frontend_dist: Path = BACKEND_DIR.parent / "frontend" / "dist"

    # Hugging Face model ids (downloaded automatically on first use)
    sd_model: str = "stable-diffusion-v1-5/stable-diffusion-v1-5"
    inpaint_model: str = "stable-diffusion-v1-5/stable-diffusion-inpainting"
    clip_model: str = "openai/clip-vit-base-patch32"
    sam2_model: str = "facebook/sam2-hiera-small"

    @field_validator("storage_dir", "frontend_dist")
    @classmethod
    def _anchor(cls, v: Path) -> Path:
        return v if v.is_absolute() else (BACKEND_DIR / v).resolve()

    @field_validator("database_url")
    @classmethod
    def _anchor_sqlite(cls, v: str) -> str:
        prefix = "sqlite:///./"
        return f"sqlite:///{(BACKEND_DIR / v[len(prefix):]).as_posix()}" if v.startswith(prefix) else v

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def admins(self) -> set[str]:
        return {e.strip().lower() for e in self.admin_emails.split(",") if e.strip()}


settings = Settings()

if settings.is_production and settings.secret_key == DEV_SECRET:
    raise RuntimeError("SECRET_KEY must be set in production")
