import io

from PIL import Image


def _character(client, auth, name="Mira"):
    r = client.post("/api/characters", headers=auth, json={"name": name, "description": "silver hair mage"})
    assert r.status_code == 201, r.text
    return r.json()


def _design(client, auth, cid, prompt="battle pose"):
    r = client.post(f"/api/characters/{cid}/generate", headers=auth, json={"prompt": prompt})
    assert r.status_code == 201, r.text
    return r.json()


# ------------------------------------------------------------------ auth
def test_health(client):
    assert client.get("/api/health").json()["status"] == "ok"


def test_register_login_me(client):
    body = {"email": "Alice@Example.com", "password": "password123", "display_name": "Alice"}
    assert client.post("/api/auth/register", json=body).status_code == 201
    assert client.post("/api/auth/register", json=body).status_code == 409  # case-insensitive duplicate
    assert client.post("/api/auth/login", json={"email": "alice@example.com", "password": "nope"}).status_code == 401
    r = client.post("/api/auth/login", json={"email": "alice@example.com", "password": "password123"})
    assert r.status_code == 200
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {r.json()['token']}"}).json()
    assert me["email"] == "alice@example.com" and me["display_name"] == "Alice" and not me["is_admin"]


def test_requires_login(client):
    assert client.get("/api/characters").status_code == 401
    assert client.get("/api/characters", headers={"Authorization": "Bearer garbage"}).status_code == 401


def test_validation(client):
    r = client.post("/api/auth/register", json={"email": "bad", "password": "short", "display_name": "x"})
    assert r.status_code == 422


def test_login_rate_limited(client):
    codes = [
        client.post("/api/auth/login", json={"email": "x@example.com", "password": "wrong"}).status_code
        for _ in range(12)
    ]
    assert 429 in codes


# ------------------------------------------------------------------ studio flow
def test_full_flow_and_history(client, auth):
    ch = _character(client, auth)
    d1 = _design(client, auth, ch["id"])
    assert d1["consistency"] == 1.0 and d1["created_at"].endswith("Z")
    img = client.get(d1["image_url"])
    assert img.status_code == 200 and img.headers["content-type"] == "image/png"

    seg = client.post(f"/api/designs/{d1['id']}/segment", headers=auth, json={"points": [{"x": 256, "y": 150}]})
    assert seg.status_code == 200 and 0 < seg.json()["coverage"] < 1
    assert client.get(seg.json()["overlay_url"]).status_code == 200

    ed = client.post(f"/api/designs/{d1['id']}/edit", headers=auth, json={"mask_id": seg.json()["mask_id"], "prompt": "red hair"})
    assert ed.status_code == 201 and ed.json()["kind"] == "edit" and ed.json()["parent_id"] == d1["id"]
    # mask is consumed after the edit
    again = client.post(f"/api/designs/{d1['id']}/edit", headers=auth, json={"mask_id": seg.json()["mask_id"], "prompt": "x"})
    assert again.status_code == 404

    assert client.get(f"/api/designs/{d1['id']}/export?format=transparent", headers=auth).status_code == 200
    assert client.get(f"/api/designs/{d1['id']}/export?format=png&preview=true", headers=auth).status_code == 200
    assert client.get(f"/api/characters/{ch['id']}/export?target=godot", headers=auth).status_code == 200

    actions = [a["action"] for a in client.get("/api/history", headers=auth).json()["items"]]
    assert actions == ["exported", "exported", "edited", "generated", "created"]  # preview not logged


def test_mask_bound_to_design(client, auth):
    ch = _character(client, auth)
    d1, d2 = _design(client, auth, ch["id"]), _design(client, auth, ch["id"], "side view")
    seg = client.post(f"/api/designs/{d1['id']}/segment", headers=auth, json={"points": [{"x": 256, "y": 150}]}).json()
    r = client.post(f"/api/designs/{d2['id']}/edit", headers=auth, json={"mask_id": seg["mask_id"], "prompt": "x"})
    assert r.status_code == 404


def test_ownership(client, auth):
    ch = _character(client, auth)
    d = _design(client, auth, ch["id"])
    other = client.post("/api/auth/register", json={"email": "eve@example.com", "password": "password123", "display_name": "Eve"})
    eve = {"Authorization": f"Bearer {other.json()['token']}"}
    assert client.get(f"/api/characters/{ch['id']}", headers=eve).status_code == 404
    assert client.post(f"/api/designs/{d['id']}/publish", headers=eve).status_code == 404
    assert client.delete(f"/api/characters/{ch['id']}", headers=eve).status_code == 404
    assert client.get("/api/history", headers=eve).json()["items"] == []


def test_history_survives_delete(client, auth):
    ch = _character(client, auth, "Temp")
    _design(client, auth, ch["id"])
    assert client.delete(f"/api/characters/{ch['id']}", headers=auth).status_code == 200
    items = client.get("/api/history", headers=auth).json()["items"]
    assert items[0]["action"] == "deleted" and items[0]["character_name"] == "Temp"
    assert not any(i["character_exists"] for i in items)
    assert all(client.get(i["thumb_url"]).status_code == 200 for i in items if i["thumb_url"])


def test_history_pagination(client, auth):
    ch = _character(client, auth)
    for i in range(4):
        _design(client, auth, ch["id"], f"pose {i}")
    p1 = client.get("/api/history?limit=3", headers=auth).json()
    assert len(p1["items"]) == 3 and p1["next_before"]
    p2 = client.get(f"/api/history?limit=3&before={p1['next_before']}", headers=auth).json()
    assert len(p2["items"]) == 2 and p2["next_before"] is None


def test_reference_upload(client, auth):
    ch = _character(client, auth)
    buf = io.BytesIO()
    Image.new("RGB", (300, 400), (200, 30, 30)).save(buf, "PNG")
    r = client.post(f"/api/characters/{ch['id']}/reference", headers=auth, files={"file": ("r.png", buf.getvalue(), "image/png")})
    assert r.status_code == 200 and r.json()["reference_url"]
    bad = client.post(f"/api/characters/{ch['id']}/reference", headers=auth, files={"file": ("r.png", b"not an image", "image/png")})
    assert bad.status_code == 400


def test_embedding_dimension_mismatch_recovers(client, auth):
    """Switching MOCK_AI used to crash scoring (64-dim vs 512-dim vectors)."""
    from app.database import SessionLocal
    from app.models import Character

    ch = _character(client, auth)
    _design(client, auth, ch["id"])
    with SessionLocal() as db:
        row = db.get(Character, ch["id"])
        row.embedding = [0.1] * 512  # pretend it came from CLIP
        db.commit()
    d = _design(client, auth, ch["id"], "winter coat")
    assert d["consistency"] is not None


# ------------------------------------------------------------------ community gallery
def test_publish_gallery(client, auth):
    ch = _character(client, auth, "Showcase")
    d = _design(client, auth, ch["id"])
    assert client.post(f"/api/designs/{d['id']}/publish", headers=auth).json()["is_public"] is True
    items = client.get("/api/gallery").json()["items"]  # no login needed
    assert items[0]["id"] == d["id"] and items[0]["character_name"] == "Showcase"

    # admin can take it down
    r = client.post("/api/auth/register", json={"email": "admin@example.com", "password": "password123", "display_name": "Admin"})
    admin = {"Authorization": f"Bearer {r.json()['token']}"}
    assert client.delete(f"/api/designs/{d['id']}/publish", headers=admin).status_code == 200
    assert all(i["id"] != d["id"] for i in client.get("/api/gallery").json()["items"])


def test_files_path_traversal(client):
    assert client.get("/files/../app/main.py").status_code == 404
    assert client.get("/files/designs/..%2F..%2Fapp.png").status_code == 404


def test_delete_account(client):
    r = client.post("/api/auth/register", json={"email": "bye@example.com", "password": "password123", "display_name": "Bye"})
    h = {"Authorization": f"Bearer {r.json()['token']}"}
    ch = _character(client, h)
    _design(client, h, ch["id"])
    assert client.delete("/api/auth/me", headers=h).status_code == 200
    assert client.get("/api/auth/me", headers=h).status_code == 401
