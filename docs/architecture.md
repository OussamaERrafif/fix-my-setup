# Architecture

Fix My Setup is intentionally small. This document explains the moving parts and
the key decisions behind them.

## High-level flow

```text
CLI (commander)
   │  parse flags → RunOptions
   ▼
buildContext()  ── platform, cwd, env, homeDir, fs, runCommand, which
   │
   ▼
DiagnosticRunner.run(context)
   │   selects plugins by platform + category
   │   runs each plugin.detect(context), isolating throws
   ▼
RunSummary { results[], counts, exitCode, durationMs }
   │
   ├── human output  (colors + symbols + grouped format)
   ├── JSON output   (deterministic)
   └── report        (sanitized → written to disk)
```

## Core components

| File                        | Responsibility                                                          |
| --------------------------- | ----------------------------------------------------------------------- |
| `core/context.ts`           | Assembles the real `DiagnosticContext` (the only OS-facing surface).    |
| `core/exec.ts`              | `runCommand` (never throws), `which` (PATH scan), platform detection.   |
| `core/fs.ts`                | Error-swallowing filesystem surface (`DiagnosticFs`).                   |
| `core/plugin-registry.ts`   | Register / list / select plugins by platform + category.                |
| `core/diagnostic-runner.ts` | Runs plugins, isolates failures, tallies statuses, picks the exit code. |
| `core/sanitizer.ts`         | Redacts paths, usernames, secrets, emails, IPs for reports.             |
| `core/reporter.ts`          | Builds the anonymized report from a run.                                |
| `output/*`                  | Colors (auto-disable), status symbols (ASCII fallback), human + JSON.   |
| `fixes/*`                   | `FixRegistry` + built-in `safe` applicable fixes.                       |
| `plugins/*`                 | The diagnostics themselves.                                             |

## Key decisions

### 1. Everything OS-facing goes through `DiagnosticContext`

Plugins never call `child_process` or `fs` directly. They receive `runCommand`,
`which`, and `fs` on the context. This makes plugins **pure and unit-testable** —
tests build a fake context with stubbed commands and an in-memory filesystem, so
the whole suite runs identically on every platform.

### 2. Failure isolation

`DiagnosticRunner` wraps each `plugin.detect()` in try/catch. An unexpected throw
becomes an `error` result (`<id>.internal-error`) and the run continues. One
broken plugin can never abort the whole diagnosis.

### 3. Diagnostics vs. fixes are separate concerns

`DiagnosticResult` and `SuggestedFix` are **serializable data** — no functions,
safe to emit as JSON. The imperative logic for applying a fix lives in a separate
`ApplicableFix` (with `preview()` / `apply()`), stored in the `FixRegistry` and
referenced from a suggestion by `applyId`. This keeps diagnostic output pure and
concentrates the (risky) mutation logic in one auditable place.

### 4. Platform is data, not `process.platform`

Any logic that differs by OS takes the platform from `context.platform` (and PATH
separators / joins are derived from it). The host OS is only consulted at the very
edge (`detectPlatform()` when building the real context). This is why simulated
Windows/macOS/Linux tests pass on a single CI runner.

### 5. Safe command execution

`runCommand` uses `shell: false` with fixed argument arrays. On Windows, `.cmd`
/ `.bat` shims (like `npm`) are resolved via `which` and executed through
`cmd.exe /d /s /c` with hand-quoted, `windowsVerbatimArguments` command lines so
paths and arguments containing spaces survive — without opening a shell-injection
surface.

### 6. Deterministic JSON

`--json` output omits timing and orders keys, so identical environments produce
byte-identical output. This makes it safe to snapshot in tests and diff in CI.

## Exit codes

Chosen in `selectExitCode`: `2` if any error, else `1` if any warning, else `0`.
Code `3` is reserved for a failure of the tool itself and is set by the CLI entry
point (e.g. an unknown `--category`, or an unwritable `--report` path).
