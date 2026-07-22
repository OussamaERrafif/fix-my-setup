import type { DiagnosticContext } from '../types/index.js';

/** Extract the first semver-ish `x.y.z` (or `x.y`) token from text. */
export function parseVersion(text: string): string | null {
  const match = text.match(/\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z.-]+)?/);
  return match ? match[0] : null;
}

/** Compare two dotted numeric versions. Returns -1, 0, or 1. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

export interface ToolVersion {
  found: boolean;
  version: string | null;
  raw: string;
}

/**
 * Run `<binary> <...args>` (default `--version`) and extract a version string.
 * Never throws; a missing binary resolves to `{ found: false }`.
 */
export async function getToolVersion(
  context: DiagnosticContext,
  binary: string,
  args: string[] = ['--version'],
): Promise<ToolVersion> {
  const result = await context.runCommand(binary, args);
  if (result.spawnError || result.code === null) {
    return { found: false, version: null, raw: result.spawnError ?? '' };
  }
  // Some tools (java, python2) print version to stderr.
  const raw = (result.stdout + '\n' + result.stderr).trim();
  if (result.code !== 0 && !raw) {
    return { found: false, version: null, raw };
  }
  return { found: true, version: parseVersion(raw), raw };
}

/** Split a PATH string into its directory entries. */
export function parsePath(pathValue: string | undefined, platform: string): string[] {
  if (!pathValue) return [];
  const delimiter = platform === 'windows' ? ';' : ':';
  return pathValue
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
}
