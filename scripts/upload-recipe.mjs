#!/usr/bin/env node
// Upload a Thermomix recipe to Cookidoo (created recipes), no browser required.
//
// What it does:
//   1. Parses your Cookidoo session cookies (Netscape cookies.txt export OR a raw Cookie header).
//   2. Builds the PATCH payload, computing every annotation offset with `indexOf` (never by hand).
//   3. POSTs to create the recipe, PATCHes the full content, then GETs it back to verify.
//
// Usage:
//   node scripts/upload-recipe.mjs --cookies cookies.txt --recipe my-recipe.json
//   node scripts/upload-recipe.mjs --cookies cookies.txt --recipe my-recipe.json --dry-run
//   node scripts/upload-recipe.mjs --cookies cookies.txt --recipe my-recipe.json --recipe-id <id>   # patch existing
//
// Options:
//   --cookies <file>   Netscape cookies.txt export, or a file containing a raw "name=value; ..." Cookie header
//   --recipe <file>    Recipe spec JSON (see scripts/README.md for the format)
//   --host <host>      Cookidoo host (default: cookidoo.international — the host your cookies are scoped to)
//   --locale <locale>  Created-recipes locale (default: pt-BR — must return JSON, not a 307, for your account)
//   --recipe-id <id>   Skip create; PATCH an existing recipe id
//   --dry-run          Build + validate the payload, print a summary, make no network calls
//
// Notes:
//   - Created recipes are tied to your Vorwerk ACCOUNT, so they show up on every Cookidoo portal you log into,
//     regardless of which host created them. The host only decides which API accepts your cookies.
//   - Offsets/lengths use JS string .length (UTF-16), which matches Cookidoo's counting (the degree sign ° = 1).

import { readFileSync, writeFileSync } from 'node:fs';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a.startsWith('--')) args[a.slice(2)] = argv[++i];
  }
  return args;
}

const args = parseArgs(process.argv);
const host = args.host || 'cookidoo.international';
const locale = args.locale || 'pt-BR';

if (!args.recipe) {
  console.error('Missing --recipe <spec.json>. See scripts/README.md.');
  process.exit(2);
}
if (!args.dryRun && !args.cookies) {
  console.error('Missing --cookies <file>. Use --dry-run to validate without uploading.');
  process.exit(2);
}

// --- Cookie loading -------------------------------------------------------
function buildCookieHeader(file, targetHost) {
  const raw = readFileSync(file, 'utf8');
  const lines = raw.split(/\r?\n/);
  const looksNetscape = lines.some((l) => l && !l.startsWith('#') && l.split('\t').length >= 7);
  if (!looksNetscape) return raw.trim(); // raw "name=value; ..." header
  const hostRe = new RegExp(`(^|\\.)${targetHost.replace(/\./g, '\\.')}$`);
  const jar = {};
  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;
    const p = line.split('\t');
    if (p.length < 7) continue;
    if (hostRe.test(p[0])) jar[p[5]] = p[6];
  }
  if (!jar['v-authenticated'] && !jar['_oauth2_proxy']) {
    console.warn(`WARN: no auth cookie (v-authenticated/_oauth2_proxy) found for ${targetHost}.`);
  }
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
}

// --- Payload building -----------------------------------------------------
function buildAnnotations(step) {
  const ann = [];
  for (const d of step.ings || []) {
    const offset = step.text.indexOf(d);
    if (offset < 0) throw new Error(`Ingredient "${d}" not found in step text:\n  ${step.text}`);
    ann.push({ type: 'INGREDIENT', data: { description: d }, position: { offset, length: d.length } });
  }
  if (step.tts) {
    const { snippet, speed, time, temp } = step.tts;
    const offset = step.text.indexOf(snippet);
    if (offset < 0) throw new Error(`TTS snippet "${snippet}" not found in step text:\n  ${step.text}`);
    const data = { speed: String(speed), time };
    if (temp != null) data.temperature = { value: String(temp), unit: 'C' };
    ann.push({ type: 'TTS', data, position: { offset, length: snippet.length } });
  }
  return ann;
}

function buildPayload(spec) {
  return {
    ingredients: spec.ingredients.map((text) => ({ type: 'INGREDIENT', text })),
    instructions: spec.steps.map((s) => ({ type: 'STEP', text: s.text, annotations: buildAnnotations(s) })),
    tools: [spec.model || 'TM7'],
    totalTime: spec.totalTime,
    prepTime: spec.prepTime,
    yield: spec.yield,
  };
}

const spec = JSON.parse(readFileSync(args.recipe, 'utf8'));
const payload = buildPayload(spec); // throws here if any offset can't be resolved

if (args.dryRun) {
  const counts = payload.instructions.flatMap((s) => s.annotations).reduce(
    (a, x) => ((a[x.type] = (a[x.type] || 0) + 1), a), {});
  console.log(`DRY RUN OK — "${spec.name}": ${payload.ingredients.length} ingredients, ` +
    `${payload.instructions.length} steps, ${counts.INGREDIENT || 0} INGREDIENT + ${counts.TTS || 0} TTS annotations.`);
  process.exit(0);
}

// --- Network --------------------------------------------------------------
const cookieHeader = buildCookieHeader(args.cookies, host);
const headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'Cookie': cookieHeader,
  'Origin': `https://${host}`,
  'Referer': `https://${host}/`,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};
const base = `https://${host}/created-recipes/${locale}`;

let recipeId = args['recipe-id'];
if (!recipeId) {
  const r = await fetch(base, { method: 'POST', headers, body: JSON.stringify({ recipeName: spec.name }) });
  const text = await r.text();
  if (!r.ok) {
    console.error(`CREATE failed: ${r.status} ${r.statusText}\n${text.slice(0, 1200)}`);
    console.error('Tip: confirm the host owns your cookies and that GET ' + base + ' returns JSON (not a 307).');
    process.exit(1);
  }
  recipeId = JSON.parse(text).recipeId;
  console.log('Created recipeId:', recipeId);
}

const pr = await fetch(`${base}/${recipeId}`, { method: 'PATCH', headers, body: JSON.stringify(payload) });
if (!pr.ok) {
  console.error(`PATCH failed: ${pr.status} ${pr.statusText}\n${(await pr.text()).slice(0, 1500)}`);
  console.error('Recipe exists but may be empty:', `${base}/${recipeId}/edit`);
  process.exit(1);
}
console.log('PATCH ok:', pr.status);

// Verify by reading it back (read format is schema.org, not the write format)
const vr = await fetch(`${base}/${recipeId}`, { headers: { Accept: 'application/json', Cookie: cookieHeader } });
const rc = (await vr.json()).recipeContent || {};
console.log('\n=== READ-BACK ===');
console.log('Name:', rc.name);
console.log('Ingredients:', (rc.recipeIngredient || []).length, '| Steps:', (rc.recipeInstructions || []).length);
console.log('totalTime:', rc.totalTime, '| prepTime:', rc.prepTime, '| tools:', JSON.stringify(rc.tool), '| yield:', JSON.stringify(rc.recipeYield));
console.log('\nDONE:', `${base}/${recipeId}/edit`);

if (args.out) writeFileSync(args.out, JSON.stringify({ recipeId, url: `${base}/${recipeId}/edit` }, null, 2));
