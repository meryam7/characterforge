---
description: Bring the AI-facing docs back in line with the code after changes
argument-hint: [files or area that changed]
---
Delegate to the `docs-keeper` subagent: "Docs may have drifted. Changed area: $ARGUMENTS. Verify every symbol, path,
endpoint and command named in CLAUDE.md, server/CLAUDE.md, frontend/CLAUDE.md and docs/*.md for that area, and fix
the inaccurate lines only."
Then relay its report in 3–6 bullets.
