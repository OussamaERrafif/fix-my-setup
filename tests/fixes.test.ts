import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FixRegistry } from '../src/fixes/registry.js';
import { builtinFixes } from '../src/fixes/builtin.js';
import { makeContext, makeFs } from './helpers.js';
import type { ApplicableFix } from '../src/types/index.js';

const cacheDir = join('/project', '.cache');

const noop: ApplicableFix = {
  id: 'test.noop',
  risk: 'safe',
  preview: async () => ['nothing'],
  apply: async () => ({ applied: true, message: 'done', changes: [] }),
};

describe('FixRegistry', () => {
  it('registers and resolves fixes', () => {
    const registry = new FixRegistry().register(noop);
    expect(registry.get('test.noop')).toBe(noop);
    expect(registry.has('missing')).toBe(false);
  });

  it('throws on duplicate fix ids', () => {
    const registry = new FixRegistry().register(noop);
    expect(() => registry.register(noop)).toThrow(/Duplicate fix id/);
  });
});

describe('builtin cache-dir fix', () => {
  const fix = builtinFixes.find((f) => f.id === 'node.create-local-cache-dir')!;

  it('previews the exact directory it would create without side effects', async () => {
    const ctx = makeContext({ cwd: '/project', fs: makeFs({}) });
    const preview = await fix.preview(ctx);
    expect(preview[0]).toContain('.cache');
  });

  it('is a no-op when the directory already exists', async () => {
    const ctx = makeContext({ cwd: '/project', fs: makeFs({}, [cacheDir]) });
    const result = await fix.apply(ctx);
    expect(result.applied).toBe(false);
  });

  let tempRoot: string | undefined;
  afterEach(() => {
    if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
    tempRoot = undefined;
  });

  it('creates the directory when missing', async () => {
    // Real temp cwd; the fake fs reports the dir as absent so apply proceeds.
    tempRoot = mkdtempSync(join(tmpdir(), 'fms-'));
    const ctx = makeContext({ cwd: tempRoot, fs: makeFs({}) });
    const result = await fix.apply(ctx);
    expect(result.applied).toBe(true);
    expect(existsSync(join(tempRoot, '.cache'))).toBe(true);
  });
});
