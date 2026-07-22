import type { DiagnosticResult, Platform, RunSummary, SuggestedFix } from '../types/index.js';
import type { Colorizer } from './colors.js';
import { colorizedSymbol, type SymbolOptions } from './symbols.js';

export interface FormatOptions extends SymbolOptions {
  colors: Colorizer;
  platform: Platform;
  verbose: boolean;
}

/**
 * Render a full run summary as human-readable, grouped terminal output.
 */
export function formatSummary(
  summary: RunSummary,
  results: DiagnosticResult[],
  categoriesById: Map<string, string>,
  options: FormatOptions,
): string {
  const { colors } = options;
  const lines: string[] = [];

  lines.push(colors.bold('Fix My Setup'));
  lines.push('');

  // Group results by category, preserving first-seen order.
  const groups = new Map<string, DiagnosticResult[]>();
  for (const result of results) {
    const category = categoriesById.get(result.id) ?? 'General';
    const bucket = groups.get(category) ?? [];
    bucket.push(result);
    groups.set(category, bucket);
  }

  for (const [category, groupResults] of groups) {
    lines.push(colors.cyan(colors.bold(category)));
    for (const result of groupResults) {
      lines.push(formatResultLine(result, options));
      if (options.verbose && result.details) {
        for (const detail of result.details) {
          lines.push('    ' + colors.dim(detail));
        }
      }
    }
    lines.push('');
  }

  const fixesBlock = formatFixes(results, options);
  if (fixesBlock) {
    lines.push(fixesBlock);
    lines.push('');
  }

  lines.push(formatCountsLine(summary, colors));
  return lines.join('\n');
}

/** One line for a single diagnostic result. */
export function formatResultLine(result: DiagnosticResult, options: FormatOptions): string {
  const symbol = colorizedSymbol(result.status, options.colors, options);
  return `${symbol} ${result.message}`;
}

function formatFixes(results: DiagnosticResult[], options: FormatOptions): string | null {
  const withFixes = results.filter((r) => r.suggestedFixes && r.suggestedFixes.length > 0);
  if (withFixes.length === 0) return null;

  const { colors } = options;
  const lines: string[] = [colors.bold('Suggested fixes:'), ''];
  let index = 1;

  for (const result of withFixes) {
    for (const fix of result.suggestedFixes ?? []) {
      lines.push(`${colors.bold(String(index) + '.')} ${fix.title} ${riskBadge(fix, colors)}`);
      if (fix.explanation) lines.push('   ' + colors.dim(fix.explanation));
      const commands = fix.commands?.[options.platform];
      if (commands) {
        for (const command of commands) {
          lines.push('   ' + colors.cyan('$ ' + command));
        }
      }
      lines.push('');
      index += 1;
    }
  }
  // Drop the trailing blank line for a tidy block.
  if (lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n');
}

function riskBadge(fix: SuggestedFix, colors: Colorizer): string {
  if (fix.canApplyAutomatically) return colors.green('(auto-fixable)');
  if (fix.risk === 'caution') return colors.yellow('(caution)');
  if (fix.risk === 'manual') return colors.gray('(manual)');
  return colors.gray('(safe)');
}

function formatCountsLine(summary: RunSummary, colors: Colorizer): string {
  const { counts } = summary;
  const parts = [
    colors.green(`${counts.success} ok`),
    colors.yellow(`${counts.warning} warning${counts.warning === 1 ? '' : 's'}`),
    colors.red(`${counts.error} error${counts.error === 1 ? '' : 's'}`),
  ];
  return colors.dim(`Summary: `) + parts.join(colors.dim(' · '));
}
