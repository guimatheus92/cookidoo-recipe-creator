#!/usr/bin/env node
// Unit check for the .env parser. No framework — run it directly:
//
//   node scripts/test-env.mjs
//
// Exits 0 with a pass count, or 1 on the first failure with a diff.

import assert from 'node:assert/strict';
import { applyEnv } from './lib/env.mjs';

let passed = 0;
const check = (name, raw, env, expected) => {
  try {
    assert.deepEqual(applyEnv(raw, env), expected);
    passed++;
  } catch (e) {
    console.error(`FAIL: ${name}`);
    console.error(`  input:    ${JSON.stringify(raw)}`);
    console.error(`  expected: ${JSON.stringify(expected)}`);
    console.error(`  actual:   ${JSON.stringify(e.actual)}`);
    process.exit(1);
  }
};

check('basic KEY=VALUE',
  'COOKIES_FILE=cookies.txt', {}, { COOKIES_FILE: 'cookies.txt' });

check('multiple keys',
  'A=1\nB=2', {}, { A: '1', B: '2' });

check('blank lines and comments are skipped',
  '# a comment\n\n   \nA=1\n# another', {}, { A: '1' });

check('CRLF line endings',
  'A=1\r\nB=2\r\n', {}, { A: '1', B: '2' });

check('whitespace around key, = and value is trimmed',
  '  A  =  spaced  ', {}, { A: 'spaced' });

// The precedence rule the uploader depends on: real env vars outrank .env.
check('existing key is never overwritten',
  'A=from-env-file', { A: 'from-real-env' }, { A: 'from-real-env' });

check('existing key untouched but new key still added',
  'A=x\nB=y', { A: 'keep' }, { A: 'keep', B: 'y' });

check('empty value is allowed and does not fall through to a default',
  'A=', {}, { A: '' });

check('double quotes are stripped',
  'A="quoted value"', {}, { A: 'quoted value' });

check('single quotes are stripped',
  "A='quoted value'", {}, { A: 'quoted value' });

check('mismatched quotes are left alone',
  `A="oops'`, {}, { A: `"oops'` });

check('value containing = is kept whole',
  'A=v-authenticated=abc; _oauth2_proxy=def', {},
  { A: 'v-authenticated=abc; _oauth2_proxy=def' });

check('Windows path with backslashes survives',
  'COOKIES_FILE=C:\\Users\\me\\cookies.txt', {},
  { COOKIES_FILE: 'C:\\Users\\me\\cookies.txt' });

check('unquoted inline comment is stripped',
  'COOKIDOO_LOCALE=pt-BR   # brasil', {}, { COOKIDOO_LOCALE: 'pt-BR' });

check('# inside quotes is literal, not a comment',
  'A="keep # this"', {}, { A: 'keep # this' });

check('# with no leading space is part of the value',
  'A=colour#ff0000', {}, { A: 'colour#ff0000' });

check('keys cannot start with a digit',
  '1BAD=x\nGOOD=y', {}, { GOOD: 'y' });

check('keys cannot contain a dash',
  'BAD-KEY=x\nGOOD=y', {}, { GOOD: 'y' });

check('a line with no = is ignored',
  'NOT_AN_ASSIGNMENT\nA=1', {}, { A: '1' });

check('export prefix is not supported and is ignored',
  'export A=1\nB=2', {}, { B: '2' });

check('empty input leaves env untouched',
  '', { A: '1' }, { A: '1' });

console.log(`.env parser: ${passed} checks passed`);
