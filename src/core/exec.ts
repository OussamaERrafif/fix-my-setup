import { spawn } from 'node:child_process';
import { accessSync, constants, statSync } from 'node:fs';
import type { CommandResult, Platform, RunCommandOptions } from '../types/index.js';

/** Map Node's `process.platform` to our {@link Platform} union. */
export function detectPlatform(nodePlatform: NodeJS.Platform = process.platform): Platform {
  if (nodePlatform === 'win32') return 'windows';
  if (nodePlatform === 'darwin') return 'macos';
  return 'linux';
}

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Run an external command and capture its output without ever throwing.
 *
 * Errors (missing binary, timeout) are surfaced as `spawnError` / non-zero
 * codes rather than exceptions, so callers can treat diagnosis as data.
 */
export function runCommand(
  command: string,
  args: string[],
  options: RunCommandOptions = {},
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    let stdout = '';
    let stderr = '';
    let settled = false;

    const finish = (result: CommandResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    let child;
    try {
      const spawnable = resolveSpawnTarget(command, args);
      child = spawn(spawnable.file, spawnable.args, {
        cwd: options.cwd,
        // `shell: false` avoids injection; commands are fixed strings.
        shell: false,
        windowsHide: true,
        windowsVerbatimArguments: spawnable.windowsVerbatim,
      });
    } catch (error) {
      finish({ code: null, stdout: '', stderr: '', spawnError: errorMessage(error) });
      return;
    }

    const timer = setTimeout(() => {
      child.kill();
      finish({ code: null, stdout, stderr, spawnError: `Timed out after ${timeoutMs}ms` });
    }, timeoutMs);

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      finish({ code: null, stdout, stderr, spawnError: errorMessage(error) });
    });
    child.on('close', (code) => {
      finish({ code, stdout, stderr });
    });
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface SpawnTarget {
  file: string;
  args: string[];
  windowsVerbatim?: boolean;
}

/**
 * Resolve how to actually spawn a command on this platform.
 *
 * Windows `CreateProcess` (used when `shell: false`) only appends `.exe`, so
 * `.cmd`/`.bat` shims such as `npm`/`npx` are invisible to a bare `spawn`. We
 * resolve the real file via {@link which}; batch shims are executed through
 * `cmd.exe /d /s /c` with a hand-quoted command line and
 * `windowsVerbatimArguments` so paths and arguments containing spaces survive
 * cmd's parsing. Args are internal, fixed strings, so no untrusted shell
 * interpolation is involved. On POSIX the command is used as-is.
 */
function resolveSpawnTarget(command: string, args: string[]): SpawnTarget {
  if (detectPlatform() !== 'windows') return { file: command, args };
  const resolved = which(command);
  if (!resolved) return { file: command, args };
  if (/\.(cmd|bat)$/i.test(resolved)) {
    // Build: cmd /d /s /c ""resolved" "arg1" "arg2""  (outer quotes are
    // stripped by /s, leaving a properly-quoted command line for cmd).
    const quotedInner = [resolved, ...args].map(quoteForCmd).join(' ');
    return {
      file: process.env.ComSpec || 'cmd.exe',
      args: ['/d', '/s', '/c', `"${quotedInner}"`],
      windowsVerbatim: true,
    };
  }
  return { file: resolved, args };
}

/** Quote a single token for a cmd.exe command line. */
function quoteForCmd(token: string): string {
  return `"${token.replace(/"/g, '""')}"`;
}

/**
 * Resolve an executable on PATH by scanning PATH directories directly.
 *
 * This is deterministic and unit-testable (no reliance on `where`/`which`
 * being installed) and honors PATHEXT on Windows. The `pathValue` and
 * `pathExt` parameters are injectable so tests can exercise every platform.
 */
export function which(
  binary: string,
  platform: Platform = detectPlatform(),
  pathValue: string = process.env.PATH ?? '',
  pathExt: string = process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD',
): string | null {
  const sep = platform === 'windows' ? ';' : ':';
  const dirs = pathValue.split(sep).filter(Boolean);
  const extensions =
    platform === 'windows'
      ? // A bare name must resolve to an executable extension (.exe/.cmd/...),
        // never the extensionless Unix shim that also lives in the directory.
        hasKnownExtension(binary, pathExt)
        ? ['']
        : pathExt.split(';').filter(Boolean)
      : [''];

  for (const dir of dirs) {
    for (const ext of extensions) {
      const candidate = joinPath(dir, binary + ext, platform);
      if (isExecutableFile(candidate)) return candidate;
    }
  }
  return null;
}

/** Join a directory and file using the target platform's separator. */
function joinPath(dir: string, name: string, platform: Platform): string {
  const trimmed = dir.replace(/[\\/]+$/, '');
  return platform === 'windows' ? `${trimmed}\\${name}` : `${trimmed}/${name}`;
}

function hasKnownExtension(binary: string, pathExt: string): boolean {
  const lower = binary.toLowerCase();
  return pathExt
    .split(';')
    .filter(Boolean)
    .some((ext) => lower.endsWith(ext.toLowerCase()));
}

function isExecutableFile(path: string): boolean {
  try {
    if (!statSync(path).isFile()) return false;
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    // On Windows X_OK is not meaningful; existence as a file is enough.
    try {
      return statSync(path).isFile();
    } catch {
      return false;
    }
  }
}
