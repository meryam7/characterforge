"""AI layer: text->image (Diffusers), identity lock (IP-Adapter + CLIP), segmentation (SAM2), inpainting.

Everything heavy is imported lazily, so MOCK_AI=true runs on any laptop with no torch installed.
"""
from __future__ import annotations

import contextlib
import hashlib
import random
import threading
from typing import Sequence

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from ..config import settings

W, H = 512, 768
NEGATIVE = (
    "blurry, low quality, deformed, extra limbs, bad anatomy, text, watermark, "
    "cropped, multiple characters, busy background"
)
STYLES = {
    "anime": "anime style, clean lineart, vibrant colors, cel shading",
    "pixel art": "pixel art, 16-bit game sprite, limited palette, crisp pixels",
    "comic book": "comic book style, bold ink outlines, halftone shading",
    "painterly": "digital painting, painterly brush strokes, rich colors, concept art",
    "chibi": "chibi proportions, cute, big head, kawaii, clean lineart",
    "realistic concept art": "realistic character concept art, highly detailed, studio lighting",
}

_lock = threading.RLock()  # one GPU job at a time
_cache: dict = {}

Point = tuple[float, float, bool]  # x, y, positive?


def build_prompt(description: str, style: str, extra: str = "") -> str:
    parts = [
        description.strip(),
        extra.strip(),
        STYLES.get(style, style),
        "full body character design, single character, centered, plain white background",
    ]
    return ", ".join(p for p in parts if p)


def _device() -> str:
    if settings.device != "auto":
        return settings.device
    import torch

    if torch.cuda.is_available():
        return "cuda"
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


# --------------------------------------------------------------------------- generation
def _t2i_pipe():
    if "t2i" not in _cache:
        import torch
        from diffusers import StableDiffusionPipeline

        dev = _device()
        dtype = torch.float16 if dev == "cuda" else torch.float32
        pipe = StableDiffusionPipeline.from_pretrained(settings.sd_model, torch_dtype=dtype)
        try:  # IP-Adapter = "look like this reference image" -> keeps the character's identity
            pipe.load_ip_adapter("h94/IP-Adapter", subfolder="models", weight_name="ip-adapter_sd15.bin")
            _cache["ip"] = True
        except Exception as exc:  # noqa: BLE001
            print(f"[ai] IP-Adapter unavailable ({exc}); identity relies on seed + prompt only")
            _cache["ip"] = False
        _cache["t2i"] = pipe.to(dev)
    return _cache["t2i"]


def generate(prompt: str, negative: str, seed: int, anchor: Image.Image | None) -> Image.Image:
    if settings.mock_ai:
        return _mock_character(prompt, seed)
    import torch

    with _lock:
        pipe = _t2i_pipe()
        extra = {}
        if _cache.get("ip"):
            pipe.set_ip_adapter_scale(0.6 if anchor is not None else 0.0)
            extra["ip_adapter_image"] = anchor or Image.new("RGB", (224, 224), (127, 127, 127))
        gen = torch.Generator(device="cpu").manual_seed(seed)
        out = pipe(
            prompt=prompt, negative_prompt=negative, width=W, height=H,
            num_inference_steps=30, guidance_scale=7.5, generator=gen, **extra,
        )
        return out.images[0].convert("RGB")


# --------------------------------------------------------------------------- inpainting (edit a region)
def _inpaint_pipe():
    if "inpaint" not in _cache:
        import torch
        from diffusers import StableDiffusionInpaintPipeline

        dev = _device()
        dtype = torch.float16 if dev == "cuda" else torch.float32
        pipe = StableDiffusionInpaintPipeline.from_pretrained(settings.inpaint_model, torch_dtype=dtype)
        _cache["inpaint"] = pipe.to(dev)
    return _cache["inpaint"]


def inpaint(image: Image.Image, mask: Image.Image, prompt: str, negative: str, seed: int) -> Image.Image:
    if settings.mock_ai:
        return _mock_inpaint(image, mask, prompt)
    import torch

    with _lock:
        pipe = _inpaint_pipe()
        size = image.size
        img = image.convert("RGB").resize((W, H))
        msk = mask.convert("L").resize((W, H)).filter(ImageFilter.MaxFilter(9))  # grow mask a little
        gen = torch.Generator(device="cpu").manual_seed(seed)
        out = pipe(
            prompt=prompt, negative_prompt=negative, image=img, mask_image=msk,
            width=W, height=H, strength=0.9, num_inference_steps=30, guidance_scale=7.5, generator=gen,
        ).images[0]
        # paste ONLY the masked area back so the rest of the character stays pixel-identical
        out = Image.composite(out.convert("RGB"), img, msk)
        return out.resize(size)


# --------------------------------------------------------------------------- segmentation
def segment(image: Image.Image, points: Sequence[Point]) -> Image.Image:
    """Return an 'L' mask (255 = selected)."""
    if not settings.mock_ai:
        try:
            return _sam2_segment(image, points)
        except ImportError:
            print("[ai] SAM2 not installed - falling back to colour-region selection")
    return _region_segment(image, points)


def _sam2_segment(image: Image.Image, points: Sequence[Point]) -> Image.Image:
    import torch
    from sam2.sam2_image_predictor import SAM2ImagePredictor  # raises ImportError if missing

    dev = _device()
    with _lock:
        if "sam2" not in _cache:
            _cache["sam2"] = SAM2ImagePredictor.from_pretrained(settings.sam2_model, device=dev)
        predictor = _cache["sam2"]
        coords = np.array([[x, y] for x, y, _ in points], dtype=np.float32)
        labels = np.array([1 if p else 0 for _, _, p in points], dtype=np.int32)
        ctx = torch.autocast("cuda", dtype=torch.bfloat16) if dev == "cuda" else contextlib.nullcontext()
        with torch.inference_mode(), ctx:
            predictor.set_image(np.array(image.convert("RGB")))
            masks, scores, _ = predictor.predict(
                point_coords=coords, point_labels=labels, multimask_output=len(points) == 1
            )
    best = masks[int(np.argmax(scores))]
    return Image.fromarray(((best > 0).astype(np.uint8)) * 255)


def _region(image: Image.Image, x: float, y: float, thresh: int = 36) -> np.ndarray:
    rgb = image.convert("RGB")
    marker = (255, 0, 255)
    work = rgb.copy()
    xy = (int(min(max(x, 0), rgb.width - 1)), int(min(max(y, 0), rgb.height - 1)))
    ImageDraw.floodfill(work, xy, marker, thresh=thresh)
    return np.all(np.asarray(work) == marker, axis=-1)


def _region_segment(image: Image.Image, points: Sequence[Point]) -> Image.Image:
    mask = np.zeros((image.height, image.width), dtype=bool)
    for x, y, positive in points:
        if positive:
            mask |= _region(image, x, y)
    for x, y, positive in points:
        if not positive:
            mask &= ~_region(image, x, y)
    return Image.fromarray(mask.astype(np.uint8) * 255)


# --------------------------------------------------------------------------- embeddings (identity)
def _clip():
    if "clip" not in _cache:
        from transformers import CLIPModel, CLIPProcessor

        dev = _device()
        model = CLIPModel.from_pretrained(settings.clip_model).to(dev).eval()
        _cache["clip"] = (model, CLIPProcessor.from_pretrained(settings.clip_model), dev)
    return _cache["clip"]


def embed(image: Image.Image) -> list[float]:
    if settings.mock_ai:
        px = np.asarray(image.convert("RGB").resize((128, 192))).reshape(-1, 3)
        px = px[(px < 235).any(axis=1)]  # ignore the white background
        q = (px // 64).astype(int)
        hist = np.bincount(q[:, 0] * 16 + q[:, 1] * 4 + q[:, 2], minlength=64).astype(np.float32)
        hist /= np.linalg.norm(hist) or 1.0
        return hist.tolist()
    import torch

    with _lock:
        model, proc, dev = _clip()
        with torch.no_grad():
            inputs = proc(images=image.convert("RGB"), return_tensors="pt").to(dev)
            feats = model.get_image_features(**inputs)
            feats = feats / feats.norm(dim=-1, keepdim=True)
    return feats[0].float().cpu().tolist()


def similarity(a: Sequence[float], b: Sequence[float]) -> float:
    va, vb = np.asarray(a, dtype=np.float32), np.asarray(b, dtype=np.float32)
    denom = float(np.linalg.norm(va) * np.linalg.norm(vb))
    return float(va @ vb / denom) if denom else 0.0


# --------------------------------------------------------------------------- mock mode (no GPU needed)
def _mock_character(prompt: str, seed: int) -> Image.Image:
    """Procedural placeholder. Colours come from the SEED (identity), pose from the PROMPT,
    so different prompts of the same character still look like the same character."""
    rnd = random.Random(seed)

    def col(lo=40, hi=215):
        return (rnd.randint(lo, hi), rnd.randint(lo, hi), rnd.randint(lo, hi))

    skin = rnd.choice([(255, 224, 196), (241, 194, 153), (198, 134, 96), (141, 85, 54)])
    hair, outfit, pants, shoes = col(), col(), col(), col(30, 120)
    ph = int(hashlib.md5(prompt.encode()).hexdigest(), 16)
    arm = (ph % 70) - 35

    img = Image.new("RGB", (W, H), (255, 255, 255))
    d = ImageDraw.Draw(img)
    cx = W // 2
    d.rounded_rectangle([cx - 72, 490, cx - 10, 690], 22, fill=pants)
    d.rounded_rectangle([cx + 10, 490, cx + 72, 690], 22, fill=pants)
    d.rounded_rectangle([cx - 86, 670, cx - 6, 715], 18, fill=shoes)
    d.rounded_rectangle([cx + 6, 670, cx + 86, 715], 18, fill=shoes)
    d.line([cx - 92, 320, cx - 150, 450 + arm], width=38, fill=skin)
    d.line([cx + 92, 320, cx + 150, 450 - arm], width=38, fill=skin)
    d.ellipse([cx - 175, 430 + arm, cx - 125, 480 + arm], fill=skin)
    d.ellipse([cx + 125, 430 - arm, cx + 175, 480 - arm], fill=skin)
    d.rounded_rectangle([cx - 98, 290, cx + 98, 510], 44, fill=outfit)
    d.rectangle([cx - 98, 440, cx + 98, 460], fill=tuple(max(c - 40, 0) for c in outfit))
    d.rectangle([cx - 20, 255, cx + 20, 300], fill=skin)
    d.ellipse([cx - 72, 120, cx + 72, 280], fill=skin)
    d.pieslice([cx - 88, 100, cx + 88, 250], 180, 360, fill=hair)
    d.rectangle([cx - 88, 175, cx - 66, 260], fill=hair)
    d.rectangle([cx + 66, 175, cx + 88, 260], fill=hair)
    for ex in (-28, 28):
        d.ellipse([cx + ex - 11, 190, cx + ex + 11, 218], fill=(255, 255, 255))
        d.ellipse([cx + ex - 6, 196, cx + ex + 6, 214], fill=(30, 20, 60))
    d.arc([cx - 22, 220, cx + 22, 256], 20, 160, fill=(120, 40, 60), width=4)
    d.text((14, H - 22), "MOCK PREVIEW", fill=(190, 190, 205), font=ImageFont.load_default())
    return img


def _mock_inpaint(image: Image.Image, mask: Image.Image, prompt: str) -> Image.Image:
    h = hashlib.md5(prompt.encode()).digest()
    tint = (60 + h[0] % 160, 60 + h[1] % 160, 60 + h[2] % 160)
    base = image.convert("RGB")
    blended = Image.blend(base, Image.new("RGB", base.size, tint), 0.78)
    return Image.composite(blended, base, mask.convert("L").resize(base.size))
