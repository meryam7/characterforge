---
description: Add a full-stack API endpoint (schema → router → TS types → api client → UI)
argument-hint: <what the endpoint should do>
---
Add this feature end to end: $ARGUMENTS

Follow the "Adding a route" checklist in `server/CLAUDE.md` and the conventions in `frontend/CLAUDE.md`.
Touch only the files that need it: the right `server/routes/*.ts`, maybe `server/db.ts` and a new `migrations/*.sql`, `frontend/src/lib/types.ts`,
`lib/api.ts`, `App.tsx`, and the component.
Finish with the `/check` steps, then update `docs/API.md` (and `server/CLAUDE.md`'s route table).
