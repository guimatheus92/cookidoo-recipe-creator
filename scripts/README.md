# scripts/

Browser-free tooling for uploading recipes to Cookidoo. Use this when Chrome DevTools MCP
isn't available (e.g. you only have Edge/Firefox, or no MCP configured).

Requires **Node.js 18+** (uses the built-in `fetch`).

## `upload-recipe.mjs`

Parses your Cookidoo cookies, builds the create/update payload (computing every annotation
offset with `indexOf` — never by hand), uploads, and reads the recipe back to verify.

```bash
# One-time setup: copy the config template, then drop your cookie export in the project root.
cp .env.example .env

# Check that your session actually works (no recipe needed, creates nothing):
node scripts/upload-recipe.mjs --check-auth

# Validate a spec without touching the network:
node scripts/upload-recipe.mjs --recipe recipes/example-carne-louca.json --dry-run

# Create + upload:
node scripts/upload-recipe.mjs --recipe my-recipe.json

# Update an existing recipe (skip create):
node scripts/upload-recipe.mjs --recipe my-recipe.json --recipe-id 01ABC...
```

### Configuration (`.env`)

Copy [`.env.example`](../.env.example) to `.env` in the project root. All three settings are
optional — the values shown are the defaults.

| Variable | Default | Meaning |
|---|---|---|
| `COOKIES_FILE` | `cookies.txt` | Cookie file path. Relative paths resolve from the project root. |
| `COOKIDOO_HOST` | `cookidoo.international` | Host your session cookies are scoped to. |
| `COOKIDOO_LOCALE` | `pt-BR` | Created-recipes locale. Must return JSON (not a 307) for your account. |

**Precedence:** CLI flag > real environment variable > `.env` > default.

The parser lives in [`lib/env.mjs`](lib/env.mjs) and is covered by
[`test-env.mjs`](test-env.mjs) — 21 assertions over quoting, inline comments, `=` in values,
Windows paths, and the precedence rule. No framework, no install:

```bash
node scripts/test-env.mjs      # -> ".env parser: 21 checks passed", exit 0
```

`.env` and any root file whose name contains "cookie" (`cookies.txt`, `meus-cookies.json`, …)
are already in [`.gitignore`](../.gitignore), so you can keep your cookie export in the repo
without risking a commit. No `dotenv` dependency — the script parses `.env` itself.

### Options

| Flag | Default | Meaning |
|---|---|---|
| `--recipe <file>` | — | Recipe spec JSON (format below). Required except with `--check-auth`. |
| `--cookies <file>` | `COOKIES_FILE`, else `cookies.txt` | Netscape `cookies.txt` export **or** a file with a raw `name=value; ...` Cookie header. |
| `--host <host>` | `COOKIDOO_HOST`, else `cookidoo.international` | The host your session cookies are scoped to. |
| `--locale <locale>` | `COOKIDOO_LOCALE`, else `pt-BR` | Created-recipes locale. |
| `--recipe-id <id>` | — | PATCH an existing recipe instead of creating one. |
| `--check-auth` | — | Verify the session against the host/locale and exit. No recipe needed, uploads nothing. |
| `--dry-run` | — | Build + validate the payload only; no network calls. |
| `--out <file>` | — | Write `{recipeId, url}` JSON here after a successful upload. |

### Getting the cookie file

Log into Cookidoo in any browser, then either:

- copy the **`v-authenticated`** and **`_oauth2_proxy`** cookie values into a file as
  `v-authenticated=...; _oauth2_proxy=...`, or
- use a "cookies.txt" exporter extension (Netscape format) — the script filters it down to
  the Cookidoo host automatically.

Save it as `cookies.txt` in the project root (already gitignored), or point `COOKIES_FILE`
at it. Then confirm it works:

```bash
$ node scripts/upload-recipe.mjs --check-auth
Cookie file: /path/to/cookies.txt (from COOKIES_FILE) — 11 cookie(s) for cookidoo.international
GET https://cookidoo.international/created-recipes/pt-BR
-> 200 OK | application/json
AUTH OK — session is valid. 7 created recipe(s) on this account.
```

Sessions expire after a few weeks. When they do, `--check-auth` reads the expiry straight out
of the export and tells you outright:

```text
AUTH FAILED — your cookies are expired: v-authenticated (expired 23d ago), _oauth2_proxy (expired 23d ago).
Log into https://cookidoo.international again and re-export to /path/to/cookies.txt.
```

Exit codes: `0` = OK, `1` = auth failed, `2` = bad arguments or missing cookie file.

> ⚠️ A full-browser `cookies.txt` export contains **every** site's cookies — banking, email,
> password managers, cloud consoles. **Trim it before use**, keeping only the Cookidoo lines:
>
> ```bash
> grep -iE 'cookidoo|thermomix|vorwerk' export.txt > cookies.txt
> ```
>
> A real export in this project went from 3153 lines to 48 that way. Delete the untrimmed
> export afterwards.

### What to look for in the cookie file

The Netscape format is 7 tab-separated fields; only three matter here:

```text
domain              flag  path  secure  expiry       name             value
.cookidoo.thermomix.com  TRUE  /   TRUE  1789593600  v-authenticated  eyJ...
^-- field 1                              ^-- field 5  ^-- field 6
```

**The domain of `v-authenticated` / `_oauth2_proxy` is your `COOKIDOO_HOST`.** Those two are
the session; every other Cookidoo cookie is consent/telemetry noise. Whichever domain they sit
on is the only host that will accept your session — pointing at a different portal gets a 401
no matter how fresh the cookies are.

Inspect an export without ever printing a secret:

```bash
# Which host owns your session, and when does it die?
awk -F'\t' '$6=="v-authenticated" || $6=="_oauth2_proxy" {
  printf "%-30s %-16s expires %s\n", $1, $6, strftime("%Y-%m-%d", $5) }' cookies.txt
```

```text
.cookidoo.thermomix.com        v-authenticated  expires 2026-09-16
.cookidoo.thermomix.com        _oauth2_proxy    expires 2026-09-16
```

That output says: set `COOKIDOO_HOST=cookidoo.thermomix.com` (strip the leading dot). If the
command prints nothing, the export has no Cookidoo session in it — you exported from a browser
profile that isn't logged in, or from the wrong portal.

### Which host / locale?

The created-recipes API lives on whichever host you're **logged into** — often
`cookidoo.international` or `cookidoo.thermomix.com`, not your regional portal. Created recipes
are tied to your Vorwerk **account**, so they appear on every portal you log into regardless of
which host created them; host and locale only decide which API accepts the request.

`--check-auth` distinguishes all three outcomes, so you never have to guess:

| Response | Meaning | Fix |
|---|---|---|
| **200 + JSON** | Host and locale both correct. | Nothing — upload away. |
| **307 redirect** | Host is right (your session was accepted), locale isn't enabled for it. | Use the locale in the printed `Redirects to:` line. |
| **401** | Cookies not valid for this host — wrong host, or expired. | Check the domain (above); the script names expired cookies with their age. |

Worked example — resolving a session in two steps:

```console
$ node scripts/upload-recipe.mjs --check-auth --host cookidoo.thermomix.com
-> 307 Temporary Redirect | (none)
Redirects to: /created-recipes/en-US        # <- the locale it wants

$ node scripts/upload-recipe.mjs --check-auth --host cookidoo.thermomix.com --locale en-US
-> 200 OK | application/json; charset=utf-8
AUTH OK — session is valid. 0 created recipe(s) on this account.
```

Then write the pair that worked into `.env` so it's settled for good.

## Recipe spec format

A spec is JSON. Quantities in steps must match the ingredient strings **exactly** so Cookidoo
can link them. The script computes annotation offsets from `ings` and `tts.snippet`.

```jsonc
{
  "name": "Recipe name",
  "model": "TM7",                       // TM7 | TM6 | TM5 | TM31
  "prepTime": 1200,                     // seconds (active work)
  "totalTime": 9000,                    // seconds (incl. cooking/waiting)
  "yield": { "value": 4, "unitText": "portion" },
  "ingredients": [
    "228 g de farinha de trigo",
    "3 g de sal"
  ],
  "steps": [
    {
      "text": "Coloque no copo 228 g de farinha de trigo e 3 g de sal.",
      "ings": ["228 g de farinha de trigo", "3 g de sal"]   // INGREDIENT annotations
    },
    {
      "text": "Misture 5 seg/velocidade 4.",
      "tts": { "snippet": "5 seg/velocidade 4", "speed": "4", "time": 5 }  // TTS annotation
    },
    {
      "text": "Cozinhe 8 min/90°C/velocidade 4.",
      "tts": { "snippet": "8 min/90°C/velocidade 4", "speed": "4", "time": 480, "temp": "90" }
    }
  ]
}
```

Rules (see [`../cookidoo-recipe.md`](../cookidoo-recipe.md) for the full reference):

- **Ingredient steps and machine actions are separate steps.** Never combine "add X" with "mix Y sec/speed Z".
- `time` is always in **seconds** (8 min → 480).
- `temp` is optional; include it only when the step sets a temperature.
- **Special settings** keep the human wording in `text` and use safe metadata in `tts`:
  - reverse → `sentido anti-horário` in the text, no extra field;
  - spoon speed → `velocidade colher` in the text, `"speed": "1"` in `tts`;
  - Varoma → `Varoma` in the text, omit `temp`.

[`../recipes/example-carne-louca.json`](../recipes/example-carne-louca.json) is a complete, real
example (Carne Louca, 1.3 kg) that exercises searing, batching, spoon speed, and Varoma.
