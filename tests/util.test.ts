import { describe, expect, it } from 'vitest';
import { compareVersions, getToolVersion, parseVersion } from '../src/plugins/util.js';
import { makeContext } from './helpers.js';

describe('parseVersion', () => {
  it('extracts a version from noisy output', () => {
    expect(parseVersion('v22.14.0')).toBe('22.14.0');
    expect(parseVersion('Python 3.13.1')).toBe('3.13.1');
    expect(parseVersion('git version 2.50.1.windows.1')).toBe('2.50.1');
    expect(parseVersion('no version here')).toBeNull();
  });
});

describe('compareVersions', () => {
  it('orders versions numerically', () => {
    expect(compareVersions('22.0.0', '18.0.0')).toBe(1);
    expect(compareVersions('1.2.0', '1.2.0')).toBe(0);
    expect(compareVersions('1.2', '1.10')).toBe(-1);
  });
});

describe('getToolVersion', () => {
  it('reports not found when the binary is missing', async () => {
    const version = await getToolVersion(makeContext(), 'nope');
    expect(version.found).toBe(false);
  });

  it('reads a version from stdout', async () => {
    const ctx = makeContext({ commands: { 'node --version': { stdout: 'v20.1.0' } } });
    const version = await getToolVersion(ctx, 'node');
    expect(version).toMatchObject({ found: true, version: '20.1.0' });
  });

  it('reads a version printed to stderr (e.g. java)', async () => {
    const ctx = makeContext({
      commands: { 'java -version': { stderr: 'openjdk version "21.0.8"' } },
    });
    const version = await getToolVersion(ctx, 'java', ['-version']);
    expect(version).toMatchObject({ found: true, version: '21.0.8' });
  });
});
