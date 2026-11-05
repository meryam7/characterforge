---
description: Add a full-stack API endpoint (schema → router → TS types → api client → UI)
argument-hint: <what the endpoint should do>
---
Add this feature end to end: $ARGUMENTS

Follow the "Adding an endpoint" checklist in `backend/CLAUDE.md` and the conventions in `frontend/CLAUDE.md`.
Touch only the files that need it: `schemas.py`, the right router, maybe `services/*`, `frontend/src/lib/types.ts`,
`lib/api.ts`, `App.tsx`, and the component.
Finish with the `/check` steps, then update `docs/API.md` (and `backend/CLAUDE.md`'s endpoint table).
