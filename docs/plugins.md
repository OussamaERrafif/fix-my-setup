# Writing a Diagnostic Plugin

A plugin is a small object that inspects some part of the environment and returns
`DiagnosticResult`s. This guide covers the built-in (in-tree) plugin API and the
**proposed** community-plugin model.

## The interface

```ts
export interface DiagnosticPlugin {
  id: string; // unique, kebab-case, used as the result-id prefix
  name: string; // human label, e.g. "Node.js & npm"
  category: string; // grouping label shown in output & used by --category
  supportedPlatforms?: Array<'windows' | 'macos' | 'linux'>;
  detect(context: DiagnosticContext): Promise<DiagnosticResult[]>;
}
```

Result ids should be `"<plugin.id>.<something>"` — the CLI groups output by
matching the id prefix back to the owning plugin's category.

## A minimal plugin

`src/plugins/deno/index.ts`:

```ts
import type { DiagnosticPlugin } from '../../types/index.js';
import { getToolVersion } from '../util.js';

export const denoPlugin: DiagnosticPlugin = {
  id: 'deno',
  name: 'Deno',
  category: 'Deno',
  async detect(context) {
    const deno = await getToolVersion(context, 'deno', ['--version']);
    if (!deno.found) {
      return [
        {
          id: 'deno.installed',
          name: 'Deno',
          status: 'info',
          message: 'Deno is not installed or not on PATH',
        },
      ];
    }
    return [
      {
        id: 'deno.installed',
        name: 'Deno',
        status: 'success',
        message: `Deno detected: ${deno.version ?? deno.raw}`,
      },
    ];
  },
};
```

Register it in `src/plugins/index.ts`:

```ts
import { denoPlugin } from './deno/index.js';

export const builtinPlugins = [/* … */ denoPlugin];
```

## Using the context

Never touch `child_process` or `fs` directly — use the context so your plugin
stays testable:

| Need                     | Use                                                   |
| ------------------------ | ----------------------------------------------------- |
| Run a command            | `await context.runCommand('tool', ['--version'])`     |
| Get a tool version       | `await getToolVersion(context, 'tool')` (helper)      |
| Find a binary on PATH    | `await context.which('tool')`                         |
| Read a file / check dirs | `context.fs.readFile(p)`, `context.fs.isDirectory(p)` |
| Branch on OS             | `context.platform` (never `process.platform`)         |
| Respect `--no-network`   | guard network calls with `if (context.network) { … }` |

`runCommand` never throws — check `result.spawnError` / `result.code`.

## Statuses & suggested fixes

- `success` ✓ — everything is fine
- `info` ℹ — neutral information (OS, arch, "not relevant here")
- `warning` ⚠ — probably a problem; exit code ≥ 1
- `error` ✗ — definitely a problem; exit code 2

Attach `suggestedFixes` with a `risk` of `safe` / `caution` / `manual`. Provide
platform-specific `commands` that are **shown, not executed**:

```ts
suggestedFixes: [
  {
    title: 'Install the tool',
    explanation: 'Why this helps, in one sentence.',
    risk: 'manual',
    canApplyAutomatically: false,
    commands: {
      macos: ['brew install tool'],
      linux: ['sudo apt-get install tool'],
      windows: ['winget install Vendor.Tool'],
    },
  },
];
```

## Making a fix auto-applicable

Only genuinely harmless, project-local changes should be auto-applicable. Register
an `ApplicableFix` in `src/fixes/` and reference it from the suggestion via
`applyId` + `canApplyAutomatically: true` + `risk: 'safe'`:

```ts
// fixes/builtin.ts
export const createThing: ApplicableFix = {
  id: 'mytool.create-thing',
  risk: 'safe',
  async preview(ctx) {
    return [`Create ${join(ctx.cwd, '.thing')}`];
  },
  async apply(ctx) {
    /* perform the change, return { applied, message, changes } */
  },
};
```

`--apply` will preview it and ask for confirmation before running.

## Testing

Build a fake context with `tests/helpers.ts`:

```ts
import { makeContext, makeFs } from '../helpers.js';

const ctx = makeContext({
  platform: 'linux',
  commands: { 'deno --version': { stdout: 'deno 1.44.0' } },
  fs: makeFs({ '/project/deno.json': '{}' }),
});
expect((await denoPlugin.detect(ctx))[0]?.status).toBe('success');
```

---

## Proposed community-plugin model (not in the MVP)

Remote/community plugins are **not** implemented yet. The intended design:

1. **Distribution** — plugins are npm packages named `fix-my-setup-plugin-*`
   that default-export a `DiagnosticPlugin` (or an array of them).
2. **Discovery** — an opt-in `plugins` array in a `fix-my-setup.config.json`; the
   CLI loads only what the user explicitly lists. No implicit auto-loading.
3. **Security model:**
   - Third-party plugins run **in-process** and can execute commands, so they are
     treated as trusted code — the CLI will require explicit, per-plugin
     opt-in and print which plugins loaded.
   - Planned: **signed & verified plugin packages**, a capability manifest
     (declaring whether a plugin needs network / command execution), and a
     sandboxed execution mode.
   - Community plugins must honor the same guarantees: no mutation in diagnostic
     mode, no secret printing, sanitizer-clean report text.
4. **Versioning** — plugins declare a supported `apiVersion`; the host refuses
   incompatible plugins rather than risking a crash.

Until this ships, add diagnostics as in-tree plugins via a pull request.
