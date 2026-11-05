import os
import shutil
import tempfile

# Must be set before the app is imported (settings are read at import time).
_TMP = tempfile.mkdtemp(prefix="charaforge-test-")
os.environ.update(
    ENVIRONMENT="test",
    MOCK_AI="true",
    STORAGE_BACKEND="local",
    DATABASE_URL=f"sqlite:///{_TMP}/test.db",
    STORAGE_DIR=f"{_TMP}/storage",
    ADMIN_EMAILS="admin@example.com",
    FRONTEND_DIST=f"{_TMP}/no-dist",
)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import ratelimit  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:  # runs lifespan -> migrations
        yield c
    shutil.rmtree(_TMP, ignore_errors=True)


@pytest.fixture(autouse=True)
def _reset_limits():
    ratelimit.reset()


_n = 0


@pytest.fixture
def auth(client):
    """Register a fresh user and return its Authorization header."""
    global _n
    _n += 1
    r = client.post("/api/auth/register", json={
        "email": f"user{_n}@example.com", "password": "password123", "display_name": f"User {_n}",
    })
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}
