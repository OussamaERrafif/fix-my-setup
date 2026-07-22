import type {
  DiagnosticContext,
  DiagnosticResult,
  DiagnosticStatus,
  RunSummary,
} from '../types/index.js';
import type { PluginRegistry } from './plugin-registry.js';

export interface RunnerEvents {
  /** Fired before a plugin runs (for progress display). */
  onPluginStart?: (pluginName: string, category: string) => void;
  /** Fired after a plugin finishes, with the results it produced. */
  onPluginDone?: (pluginName: string, results: DiagnosticResult[]) => void;
}

/**
 * Runs every selected plugin against a context, isolating failures so one
 * broken plugin can never abort the whole run.
 */
export class DiagnosticRunner {
  constructor(private readonly registry: PluginRegistry) {}

  async run(context: DiagnosticContext, events: RunnerEvents = {}): Promise<RunSummary> {
    const started = Date.now();
    const plugins = this.registry.select(context.platform, context.options.category);
    const results: DiagnosticResult[] = [];

    for (const plugin of plugins) {
      events.onPluginStart?.(plugin.name, plugin.category);
      let pluginResults: DiagnosticResult[];
      try {
        pluginResults = await plugin.detect(context);
      } catch (error) {
        // Failure isolation: convert an unexpected throw into an error result
        // and keep going with the remaining plugins.
        pluginResults = [failureResult(plugin.id, plugin.name, error)];
      }
      results.push(...pluginResults);
      events.onPluginDone?.(plugin.name, pluginResults);
    }

    const counts = countStatuses(results);
    return {
      results,
      counts,
      exitCode: selectExitCode(counts),
      durationMs: Date.now() - started,
    };
  }
}

function failureResult(id: string, name: string, error: unknown): DiagnosticResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    id: `${id}.internal-error`,
    name: `${name} (internal error)`,
    status: 'error',
    message: `Diagnostic "${name}" failed to run: ${message}`,
    details:
      error instanceof Error && error.stack ? error.stack.split('\n').slice(0, 5) : undefined,
  };
}

/** Tally results by status. */
export function countStatuses(results: DiagnosticResult[]): Record<DiagnosticStatus, number> {
  const counts: Record<DiagnosticStatus, number> = {
    success: 0,
    warning: 0,
    error: 0,
    info: 0,
  };
  for (const result of results) counts[result.status] += 1;
  return counts;
}

/**
 * Map aggregate status counts to a process exit code.
 *
 *  - 2: at least one error
 *  - 1: at least one warning (no errors)
 *  - 0: clean (only success/info)
 *
 * Exit code 3 is reserved for a failure of the tool itself and is chosen by
 * the CLI entry point, not here.
 */
export function selectExitCode(counts: Record<DiagnosticStatus, number>): 0 | 1 | 2 {
  if (counts.error > 0) return 2;
  if (counts.warning > 0) return 1;
  return 0;
}
