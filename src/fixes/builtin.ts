import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ApplicableFix, DiagnosticContext } from '../types/index.js';

/**
 * Built-in low-risk, project-local automatic fixes.
 *
 * The MVP ships only genuinely harmless fixes: creating a missing local,
 * git-ignored directory. Everything riskier is left as a manual suggestion.
 * Each fix implements `preview()` (no side effects) and `apply()`.
 */

/** Create a missing project-local `.cache` directory used by many tools. */
const createLocalCacheDir: ApplicableFix = {
  id: 'node.create-local-cache-dir',
  risk: 'safe',
  async preview(context: DiagnosticContext) {
    const target = join(context.cwd, '.cache');
    return [`Create directory: ${target}`];
  },
  async apply(context: DiagnosticContext) {
    const target = join(context.cwd, '.cache');
    if (context.fs.exists(target)) {
      return { applied: false, message: 'Directory already exists; nothing to do.', changes: [] };
    }
    mkdirSync(target, { recursive: true });
    return {
      applied: true,
      message: 'Created local cache directory.',
      changes: [`Created ${target}`],
    };
  },
};

export const builtinFixes: readonly ApplicableFix[] = [createLocalCacheDir];
