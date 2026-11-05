# AI pipeline (`backend/app/services/ai.py`)

All deep-learning code lives in this one file. It has two modes, selected by `settings.mock_ai` (env `MOCK_AI`).

## Public functions
| Function | Mock (`MOCK_AI=true`) | Real (`MOCK_AI=false`) |
|---|---|---|
| `build_prompt(description, style, extra)` | same in both: `"<desc>, <extra>, <STYLES[style]>, full body character design, single character, centered, plain white background"` | |
| `generate(prompt, negative, seed, anchor)` | `_mock_character`: procedural figure. The **seed** decides colours (identity) and the prompt hash decides arm pose | SD 1.5 `StableDiffusionPipeline`, 512×768, 30 steps, CFG 7.5, CPU generator seeded. IP-Adapter (`h94/IP-Adapter` sd15) at scale 0.6 if there's an anchor, else 0.0 with a grey dummy image |
| `inpaint(image, mask, prompt, negative, seed)` | `_mock_inpaint`: tints the masked area with a colour hashed from the prompt | SD inpainting, strength 0.9, mask grown with `MaxFilter(9)`, then **composited back so only masked pixels change**. Resized back to the original size |
| `segment(image, points)` | `_region_segment`: flood-fill (thresh 36) union of positive points minus negative regions | SAM2 `SAM2ImagePredictor` (`facebook/sam2-hiera-small`), best-scoring mask, multimask only for 1 point. **Falls back to flood-fill on ImportError** |
| `embed(image)` | 64-bin colour histogram (ignores near-white), L2-normalised | CLIP ViT-B/32 image features, L2-normalised (512-dim) |
| `similarity(a, b)` | cosine. Raises `ValueError` if the dimensions differ | |

Constants: `W, H = 512, 768`, `NEGATIVE` (shared negative prompt), `STYLES` (UI style name → prompt fragment. It must
match `frontend/src/lib/types.ts` `STYLES`).

## Identity mechanisms
1. `Character.seed` is passed to every generate and inpaint call.
2. The character description is prepended to every prompt.
3. IP-Adapter conditions generation on the anchor (reference image, else first design) when `lock_identity`.
4. CLIP `embed` + `similarity` gives the consistency score shown in the gallery. `studio.score_and_store_identity`
   sets `ch.embedding` on the first generated image if there's no reference.
5. Edits are mask-limited inpainting, so the rest of the image is pixel-identical.

## Internals and rules
- `_device()`: `settings.device` or auto (cuda → mps → cpu). fp16 on CUDA, otherwise fp32.
- Model loaders `_t2i_pipe`, `_inpaint_pipe`, `_clip` and the SAM2 predictor cache in the module-level `_cache` dict.
- `_lock` (RLock) serialises all GPU work. Keep new model calls inside it.
- Heavy imports (`torch`, `diffusers`, `transformers`, `sam2`) must stay inside functions.
- Model ids are configurable in `config.py`: `sd_model`, `inpaint_model`, `clip_model`, `sam2_model`.
- Output convention: RGB on a plain white background. `export.remove_background` flood-fills from the corners and
  depends on it.

## Enabling real AI
Install CUDA torch from pytorch.org into the venv, run `pip install -r requirements-ai.txt`, set `MOCK_AI=false` and restart.
The first call downloads several GB. CUDA OOM: lower `W, H` or close other GPU apps.
Existing data keeps working, because `studio.score_and_store_identity` re-embeds a character's anchor when the stored
vector has a different dimension (mock 64 vs CLIP 512). For production, build the image with
`--build-arg INSTALL_AI=true` on a GPU host (RunPod, Modal, a GPU VPS) and set `MOCK_AI=false`.

## Extension ideas (from the README)
LoRA per character, ControlNet poses, expression sheets, animation frames. Add them as new public functions with a
mock branch, then expose them through `routers/studio.py`.
