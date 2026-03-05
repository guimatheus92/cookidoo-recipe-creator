# Cookidoo Recipe Creator for Thermomix

Convert any recipe from the web into Thermomix format and upload it directly to your [Cookidoo](https://cookidoo.thermomix.com) account — all through [Claude Code](https://docs.anthropic.com/en/docs/claude-code) + Chrome DevTools MCP.

**Supports:** TM7 &bull; TM6 &bull; TM5 &bull; TM31 &bull; 8 languages

![Thermomix Models](https://img.shields.io/badge/Thermomix-TM7%20%7C%20TM6%20%7C%20TM5%20%7C%20TM31-green)
![Languages](https://img.shields.io/badge/Languages-PT%20%7C%20EN%20%7C%20DE%20%7C%20ES%20%7C%20FR%20%7C%20IT-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## What does this do?

1. You share a recipe — a **URL**, **pasted text**, **screenshot**, or **PDF**
2. Claude converts it to Thermomix format (speeds, times, temperatures)
3. Uploads it directly to your Cookidoo account via API
4. Also generates `.md` and `.pdf` files for printing

---

## Quick Start

### Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed
- A [Cookidoo](https://cookidoo.thermomix.com) account with active subscription
- Google Chrome browser (**only required for Cookidoo upload** — not needed if you just want `.md` / `.pdf` output)

### 1. Install Chrome DevTools MCP

Add to your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/chrome-devtools-mcp@latest"]
    }
  }
}
```

> For full setup instructions, see the [Chrome DevTools MCP docs](https://github.com/anthropics/anthropic-devtools-mcp).

### 2. Open Chrome with remote debugging

**Windows** — Create a shortcut with this target:
```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

**Mac** — Run in terminal:
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
```

**Linux** — Run in terminal:
```bash
google-chrome --remote-debugging-port=9222
```

### 3. Add the skill to Claude Code

Copy the `cookidoo-recipe.md` file from this repo to your Claude Code skills directory:

```bash
# Create skills directory if it doesn't exist
mkdir -p ~/.claude/skills

# Download the skill
curl -o ~/.claude/skills/cookidoo-recipe.md https://raw.githubusercontent.com/guimatheus92/cookidoo-recipe-creator/main/cookidoo-recipe.md
```

### 4. Use it

1. Open Chrome (with the debugging shortcut)
2. Go to your Cookidoo site and **log in**
3. In Claude Code, say:

```
Convert this recipe for my Thermomix TM7 and upload to Cookidoo:
https://example.com/chocolate-cake-recipe
```

Or paste the recipe text directly:

```
Convert this to TM7 and upload to Cookidoo:

Ingredients: 200g flour, 100g sugar, 2 eggs, 150g butter...
Instructions: Mix flour and sugar, add eggs...
```

Claude will ask you to confirm the model, language, and servings, then handle everything automatically.

---

## How It Works

### 1. Recipe Conversion

Claude converts standard recipes to Thermomix format using these typical operations:

| Operation | Thermomix Setting |
|---|---|
| Chop/grind | 5-10 sec / speed 7-10 |
| Mix dry ingredients | 5 sec / speed 4 |
| Cream butter + sugar | 1 min / speed 4 |
| Add egg/liquids | 20 sec / speed 3 |
| Fold in dry ingredients | 15 sec / speed 2, reverse |
| Add chunks (don't crush) | 10 sec / speed 1, reverse |
| Knead dough | 2 min / knead mode |
| Cook/sauté | X min / temp°C / speed 1 |
| Steam (Varoma) | X min / Varoma / speed 1 |

### 2. The Cookidoo API

Cookidoo doesn't provide a public API, but the web app uses internal REST endpoints that we can call from the browser context. This project uses two endpoints:

**Create a recipe:**
```
POST /created-recipes/{locale}
Body: { "recipeName": "My Recipe" }
```

**Update a recipe (ingredients, steps, metadata):**
```
PATCH /created-recipes/{locale}/{recipeId}
Body: {
  ingredients: [{ type: "INGREDIENT", text: "228 g flour" }],
  instructions: [{ type: "STEP", text: "Add flour. Mix 5 sec/speed 4." }],
  tools: ["TM7"],
  totalTime: 9000,  // seconds
  prepTime: 1200,   // seconds
  yield: { value: 4, unitText: "portion" }
}
```

Authentication is handled automatically through browser cookies when using Chrome DevTools MCP.

### 3. Output

Claude generates three things:
- **Cookidoo recipe** — uploaded directly to your account (if browser connected)
- **Markdown file** (`.md`) — full recipe with ingredients table and numbered steps
- **PDF file** (`.pdf`) — formatted for printing

---

## Supported Models

| Feature | TM7 | TM6 | TM5 | TM31 |
|---|:---:|:---:|:---:|:---:|
| Max temperature | 180°C | 160°C | 120°C | 100°C |
| Guided cooking | Yes | Yes | No | No |
| Slow cook mode | Yes | Yes | No | No |
| Built-in scale | Yes | Yes | Yes | No |
| Reverse blade | Yes | Yes | Yes | Yes |
| Max speed | 10 | 10 | 10 | 10 |

> If a recipe requires temperatures above your model's limit (e.g., 180°C on a TM5), Claude will suggest using the oven for that step instead.

---

## Supported Languages

| Language | Cookidoo Domain | Locale |
|---|---|---|
| Portuguese (Portugal) | cookidoo.pt | pt-PT |
| Portuguese (Brazil) | cookidoo.com.br | pt-BR |
| English (US) | cookidoo.thermomix.com | en-US |
| English (UK) | cookidoo.co.uk | en-GB |
| German | cookidoo.de | de-DE |
| Spanish | cookidoo.es | es-ES |
| French | cookidoo.fr | fr-FR |
| Italian | cookidoo.it | it-IT |

---

## Alternative Setup (No Chrome / No MCP)

Google Chrome and the DevTools MCP are **only required if you want to upload recipes directly to Cookidoo**. There are three usage modes:

| Mode | Chrome needed? | MCP needed? | What you get |
|---|:---:|:---:|---|
| **Full (recommended)** | Yes | Yes | Cookidoo upload + `.md` + `.pdf` |
| **Manual cookie** | Any browser | No | Cookidoo upload + `.md` + `.pdf` |
| **Offline** | No | No | `.md` + `.pdf` only |

### Manual cookie approach

If you don't want to install Chrome DevTools MCP, you can manually provide the auth cookie from **any browser** (Chrome, Firefox, Edge, Safari):

1. Open Cookidoo in your browser and log in
2. Press **F12** to open Developer Tools
3. Go to **Application** tab (Chrome/Edge) or **Storage** tab (Firefox) &rarr; **Cookies** &rarr; click your Cookidoo domain
4. Find the cookie named `v-authenticated`
5. Copy its value and share it with Claude

> The cookie expires after some time, so you may need to repeat this.

---

## Offline Mode (No Cookidoo Upload)

If you just want the recipe converted without uploading to Cookidoo:

```
Convert this recipe for my Thermomix TM6, just generate the files:
https://example.com/pasta-recipe
```

Claude will generate:
- A `.md` file with the full recipe
- A `.pdf` file for printing

No browser setup required for this mode.

---

## FAQ

### General

**Q: Is this an official Thermomix/Cookidoo product?**
No. This is a community project that uses Cookidoo's internal web API. It is not endorsed by or affiliated with Vorwerk, Thermomix, or Cookidoo.

**Q: Do I need a Cookidoo subscription?**
Yes. You need an active Cookidoo subscription to create and save custom recipes. The "Created Recipes" feature requires a paid plan.

**Q: Is this free?**
This skill itself is free and open source. You need a [Claude Code](https://docs.anthropic.com/en/docs/claude-code) subscription and a Cookidoo subscription.

**Q: Can I convert recipes from any website?**
Yes. Claude accepts recipes in multiple formats: a **URL** (from any cooking website), **pasted text** (copy from a book, message, or app), a **screenshot** (photo of a recipe card or book page), or a **PDF**. It works with all major recipe websites and any language — Claude translates and converts automatically.

**Q: Do I need to know programming?**
No. Once the initial setup is done (one-time), you just talk to Claude in natural language. Claude handles all the API calls internally.

### Recipe Conversion

**Q: What if the recipe uses cups/tablespoons instead of grams?**
Claude automatically converts common measurements to grams where possible. For ingredients that don't have a standard weight (e.g., "1 pinch of salt"), it keeps the original measurement.

**Q: Can I adjust the number of servings?**
Yes. Tell Claude how many servings you want and it will scale the ingredient quantities accordingly.

**Q: Will the Thermomix speeds and times be accurate?**
Claude uses standard Thermomix operation guidelines, but these are estimates. You may want to adjust based on your specific ingredients, quantities, and preferences. Always monitor the first time you make a recipe.

**Q: What if a recipe requires temperatures above my model's limit?**
Claude will adapt the recipe. For example, if you have a TM5 (max 120°C) and the recipe needs 180°C, Claude will suggest using an oven for that step instead.

**Q: Can I add a photo to the recipe?**
Not via the API currently. After uploading, you can add a photo manually through the Cookidoo web interface or app by clicking "Carregar imagem" (Upload image) on the recipe page.

### Cookidoo Integration

**Q: Why don't my ingredients show the weight separately (like official recipes)?**
This is a Cookidoo platform limitation. Official Vorwerk recipes have structured quantity/unit/name fields with weight aligned to the right. Custom ("Created") recipes only support plain text ingredients. The recipe still works perfectly for cooking.

**Q: Will guided cooking work on my Thermomix?**
Guided cooking (step-by-step on the touchscreen) works on **TM7 and TM6** only. TM5 and TM31 don't have touchscreens, but you can still follow the recipe from the Cookidoo app on your phone/tablet.

**Q: Will my recipe sync to my Thermomix device?**
Yes. Once saved in Cookidoo, the recipe appears in your "Created Recipes" section and syncs to your Thermomix (TM7/TM6) via Wi-Fi, just like any other Cookidoo recipe.

**Q: Can I import multiple recipes at once?**
Currently, one recipe at a time. Each recipe requires a separate conversion and upload.

**Q: Will my account get banned for using the API?**
This project uses the same API calls that the Cookidoo web app makes in your browser. It's equivalent to you manually filling in the forms. However, since this is not an official API, use it responsibly and at your own risk.

**Q: Can I share my created recipes with others?**
Yes. Cookidoo has a "Partilhar" (Share) feature for created recipes. After uploading, go to your recipe and use the share option.

### Troubleshooting

**Q: Claude says it can't connect to the browser.**
Make sure Chrome is running with `--remote-debugging-port=9222` and that you restarted Claude Code after adding the MCP configuration.

**Q: The API returns a 401 or 403 error.**
Your Cookidoo session may have expired. Refresh the Cookidoo page in Chrome and log in again.

**Q: The recipe was created but ingredients are empty.**
The PATCH may have failed silently. Ask Claude to retry the PATCH call. The API is idempotent, so it's safe to re-run.

**Q: I see the recipe in Cookidoo but not on my Thermomix.**
Make sure your Thermomix is connected to Wi-Fi and synced with Cookidoo. Go to the recipe in Cookidoo and click "Concluído" (Done) to finalize it, then sync your device.

---

## References

### Tools
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — Anthropic's CLI for Claude
- [Chrome DevTools MCP (GitHub)](https://github.com/anthropics/anthropic-devtools-mcp) — Browser automation for AI agents
- [Chrome DevTools MCP (npm)](https://www.npmjs.com/package/@anthropic-ai/chrome-devtools-mcp) — npm package
- [Chrome DevTools MCP (blog)](https://developer.chrome.com/blog/chrome-devtools-mcp) — Official Chrome announcement

### Cookidoo Official
- [Cookidoo Help Center](https://support.vorwerk.com/hc/en-us/categories/360002717300-COOKIDOO)
- [Created Recipes Overview](https://support.vorwerk.com/hc/en-us/sections/4404592060050-Cookidoo-Created-Recipes)
- [Created Recipes Basics](https://support.vorwerk.com/hc/en-us/articles/4404599366674-Basic-information-about-Cookidoo-Created-Recipes)
- [Created Recipes + Device](https://support.vorwerk.com/hc/en-us/articles/4404599417362-My-Created-recipes-and-my-Thermomix-device)
- [Importing Recipes](https://cookidoo.thermomix.com/foundation/en-US/articles/learn-about-importing-recipes)
- [Discover Created Recipes](https://cookidoo.thermomix.com/foundation/en-US/pages/discover-created-recipes)
- [Tutorial: Adding Ingredients & Steps (Basic)](https://cookidoo.thermomix.com/foundation/tutorials/en-US/courses/how-to-edit/edit-addingingredientandstepbasics)
- [Tutorial: Adding Ingredients & Steps (Advanced)](https://cookidoo.thermomix.com/foundation/tutorials/en-US/courses/how-to-edit/edit-addingingredientandstepadvanced)

### Community / Unofficial API
- [cookiput](https://github.com/croeer/cookiput) — Python tool for importing recipes via API (JSON payload examples)
- [cookidoo-api](https://github.com/miaucl/cookidoo-api) — Unofficial Python API client (intercepted requests)
- [AIdoo](https://aidoo.tools/) — AI-powered recipe converter for Thermomix

### Cookidoo Regional Portals
[Portugal](https://cookidoo.pt) &bull; [Brasil](https://cookidoo.com.br) &bull; [US](https://cookidoo.thermomix.com) &bull; [UK](https://cookidoo.co.uk) &bull; [Germany](https://cookidoo.de) &bull; [Spain](https://cookidoo.es) &bull; [France](https://cookidoo.fr) &bull; [Italy](https://cookidoo.it)

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Disclaimer

This project is not affiliated with, endorsed by, or connected to Vorwerk, Thermomix, Cookidoo, or any of their subsidiaries. Thermomix and Cookidoo are registered trademarks of Vorwerk International. This tool interacts with Cookidoo's web interface in the same way a user would manually — no proprietary systems are reverse-engineered or bypassed. Use at your own risk.
