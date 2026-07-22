# Roadmap

This page separates what is **done today** from what is **planned**. We will not
claim unfinished features are available.

## ✅ Completed (MVP)

- One-command run via `npx fix-my-setup`
- Commands: default / `doctor`, `list`, `report`, `--help`, `--version`
- Options: `--safe`, `--apply`, `--json`, `--verbose`, `--category`, `--port`
  (repeatable), `--no-network`, `--report`, `--yes`
- Diagnostic plugins: **System, Node.js/npm, Git, Python/pip, Java, Ports,
  Environment files**
- Node/npm depth: install & version checks, EOL detection, npm global bin on
  PATH, cache access, registry reachability, node_modules, lockfile conflicts,
  declared package manager
- Port diagnostics with PID + process name and a platform-specific stop command
- `.env` vs `.env.example` diff that never reads or prints values
- Human output with auto-disabling colors + ASCII glyph fallback
- Deterministic `--json` output
- Anonymized, sanitized, local-only reports
- Plugin registry + failure isolation + meaningful exit codes
- Safe-fix system: preview + confirm, `safe`-only auto-apply
- Full unit-test suite (OS commands mocked; runs on all platforms) + CI

## 🚧 Planned (documented, not built)

These are **not** available yet:

- **Community-created diagnostic plugins** (see the security model in
  [plugins.md](plugins.md))
- **Signed & verified plugin packages** with a capability manifest & sandbox
- **VS Code extension**
- **Interactive fix wizard**
- **Framework-specific diagnostics** (Next.js, Vite, Django, Spring, …)
- **Docker & container diagnostics**
- **Android & iOS development checks**
- **Remote report sharing** with explicit, opt-in consent
- **CI-environment diagnostics**
- **Team-specific diagnostic rule sets**

## Launch checklist (for maintainers)

- [ ] Record a 10-second GIF of the command catching a real issue → `docs/demo.gif`
- [ ] Keep install to one command (`npx fix-my-setup`)
- [ ] Ship a working MVP before announcing advanced features
- [ ] Seed a few beginner-friendly issues (below)
- [ ] Tell the origin story (hours lost to a broken setup)
- [ ] Use real terminal output & screenshots, not mockups

## Good first issues

Beginner-friendly, well-scoped tasks to seed the tracker:

1. **Add a Ruby/`gem` plugin** mirroring the Python plugin.
2. **Add a Go (`go version`) plugin.**
3. **Detect `.nvmrc` / `.node-version`** and compare against the running Node
   version in the Node plugin.
4. **Add a `--only-problems` flag** that hides `success`/`info` results.
5. **Add a `pnpm` / `yarn` availability check** when `packageManager` declares one.
6. **Improve Windows elevation detection** (currently conservative "no").
7. **Add a `PATH` duplicate-entry warning** to the System plugin.
8. **Snapshot-test the human formatter** with `NO_COLOR` set.
9. **Add `--category all` as an explicit alias** for running everything.
10. **Detect a `.python-version` file** and surface the expected version.

Each should include a test and, where relevant, a suggested fix.
