import { describe, expect, it } from 'vitest';
import { runDoctor } from '../src/cli/run.js';
import { makeOptions } from './helpers.js';

/**
 * Integration-style tests for the runDoctor pipeline. They exercise the real
 * System plugin (stable, info-only) with output captured via injected sinks.
 */
describe('runDoctor', () => {
  it('emits deterministic JSON and a clean exit for the System category', async () => {
    const lines: string[] = [];
    const outcome = await runDoctor(
      makeOptions({ json: true, category: 'System', network: false }),
      (l) => lines.push(l),
    );
    const parsed = JSON.parse(lines.join('\n'));
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.results.every((r: { id: string }) => r.id.startsWith('system'))).toBe(true);
    expect(outcome.exitCode).toBe(0);
  });

  it('restricts output to the requested category', async () => {
    const lines: string[] = [];
    await runDoctor(makeOptions({ category: 'System', network: false }), (l) => lines.push(l));
    const text = lines.join('\n');
    expect(text).toContain('System');
    expect(text).not.toContain('Node.js detected');
  });

  it('returns exit code 3 for an unknown category', async () => {
    const errs: string[] = [];
    const outcome = await runDoctor(
      makeOptions({ category: 'Nope', network: false }),
      () => {},
      (l) => errs.push(l),
    );
    expect(outcome.exitCode).toBe(3);
    expect(errs.join('\n')).toContain('Unknown category');
  });

  it('is case-insensitive for category names', async () => {
    const outcome = await runDoctor(
      makeOptions({ json: true, category: 'system', network: false }),
      () => {},
    );
    expect(outcome.exitCode).toBe(0);
  });
});
