import type * as NodeFs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { detectPlatform, which } from '../src/core/exec.js';
import { parsePath } from '../src/plugins/util.js';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof NodeFs>();
  // Pretend a fixed set of paths are executable files.
  const executables = new Set([
    '/usr/bin/node',
    '/usr/local/bin/git',
    'C:\\tools\\npm.CMD',
    'C:\\tools\\node.EXE',
  ]);
  return {
    ...actual,
    statSync: (p: string) => {
      if (executables.has(p)) return { isFile: () => true, isDirectory: () => false };
      throw new Error('ENOENT');
    },
    accessSync: (p: string) => {
      if (!executables.has(p)) throw new Error('EACCES');
    },
  };
});

describe('detectPlatform', () => {
  it('maps node platforms to our union', () => {
    expect(detectPlatform('win32')).toBe('windows');
    expect(detectPlatform('darwin')).toBe('macos');
    expect(detectPlatform('linux')).toBe('linux');
    expect(detectPlatform('freebsd')).toBe('linux');
  });
});

describe('which (PATH resolution)', () => {
  it('finds a POSIX executable across PATH entries', () => {
    expect(which('git', 'linux', '/usr/bin:/usr/local/bin')).toBe('/usr/local/bin/git');
    expect(which('node', 'linux', '/usr/bin:/usr/local/bin')).toBe('/usr/bin/node');
  });

  it('returns null when not found', () => {
    expect(which('python', 'linux', '/usr/bin')).toBeNull();
  });

  it('applies PATHEXT on Windows for bare names', () => {
    expect(which('npm', 'windows', 'C:\\tools', '.EXE;.CMD')).toBe('C:\\tools\\npm.CMD');
    expect(which('node', 'windows', 'C:\\tools', '.EXE;.CMD')).toBe('C:\\tools\\node.EXE');
  });
});

describe('parsePath', () => {
  it('splits on the platform delimiter', () => {
    expect(parsePath('/a:/b:/c', 'linux')).toEqual(['/a', '/b', '/c']);
    expect(parsePath('C:\\a;C:\\b', 'windows')).toEqual(['C:\\a', 'C:\\b']);
  });

  it('trims and drops empty entries', () => {
    expect(parsePath(' /a : : /b ', 'linux')).toEqual(['/a', '/b']);
    expect(parsePath(undefined, 'linux')).toEqual([]);
  });
});
