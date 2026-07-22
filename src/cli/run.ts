import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildContext } from '../core/context.js';
import { DiagnosticRunner } from '../core/diagnostic-runner.js';
import { createDefaultRegistry } from '../plugins/index.js';
import { buildReport } from '../core/reporter.js';
import { createColorizer, supportsColor } from '../output/colors.js';
import { shouldUseAscii } from '../output/symbols.js';
import { formatSummary } from '../output/format.js';
import { formatJson } from '../output/json.js';
import type { DiagnosticResult, RunOptions, RunSummary } from '../types/index.js';

export interface DoctorOutcome {
  summary: RunSummary;
  /** Exit code the process should use (3 reserved for tool failure). */
  exitCode: 0 | 1 | 2 | 3;
}

/**
 * The main diagnostic pipeline shared by the default command and `doctor`.
 * Builds context, runs plugins, prints results (human or JSON), and optionally
 * writes a sanitized report. Never mutates the system in this path.
 */
export async function runDoctor(
  options: RunOptions,
  out: (line: string) => void = console.log,
  err: (line: string) => void = console.error,
): Promise<DoctorOutcome> {
  const registry = createDefaultRegistry();

  // Validate an unknown --category early with a helpful message, and
  // canonicalize its casing so the registry's exact-match filter works.
  if (options.category) {
    const canonical = registry.categories().find((c) => eqCategory(c, options.category!));
    if (!canonical) {
      err(`Unknown category "${options.category}". Available: ${registry.categories().join(', ')}`);
      return { summary: emptySummary(), exitCode: 3 };
    }
    options = { ...options, category: canonical };
  }

  const context = buildContext({ options });
  const runner = new DiagnosticRunner(registry);

  const showProgress = !options.json && Boolean(process.stderr.isTTY);
  const summary = await runner.run(context, {
    onPluginStart: showProgress
      ? (name) => process.stderr.write(`  … checking ${name}\r`)
      : undefined,
    onPluginDone: showProgress ? () => process.stderr.write(' '.repeat(40) + '\r') : undefined,
  });

  if (options.json) {
    out(formatJson(summary));
  } else {
    const colors = createColorizer(supportsColor());
    const categoriesById = buildCategoryMap(registry.list(), summary.results);
    out(
      formatSummary(summary, summary.results, categoriesById, {
        colors,
        platform: context.platform,
        verbose: options.verbose,
        ascii: shouldUseAscii(context.env),
      }),
    );
  }

  if (options.reportPath) {
    const report = buildReport(context, summary);
    const target = resolve(options.reportPath);
    try {
      writeFileSync(target, JSON.stringify(report, null, 2) + '\n', 'utf8');
      if (!options.json) out(`\nSaved anonymized report to ${target}`);
    } catch (error) {
      err(`Failed to write report: ${error instanceof Error ? error.message : String(error)}`);
      return { summary, exitCode: 3 };
    }
  }

  return { summary, exitCode: summary.exitCode };
}

/** Map each result id to its owning plugin's category (by id prefix). */
function buildCategoryMap(
  plugins: { id: string; category: string }[],
  results: DiagnosticResult[],
): Map<string, string> {
  const byPluginId = new Map(plugins.map((p) => [p.id, p.category]));
  const map = new Map<string, string>();
  for (const result of results) {
    const pluginId = result.id.split('.')[0] ?? '';
    map.set(result.id, byPluginId.get(pluginId) ?? 'General');
  }
  return map;
}

function eqCategory(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function emptySummary(): RunSummary {
  return {
    results: [],
    counts: { success: 0, warning: 0, error: 0, info: 0 },
    exitCode: 0,
    durationMs: 0,
  };
}
