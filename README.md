# Fix My Setup

**One command to discover why your development setup is broken.**

```bash
npx fix-my-setup
```

<!-- TODO: Replace with a 10-second demo GIF showing the command finding a real issue. -->
<!-- ![Fix My Setup demo](docs/demo.gif) -->

> 📽️ _Demo GIF placeholder — a 10-second recording of `npx fix-my-setup` catching a real problem goes here._

Fix My Setup scans your development environment, detects common problems, explains
what is wrong, and suggests **safe** commands to fix each issue. It never changes
your machine unless you explicitly ask it to.

---

## Why this exists

> Fix My Setup was inspired by losing hours to development-environment problems
> that could have been detected in seconds — a stale PATH, a port already in use,
> a `.env` missing one variable, an npm global bin that was never wired up.

It does **one job well**: tell you _why_ your setup is broken, in seconds.

## Example output

```text
Fix My Setup

System
ℹ OS: Windows (10.0.26200)
ℹ Architecture: x64
ℹ Shell: PowerShell
ℹ PATH contains 55 entries

Node.js
✓ Node.js detected: 22.14.0
✗ npm global directory is missing from PATH
⚠ npx is not available

Ports
✗ Port 3000 is currently occupied by node.exe (PID 18432)

Environment
⚠ .env exists but DATABASE_URL is missing
✓ API_PORT is defined

Suggested fixes:

1. Add the npm global directory to your PATH (caution)
   Globally-installed CLI tools live here.
   $ setx PATH "C:\Users\username\AppData\Roaming\npm;%PATH%"

2. Stop the process using this port (PID 18432) (caution)
   $ taskkill /PID 18432 /F

Summary: 4 ok · 2 warnings · 2 errors
```

- **Green ✓** passed check &nbsp;·&nbsp; **Red ✗** error &nbsp;·&nbsp; **Yellow ⚠** warning &nbsp;·&nbsp; **Blue ℹ** info
- Colors and Unicode glyphs auto-disable on terminals that don't support them
  (respects [`NO_COLOR`](https://no-color.org), non-TTY pipes, and non-UTF locales).

## Install / Run

No install required — run it directly:

```bash
npx fix-my-setup
```

Or install globally:

```bash
npm install -g fix-my-setup
fix-my-setup
```

Requires **Node.js 20+**. Works on **Windows, macOS, and Linux**.

## Commands

```bash
fix-my-setup            # run all diagnostics (default)
fix-my-setup doctor     # same as the default command
fix-my-setup list       # list available diagnostic categories
fix-my-setup report     # run diagnostics and save an anonymized report
fix-my-setup --help
fix-my-setup --version
```

## Options

| Option              | Description                                                        |
| ------------------- | ------------------------------------------------------------------ |
| `--safe`            | Explain fixes without changing anything (diagnostic mode default)  |
| `--apply`           | Apply only explicitly approved, low-risk fixes (with confirmation) |
| `--json`            | Deterministic machine-readable JSON output                         |
| `--verbose`         | Show additional diagnostic details                                 |
| `--category <name>` | Run only one category (`System`, `Node.js`, `Ports`, …)            |
| `--port <number>`   | Check a specific port; repeatable                                  |
| `--no-network`      | Skip checks that need internet access                              |
| `--report <path>`   | Save an anonymized diagnostic report to a file                     |
| `--yes`             | Skip confirmation for harmless approved operations                 |

### Examples

```bash
npx fix-my-setup --port 3000 --port 5173     # check dev ports
npx fix-my-setup --category Node.js --verbose # only Node checks, detailed
npx fix-my-setup --json                       # pipe into other tools
npx fix-my-setup report                       # write an anonymized report
npx fix-my-setup --no-network                 # offline / air-gapped
```

## What it checks (MVP)

| Category        | Checks                                                                                                                                                                              |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **System**      | OS, architecture, shell, cwd, PATH entries, elevated-permission status                                                                                                              |
| **Node.js/npm** | Node/npm/npx presence & versions, unsupported/EOL Node, npm global bin on PATH, npm cache access, registry reachability, node_modules, lockfile conflicts, declared package manager |
| **Git**         | Git presence & version, `.gitignore` presence in a repo                                                                                                                             |
| **Python/pip**  | `python3`/`python` and `pip3`/`pip` presence & versions                                                                                                                             |
| **Java**        | `java` runtime and `javac` compiler presence & versions                                                                                                                             |
| **Ports**       | Availability, owning PID, process name, platform-specific stop command                                                                                                              |
| **Environment** | `.env` vs `.env.example` diff (missing / empty / present keys), `.env` not git-ignored — **values are never read or printed**                                                       |

## Exit codes

| Code | Meaning                           |
| ---- | --------------------------------- |
| `0`  | No important problems found       |
| `1`  | One or more warnings              |
| `2`  | One or more errors                |
| `3`  | The diagnostic tool itself failed |

## Safety model

Diagnostic mode is the **default**. Running without `--apply` **never** changes
anything. Fix My Setup will never, on its own:

- delete files, kill processes, or uninstall software
- modify shell profiles or system-wide environment variables
- change permissions or run as administrator
- upload reports anywhere

Every suggested fix carries a risk classification (`safe`, `caution`, `manual`).
Only `safe`, explicitly-registered fixes can be applied via `--apply`, and each
one **previews exactly what will change** before doing so. See
[SECURITY.md](SECURITY.md).

## Anonymized reports

`fix-my-setup report` (or `--report <path>`) writes a shareable JSON report with
OS family, architecture, tool versions, and diagnostic statuses. Sensitive data
is redacted before it ever touches disk:

```text
<HOME>/AppData/Roaming/npm
<PROJECT>/package.json
<REDACTED>   <EMAIL>   <IP>
```

Usernames, home/project paths, env values, tokens, and credentials in URLs are
replaced with placeholders. Reports are saved **locally** and never uploaded.

## Architecture

Diagnostics are **plugins** from day one. A small registry runs each plugin,
isolating failures so one broken check can't abort the run.

```text
src/
├── cli/        # commander wiring, run + apply pipelines
├── core/       # runner, registry, context, sanitizer, reporter, exec
├── output/     # colors, symbols, human + JSON formatting
├── fixes/      # applicable-fix registry + built-in safe fixes
├── plugins/    # system · node · git · python · java · ports · environment
├── types/      # shared contracts
└── index.ts    # public library surface
```

See [docs/architecture.md](docs/architecture.md) for the full design and
[docs/plugins.md](docs/plugins.md) to write your own plugin.

## Development

```bash
npm install
npm run dev -- --category Node.js   # run from source (tsx)
npm run build                       # compile to dist/
npm test                            # run the vitest suite
npm run lint                        # eslint
npm run format                      # prettier --write
npm run typecheck                   # tsc --noEmit
```

## Roadmap

Completed MVP vs. planned work lives in [docs/roadmap.md](docs/roadmap.md).
Highlights on the horizon: community plugins with a signed/verified package
model, an interactive fix wizard, framework- and container-specific diagnostics,
and a VS Code extension. None of these are claimed as available today.

## Contributing

Newcomers welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) and the
[`good first issue`](docs/roadmap.md#good-first-issues) list. By participating you
agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE) © Fix My Setup contributors
