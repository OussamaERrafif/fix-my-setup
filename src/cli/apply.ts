import { createInterface } from 'node:readline';
import { buildContext } from '../core/context.js';
import { DiagnosticRunner } from '../core/diagnostic-runner.js';
import { createDefaultRegistry } from '../plugins/index.js';
import { FixRegistry } from '../fixes/registry.js';
import { builtinFixes } from '../fixes/builtin.js';
import { createColorizer, supportsColor } from '../output/colors.js';
import type { ApplicableFix, RunOptions, SuggestedFix } from '../types/index.js';

/**
 * Apply only explicitly-approved, low-risk fixes.
 *
 * Flow: run diagnostics → collect suggested fixes that (a) are marked
 * `canApplyAutomatically`, (b) resolve to a registered {@link ApplicableFix},
 * and (c) are `risk: 'safe'` → preview exactly what will change → confirm
 * (unless `--yes`) → apply. Nothing is ever changed without a preview.
 */
export async function runApply(
  options: RunOptions,
  out: (line: string) => void = console.log,
): Promise<0 | 1 | 2 | 3> {
  const registry = createDefaultRegistry();
  const fixes = new FixRegistry().registerAll(builtinFixes);
  const context = buildContext({ options });
  const colors = createColorizer(supportsColor());

  const summary = await new DiagnosticRunner(registry).run(context);

  // Gather unique, applicable, safe fixes referenced by diagnostics.
  const candidates = collectApplicable(
    summary.results.flatMap((r) => r.suggestedFixes ?? []),
    fixes,
  );

  if (candidates.length === 0) {
    out(colors.dim('No automatically-applicable fixes were found. Nothing to change.'));
    out(colors.dim('Run without --apply to see manual suggestions.'));
    return summary.exitCode;
  }

  for (const fix of candidates) {
    out(colors.bold(`\nFix: ${fix.id}`));
    const preview = await fix.preview(context);
    for (const line of preview) out('  ' + colors.cyan(line));

    const approved = options.yes || (await confirm(`Apply this ${fix.risk} fix?`));
    if (!approved) {
      out(colors.dim('  Skipped.'));
      continue;
    }
    const result = await fix.apply(context);
    out((result.applied ? colors.green('  ✓ ') : colors.yellow('  • ')) + result.message);
    for (const change of result.changes) out('    ' + colors.dim(change));
  }

  return summary.exitCode;
}

function collectApplicable(fixes: SuggestedFix[], registry: FixRegistry): ApplicableFix[] {
  const seen = new Set<string>();
  const applicable: ApplicableFix[] = [];
  for (const fix of fixes) {
    if (!fix.canApplyAutomatically || !fix.applyId || fix.risk !== 'safe') continue;
    if (seen.has(fix.applyId)) continue;
    const handler = registry.get(fix.applyId);
    if (handler) {
      seen.add(fix.applyId);
      applicable.push(handler);
    }
  }
  return applicable;
}

function confirm(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) return Promise.resolve(false);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolveAnswer) => {
    rl.question(`${question} [y/N] `, (answer) => {
      rl.close();
      resolveAnswer(/^y(es)?$/i.test(answer.trim()));
    });
  });
}
