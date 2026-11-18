-- Character builder: chosen traits (gender, skin, hair, outfit...) as JSON {groupId: optionId | optionId[]}.
-- Validated against frontend/src/lib/traits.ts (the catalogue) and turned into the AI prompt by server/ai.ts.
ALTER TABLE characters ADD COLUMN traits TEXT;
