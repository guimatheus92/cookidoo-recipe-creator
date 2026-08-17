#!/usr/bin/env node
// Upload a Thermomix recipe to Cookidoo (created recipes), no browser required.
//
// What it does:
//   1. Parses your Cookidoo session cookies (Netscape cookies.txt export OR a raw Cookie header).
//   2. Builds the PATCH payload, computing every annotation offset with `indexOf` (never by hand).
//   3. POSTs to create the recipe, PATCHes the full content, then GETs it back to verify.
//
// Usage:
//   node scripts/upload-recipe.mjs --check-auth                                  # verify login only
//   node scripts/upload-recipe.mjs --recipe my-recipe.json
//   node scripts/upload-recipe.mjs --recipe my-recipe.json --dry-run
//   node scripts/upload-recipe.mjs --recipe my-recipe.json --recipe-id <id>      # patch existing
//
// Config comes from CLI flags > real env vars > .env in the project root > defaults.
// Copy .env.example to .env to set COOKIES_FILE / COOKIDOO_HOST / COOKIDOO_LOCALE once.
//
// Options:
//   --cookies <file>   Netscape cookies.txt export, or a file containing a raw "name=value; ..." Cookie header
//                      (default: COOKIES_FILE, else cookies.txt in the project root)
//   --recipe <file>    Recipe spec JSON (see scripts/README.md for the format)
//   --host <host>      Cookidoo host (default: COOKIDOO_HOST, else cookidoo.international)
//   --locale <locale>  Created-recipes locale (default: COOKIDOO_LOCALE, else pt-BR — must return JSON, not a 307)
//   --recipe-id <id>   Skip create; PATCH an existing recipe id
//   --check-auth       Check the session against the host/locale and exit; no recipe needed
//   --dry-run          Build + validate the payload, print a summary, make no network calls
//   --out <file>       Write {recipeId, url} JSON to this file after a successful upload
//
// Notes:
//   - Created recipes are tied to your Vorwerk ACCOUNT, so they show up on every Cookidoo portal you log into,
//     regardless of which host created them. The host only decides which API accepts your cookies.
//   - Offsets/lengths use JS string .length (UTF-16), which matches Cookidoo's counting (the degree sign ° = 1).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { applyEnv } from './lib/env.mjs';

// --- Config ---------------------------------------------------------------
// Project root, so relative paths and the .env lookup don't depend on the CWD
// (this script lives in scripts/, but is run from the repo root).
// resolve() leaves absolute paths alone, so --cookies C:\... still works.
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const fromRoot = (p) => resolve(ROOT, p);

// Load .env from the project root, if there is one. Parsing rules live in lib/env.mjs.
try {
  applyEnv(readFileSync(fromRoot('.env'), 'utf8'), process.env);
} catch { /* no .env — flags and defaults cover it */ }

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--check-auth') args.checkAuth = true;
    else if (a.startsWith('--')) args[a.slice(2)] = argv[++i];
  }
  return args;
}

const args = parseArgs(process.argv);
const host = args.host || process.env.COOKIDOO_HOST || 'cookidoo.international';
const locale = args.locale || process.env.COOKIDOO_LOCALE || 'pt-BR';

// Where the cookie file came from — quoted back in errors so a wrong path is obvious.
const cookieSource = args.cookies ? '--cookies'
  : process.env.COOKIES_FILE ? 'COOKIES_FILE'
  : 'default';
const cookiesFile = fromRoot(args.cookies || process.env.COOKIES_FILE || 'cookies.txt');

if (!args.recipe && !args.checkAuth) {
  console.error('Missing --recipe <spec.json>. See scripts/README.md.');
  console.error('Use --check-auth to verify your session without a recipe.');
  process.exit(2);
}

// --- Cookie loading -------------------------------------------------------
function buildCookieHeader(file, targetHost) {
  let raw;
  try {
    raw = readFileSync(file, 'utf8');
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    console.error(`Cookie file not found: ${file}`);
    console.error(`  (path came from ${cookieSource})`);
    console.error('Export your Cookidoo cookies there, or set COOKIES_FILE in .env (cp .env.example .env).');
    process.exit(2);
  }
  const lines = raw.split(/\r?\n/);
  const looksNetscape = lines.some((l) => l && !l.startsWith('#') && l.split('\t').length >= 7);
  if (!looksNetscape) return { header: raw.trim(), count: null }; // raw "name=value; ..." header
  const hostRe = new RegExp(`(^|\\.)${targetHost.replace(/\./g, '\\.')}$`);
  const jar = {};
  const expiry = {}; // Netscape field 5 = expiry (unix seconds, 0 = session cookie)
  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;
    const p = line.split('\t');
    if (p.length < 7) continue;
    if (!hostRe.test(p[0])) continue;
    jar[p[5]] = p[6];
    expiry[p[5]] = Number(p[4]) || 0;
  }
  if (!jar['v-authenticated'] && !jar['_oauth2_proxy']) {
    console.warn(`WARN: no auth cookie (v-authenticated/_oauth2_proxy) found for ${targetHost}.`);
  }
  // The export carries its own expiry, so say so instead of making the user guess.
  const now = Date.now() / 1000;
  const stale = ['v-authenticated', '_oauth2_proxy']
    .filter((n) => expiry[n] > 0 && expiry[n] < now)
    .map((n) => `${n} (expired ${Math.floor((now - expiry[n]) / 86400)}d ago)`);
  const entries = Object.entries(jar);
  return { header: entries.map(([k, v]) => `${k}=${v}`).join('; '), count: entries.length, stale };
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

const spec = args.recipe ? JSON.parse(readFileSync(args.recipe, 'utf8')) : null;
const payload = spec ? buildPayload(spec) : null; // throws here if any offset can't be resolved

if (spec && args.dryRun) {
  const counts = payload.instructions.flatMap((s) => s.annotations).reduce(
    (a, x) => ((a[x.type] = (a[x.type] || 0) + 1), a), {});
  console.log(`DRY RUN OK — "${spec.name}": ${payload.ingredients.length} ingredients, ` +
    `${payload.instructions.length} steps, ${counts.INGREDIENT || 0} INGREDIENT + ${counts.TTS || 0} TTS annotations.`);
  process.exit(0);
}

// --- Network --------------------------------------------------------------
const { header: cookieHeader, count: cookieCount, stale: staleCookies = [] } = buildCookieHeader(cookiesFile, host);
if (staleCookies.length) {
  console.warn(`WARN: stale auth cookie(s): ${staleCookies.join(', ')}. Re-export from a logged-in browser.`);
}
const headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'Cookie': cookieHeader,
  'Origin': `https://${host}`,
  'Referer': `https://${host}/`,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};
const base = `https://${host}/created-recipes/${locale}`;

// Everything past the first fetch lives in main() so we can `return` instead of
// process.exit(): exiting while undici still holds a pooled socket trips a libuv
// assertion on Windows (`UV_HANDLE_CLOSING`) and reports exit code 127.
const fail = (code = 1) => { process.exitCode = code; };

async function main() {
  // --- Auth check ---------------------------------------------------------
  // A live session returns 200 + JSON here. An expired one, or the wrong host/locale
  // for this account, redirects to an HTML login/locale page instead.
  if (args.checkAuth) {
    console.log(`Cookie file: ${cookiesFile} (from ${cookieSource})` +
      (cookieCount === null ? ' — raw Cookie header' : ` — ${cookieCount} cookie(s) for ${host}`));
    const r = await fetch(base, { headers, redirect: 'manual' });
    const body = await r.text();
    const ct = r.headers.get('content-type') || '(none)';
    console.log(`GET ${base}\n-> ${r.status} ${r.statusText} | ${ct}`);
    if (r.ok && ct.includes('json')) {
      const n = JSON.parse(body).items?.length;
      console.log(`AUTH OK — session is valid.${n === undefined ? '' : ` ${n} created recipe(s) on this account.`}`);
      return;
    }
    const to = r.headers.get('location');
    if (to) console.error(`Redirects to: ${to}`);
    console.error(`Body: ${body.slice(0, 200).replace(/\s+/g, ' ').trim() || '(empty)'}`);
    if (staleCookies.length) {
      console.error(`AUTH FAILED — your cookies are expired: ${staleCookies.join(', ')}.`);
      console.error(`Log into https://${host} again and re-export to ${cookiesFile}.`);
    } else {
      console.error('AUTH FAILED — cookies rejected, or wrong host/locale for this account.');
      console.error('Re-export your cookies, or adjust COOKIDOO_HOST / COOKIDOO_LOCALE in .env.');
    }
    return fail();
  }

  let recipeId = args['recipe-id'];
  if (!recipeId) {
    const r = await fetch(base, { method: 'POST', headers, body: JSON.stringify({ recipeName: spec.name }) });
    const text = await r.text();
    if (!r.ok) {
      console.error(`CREATE failed: ${r.status} ${r.statusText}\n${text.slice(0, 1200)}`);
      console.error('Tip: run --check-auth to confirm the host/locale accept your cookies.');
      return fail();
    }
    recipeId = JSON.parse(text).recipeId;
    console.log('Created recipeId:', recipeId);
  }

  const editUrl = `${base}/${recipeId}/edit`;
  const writeOut = () => {
    if (args.out) writeFileSync(args.out, JSON.stringify({ recipeId, url: editUrl }, null, 2));
  };

  const pr = await fetch(`${base}/${recipeId}`, { method: 'PATCH', headers, body: JSON.stringify(payload) });
  const prText = await pr.text();
  if (!pr.ok) {
    console.error(`PATCH failed: ${pr.status} ${pr.statusText}\n${prText.slice(0, 1500)}`);
    console.error('Recipe exists but may be empty:', editUrl);
    return fail();
  }
  console.log('PATCH ok:', pr.status);

  // Verify by reading it back (read format is schema.org, not the write format)
  const vr = await fetch(`${base}/${recipeId}`, { headers: { Accept: 'application/json', Cookie: cookieHeader } });
  const vrText = await vr.text();
  if (!vr.ok) {
    // The upload already succeeded — don't fail the run just because the read-back didn't.
    console.warn(`\nWARN: read-back failed (${vr.status} ${vr.statusText}); the recipe was still uploaded.`);
    console.log('DONE:', editUrl);
    return writeOut();
  }
  const rc = JSON.parse(vrText).recipeContent || {};
  console.log('\n=== READ-BACK ===');
  console.log('Name:', rc.name);
  console.log('Ingredients:', (rc.recipeIngredient || []).length, '| Steps:', (rc.recipeInstructions || []).length);
  console.log('totalTime:', rc.totalTime, '| prepTime:', rc.prepTime, '| tools:', JSON.stringify(rc.tool), '| yield:', JSON.stringify(rc.recipeYield));
  console.log('\nDONE:', editUrl);
  writeOut();
}

await main();
