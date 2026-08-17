// Minimal .env reader. No `dotenv` dependency — this repo installs nothing.
//
// ponytail: hand-rolled instead of process.loadEnvFile() because that needs Node
// 20.12+, and on Node 18 (this repo's floor) it would ignore .env in silence —
// a bad failure mode on an auth path. Kept in its own module so it's testable
// without importing the uploader, which runs on import.
//
// Rules:
//   KEY=VALUE per line; keys are [A-Za-z_][A-Za-z0-9_]*
//   blank lines and lines that don't match (including `# comments`) are skipped
//   surrounding single/double quotes are stripped
//   an unquoted ` #` starts a trailing comment; inside quotes `#` is literal
//   a key already present in `env` is never overwritten — a real environment
//   variable always beats the .env file

export function applyEnv(raw, env) {
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m || m[1] in env) continue;
    let v = m[2].trim();
    const quoted = v.match(/^(['"])([\s\S]*)\1$/);
    v = quoted ? quoted[2] : v.replace(/\s+#.*$/, '').trim();
    env[m[1]] = v;
  }
  return env;
}
