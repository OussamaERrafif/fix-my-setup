import { describe, expect, it } from 'vitest';
import { createColorizer, supportsColor } from '../src/output/colors.js';
import { statusSymbol, shouldUseAscii } from '../src/output/symbols.js';
import { formatJson } from '../src/output/json.js';
import type { RunSummary } from '../src/types/index.js';

describe('supportsColor', () => {
  it('honors NO_COLOR', () => {
    expect(supportsColor({ isTTY: true, env: { NO_COLOR: '1' } })).toBe(false);
  });
  it('honors FORCE_COLOR even without a TTY', () => {
    expect(supportsColor({ isTTY: false, env: { FORCE_COLOR: '1' } })).toBe(true);
  });
  it('disables color for non-TTY and TERM=dumb', () => {
    expect(supportsColor({ isTTY: false, env: {} })).toBe(false);
    expect(supportsColor({ isTTY: true, env: { TERM: 'dumb' } })).toBe(false);
  });
});

describe('createColorizer', () => {
  it('is an identity function when disabled', () => {
    const c = createColorizer(false);
    expect(c.red('x')).toBe('x');
  });
  it('wraps with ANSI codes when enabled', () => {
    const c = createColorizer(true);
    expect(c.green('x')).toContain('x');
    expect(c.green('x')).not.toBe('x');
  });
});

describe('symbols', () => {
  it('uses ascii fallbacks when requested', () => {
    expect(statusSymbol('success', { ascii: true })).toBe('[OK]');
    expect(statusSymbol('error', { ascii: false })).toBe('✗');
  });
  it('chooses ascii for non-utf locales', () => {
    expect(shouldUseAscii({ LANG: 'C' })).toBe(true);
    expect(shouldUseAscii({ LANG: 'en_US.UTF-8' })).toBe(false);
  });
});

describe('formatJson', () => {
  const summary: RunSummary = {
    results: [
      {
        id: 'a.ok',
        name: 'ok',
        status: 'success',
        message: 'all good',
      },
    ],
    counts: { success: 1, warning: 0, error: 0, info: 0 },
    exitCode: 0,
    durationMs: 42,
  };

  it('produces deterministic JSON without timing', () => {
    const a = formatJson(summary);
    const b = formatJson({ ...summary, durationMs: 999 });
    expect(a).toBe(b);
    const parsed = JSON.parse(a);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.results[0].details).toEqual([]);
  });
});
