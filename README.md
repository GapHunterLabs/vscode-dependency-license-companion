# Dependency License Companion (VS Code)

Reads each `node_modules` dependency's SPDX license locally and flags
copyleft/missing licenses right on the `package.json` line that
declares it. No data leaves your editor.

**v0.1, new niche.** Not a port from the Gap Hunter Labs IntelliJ-
family catalog. Evidence: no VS Code extension found that shows
per-dependency license as live editor diagnostics — the real tooling
for this (`license-checker-rseidelsohn`, `spdx-expression-parse`) is
100% CLI, confirmed absent from the editor across 2 independent
searches.

## What it does

Reads your workspace root `package.json`'s `dependencies`/
`devDependencies`/`optionalDependencies`, looks up each one's own
`license` field inside `node_modules` (handles the plain SPDX string
form, the older `{ type, url }` object form, the deprecated
`licenses[]` array form, and a basic `(X OR Y)` SPDX expression split),
and classifies each:

- **permissive** — MIT, Apache-2.0, BSD, ISC, 0BSD, Unlicense, ... —
  never flagged.
- **weak-copyleft** — LGPL, MPL, EPL, CDDL.
- **strong-copyleft** — GPL, AGPL, SSPL.
- **unknown** — no license field found at all.

Every non-permissive dependency gets a diagnostic directly on its
`package.json` declaration line, live whenever `package.json` changes.
Command: `Dependency License Companion: Rescan Dependencies` to force
a manual re-check.

**v0.1 scope, honestly noted:** a dual-license `(MIT OR GPL-3.0)`
package is reported as its *worst* category (strong-copyleft), even
though you could legally choose the MIT option — the safer default
for an automated check, stated plainly rather than silently picking
the favorable reading. Not a real SPDX expression parser (no
`AND`-inside-`OR` nesting support) — a basic split on `OR`/`AND` is
enough for the overwhelming majority of real package.json license
fields.

## Privacy

See [PRIVACY.md](PRIVACY.md) — zero network calls, everything runs
against files already in your workspace (your own `package.json` and
the `node_modules` you already installed).

## Development

```bash
npm install
npm run compile   # or: npm run watch
npm test
```

To build an installable package without publishing:

```bash
npx @vscode/vsce package
```

## License

Apache License 2.0 — see [LICENSE](LICENSE).
