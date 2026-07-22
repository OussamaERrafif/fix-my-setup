import type { RunSummary } from '../types/index.js';

/**
 * Produce deterministic machine-readable JSON for `--json`.
 *
 * Object keys are emitted in a fixed order and no timestamps or durations are
 * included, so identical environments produce byte-identical output (useful
 * for snapshot tests and CI diffing). Duration is available separately.
 */
export function formatJson(summary: RunSummary): string {
  const payload = {
    schemaVersion: 1 as const,
    exitCode: summary.exitCode,
    counts: {
      success: summary.counts.success,
      warning: summary.counts.warning,
      error: summary.counts.error,
      info: summary.counts.info,
    },
    results: summary.results.map((result) => ({
      id: result.id,
      name: result.name,
      status: result.status,
      message: result.message,
      details: result.details ?? [],
      suggestedFixes: (result.suggestedFixes ?? []).map((fix) => ({
        title: fix.title,
        explanation: fix.explanation,
        risk: fix.risk,
        canApplyAutomatically: fix.canApplyAutomatically,
        applyId: fix.applyId ?? null,
        commands: fix.commands ?? {},
      })),
    })),
  };
  return JSON.stringify(payload, null, 2);
}
