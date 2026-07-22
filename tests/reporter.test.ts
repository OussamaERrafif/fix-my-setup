import { describe, expect, it } from 'vitest';
import { buildReport } from '../src/core/reporter.js';
import { makeContext } from './helpers.js';
import type { RunSummary } from '../src/types/index.js';

describe('buildReport', () => {
  const context = makeContext({
    platform: 'linux',
    cwd: '/home/dev/app',
    homeDir: '/home/dev',
    options: { category: 'Node.js', network: false },
  });

  const summary: RunSummary = {
    results: [
      {
        id: 'node.node-modules',
        name: 'deps',
        status: 'error',
        message: 'missing in /home/dev/app/node_modules',
        details: ['see /home/dev/app for details'],
        suggestedFixes: [
          { title: 'x', explanation: 'y', risk: 'safe', canApplyAutomatically: false },
        ],
      },
    ],
    counts: { success: 0, warning: 0, error: 1, info: 0 },
    exitCode: 2,
    durationMs: 10,
  };

  it('sanitizes paths in messages and details', () => {
    const report = buildReport(context, summary);
    expect(report.results[0]?.message).toBe('missing in <PROJECT>/node_modules');
    expect(report.results[0]?.details?.[0]).toBe('see <PROJECT> for details');
  });

  it('drops suggested fixes and includes filters/system metadata', () => {
    const report = buildReport(context, summary);
    expect(report.results[0]).not.toHaveProperty('suggestedFixes');
    expect(report.filters.mode).toBe('diagnose');
    expect(report.filters.category).toBe('Node.js');
    expect(report.system.platform).toBe('linux');
    expect(report.counts.error).toBe(1);
  });

  it('never leaks the raw home path', () => {
    const report = buildReport(context, summary);
    expect(JSON.stringify(report)).not.toContain('/home/dev');
  });
});
