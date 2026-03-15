# Cookidoo Recipe Creator

This repo contains a Claude Code skill (`cookidoo-recipe.md`) that converts recipes to Thermomix format and uploads them to Cookidoo.

## Key files

- `cookidoo-recipe.md` — the skill definition (instructions, API format, rules)
- `recipes/example-taca-maravilha-de-morango.json` — reference example with full annotations

## Important rules

- **Annotations are MANDATORY** — every PATCH to Cookidoo must include `INGREDIENT` and `TTS` annotations with correct offset/length. Never send plain text steps.
- **Ingredient steps and machine actions must be separate steps** — never combine "Coloque X" with "Misture Y seg/vel Z" in the same step.
- **Do NOT save recipe files locally** unless the user explicitly asks.
- **Default language is pt-BR**, default model is TM7.
- **User's Cookidoo domain is cookidoo.pt** (Portuguese account).
