# Contributing to Fix My Setup

Thanks for helping make broken dev environments easier to diagnose! This project
aims to do **one job extremely well**, so contributions that keep it small,
reliable, and secure are the most valuable.

## Getting started

```bash
git clone https://github.com/<your-fork>/fix-my-setup.git
cd fix-my-setup
npm install
npm run dev -- --help     # run the CLI from source
npm test                  # run the test suite
```

Requires Node.js 20+.

## Project layout

See [docs/architecture.md](docs/architecture.md). In short:

- `src/plugins/*` — one folder per diagnostic category
- `src/core/*` — runner, registry, context, sanitizer, reporter
- `src/output/*` — colors, symbols, formatting
- `tests/*` — vitest tests (OS commands are mocked so they run everywhere)

## Ground rules

1. **Never mutate the user's machine in diagnostic mode.** Anything that changes
   the system must go through the fix registry, be classified `safe`, and preview
   its changes before applying.
2. **Never print secrets.** Environment values, tokens, and credentials must not
   appear in output or reports. Route report text through the `Sanitizer`.
3. **Fail soft.** A plugin should report problems as `DiagnosticResult`s, not
   throw. The runner isolates throws, but returning a clean `error` result is
   better UX.
4. **Keep dependencies minimal.** Prefer the standard library. New runtime deps
   need a clear justification in the PR.
5. **Cross-platform by construction.** Don't rely on the host OS in logic that is
   parameterized by `context.platform` — pass the platform through so tests can
   simulate Windows/macOS/Linux.

## Adding a diagnostic plugin

See the step-by-step guide in [docs/plugins.md](docs/plugins.md). The short
version:

```ts
import type { DiagnosticPlugin } from '../../types/index.js';

export const myPlugin: DiagnosticPlugin = {
  id: 'my-tool',
  name: 'My Tool',
  category: 'My Tool',
  async detect(context) {
    const found = await context.which('my-tool');
    return [
      {
        id: 'my-tool.installed',
        name: 'My Tool',
        status: found ? 'success' : 'warning',
        message: found ? 'My Tool is installed' : 'My Tool is not on PATH',
      },
    ];
  },
};
```

Register it in `src/plugins/index.ts` and add tests in `tests/`.

## Before you open a PR

Run the full local gate — CI runs the same checks:

```bash
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

- Add or update tests for any behavior change.
- Keep messages concise and actionable; users read them in a hurry.
- Use [Conventional Commits](https://www.conventionalcommits.org/) if you can
  (`feat:`, `fix:`, `docs:`, `test:`, `chore:`), but it's not enforced.

## Reporting bugs & requesting features

Use the issue templates. For diagnostic bugs, an anonymized report helps a lot:

```bash
npx fix-my-setup report
```

(The report redacts usernames, paths, and secrets — see [SECURITY.md](SECURITY.md).)

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Be kind.
