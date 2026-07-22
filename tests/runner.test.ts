import { describe, expect, it } from 'vitest';
import { DiagnosticRunner, countStatuses, selectExitCode } from '../src/core/diagnostic-runner.js';
import { PluginRegistry } from '../src/core/plugin-registry.js';
import type { DiagnosticPlugin, DiagnosticResult } from '../src/types/index.js';
import { makeContext } from './helpers.js';

function plugin(id: string, results: DiagnosticResult[]): DiagnosticPlugin {
  return { id, name: id, category: id, detect: async () => results };
}

const okResult: DiagnosticResult = { id: 'a.ok', name: 'ok', status: 'success', message: 'ok' };
const warnResult: DiagnosticResult = { id: 'b.w', name: 'w', status: 'warning', message: 'w' };
const errResult: DiagnosticResult = { id: 'c.e', name: 'e', status: 'error', message: 'e' };

describe('selectExitCode', () => {
  it('prioritizes errors, then warnings, then clean', () => {
    expect(selectExitCode(countStatuses([okResult]))).toBe(0);
    expect(selectExitCode(countStatuses([okResult, warnResult]))).toBe(1);
    expect(selectExitCode(countStatuses([warnResult, errResult]))).toBe(2);
  });
});

describe('countStatuses', () => {
  it('tallies each status', () => {
    expect(countStatuses([okResult, okResult, warnResult, errResult])).toEqual({
      success: 2,
      warning: 1,
      error: 1,
      info: 0,
    });
  });
});

describe('DiagnosticRunner', () => {
  it('aggregates results and computes the exit code', async () => {
    const registry = new PluginRegistry().registerAll([
      plugin('a', [okResult]),
      plugin('b', [warnResult]),
    ]);
    const summary = await new DiagnosticRunner(registry).run(makeContext());
    expect(summary.results).toHaveLength(2);
    expect(summary.exitCode).toBe(1);
  });

  it('isolates a throwing plugin and keeps running others', async () => {
    const throwing: DiagnosticPlugin = {
      id: 'boom',
      name: 'boom',
      category: 'boom',
      detect: async () => {
        throw new Error('kaboom');
      },
    };
    const registry = new PluginRegistry().registerAll([throwing, plugin('a', [okResult])]);
    const summary = await new DiagnosticRunner(registry).run(makeContext());

    const failure = summary.results.find((r) => r.id.startsWith('boom'));
    expect(failure?.status).toBe('error');
    expect(failure?.message).toContain('kaboom');
    // The healthy plugin still ran.
    expect(summary.results.some((r) => r.id === 'a.ok')).toBe(true);
    expect(summary.exitCode).toBe(2);
  });

  it('fires progress events per plugin', async () => {
    const registry = new PluginRegistry().registerAll([plugin('a', [okResult])]);
    const started: string[] = [];
    await new DiagnosticRunner(registry).run(makeContext(), {
      onPluginStart: (name) => started.push(name),
    });
    expect(started).toEqual(['a']);
  });
});
