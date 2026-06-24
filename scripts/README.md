# scripts/

Browser-free tooling for uploading recipes to Cookidoo. Use this when Chrome DevTools MCP
isn't available (e.g. you only have Edge/Firefox, or no MCP configured).

Requires **Node.js 18+** (uses the built-in `fetch`).

## `upload-recipe.mjs`

Parses your Cookidoo cookies, builds the create/update payload (computing every annotation
offset with `indexOf` — never by hand), uploads, and reads the recipe back to verify.

```bash
# Validate a spec without touching the network:
node scripts/upload-recipe.mjs --recipe recipes/example-carne-louca.json --dry-run

# Create + upload:
node scripts/upload-recipe.mjs --cookies cookies.txt --recipe my-recipe.json

# Update an existing recipe (skip create):
node scripts/upload-recipe.mjs --cookies cookies.txt --recipe my-recipe.json --recipe-id 01ABC...
```

### Options

| Flag | Default | Meaning |
|---|---|---|
| `--recipe <file>` | — | Recipe spec JSON (format below). Required. |
| `--cookies <file>` | — | Netscape `cookies.txt` export **or** a file with a raw `name=value; ...` Cookie header. Required unless `--dry-run`. |
| `--host <host>` | `cookidoo.international` | The host your session cookies are scoped to. |
| `--locale <locale>` | `pt-BR` | Created-recipes locale. Must return JSON (not a 307) for your account. |
| `--recipe-id <id>` | — | PATCH an existing recipe instead of creating one. |
| `--dry-run` | — | Build + validate the payload only; no network calls. |

### Getting the cookie file

Log into Cookidoo in any browser, then either:

- copy the **`v-authenticated`** and **`_oauth2_proxy`** cookie values into a file as
  `v-authenticated=...; _oauth2_proxy=...`, or
- use a "cookies.txt" exporter extension (Netscape format) — the script filters it down to
  the Cookidoo host automatically.

> ⚠️ A full-browser `cookies.txt` export contains **every** site's cookies (banking, email,
> live sessions). Keep only the Cookidoo lines, or delete the export right after uploading.

### Which host / locale?

The created-recipes API lives on whichever host you're **logged into** — often
`cookidoo.international`, not the regional portal. Created recipes are tied to your Vorwerk
**account**, so they appear on every portal you log into regardless of which host created them.

To confirm the locale, `GET https://<host>/created-recipes/<locale>` with your cookies:
a valid locale returns a JSON `{ meta, items }` list; an unsupported one 307-redirects to
another locale (e.g. `en-US` → `/en`). Pick the locale that returns JSON.

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
