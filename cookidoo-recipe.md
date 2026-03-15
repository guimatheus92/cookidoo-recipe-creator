# Cookidoo Recipe Creator (Thermomix)

Convert any recipe to Thermomix format and upload directly to Cookidoo via API.

## Parameters

Ask the user (or use defaults) before starting:

| Parameter | Options | Default |
|---|---|---|
| **Model** | TM7, TM6, TM5, TM31 | TM7 |
| **Language** | pt-PT, pt-BR, en-US, en-GB, de-DE, es-ES, fr-FR, it-IT | pt-PT |
| **Servings** | any number | from original recipe |
| **Upload to Cookidoo?** | yes / no (just generate .md + .pdf) | yes |
| **Recipe image** | URL, file path, or "generate" | generate |

### Model differences

| Feature | TM7 | TM6 | TM5 | TM31 |
|---|---|---|---|---|
| Max speed | 10 | 10 | 10 | 10 |
| Max temp | 180°C | 160°C | 120°C | 100°C |
| Reverse blade | yes | yes | yes | yes |
| Guided cooking | yes (touchscreen) | yes (touchscreen) | no | no |
| Slow cook mode | yes | yes | no | no |
| Built-in scale | yes | yes | yes | no |

### Language → Cookidoo domain & locale mapping

| Language | Domain | Locale | Ingredient format |
|---|---|---|---|
| pt-PT | cookidoo.pt | pt-PT | `228 g de farinha de trigo` |
| pt-BR | cookidoo.com.br | pt-BR | `228 g de farinha de trigo` |
| en-US | cookidoo.thermomix.com | en-US | `228 g all-purpose flour` |
| en-GB | cookidoo.co.uk | en-GB | `228 g plain flour` |
| de-DE | cookidoo.de | de-DE | `228 g Mehl` |
| es-ES | cookidoo.es | es-ES | `228 g de harina de trigo` |
| fr-FR | cookidoo.fr | fr-FR | `228 g de farine de blé` |
| it-IT | cookidoo.it | it-IT | `228 g di farina` |

### TM step vocabulary by language

| Concept | pt-PT / pt-BR | en-US / en-GB | de-DE | es-ES | fr-FR | it-IT |
|---|---|---|---|---|---|---|
| seconds | seg | sec | Sek | seg | sec | sec |
| speed | vel | speed | Stufe | vel | vitesse | vel |
| reverse | sentido anti-horário | reverse | Linkslauf | giro inverso | sens inverse | senso antiorario |
| temperature | °C | °C | °C | °C | °C | °C |
| minutes | min | min | Min | min | min | min |

## Setup for Cookidoo Upload (step-by-step for beginners)

There are two ways to connect to Cookidoo. Option A is recommended.

### Option A: Chrome DevTools MCP (recommended)

This lets Claude interact directly with your browser — no manual cookie copying needed.

**One-time setup:**

1. Install the Chrome DevTools MCP server in your Claude Code settings (`~/.claude/settings.json`):

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

2. Open Google Chrome with remote debugging enabled:
   - **Windows**: Create a shortcut with target:
     `"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222`
   - **Mac**: Run in terminal:
     `/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222`
3. Restart Claude Code so the MCP server connects

**Each time you want to upload a recipe:**

1. Open Chrome (with the debugging shortcut from step 2)
2. Go to your Cookidoo site (e.g., cookidoo.pt) and **log in**
3. Tell Claude: "Upload this recipe to Cookidoo" — Claude will handle the rest via the browser

### Option B: Manual cookie (advanced)

If you don't have Chrome DevTools MCP, you can manually provide the auth cookie:

1. Open Cookidoo in any browser and log in
2. Press **F12** to open Developer Tools
3. Go to **Application** tab → **Cookies** → click your cookidoo domain
4. Find the cookie named `v-authenticated` (or `_oauth2_proxy`)
5. Copy its value and share it with Claude

> Note: this cookie expires after some time, so you may need to repeat this.

### No setup needed for .md/.pdf only

If you just want the recipe converted (no Cookidoo upload), no setup is required. Just share the recipe URL or text.

## Prerequisites summary

| Mode | What you need |
|---|---|
| .md + .pdf only | Nothing — just share the recipe |
| Cookidoo upload (Option A) | Chrome DevTools MCP + logged into Cookidoo in Chrome |
| Cookidoo upload (Option B) | Auth cookie from browser DevTools |

## Workflow

### 1. Get the recipe

Fetch the recipe URL with WebFetch, extract all ingredients with exact measurements and all steps.

### 2. Ask parameters

If not provided, ask which **model**, **language**, and **servings** to use.

### 3. Convert to Thermomix format

- Convert all measurements to grams where possible
- Adapt step vocabulary to chosen language
- Respect model temperature limits (e.g. TM5 max 120°C — suggest oven for higher temps)
- Write Thermomix-specific steps: `X seg/vel Y`, `X min/vel Y`
- Calculate prep time (active TM work) and total time (including wait/oven/freezer)

#### Step structure rules (CRITICAL for Cookidoo rendering)

Cookidoo uses **annotations** to link ingredient references and Thermomix actions in preparation steps. Without annotations, ingredients appear as plain text. With annotations, they render as **bold/highlighted** and are linked to the ingredients list. This is MANDATORY for every recipe.

There are two annotation types:

- `INGREDIENT` — links text in a step to an ingredient from the list
- `TTS` (Thermomix Time/Speed) — marks machine actions (speed, time, temperature)

Follow these 3 rules when writing steps:

##### Rule 1: Ingredients go in a separate step BEFORE the machine action

WRONG (single step):
> "Coloque no copo 228 g de farinha de trigo, o 3 g de bicarbonato de sódio e o 3 g de sal. Misture 5 seg/velocidade 4."

RIGHT (two steps):
> Step N: "Coloque no copo **228 g de farinha de trigo**, o **3 g de bicarbonato de sódio** e o **3 g de sal**."
> Step N+1: "Misture **5 seg/velocidade 4**."

##### Rule 2: Machine actions (speed/time) are always a separate step

Any instruction with `seg/velocidade`, `min/velocidade`, or temperature must be its own step. This prevents the Thermomix action from appearing as if it were an ingredient reference.

WRONG:
> "Adicione 1 ovo e 6 g de extrato de baunilha. Bata por 20 seg/velocidade 3."

RIGHT:
> Step N: "Adicione **1 ovo** e **6 g de extrato de baunilha**."
> Step N+1: "Bata por **20 seg/velocidade 3**."

##### Rule 3: Use exact quantities from the ingredients list

When referencing ingredients in steps, always use the exact same quantity and text from the ingredients list so Cookidoo can auto-link them. For example, if the ingredient is `143 g de manteiga sem sal, em temperatura ambiente`, the step should say `143 g de manteiga sem sal, em temperatura ambiente` — not just `a manteiga`.

#### Annotations format (MANDATORY for PATCH API)

Every instruction sent via PATCH **MUST** include annotations. Calculate `offset` (0-based character position in the step text) and `length` (number of characters) for each annotation.

##### INGREDIENT annotation

Links a text span in the step to an ingredient from the ingredients list. The `description` must match the ingredient text exactly.

```json
{
  "type": "INGREDIENT",
  "data": { "description": "500 g de leite integral" },
  "position": { "offset": 16, "length": 23 }
}
```

Example: in the text `"Coloque no copo 500 g de leite integral e 3 gemas."`:

- `"500 g de leite integral"` starts at offset 16, length 23
- `"3 gemas"` starts at offset 42, length 7

##### TTS annotation (Thermomix Time/Speed)

Marks a machine action with speed, time (in seconds), and optional temperature.

```json
{
  "type": "TTS",
  "data": {
    "speed": "4",
    "time": 480,
    "temperature": { "value": "90", "unit": "C" }
  },
  "position": { "offset": 8, "length": 23 }
}
```

- `time`: always in seconds (e.g. 8 min = 480, 10 seg = 10)
- `speed`: string value ("1" to "10")
- `temperature`: optional object with `value` (string) and `unit` ("C")
- For steps without temperature (e.g. "Misture 10 seg/velocidade 3."), omit `temperature`

##### Full instruction example with annotations

```json
{
  "instructions": [
    {
      "type": "STEP",
      "text": "Coloque no copo 500 g de leite integral, 395 g de leite condensado e 3 gemas.",
      "annotations": [
        { "type": "INGREDIENT", "data": { "description": "500 g de leite integral" }, "position": { "offset": 16, "length": 23 } },
        { "type": "INGREDIENT", "data": { "description": "395 g de leite condensado" }, "position": { "offset": 41, "length": 25 } },
        { "type": "INGREDIENT", "data": { "description": "3 gemas" }, "position": { "offset": 69, "length": 7 } }
      ]
    },
    {
      "type": "STEP",
      "text": "Cozinhe 8 min/90°C/velocidade 4.",
      "annotations": [
        { "type": "TTS", "data": { "speed": "4", "time": 480, "temperature": { "value": "90", "unit": "C" } }, "position": { "offset": 8, "length": 23 } }
      ]
    },
    {
      "type": "STEP",
      "text": "Transfira para um recipiente e reserve na geladeira.",
      "annotations": []
    }
  ]
}
```

##### How to calculate offset and length

1. Write the full step text first
2. Find where each ingredient/TTS reference starts (0-based index)
3. Count the number of characters in the reference
4. The `description` in INGREDIENT annotations must match the ingredient text from the `ingredients` array exactly

#### Typical Thermomix operations

| Operation | Setting |
|---|---|
| Chop/grind | 5-10 seg/vel 7-10 |
| Mix dry ingredients | 5 seg/vel 4 |
| Cream butter + sugar | 1 min/vel 4 |
| Add egg/liquids | 20 seg/vel 3 |
| Fold in dry ingredients | 15 seg/vel 2, reverse |
| Add chunks (don't crush) | 10 seg/vel 1, reverse (or manually) |
| Knead dough | 2 min/knead mode |
| Cook/sauté | X min/temp°C/vel 1 |
| Boil | X min/100°C/vel 1 |
| Steam (Varoma) | X min/Varoma/vel 1 |

### 4. Generate recipe image

If the user provides an image (URL or file), use it. Otherwise, generate a high-quality, appetizing photo of the finished dish.

To generate the image, use an image generation tool (e.g. DALL-E, or any available image generation MCP) with a prompt like:
> "Professional food photography of [recipe name], plated beautifully, warm natural lighting, shallow depth of field, top-down or 45-degree angle, high resolution"

Save the generated image to `recipes/images/{recipe-slug}.jpg`.

When uploading to Cookidoo, the image can be set via the recipe edit page in the browser — navigate to the edit page and use Chrome DevTools MCP to click the image upload area and upload the file.

### 5. Generate outputs

Do NOT save recipe files locally unless the user explicitly asks. A reference example is available at `recipes/example-taca-maravilha-de-morango.json`.

#### If uploading to Cookidoo: API calls

Execute these via Chrome DevTools MCP (`evaluate_script`) or via `fetch` if cookie is available.

##### Option A — via Chrome DevTools MCP (user is logged in on the browser)

All `fetch` calls below run inside the browser context via `evaluate_script`, so cookies are sent automatically with `credentials: 'include'`.

##### Option B — via manual cookie

If using the manual cookie approach, add the cookie header to each request:

```javascript
headers: { 'Cookie': 'v-authenticated=USER_COOKIE_VALUE', ... }
```

##### Create new recipe

```javascript
// Replace DOMAIN and LOCALE based on language parameter
const domain = 'cookidoo.pt';  // see mapping table
const locale = 'pt-PT';        // see mapping table

const resp = await fetch(`https://${domain}/created-recipes/${locale}`, {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
  body: JSON.stringify({ recipeName: "Recipe Name" })
});
const data = await resp.json();
// data.recipeId → use for PATCH
```

##### Update recipe (PATCH)

```javascript
const recipeId = 'RECIPE_ID_HERE'; // from URL or POST response
const model = 'TM7'; // TM7, TM6, TM5, TM31

const payload = {
  ingredients: [
    { type: "INGREDIENT", text: "228 g de farinha de trigo" },
    { type: "INGREDIENT", text: "3 g de bicarbonato de sódio" },
    { type: "INGREDIENT", text: "143 g de manteiga sem sal" }
  ],
  instructions: [
    {
      type: "STEP",
      text: "Coloque no copo 228 g de farinha de trigo e 3 g de bicarbonato de sódio.",
      annotations: [
        { type: "INGREDIENT", data: { description: "228 g de farinha de trigo" }, position: { offset: 16, length: 24 } },
        { type: "INGREDIENT", data: { description: "3 g de bicarbonato de sódio" }, position: { offset: 43, length: 27 } }
      ]
    },
    {
      type: "STEP",
      text: "Misture 5 seg/velocidade 4.",
      annotations: [
        { type: "TTS", data: { speed: "4", time: 5 }, position: { offset: 8, length: 18 } }
      ]
    },
    {
      type: "STEP",
      text: "Adicione 143 g de manteiga sem sal.",
      annotations: [
        { type: "INGREDIENT", data: { description: "143 g de manteiga sem sal" }, position: { offset: 9, length: 25 } }
      ]
    },
    {
      type: "STEP",
      text: "Misture 1 min/velocidade 4.",
      annotations: [
        { type: "TTS", data: { speed: "4", time: 60 }, position: { offset: 8, length: 18 } }
      ]
    }
  ],
  tools: [model],
  totalTime: 9000,   // in SECONDS
  prepTime: 1200,    // in SECONDS
  yield: { value: 5, unitText: "portion" }
};

const resp = await fetch(`https://${domain}/created-recipes/${locale}/${recipeId}`, {
  method: 'PATCH',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
  body: JSON.stringify(payload)
});
```

##### If user already has a recipe page open

Extract the recipeId from the URL: `cookidoo.XX/created-recipes/LOCALE/{recipeId}/edit`
Skip the POST and go straight to PATCH.

### 6. Verify

Reload the page and take a screenshot to confirm.

## Ingredient Format Rules

- Use grams whenever possible: `228 g de farinha de trigo`
- For items without weight: `1 ovo`, `3 dentes de alho`
- Notes go after comma: `143 g de manteiga sem sal, em temperatura ambiente`
- Portuguese uses "de": `100 g de açúcar` (not `100 g açúcar`)
- Spanish uses "de": `100 g de azúcar`
- French uses "de": `100 g de sucre`
- Italian uses "di": `100 g di zucchero`
- English has NO preposition: `100 g sugar`
- German has NO preposition: `100 g Zucker`

## Time Conversion

| Human readable | Seconds |
|---|---|
| 5 min | 300 |
| 10 min | 600 |
| 20 min | 1200 |
| 30 min | 1800 |
| 1 hour | 3600 |
| 1h 30min | 5400 |
| 2h 30min | 9000 |

## API Notes

- Auth: Uses session cookies — must be logged in via browser
- All calls use `credentials: 'include'` to pass cookies
- PATCH is idempotent — safe to re-run to update
- Recipe ID visible in URL: `cookidoo.XX/created-recipes/LOCALE/{recipeId}/edit`
- If recipe already exists (user shares URL), extract recipeId and PATCH directly

## Limitations

- Custom ("created") recipes show ingredients as plain text only. Official Vorwerk recipes have structured quantity/unit/name with weight aligned right — this is a platform limitation.
- Guided cooking on TM5/TM31 is not available (no touchscreen); recipe still works for manual cooking.

## References

### Chrome DevTools MCP (browser automation)

- GitHub (official): <https://github.com/anthropics/anthropic-devtools-mcp> — source & setup instructions
- npm package: <https://www.npmjs.com/package/@anthropic-ai/chrome-devtools-mcp>
- Chrome blog announcement: <https://developer.chrome.com/blog/chrome-devtools-mcp>
- Addy Osmani intro: <https://addyosmani.com/blog/devtools-mcp/>

### Cookidoo official docs

- Help center (main): <https://support.vorwerk.com/hc/en-us/categories/360002717300-COOKIDOO>
- Created Recipes overview: <https://support.vorwerk.com/hc/en-us/sections/4404592060050-Cookidoo-Created-Recipes>
- Created Recipes basics: <https://support.vorwerk.com/hc/en-us/articles/4404599366674-Basic-information-about-Cookidoo-Created-Recipes>
- Created Recipes + Thermomix device: <https://support.vorwerk.com/hc/en-us/articles/4404599417362-My-Created-recipes-and-my-Thermomix-device>
- Importing recipes: <https://cookidoo.thermomix.com/foundation/en-US/articles/learn-about-importing-recipes>
- Discover Created Recipes: <https://cookidoo.thermomix.com/foundation/en-US/pages/discover-created-recipes>
- Tutorial — adding ingredients & steps (basic): <https://cookidoo.thermomix.com/foundation/tutorials/en-US/courses/how-to-edit/edit-addingingredientandstepbasics>
- Tutorial — adding ingredients & steps (advanced): <https://cookidoo.thermomix.com/foundation/tutorials/en-US/courses/how-to-edit/edit-addingingredientandstepadvanced>
- Cookidoo help page: <https://cookidoo.thermomix.com/foundation/en-US/help>

### Cookidoo API (unofficial / community)

- cookiput (Python, API reverse-engineering): <https://github.com/croeer/cookiput> — JSON payload examples for POST/PATCH
- cookidoo-api (Python, async): <https://github.com/miaucl/cookidoo-api> — intercepted API requests from Android app
- AIdoo (AI recipe converter): <https://aidoo.tools/> — converts recipes from URL/text/PDF to Cookidoo format

### Cookidoo regional portals

- Portugal: <https://cookidoo.pt>
- Brasil: <https://cookidoo.com.br>
- US: <https://cookidoo.thermomix.com>
- UK: <https://cookidoo.co.uk>
- Germany: <https://cookidoo.de>
- Spain: <https://cookidoo.es>
- France: <https://cookidoo.fr>
- Italy: <https://cookidoo.it>
