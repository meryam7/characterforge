---
description: Run CharaForge verification (typecheck, build, API smoke test if a local server is up)
---
Run from the repo root and report pass/fail with only the relevant output:
1. `npm run typecheck`
2. `npm run build`
3. If http://127.0.0.1:8788/api/health answers: `npm run smoke`
Don't fix anything unless asked. Summarise failures as `file:line` and the error.
