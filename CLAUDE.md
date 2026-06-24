# Cookidoo Recipe Creator

This repo contains a Claude Code skill (`cookidoo-recipe.md`) that converts recipes to Thermomix format and uploads them to Cookidoo.

## Key files

- `cookidoo-recipe.md` — the skill definition (instructions, API format, rules)
- `scripts/upload-recipe.mjs` — browser-free uploader (parses cookies, computes offsets, POST/PATCH/verify)
- `recipes/example-carne-louca.json` — reference example recipe spec for the uploader (Carne Louca, 1.3 kg; exercises searing, batching, spoon speed, Varoma)

## Important rules

- **Annotations are MANDATORY** — every PATCH to Cookidoo must include `INGREDIENT` and `TTS` annotations with correct offset/length. Never send plain text steps.
- **Compute annotation offsets in code** (`text.indexOf(ref)` / `ref.length`), never by hand.
- **Ingredient steps and machine actions must be separate steps** — never combine "Coloque X" with "Misture Y seg/vel Z" in the same step.
- **Do NOT save recipe files locally** unless the user explicitly asks.
- **Default language is pt-BR**, default model is TM7.
- **Upload host is `cookidoo.international` with locale `pt-BR`** (verified for this account — the regional `cookidoo.pt` host does *not* receive this account's auth cookies). Created recipes are account-bound, so they still appear on cookidoo.pt. Confirm with `GET /created-recipes/pt-BR` returning JSON before uploading.
- **No Chrome on this machine (Edge only)** — prefer the browser-free path: cookie file + `scripts/upload-recipe.mjs` (Node 18+). The auth cookies are `v-authenticated` and `_oauth2_proxy`.
