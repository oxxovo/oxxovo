<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:secret-exposure-guardrails -->
# Commands that leak secrets — never run these (HQ directive, 2026-09-02, 2nd repeat incident)

A personal memory note was not enough to prevent this twice (2026-08-30 one key, 2026-09-02 five keys — both times via a plain `railway variables` call, despite the first incident already being written down). This is now a repo-level rule so it applies to every session/persona working here, not just one agent's recall, and it applies inside every instruction, not just when someone happens to remember it.

## Never call these, with any flags — no exceptions

- `railway variables` / `railway variable list` — every subcommand and every flag (`--kv`, `--json`, or the bare default table) prints raw values for the whole service.
- `railway run env` / `railway run printenv` — the Railway CLI's own help text warns these print secret values.
- `vercel env pull` AND `vercel env ls` — `pull` writes real values into a local file (do not `cat`/`type`/Read that file afterward either); `ls` is banned too, no exceptions, per explicit HQ instruction.
- `printenv`, `env` (bash), `set` (Windows), `Get-ChildItem Env:*` / `dir env:` (PowerShell) — any full env dump.
- `cat .env` / `cat .env.local` / `cat`/`type`/Read on any `.env*` file.
- `echo $ANY_KEY`, `echo %VAR%`, `Write-Host $env:VAR` or anything else that writes a specific secret variable's value to stdout.
- Opening a `git log`/`git diff`/`git show` commit that has a secret mixed into it.
- Any script line like `console.log(process.env)` or `JSON.stringify(process.env)` that dumps the whole env.

## Instead — check existence, never the value

- One specific non-secret Railway var (e.g. `SEASON_ID`, `ROUND`): `railway run -s <svc> -e <env> -p <project-id> node -e "console.log('KEY='+process.env.KEY)"` — name that one var, never list the service. Use the project **ID** (from `railway list --json`, which returns no variable values) — `railway run` does not reliably accept the project name.
- Whether a Railway var is set at all (value withheld): same pattern with `console.log(!!process.env.KEY)`.
- Whether a local `.env*` file has a key: `grep -c "^KEY_NAME=" .env.local` (0/1 only, no value).
- Whether a local process env var is set: `node -e "console.log(!!process.env.KEY)"`.
- Whether a string ever appeared in git history: `git log -p | grep -c PATTERN` (count only, never print the match).
- **Vercel: no safe CLI existence-check exists** (`ls` and `pull` are both banned) — if you need to know whether a Vercel env var is set, ask TK to check the dashboard. Do not try to work around this with a different Vercel command.

## If the actual value is ever needed

Don't read it yourself, from any source. Ask TK for it directly.

## If a secret leaks anyway

Report it immediately (which key, where) — rotation is TK's call, not automatic. If a key does get rotated, every local copy (`.env.local`, etc.) is stale until TK gives the new value — pause all work that writes through that key (DB writes included) until then.
<!-- END:secret-exposure-guardrails -->
