# Cookidoo Recipe Creator

This repo contains a Claude Code skill (`cookidoo-recipe.md`) that converts recipes to Thermomix format and uploads them to Cookidoo.

## Key files

- `cookidoo-recipe.md` — the skill definition (instructions, API format, rules)
- `scripts/upload-recipe.mjs` — browser-free uploader (parses cookies, computes offsets, POST/PATCH/verify)
- `scripts/lib/env.mjs` — `.env` parser (no dotenv); `scripts/test-env.mjs` is its check — `node scripts/test-env.mjs`
- `.env.example` — config template; `cp .env.example .env` sets `COOKIES_FILE` / `COOKIDOO_HOST` / `COOKIDOO_LOCALE`
- `recipes/example-carne-louca.json` — reference example recipe spec for the uploader (Carne Louca, 1.3 kg; exercises searing, batching, spoon speed, Varoma)

## Important rules

- **Annotations are MANDATORY** — every PATCH to Cookidoo must include `INGREDIENT` and `TTS` annotations with correct offset/length. Never send plain text steps.
- **Compute annotation offsets in code** (`text.indexOf(ref)` / `ref.length`), never by hand.
- **Ingredient steps and machine actions must be separate steps** — never combine "Coloque X" with "Misture Y seg/vel Z" in the same step.
- **Do NOT save recipe files locally** unless the user explicitly asks.
- **Default language is pt-BR**, default model is TM7.
- **Upload host is `cookidoo.international` with locale `pt-BR`** (verified for this account — the regional `cookidoo.pt` host does *not* receive this account's auth cookies). Created recipes are account-bound, so they still appear on cookidoo.pt. These are the defaults in `.env.example`.
- **Always run `node scripts/upload-recipe.mjs --check-auth` before uploading.** It's the gate: one GET, creates nothing, and reports expired cookies by name and age. Never debug a failed upload before this passes.
- **Config comes from `.env`** (`COOKIES_FILE`, `COOKIDOO_HOST`, `COOKIDOO_LOCALE`), so uploads need no flags — just `--recipe`. Precedence: CLI flag > env var > `.env` > default. No `dotenv` dependency and no `package.json`; keep the repo install-free.
- **Cookie files live in the project root.** `.gitignore` covers any root filename containing "cookie", plus `.env`.
- **The domain of `v-authenticated` / `_oauth2_proxy` in the export IS the host to use.** Every other Cookidoo cookie is noise. Read it with `awk -F'\t' '$6=="v-authenticated" || $6=="_oauth2_proxy" {print $1, $6, strftime("%Y-%m-%d", $5)}' cookies.txt` — field 1 = domain, 5 = expiry, 6 = name. **Never read or print field 7 (the value).**
- **Locale depends on the host.** `cookidoo.international` → `pt-BR` works, `en-US` redirects. `cookidoo.thermomix.com` → the reverse. Resolve the host first, then let a 307's `Location` name the locale.
- **Always trim a full-browser export before use** — `grep -iE 'cookidoo|thermomix|vorwerk' export.txt > cookies.txt`. Untrimmed, it contains banking, email and password-manager sessions.
- **No Chrome on this machine (Edge only)** — prefer the browser-free path: cookie file + `scripts/upload-recipe.mjs` (Node 18+). The auth cookies are `v-authenticated` and `_oauth2_proxy`.
