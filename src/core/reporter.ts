import { userInfo } from 'node:os';
import type { DiagnosticContext, DiagnosticResult, RunSummary } from '../types/index.js';
import { Sanitizer } from './sanitizer.js';

/** The shape of a shareable, anonymized diagnostic report. */
export interface DiagnosticReport {
  tool: { name: string; version: string };
  generatedAt: string;
  system: {
    platform: string;
    arch: string;
    nodeVersion: string;
  };
  filters: {
    category?: string;
    ports: number[];
    networkChecks: boolean;
    mode: 'safe' | 'apply' | 'diagnose';
  };
  /** Diagnostic results with all messages/details sanitized. */
  results: Array<Omit<DiagnosticResult, 'suggestedFixes'>>;
  counts: RunSummary['counts'];
}

const REPORT_VERSION = '0.1.0';

/**
 * Build an anonymized report from a run. All free-text fields pass through
 * the {@link Sanitizer}; suggested fixes (which can contain absolute paths)
 * are dropped entirely from the report.
 */
export function buildReport(context: DiagnosticContext, summary: RunSummary): DiagnosticReport {
  const sanitizer = new Sanitizer({
    homeDir: context.homeDir,
    projectDir: context.cwd,
    username: safeUsername(),
  });

  const results = summary.results.map((result) => ({
    id: result.id,
    name: sanitizer.sanitize(result.name),
    status: result.status,
    message: sanitizer.sanitize(result.message),
    details: result.details?.map((d) => sanitizer.sanitize(d)),
  }));

  return {
    tool: { name: 'fix-my-setup', version: REPORT_VERSION },
    generatedAt: new Date().toISOString(),
    system: {
      platform: context.platform,
      arch: process.arch,
      nodeVersion: process.version,
    },
    filters: {
      category: context.options.category,
      ports: context.options.ports,
      networkChecks: context.network,
      mode: context.options.apply ? 'apply' : context.options.safe ? 'safe' : 'diagnose',
    },
    results,
    counts: summary.counts,
  };
}

function safeUsername(): string | undefined {
  try {
    return userInfo().username;
  } catch {
    return undefined;
  }
}
